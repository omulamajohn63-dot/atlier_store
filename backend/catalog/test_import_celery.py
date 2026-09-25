"""The Celery driver around bulk imports.

The import engine itself is untouched by the Celery upgrade — every upsert,
validation rule and idempotent ``next_index`` skip is still the code exercised
by ``catalog.test_bulk_import``. What these tests pin down is the *driver*:
who calls ``process_chunk``, what happens when a job is duplicated, cancelled
mid-flight or blown up, and that the no-worker fallback still does the work.
"""

import io
import tempfile
import zipfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from openpyxl import Workbook
from PIL import Image

from audit.models import AuditLog
from emails.models import EmailLog

from catalog.bulk_import import (
    BulkImportError,
    BulkImportExecutionService,
    BulkProductImportService,
)
from catalog.models import ImportJob, Product
from catalog.tasks import enqueue_import_job, process_import_job

HEADERS = [
    'product_code', 'name', 'description', 'tagline', 'category',
    'status', 'color', 'color_hex', 'size', 'sku', 'price', 'stock',
    'image_1', 'image_2', 'image_3', 'image_4',
]

ROWS = [
    {'product_code': 'LSD001', 'name': 'Luna Silk Dress',
     'description': 'Silk dress', 'category': 'Dresses', 'color': 'Black',
     'color_hex': '#000000', 'size': 'S', 'sku': 'LSD-BLK-S',
     'price': '4500', 'stock': '5', 'image_1': 'luna.jpg'},
    {'product_code': 'LSD001', 'name': 'Luna Silk Dress',
     'description': 'Silk dress', 'category': 'Dresses', 'color': 'Black',
     'color_hex': '#000000', 'size': 'M', 'sku': 'LSD-BLK-M',
     'price': '4500', 'stock': '7', 'image_1': 'luna.jpg'},
]


def package_bytes(rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Products'
    sheet.append(HEADERS)
    for row in rows:
        sheet.append([row.get(header, '') for header in HEADERS])
    excel = io.BytesIO()
    workbook.save(excel)

    image = io.BytesIO()
    Image.new('RGB', (20, 20), (10, 20, 30)).save(image, format='JPEG')

    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('products.xlsx', excel.getvalue())
        archive.writestr('images/luna.jpg', image.getvalue())
    return output.getvalue()


class CeleryImportTaskTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='importer', password='password', is_staff=True)
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.storage = FileSystemStorage(location=self._tmp.name)
        patcher = patch('catalog.bulk_import.default_storage', self.storage)
        patcher.start()
        self.addCleanup(patcher.stop)

    def ready_job(self, rows=None):
        upload = io.BytesIO(package_bytes(rows or ROWS))
        package = SimpleUploadedFile(
            'MODEZA_IMPORT.zip', upload.getvalue(),
            content_type='application/zip')
        job = BulkProductImportService.create_job(
            package, self.user, import_status='DRAFT')
        job = BulkProductImportService.validate(job, actor=self.user)
        return BulkProductImportService.confirm(job, actor=self.user)

    def run_task(self, job):
        """Deliver the task inside a captured commit.

        Audit rows and email dispatches are correctly deferred to
        ``transaction.on_commit``; in a ``TestCase`` nothing commits, so the
        callbacks have to be flushed explicitly to be observable.
        """
        with self.captureOnCommitCallbacks(execute=True):
            return process_import_job.delay(
                str(job.pk), str(self.user.pk)).get()

    def test_task_drives_a_confirmed_job_to_completion(self):
        job = self.ready_job()

        result = self.run_task(job)

        job.refresh_from_db()
        self.assertEqual(result['status'], ImportJob.Status.COMPLETED)
        self.assertEqual(job.status, ImportJob.Status.COMPLETED)
        self.assertEqual(job.created_products, 1)
        self.assertEqual(job.created_variants, 2)
        self.assertTrue(Product.objects.filter(product_code='LSD001').exists())
        self.assertEqual(
            EmailLog.objects.filter(email_type='bulk_import_completed').count(),
            1)

    def test_a_second_delivery_of_the_same_job_changes_nothing(self):
        job = self.ready_job()
        self.run_task(job)

        second = self.run_task(job)

        job.refresh_from_db()
        self.assertEqual(second['status'], ImportJob.Status.COMPLETED)
        self.assertEqual(job.created_products, 1)
        # The completion email is keyed on the job, so a redelivery cannot
        # email the operator twice.
        self.assertEqual(
            EmailLog.objects.filter(email_type='bulk_import_completed').count(),
            1)
        self.assertEqual(
            EmailLog.objects.get(
                email_type='bulk_import_completed').status,
            EmailLog.Status.SENT)

    def test_task_leaves_a_cancelled_job_untouched(self):
        job = self.ready_job()
        BulkProductImportService.cancel(job, actor=self.user)

        result = self.run_task(job)

        job.refresh_from_db()
        self.assertEqual(result['status'], ImportJob.Status.CANCELLED)
        self.assertEqual(job.status, ImportJob.Status.CANCELLED)
        self.assertEqual(Product.objects.count(), 0)

    def test_task_failure_marks_the_job_failed_and_notifies_the_operator(self):
        job = self.ready_job()

        with patch.object(BulkImportExecutionService, 'process_chunk',
                          side_effect=BulkImportError('Workbook was rejected')):
            result = self.run_task(job)

        job.refresh_from_db()
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(job.status, ImportJob.Status.FAILED)
        self.assertTrue(AuditLog.objects.filter(
            action='bulk_import_failed', object_id=str(job.pk)).exists())
        self.assertEqual(
            EmailLog.objects.filter(email_type='bulk_import_failed').count(), 1)

    def test_a_processing_job_can_be_cancelled_cooperatively(self):
        job = self.ready_job()
        self.assertEqual(job.status, ImportJob.Status.PROCESSING)

        BulkProductImportService.cancel(job, actor=self.user)

        job.refresh_from_db()
        self.assertEqual(job.status, ImportJob.Status.CANCELLED)
        self.assertIsNotNone(job.cancelled_at)
        self.assertIsNone(job.processing_token)

    @override_settings(CELERY_WORKER_ENABLED=False)
    def test_no_worker_falls_back_to_running_the_job_inline(self):
        job = self.ready_job()

        with self.captureOnCommitCallbacks(execute=True):
            enqueue_import_job(str(job.pk), str(self.user.pk))

        job.refresh_from_db()
        self.assertEqual(job.status, ImportJob.Status.COMPLETED)
        self.assertEqual(
            EmailLog.objects.filter(email_type='bulk_import_completed').count(),
            1)
        self.assertEqual(
            EmailLog.objects.get(
                email_type='bulk_import_completed').status,
            EmailLog.Status.SENT)

    @override_settings(CELERY_WORKER_ENABLED=True)
    def test_worker_mode_defers_until_the_transaction_commits(self):
        job = self.ready_job()
        self.assertEqual(job.status, ImportJob.Status.PROCESSING)

        with self.captureOnCommitCallbacks(execute=True):
            enqueue_import_job(str(job.pk), str(self.user.pk))

        job.refresh_from_db()
        self.assertEqual(job.status, ImportJob.Status.COMPLETED)
