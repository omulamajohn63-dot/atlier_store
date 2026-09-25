import io
import tempfile
import zipfile
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from openpyxl import Workbook
from rest_framework.test import APIClient

from access_control.models import Permission, StaffProfile
from catalog.models import Category


@override_settings(
    SUPABASE_JWT_SECRET='test-secret-that-is-at-least-32-bytes',
    SUPABASE_JWT_ISSUER='',
)
class BulkImportAdminApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='Dresses', slug='dresses')

    def authenticate(self, role='staff'):
        now = datetime.now(timezone.utc)
        token = jwt.encode({
            'sub': f'{role}-bulk-user',
            'email': f'{role}-bulk@example.com',
            'aud': 'authenticated',
            'iat': now,
            'exp': now + timedelta(minutes=5),
            'app_metadata': {'role': role},
        }, 'test-secret-that-is-at-least-32-bytes', algorithm='HS256')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def enroll(self, codes):
        user, _ = get_user_model().objects.get_or_create(
            username='supabase_staff-bulk-user',
            defaults={'email': 'staff-bulk@example.com', 'is_staff': True, 'is_active': True},
        )
        user.is_staff = True
        user.is_active = True
        user.save(update_fields=['is_staff', 'is_active'])
        profile, _ = StaffProfile.objects.get_or_create(user=user)
        profile.status = StaffProfile.Status.ACTIVE
        profile.save(update_fields=['status'])
        profile.direct_permissions.set([Permission.objects.get(code=code) for code in codes])
        return user

    def package(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'Products'
        sheet.append([
            'product_code', 'name', 'description', 'tagline', 'category',
            'status', 'color', 'color_hex', 'size', 'sku', 'price', 'stock',
            'image_1', 'image_2', 'image_3', 'image_4',
        ])
        sheet.append([
            'LSD001', 'Luna Silk Dress', 'Silk dress', '', 'Dresses', 'DRAFT',
            'Black', '#000000', 'S', 'LSD-BLK-S', '4500', 5, '', '', '', '',
        ])
        workbook_data = io.BytesIO()
        workbook.save(workbook_data)
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as archive:
            archive.writestr('products.xlsx', workbook_data.getvalue())
            archive.writestr('images/.keep', b'not-an-image')
        return output.getvalue()

    def test_unauthorized_user_cannot_upload(self):
        self.authenticate('customer')
        response = self.client.post(
            '/api/admin/bulk-import/upload',
            {'file': SimpleUploadedFile('import.zip', b'not a zip')},
            format='multipart',
        )
        self.assertEqual(response.status_code, 403)

    def test_authorized_staff_can_upload_validate_and_preview(self):
        self.authenticate()
        self.enroll(['products.import'])
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        storage = FileSystemStorage(location=temporary.name)
        with patch('catalog.bulk_import.default_storage', storage):
            upload = self.client.post(
                '/api/admin/bulk-import/upload',
                {
                    'file': SimpleUploadedFile('MODEZA_IMPORT.zip', self.package(), content_type='application/zip'),
                    'import_status': 'DRAFT',
                },
                format='multipart',
            )
            self.assertEqual(upload.status_code, 201)
            job_id = upload.json()['id']
            validated = self.client.post(f'/api/admin/bulk-import/{job_id}/validate', {}, format='json')
            self.assertEqual(validated.status_code, 200)
            self.assertEqual(validated.json()['status'], 'READY')
            preview = self.client.get(f'/api/admin/bulk-import/{job_id}/preview')
            self.assertEqual(preview.status_code, 200)
            self.assertEqual(preview.json()['preview']['summary']['products'], 1)

    def test_import_page_multipart_actions_are_accepted(self):
        """Regression: the admin import page posts multipart/form-data bodies
        (empty FormData + a limit field), but the API default parser is
        JSON-only — validate/confirm/process/cancel used to return 415."""
        self.authenticate()
        self.enroll(['products.import'])
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        storage = FileSystemStorage(location=temporary.name)
        with patch('catalog.bulk_import.default_storage', storage):
            upload = self.client.post(
                '/api/admin/bulk-import/upload',
                {
                    'file': SimpleUploadedFile('MODEZA_IMPORT.zip', self.package(), content_type='application/zip'),
                    'import_status': 'DRAFT',
                },
                format='multipart',
            )
            self.assertEqual(upload.status_code, 201)
            job_id = upload.json()['id']

            validated = self.client.post(
                f'/api/admin/bulk-import/{job_id}/validate', {}, format='multipart')
            self.assertEqual(validated.status_code, 200)
            self.assertEqual(validated.json()['status'], 'READY')

            started = self.client.post(
                f'/api/admin/bulk-import/{job_id}/confirm', {}, format='multipart')
            self.assertEqual(started.status_code, 202)

            processed = self.client.post(
                f'/api/admin/bulk-import/{job_id}/process', {'limit': '10'}, format='multipart')
            self.assertEqual(processed.status_code, 200)
            payload = processed.json()
            self.assertTrue(payload['finished'])
            self.assertIn(payload['status'], ('COMPLETED', 'COMPLETED_WITH_ERRORS'))

    def test_cancel_accepts_multipart(self):
        self.authenticate()
        self.enroll(['products.import'])
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        storage = FileSystemStorage(location=temporary.name)
        with patch('catalog.bulk_import.default_storage', storage):
            upload = self.client.post(
                '/api/admin/bulk-import/upload',
                {'file': SimpleUploadedFile('MODEZA_IMPORT.zip', self.package(), content_type='application/zip')},
                format='multipart',
            )
            self.assertEqual(upload.status_code, 201)
            cancelled = self.client.post(
                f"/api/admin/bulk-import/{upload.json()['id']}/cancel", {}, format='multipart')
            self.assertEqual(cancelled.status_code, 200)
            self.assertEqual(cancelled.json()['status'], 'CANCELLED')

    def test_template_is_xlsx(self):
        self.authenticate()
        self.enroll(['products.import'])
        response = self.client.get('/api/admin/bulk-import/template')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        self.assertIn('.xlsx', response['Content-Disposition'])
