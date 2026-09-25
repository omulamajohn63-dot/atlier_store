from django.contrib.auth import get_user_model
from django.test import TestCase

from catalog.models import ImportJob


class BulkImportAdminPageTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username='bulk-page-admin', password='password', email='bulk-page@example.com')

    def test_bulk_import_page_renders(self):
        self.client.force_login(self.user)
        response = self.client.get('/admin/dashboard/products/import/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Bulk Product Import')
        self.assertContains(response, 'Download Template')

    def test_bulk_import_history_and_template_routes_render(self):
        self.client.force_login(self.user)
        history = self.client.get('/admin/dashboard/products/import/history/')
        template = self.client.get('/admin/dashboard/products/import/download-template/')
        self.assertEqual(history.status_code, 200)
        self.assertEqual(template.status_code, 200)
        self.assertEqual(template['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    def test_progress_page_renders_for_processing_job(self):
        job = ImportJob.objects.create(
            filename='package.zip',
            status=ImportJob.Status.PROCESSING,
            uploaded_by=self.user,
            total_rows=40,
            processed_rows=10,
        )
        self.client.force_login(self.user)
        response = self.client.get(f'/admin/dashboard/products/import/{job.pk}/progress/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Import Progress')
        self.assertContains(response, 'package.zip')
        self.assertContains(response, '10 / 40 rows')
        self.assertContains(response, '25%')
        self.assertContains(response, 'initial-job')

    def test_progress_page_context_flags(self):
        job = ImportJob.objects.create(
            filename='processing.zip',
            status=ImportJob.Status.PROCESSING,
            uploaded_by=self.user,
            total_rows=10,
        )
        self.client.force_login(self.user)
        response = self.client.get(f'/admin/dashboard/products/import/{job.pk}/progress/')
        self.assertFalse(response.context['is_terminal'])
        self.assertFalse(response.context['can_start'])
        self.assertEqual(response.context['status_class'], 'status-warning')
        self.assertEqual(response.context['report_url'], '')

    def test_progress_page_offers_start_for_ready_job(self):
        job = ImportJob.objects.create(
            filename='ready.zip',
            status=ImportJob.Status.READY,
            uploaded_by=self.user,
            total_rows=10,
        )
        self.client.force_login(self.user)
        response = self.client.get(f'/admin/dashboard/products/import/{job.pk}/progress/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['can_start'])
        self.assertFalse(response.context['is_terminal'])
        self.assertContains(response, 'Start Import')

    def test_progress_page_shows_report_for_completed_job(self):
        job = ImportJob.objects.create(
            filename='done.zip',
            status=ImportJob.Status.COMPLETED,
            uploaded_by=self.user,
            total_rows=10,
            processed_rows=10,
        )
        self.client.force_login(self.user)
        response = self.client.get(f'/admin/dashboard/products/import/{job.pk}/progress/')
        self.assertTrue(response.context['is_terminal'])
        self.assertEqual(response.context['status_class'], 'status-success')
        self.assertIn(f'/admin/dashboard/products/import/{job.pk}/report/',
                      response.context['report_url'])
        self.assertContains(response, 'Import completed')

    def test_progress_page_redirects_when_job_is_missing(self):
        self.client.force_login(self.user)
        response = self.client.get(
            '/admin/dashboard/products/import/00000000-0000-0000-0000-000000000000/progress/')
        self.assertRedirects(response, '/admin/dashboard/products/import/history/')

    def test_progress_page_requires_login(self):
        response = self.client.get(
            '/admin/dashboard/products/import/00000000-0000-0000-0000-000000000000/progress/')
        self.assertEqual(response.status_code, 302)
