from datetime import datetime, timedelta, timezone

import jwt
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(
    SUPABASE_JWT_SECRET='test-secret-that-is-at-least-32-bytes',
    SUPABASE_JWT_ISSUER='',
)
class SupabaseAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def token(self, role='customer', subject='user-123'):
        now = datetime.now(timezone.utc)
        return jwt.encode({
            'sub': subject,
            'email': f'{subject}@example.com',
            'aud': 'authenticated',
            'iat': now,
            'exp': now + timedelta(minutes=5),
            'app_metadata': {'role': role},
        }, 'test-secret-that-is-at-least-32-bytes', algorithm='HS256')

    def auth(self, role='customer', subject='user-123'):
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {self.token(role, subject)}')

    def test_valid_token_resolves_current_user_and_role(self):
        self.auth('customer')

        response = self.client.get('/api/auth/me')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], 'customer')

    def test_customer_is_denied_staff_route(self):
        self.auth('customer')

        response = self.client.get('/api/admin/access')

        self.assertEqual(response.status_code, 403)

    def test_staff_can_access_staff_route_but_not_admin_route(self):
        self.auth('staff')

        self.assertEqual(self.client.get('/api/admin/access').status_code, 200)
        self.assertEqual(self.client.get(
            '/api/admin/owner-access').status_code, 403)

    def test_admin_can_access_both_protected_routes(self):
        self.auth('admin')

        self.assertEqual(self.client.get('/api/admin/access').status_code, 200)
        self.assertEqual(self.client.get(
            '/api/admin/owner-access').status_code, 200)

    def test_staff_role_syncs_to_local_user_without_customer_status(self):
        self.auth('staff', subject='staff-user')

        response = self.client.get('/api/auth/me')

        self.assertEqual(response.status_code, 200)
        user = response.wsgi_request.user
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_customer_role_is_not_local_staff(self):
        self.auth('customer', subject='customer-user')

        response = self.client.get('/api/auth/me')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.wsgi_request.user.is_staff)

    def test_invalid_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')

        response = self.client.get('/api/auth/me')

        self.assertEqual(response.status_code, 401)
