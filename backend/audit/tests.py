"""Audit trail tests for the Modeza storefront backend.

Covers, end to end, the pieces that make up the audit budget:

* the health probe running through the middleware stack (request correlation
  is verified end-to-end via the error envelope and audit rows, which are
  populated while the request context is still active),
* the AuditLogService writer itself (defaults, sanitization, actor resolution,
  unknown-action coercion and anonymous writes),
* the client event endpoint (POST /api/audit/events), including whitelist
  enforcement and sanitization,
* API error audits produced by ``botique_backend.exceptions.api_exception_handler``
  (401 -> login_failed, 403 -> permission_denied; 404 is NOT audited),
* checkout audits for both successful orders and empty-cart failures,
* the staff inventory restock audit, and
* the payment webhook security audit for an invalid signature.

The audit service defers its writes with ``transaction.on_commit`` when it is
inside an atomic block (which a ``django.test.TestCase`` always is), so every
test that triggers audit writes wraps those calls in Django's official
``captureOnCommitCallbacks(execute=True)`` helper to flush the pending callbacks
before asserting on rows.
"""

import re
from datetime import datetime, timedelta, timezone as dt_timezone

import jwt
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from audit.context import request_context
from audit.models import AuditLog
from audit.services import AuditLogService
from catalog.models import Category, Product, ProductVariant

from access_control.models import Permission, StaffProfile
from admin_ui.models import AdminNotification

TEST_SECRET = 'test-secret-that-is-at-least-32-bytes'
INBOUND_REQUEST_ID = 'test-inbound-request-id'


def enroll_staff(sub, codes=()):
    """Create the same user the JWT sync will look up and enroll it in
    access_control (mirrors backend/admin_api/tests.py)."""
    user, _ = get_user_model().objects.get_or_create(
        username=f'supabase_{sub}',
        defaults={'email': f'{sub}@example.com',
                  'is_staff': True, 'is_active': True},
    )
    user.is_staff = True
    user.is_active = True
    user.save(update_fields=['is_staff', 'is_active'])
    profile, _ = StaffProfile.objects.get_or_create(user=user)
    profile.status = StaffProfile.Status.ACTIVE
    profile.save(update_fields=['status'])
    profile.direct_permissions.set(
        [Permission.objects.get(code=c) for c in codes])
    return user


