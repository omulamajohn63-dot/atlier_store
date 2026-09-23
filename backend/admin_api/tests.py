from datetime import datetime, timedelta, timezone

import jwt
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from access_control.models import Permission, StaffProfile
from catalog.models import Category, Product, ProductVariant

User = get_user_model()


@override_settings(
    SUPABASE_JWT_SECRET='test-secret-that-is-at-least-32-bytes',
    SUPABASE_JWT_ISSUER='',
)
class AdminApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(
            name='Admin Category', slug='admin-category')
        self.product = Product.objects.create(category=self.category, name='Admin Product', slug='admin-product',
                                              description='A product created for admin API testing.', price_minor=10000, status=Product.Status.ACTIVE)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='ADMIN-ONE', stock_quantity=3)

    def auth(self, role):
        now = datetime.now(timezone.utc)
        token = jwt.encode({'sub': f'{role}-user', 'email': f'{role}@example.com', 'aud': 'authenticated', 'iat': now, 'exp': now +
                           timedelta(minutes=5), 'app_metadata': {'role': role}}, 'test-secret-that-is-at-least-32-bytes', algorithm='HS256')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def enroll(self, sub, codes=(), active=True):
        """Mirror the JWT sync, then give the operator an explicit in-DB
        enroll in access_control (the only way staff get privileges)."""
        user, _ = User.objects.get_or_create(
            username=f'supabase_{sub}',
            defaults={'email': f'{sub}@example.com',
                      'is_staff': True, 'is_active': True},
        )
        user.is_staff = True
        user.is_active = active
        user.save(update_fields=['is_staff', 'is_active'])
        profile, _ = StaffProfile.objects.get_or_create(user=user)
        profile.status = StaffProfile.Status.ACTIVE if active else StaffProfile.Status.INACTIVE
        profile.save(update_fields=['status'])
        profile.direct_permissions.set(
            [Permission.objects.get(code=c) for c in codes])
        return user

    def test_staff_can_adjust_stock(self):
        self.auth('staff')
        self.enroll('staff-user', ['inventory.adjust'])
        response = self.client.patch(
            f'/api/admin/inventory/{self.variant.id}', {'delta': 2, 'reason': 'restock'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['stockQuantity'], 5)

    def test_customer_cannot_create_product(self):
        self.auth('customer')
        response = self.client.post('/api/admin/products', {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_archive_product(self):
        self.auth('admin')
        self.enroll('admin-user', ['products.update'])
        response = self.client.post(
            f'/api/admin/products/{self.product.id}/archive')
        self.assertEqual(response.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.status, Product.Status.ARCHIVED)

    def test_enrolled_staff_without_permission_cannot_create_product(self):
        self.auth('staff')
        self.enroll('staff-user', ['inventory.adjust'])
        response = self.client.post('/api/admin/products', {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_staff_not_enrolled_cannot_adjust_stock(self):
        # Supabase 'staff' role alone is not enough: explicit in-DB
        # enrollment + permission is required.
        self.auth('staff')
        response = self.client.patch(
            f'/api/admin/inventory/{self.variant.id}', {'delta': 2, 'reason': 'restock'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_deactivated_staff_is_blocked(self):
        self.auth('staff')
        self.enroll('staff-user', ['inventory.adjust'], active=False)
        response = self.client.patch(
            f'/api/admin/inventory/{self.variant.id}', {'delta': 2, 'reason': 'restock'}, format='json')
        self.assertEqual(response.status_code, 403)
