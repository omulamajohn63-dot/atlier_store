from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditLog
from catalog.models import Category, Product, ProductVariant
from inventory.models import BackInStockRequest


class BackInStockApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        category = Category.objects.create(name='Tops', slug='tops')
        self.product = Product.objects.create(
            category=category,
            name='Linen Top',
            slug='linen-top',
            description='Breathable linen top.',
            price_minor=15000,
            status=Product.Status.ACTIVE,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='LINEN-M', size='M', stock_quantity=0)

    def test_subscribe_to_back_in_stock_creates_request_and_audits(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/back-in-stock',
                {'variantId': str(self.variant.id), 'email': 'ada@example.com'},
                format='json',
            )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['ok'])
        request = BackInStockRequest.objects.get(
            variant=self.variant, email='ada@example.com')
        self.assertEqual(request.status, BackInStockRequest.Status.PENDING)
        self.assertTrue(AuditLog.objects.filter(
            action='back_in_stock_subscribed',
            object_type='product_variant',
            object_id=str(self.variant.pk)).exists())

    def test_duplicate_subscribe_is_idempotent(self):
        url = '/api/back-in-stock'

        first = self.client.post(
            url, {'variantId': str(self.variant.id), 'email': 'ada@example.com'},
            format='json')
        second = self.client.post(
            url, {'variantId': str(self.variant.id), 'email': 'ada@example.com'},
            format='json')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.json()['alreadySubscribed'])
        self.assertEqual(BackInStockRequest.objects.filter(
            variant=self.variant, email='ada@example.com').count(), 1)

    def test_subscribe_rejects_invalid_email_and_missing_variant(self):
        bad_email = self.client.post(
            '/api/back-in-stock',
            {'variantId': str(self.variant.id), 'email': 'not-an-email'},
            format='json')
        self.assertEqual(bad_email.status_code, 400)

        missing = self.client.post(
            '/api/back-in-stock',
            {'variantId': '00000000-0000-0000-0000-000000000000', 'email': 'ada@example.com'},
            format='json')
        self.assertEqual(missing.status_code, 400)


class BackInStockNotificationTests(TestCase):
    def setUp(self):
        from unittest.mock import patch

        self.mail_patcher = patch('inventory.services.EmailMessage.send')
        self.mock_send = self.mail_patcher.start()
        self.addCleanup(self.mail_patcher.stop)

        category = Category.objects.create(name='Tops', slug='tops-restock')
        self.product = Product.objects.create(
            category=category,
            name='Linen Top',
            slug='linen-top-restock',
            description='Breathable linen top.',
            price_minor=15000,
            status=Product.Status.ACTIVE,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='LINEN-S', size='S', stock_quantity=0)
        self.request = BackInStockRequest.objects.create(
            variant=self.variant, email='ada@example.com')

    def test_subscribers_notified_once_when_variant_is_restocked(self):
        from inventory.services import adjust_stock

        with self.captureOnCommitCallbacks(execute=True):
            adjust_stock(self.variant.id, 5, 'restock')

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, BackInStockRequest.Status.NOTIFIED)
        self.assertIsNotNone(self.request.notified_at)
        self.assertEqual(self.mock_send.call_count, 1)
        self.assertTrue(AuditLog.objects.filter(
            action='back_in_stock_notified',
            object_type='product_variant',
            object_id=str(self.variant.pk)).exists())

    def test_release_reservation_notifies_subscribers(self):
        import uuid as uuid_mod

        from django.utils import timezone
        from orders.models import Order

        from inventory.models import StockReservation

        order = Order.objects.create(
            order_number=f'AT-{uuid_mod.uuid4().hex[:12].upper()}',
            subtotal_minor=1000, total_minor=1000)
        reservation = StockReservation.objects.create(
            order=order, variant=self.variant, quantity=1,
            expires_at=timezone.now())

        from inventory.services import release_reservation

        with self.captureOnCommitCallbacks(execute=True):
            release_reservation(reservation)

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, BackInStockRequest.Status.NOTIFIED)

    def test_no_notification_when_stock_remains_zero(self):
        from inventory.services import adjust_stock

        with self.captureOnCommitCallbacks(execute=True):
            adjust_stock(self.variant.id, 0, 'restock')

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, BackInStockRequest.Status.PENDING)
        self.assertEqual(self.mock_send.call_count, 0)