from django.contrib.auth import get_user_model
from django.test import TestCase


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