def auth_client(client, role):
    """Attach a Supabase-style HS256 JWT to ``client``, mirroring the helper
    in backend/admin_api/tests.py."""
    now = datetime.now(dt_timezone.utc)
    token = jwt.encode(
        {
            'sub': f'{role}-user',
            'email': f'{role}@example.com',
            'aud': 'authenticated',
            'iat': now,
            'exp': now + timedelta(minutes=5),
            'app_metadata': {'role': role},
        },
        TEST_SECRET,
        algorithm='HS256',
    )
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestHealthRequestId(TestCase):
    """The health probe runs through the RequestContextMiddleware stack. The
    middleware attaches an X-Request-ID header to the response; the actual
    generated/echoed value is asserted end-to-end in TestApiErrorAudits, where
    the exception handler reads it from the live request context."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_health_returns_ok(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_health_attaches_request_id_header(self):
        response = self.client.get('/api/health/')
        self.assertTrue(response.has_header('X-Request-ID'))


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestAuditLogService(TestCase):
    """The single audit writer: defaults, sanitization, actor/context
    resolution and unknown-action coercion."""

    def setUp(self):
        cache.clear()

    def test_log_persists_row_with_default_category_and_actor(self):
        user = get_user_model().objects.create_user(
            username='svc-actor', email='svc@example.com')
        with self.captureOnCommitCallbacks(execute=True):
            AuditLogService.log('status_change', actor=user, path='')
        row = AuditLog.objects.get(action='status_change')
        self.assertEqual(row.category, 'orders')
        self.assertEqual(row.actor_id, user.pk)
        self.assertEqual(row.result, 'success')

    def test_login_failed_defaults_to_medium_severity(self):
        with self.captureOnCommitCallbacks(execute=True):
            AuditLogService.log('login_failed', path='')
        row = AuditLog.objects.get(action='login_failed')
        self.assertEqual(row.severity, 'medium')
        self.assertEqual(row.category, 'auth')

    def test_metadata_is_sanitized_before_persistence(self):
        with self.captureOnCommitCallbacks(execute=True):
            AuditLogService.log(
                'update',
                metadata={
                    'password': 'hunter2',
                    'card_number': '4242',
                    'notes': 'ok',
                },
                path='',
            )
        row = AuditLog.objects.get(action='update')
        self.assertEqual(row.metadata['password'], '[REDACTED]')
        self.assertEqual(row.metadata['card_number'], '[REDACTED]')
        self.assertEqual(row.metadata['notes'], 'ok')

    def test_auto_derives_context_from_active_request(self):
        request = RequestFactory().get('/api/health/')
        request.META['REMOTE_ADDR'] = '203.0.113.7'
        with request_context(request), self.captureOnCommitCallbacks(execute=True):
            AuditLogService.log('login')
        row = AuditLog.objects.get(action='login')
        self.assertTrue(row.request_id.startswith('req_'))
        self.assertEqual(row.ip_address, '203.0.113.7')
        self.assertEqual(row.path, '/api/health/')

    def test_unknown_action_is_coerced_to_security_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            AuditLogService.log('totally_bogus_event', path='')
        row = AuditLog.objects.get(action='security_event')
        self.assertEqual(row.result, 'success')

    def test_anonymous_log_has_no_actor(self):
        with self.captureOnCommitCallbacks(execute=True):
            AuditLogService.log('login', path='')
        row = AuditLog.objects.get(action='login')
        self.assertIsNone(row.actor)
        self.assertEqual(row.actor_role, '')
        self.assertEqual(row.actor_email, '')


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestClientEventEndpoint(TestCase):
    """POST /api/audit/events: authentication, whitelist enforcement,
    sanitization and the 202 receipt envelope."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_unauthenticated_event_post_is_rejected(self):
        response = self.client.post('/api/audit/events', {}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_authenticated_client_event_is_audited(self):
        auth_client(self.client, 'customer')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/audit/events',
                {'event': 'checkout_started', 'category': 'orders',
                 'description': 'Cart review.'},
                format='json',
            )
        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertIs(body['received'], True)
        self.assertEqual(body['action'], 'checkout_started')
        self.assertTrue(body['request_id'])
        row = AuditLog.objects.get(action='checkout_started')
        self.assertEqual(row.category, 'orders')
        self.assertEqual(row.result, 'success')
        self.assertEqual(row.status_code, 202)
        self.assertEqual(row.actor.email, 'customer@example.com')

    def test_client_event_sanitizes_sensitive_data(self):
        auth_client(self.client, 'customer')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/audit/events',
                {'event': 'login_failed', 'data': {'password': 'nope'}},
                format='json',
            )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['action'], 'login_failed')
        row = AuditLog.objects.get(action='login_failed')
        self.assertEqual(row.metadata['password'], '[REDACTED]')

    def test_unknown_event_is_coerced_to_security_event(self):
        auth_client(self.client, 'customer')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/audit/events', {'event': 'make_admin'}, format='json')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['action'], 'security_event')
        self.assertEqual(
            AuditLog.objects.filter(action='security_event').count(), 1)

    def test_server_only_action_is_coerced_to_security_event(self):
        auth_client(self.client, 'customer')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/audit/events', {'event': 'create'}, format='json')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['action'], 'security_event')
        row = AuditLog.objects.get(action='security_event')
        self.assertEqual(row.result, 'success')


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestApiErrorAudits(TestCase):
    """The exception handler envelope and its 401/403 audit hooks; 404 is not
    audited. The 401 case doubles as the end-to-end proof that request context
    (request_id / ip_address) is auto-derived for audit rows."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_404_returns_envelope_but_writes_no_audit(self):
        response = self.client.get('/api/products/does-not-exist/')
        self.assertEqual(response.status_code, 404)
        body = response.json()
        self.assertIn('request_id', body)
        # No inbound header: the middleware generated the request ID.
        self.assertRegex(body['request_id'], r'^req_[0-9a-f]{32}$')
        self.assertEqual(AuditLog.objects.count(), 0)

    def test_401_authentication_failure_is_audited_with_context(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.get(
                '/api/auth/me', HTTP_X_REQUEST_ID=INBOUND_REQUEST_ID)
        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertIn('request_id', body)
        # The exception handler read the echoed ID from the live request.
        self.assertEqual(body['request_id'], INBOUND_REQUEST_ID)
        row = AuditLog.objects.filter(
            action='login_failed', result='failure',
            status_code=401,
        ).order_by('-created_at').first()
        self.assertIsNotNone(row)
        self.assertEqual(row.category, 'auth')
        # Auto-derived request context, not passed by the call site.
        self.assertEqual(row.request_id, INBOUND_REQUEST_ID)
        self.assertIsNotNone(row.ip_address)

    def test_403_permission_denied_is_audited(self):
        auth_client(self.client, 'customer')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.get('/api/admin/products')
        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertIn('request_id', body)
        self.assertRegex(body['request_id'], r'^req_[0-9a-f]{32}$')
        row = AuditLog.objects.filter(
            action='permission_denied', result='failure',
            severity='medium', status_code=403,
        ).order_by('-created_at').first()
        self.assertIsNotNone(row)
        self.assertEqual(row.category, 'security')


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestOrderCheckoutAudits(TestCase):
    """Checkout flow audits: successful checkout records checkout_started and an
    ``order_created`` event (linked to a staff notification); an empty cart
    produces a 400 + ``order_creation_failed`` audit and admin notification."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(
            name='Audit Category', slug='audit-category')
        self.product = Product.objects.create(
            category=self.category, name='Audit Product', slug='audit-product',
            description='A product created for audit trail testing.',
            price_minor=10000, status=Product.Status.ACTIVE)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='AUDIT-ONE', stock_quantity=10)
        self.staff = get_user_model().objects.create_user(
            username='audit-staff', password='x', is_staff=True)

    def customer_payload(self):
        return {
            'customer': {
                'fullName': 'Ada Lovelace', 'email': 'ada@example.com',
                'phone': '0712345678', 'addressLine1': '1 Market Street',
                'city': 'Nairobi', 'county': 'Nairobi',
            },
            'shippingMethod': 'standard',
            'paymentMethod': 'mpesa',
        }

    def test_successful_checkout_writes_started_and_order_create_audits(self):
        with self.captureOnCommitCallbacks(execute=True):
            cart_response = self.client.post(
                '/api/cart/items',
                {'variantId': str(self.variant.id), 'quantity': 1},
                format='json', HTTP_X_CART_ID='test-cart',
            )
        self.assertEqual(cart_response.status_code, 201)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/orders', self.customer_payload(),
                format='json', HTTP_X_CART_ID='test-cart',
            )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(AuditLog.objects.filter(
            action='checkout_started', category='orders',
            result='success').exists())
        order_log = AuditLog.objects.filter(
            action='order_created', object_type='order',
            category='orders', status_code=201).first()
        self.assertIsNotNone(order_log)
        notification = AdminNotification.objects.filter(
            event_type='order_created', audit_log=order_log,
            recipient=self.staff).first()
        self.assertIsNotNone(notification)
        self.assertEqual(notification.category, AdminNotification.Category.ORDER)

    def test_empty_cart_checkout_failure_is_audited(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/orders', self.customer_payload(),
                format='json', HTTP_X_CART_ID='empty-cart',
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn('request_id', response.json())
        row = AuditLog.objects.filter(
            action='order_creation_failed', result='failure',
            status_code=400,
        ).order_by('-created_at').first()
        self.assertIsNotNone(row)
        self.assertEqual(row.category, 'orders')
        self.assertTrue(AdminNotification.objects.filter(
            event_type='order_creation_failed', audit_log=row,
            recipient=self.staff).exists())


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestInventoryAudit(TestCase):
    """Staff restocks are audited as inventory 'update' events."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(
            name='Inv Category', slug='inv-category')
        self.product = Product.objects.create(
            category=self.category, name='Inv Product', slug='inv-product',
            description='A product created for inventory audit testing.',
            price_minor=10000, status=Product.Status.ACTIVE)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='INV-ONE', stock_quantity=10)

    def test_staff_stock_adjustment_is_audited(self):
        enroll_staff('staff-user', ['inventory.adjust', 'inventory.view'])
        auth_client(self.client, 'staff')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f'/api/admin/inventory/{self.variant.id}',
                {'delta': 2, 'reason': 'restock'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['stockQuantity'], 12)
        row = AuditLog.objects.filter(
            action='update', category='inventory',
        ).order_by('-created_at').first()
        self.assertIsNotNone(row)
        self.assertEqual(row.object_type, 'product_variant')
        self.assertEqual((row.metadata or {}).get('delta'), 2)
        self.assertEqual((row.metadata or {}).get('reason'), 'restock')


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestWebhookSecurityAudit(TestCase):
    """An invalid payment webhook signature is rejected with a 403 and audited
    as a critical security_event."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_invalid_webhook_signature_is_audited(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/payments/webhook',
                {'event': 'checkout.session.completed'},
                format='json', HTTP_X_WEBHOOK_SIGNATURE='wrong-signature')
        self.assertEqual(response.status_code, 403)
        self.assertIn('request_id', response.json())
        row = AuditLog.objects.filter(
            action='security_event', result='failure',
            severity='critical',
        ).order_by('-created_at').first()
        self.assertIsNotNone(row)
        self.assertEqual(row.category, 'security')
        self.assertEqual(
            (row.metadata or {}).get('event_type'), 'checkout.session.completed')
        self.assertIs((row.metadata or {}).get('has_signature'), True)


@override_settings(
    SUPABASE_JWT_SECRET=TEST_SECRET,
    SUPABASE_JWT_ISSUER='',
)
class TestCleanupCommand(TestCase):
    """The cleanup_audit_logs management command honours its retention window
    and dry-run flag without touching records inside the window."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_dry_run_deletes_nothing(self):
        AuditLog.objects.create(action='login')
        count = AuditLog.objects.count()
        call_command('cleanup_audit_logs', days=30, dry_run=True)
        self.assertEqual(AuditLog.objects.count(), count)

    def test_old_records_are_deleted_and_fresh_kept(self):
        fresh = AuditLog.objects.create(action='login')
        old = AuditLog.objects.create(action='login')
        AuditLog.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=32))
        call_command('cleanup_audit_logs', days=30)
        self.assertFalse(AuditLog.objects.filter(pk=old.pk).exists())
        self.assertTrue(AuditLog.objects.filter(pk=fresh.pk).exists())