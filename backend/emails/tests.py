"""Behaviour of the centralised mailer.

Five things must hold or the whole subsystem is worse than the code it
replaced:

1. ``queue_email`` never raises and a duplicated business event sends exactly
   one message.
2. Delivery records one attempt per try, retries transients and stops on
   permanents — and a terminal failure raises one staff alert, not one per
   attempt.
3. Admin re-sends are explicit, audited, and cannot duplicate a delivered
   message.
4. Delivery side effects (the customer's in-app notification, receipt
   bookkeeping) reuse the call site's own ``event_key`` so nothing appears
   twice in the notification centre.
5. The staff pages stay permission-gated.
"""

import smtplib as smtp
import uuid as uuid_lib
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from access_control.models import Permission, StaffProfile
from admin_ui.models import AdminNotification, CustomerNotification, notify_customer
from audit.models import AuditLog
from orders.models import Order
from receipts.models import Receipt

from .models import EmailLog
from .services import (
    deliver_email_log,
    queue_email,
    requeue_email_log,
    retry_email_log,
)

CUSTOMER_EVENT = 'customer-welcome:{pk}'


def make_log(**overrides):
    defaults = {
        'idempotency_key': f'test:{uuid_lib.uuid4().hex}',
        'email_type': 'welcome',
        'recipient_email': 'ada@example.com',
        'recipient_name': 'Ada',
        'subject': 'Welcome to MODEZA',
        'body_text': 'Thanks for joining us.',
    }
    defaults.update(overrides)
    return EmailLog.objects.create(**defaults)


def transient_failure():
    return smtp.SMTPResponseException(451, b'try again later')


def permanent_failure():
    return smtp.SMTPAuthenticationError(535, b'authentication failed')


class QueueTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='ada', email='ada@example.com', password='pw')

    def queue(self, **overrides):
        payload = {
            'email_type': 'welcome',
            'subject': 'Welcome to MODEZA',
            'body_text': 'Thanks for joining us.',
            'recipient_email': 'ada@example.com',
            'recipient_name': 'Ada',
            'related_user': self.user,
        }
        payload.update(overrides)
        with self.captureOnCommitCallbacks(execute=True):
            return queue_email(**payload)

    def test_queues_then_delivers_one_message_after_commit(self):
        log = self.queue()

        log.refresh_from_db()
        self.assertEqual(log.status, EmailLog.Status.SENT)
        self.assertEqual(log.attempt_count, 1)
        self.assertIsNotNone(log.sent_at)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Welcome to MODEZA')
        self.assertEqual(message.to, ['ada@example.com'])
        # The HTML wrapper is attached as an alternative, never as the body.
        self.assertEqual(message.alternatives[0][1], 'text/html')
        self.assertIn('Thanks for joining us.', message.body)

    def test_the_same_business_event_is_emailed_exactly_once(self):
        first = self.queue()
        second = self.queue()

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(EmailLog.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_an_unknown_email_type_is_rejected(self):
        self.assertIsNone(self.queue(email_type='definitely_not_a_type'))
        self.assertEqual(EmailLog.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_an_unusable_recipient_is_rejected(self):
        self.assertIsNone(self.queue(recipient_email='not-an-address'))
        self.assertEqual(EmailLog.objects.count(), 0)

    def test_a_notification_without_an_event_key_is_rejected(self):
        """Without a key the notification centre cannot de-duplicate, so the
        whole email is dropped rather than risking a visible duplicate."""
        self.assertIsNone(self.queue(notification={'category': 'account'}))
        self.assertEqual(EmailLog.objects.count(), 0)

    def test_admin_mail_defaults_to_the_operations_inbox(self):
        log = queue_email(
            email_type='admin_low_stock',
            subject='Low stock',
            body_text='Luna Silk Dress is down to 2.',
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.recipient_email, settings.STORE_EMAIL)

    def test_a_non_customer_type_drops_its_notification_payload(self):
        log = queue_email(
            email_type='bulk_import_completed',
            subject='Import finished',
            body_text='42 rows imported.',
            notification={'category': 'system', 'title': 'x',
                          'message': 'y', 'event_key': 'k'},
        )

        self.assertIsNotNone(log)
        self.assertNotIn('notification', log.metadata)

    def test_queue_email_swallows_infrastructure_errors(self):
        with patch('emails.services.EmailLog') as model:
            model.objects.get_or_create.side_effect = RuntimeError('db down')
            log = self.queue()

        self.assertIsNone(log)

    def test_a_transient_failure_is_recorded_for_the_retry_ladder(self):
        with patch('django.core.mail.EmailMessage.send',
                   side_effect=transient_failure()):
            log = self.queue()

        log.refresh_from_db()
        self.assertEqual(log.status, EmailLog.Status.RETRYING)
        self.assertEqual(log.attempt_count, 1)
        self.assertIsNotNone(log.next_retry_at)
        self.assertIn('SMTP 451', log.last_error)


class DeliveryTests(TestCase):
    def setUp(self):
        self.ops = get_user_model().objects.create_user(
            username='ops', email='ops@example.com', password='pw',
            is_staff=True)

    def test_a_transient_error_schedules_an_exponential_retry(self):
        log = make_log()

        with patch('django.core.mail.EmailMessage.send',
                   side_effect=transient_failure()):
            result = deliver_email_log(log.pk)

        result.refresh_from_db()
        self.assertEqual(result.status, EmailLog.Status.RETRYING)
        self.assertEqual(result.attempt_count, 1)
        self.assertIsNotNone(result.next_retry_at)
        self.assertIn('SMTP 451', result.last_error)
        # A transient attempt must not page anyone yet.
        self.assertFalse(AdminNotification.objects.filter(
            event_key=f'email-failed:{log.pk}').exists())

    def test_a_permanent_error_fails_immediately_and_alerts_staff_once(self):
        log = make_log()

        with patch('django.core.mail.EmailMessage.send',
                   side_effect=permanent_failure()):
            deliver_email_log(log.pk)

        log.refresh_from_db()
        self.assertEqual(log.status, EmailLog.Status.FAILED)
        self.assertIsNotNone(log.failed_at)
        self.assertEqual(log.next_retry_at, None)
        self.assertIn('SMTP 535', log.last_error)

        bells = AdminNotification.objects.filter(
            event_key=f'email-failed:{log.pk}')
        self.assertEqual(bells.count(), 1)
        self.assertEqual(bells.get().recipient_id, self.ops.pk)
        self.assertEqual(bells.get().link, '/admin/dashboard/emails/?status=failed')

    def test_a_temporary_error_still_stops_when_attempts_are_exhausted(self):
        log = make_log(max_attempts=1)

        with patch('django.core.mail.EmailMessage.send',
                   side_effect=transient_failure()):
            deliver_email_log(log.pk)

        log.refresh_from_db()
        self.assertEqual(log.status, EmailLog.Status.FAILED)
        self.assertEqual(log.attempt_count, 1)

    def test_a_terminal_log_is_never_touched_again(self):
        log = make_log(status=EmailLog.Status.SENT, sent_at=timezone.now())

        with patch('django.core.mail.EmailMessage.send') as send:
            result = deliver_email_log(log.pk)

        send.assert_not_called()
        self.assertEqual(result.status, EmailLog.Status.SENT)

    def test_repeated_terminal_failures_produce_a_single_staff_alert(self):
        log = make_log()

        with patch('django.core.mail.EmailMessage.send',
                   side_effect=permanent_failure()):
            deliver_email_log(log.pk)
        # A duplicate broker message must not page twice.
        with patch('django.core.mail.EmailMessage.send',
                   side_effect=permanent_failure()):
            deliver_email_log(log.pk)

        self.assertEqual(
            AdminNotification.objects.filter(
                event_key=f'email-failed:{log.pk}').count(),
            1)


class RetryTests(TestCase):
    def test_only_a_failed_log_can_be_manually_retried(self):
        sent = make_log(status=EmailLog.Status.SENT, sent_at=timezone.now())

        log, dispatched = retry_email_log(sent)

        self.assertFalse(dispatched)
        self.assertEqual(log.status, EmailLog.Status.SENT)
        self.assertEqual(len(mail.outbox), 0)

    def test_a_retry_resets_the_ladder_and_sends(self):
        log = make_log(
            status=EmailLog.Status.FAILED, attempt_count=5,
            failed_at=timezone.now(), last_error='SMTP 535: nope')

        log, dispatched = retry_email_log(log)

        self.assertTrue(dispatched)
        # ``retry_email_log`` returns as soon as the work is re-dispatched —
        # in production the worker owns the delivery from here on.
        log.refresh_from_db()
        self.assertEqual(log.status, EmailLog.Status.SENT)
        self.assertEqual(log.attempt_count, 1)
        self.assertEqual(log.last_error, '')
        self.assertEqual(len(mail.outbox), 1)

    def test_requeue_rebuilds_broker_work_from_the_database(self):
        queued = make_log()
        sent = make_log(status=EmailLog.Status.SENT, sent_at=timezone.now())
        due = make_log(
            status=EmailLog.Status.RETRYING,
            next_retry_at=timezone.now() - timedelta(seconds=1))
        waiting = make_log(
            status=EmailLog.Status.RETRYING,
            next_retry_at=timezone.now() + timedelta(hours=1))

        self.assertTrue(requeue_email_log(queued))
        self.assertTrue(requeue_email_log(due))
        self.assertFalse(requeue_email_log(sent))
        self.assertFalse(requeue_email_log(waiting))


class NotificationHookTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='ada', email='ada@example.com', password='pw')

    def log_with_notification(self, event_key, *, guest=False):
        return make_log(
            related_user=None if guest else self.user,
            metadata={'notification': {
                'category': 'account',
                'title': 'Welcome to MODEZA',
                'message': 'Your account is ready.',
                'link': '/account',
                'event_key': event_key,
                'event_type': 'welcome',
            }})

    def test_delivery_surfaces_the_message_in_app(self):
        key = CUSTOMER_EVENT.format(pk=self.user.pk)
        log = self.log_with_notification(key)

        deliver_email_log(log.pk)

        notification = CustomerNotification.objects.get(user=self.user)
        self.assertEqual(notification.event_key, key)
        self.assertEqual(notification.category, 'account')
        self.assertEqual(notification.title, 'Welcome to MODEZA')
        self.assertEqual(notification.link, '/account')

    def test_the_business_layer_can_pre_surface_the_same_event(self):
        key = CUSTOMER_EVENT.format(pk=self.user.pk)
        notify_customer(
            self.user, 'account', 'Welcome to MODEZA',
            'Your account is ready.', link='/account', event_key=key)
        log = self.log_with_notification(key)

        deliver_email_log(log.pk)

        self.assertEqual(
            CustomerNotification.objects.filter(user=self.user).count(), 1)

    def test_a_guest_gets_the_email_but_no_in_app_entry(self):
        key = CUSTOMER_EVENT.format(pk='guest')
        log = self.log_with_notification(key, guest=True)

        log = deliver_email_log(log.pk)

        self.assertEqual(log.status, EmailLog.Status.SENT)
        self.assertEqual(CustomerNotification.objects.count(), 0)

    def test_no_notification_payload_means_no_bell(self):
        log = make_log(related_user=self.user)

        deliver_email_log(log.pk)

        self.assertEqual(CustomerNotification.objects.count(), 0)


class ReceiptHookTests(TestCase):
    def setUp(self):
        self.order = Order.objects.create(
            order_number='AT-RECEIPT-001',
            customer={'fullName': 'Ada'},
            subtotal_minor=1000, total_minor=1000)
        self.receipt = Receipt.objects.create(
            order=self.order, receipt_number='RCP-2026-000042')

    def test_successful_delivery_stamps_the_receipt(self):
        log = make_log(email_type='receipt',
                       metadata={'receipt_id': str(self.receipt.pk)})

        # Audit rows are correctly deferred to on_commit; the test transaction
        # never commits, so flush the callbacks to observe them.
        with self.captureOnCommitCallbacks(execute=True):
            deliver_email_log(log.pk)

        self.receipt.refresh_from_db()
        self.assertIsNotNone(self.receipt.email_sent_at)
        self.assertEqual(self.receipt.email_attempts, 1)
        self.assertEqual(self.receipt.email_error, '')
        self.assertTrue(AuditLog.objects.filter(
            action='receipt_email_sent',
            object_id=str(self.receipt.pk)).exists())

    def test_terminal_failure_records_the_error_on_the_receipt(self):
        log = make_log(email_type='receipt',
                       metadata={'receipt_id': str(self.receipt.pk)})

        with patch('django.core.mail.EmailMessage.send',
                   side_effect=permanent_failure()):
            with self.captureOnCommitCallbacks(execute=True):
                deliver_email_log(log.pk)

        self.receipt.refresh_from_db()
        self.assertIsNone(self.receipt.email_sent_at)
        self.assertEqual(self.receipt.email_attempts, 1)
        self.assertIn('SMTP 535', self.receipt.email_error)
        self.assertTrue(AuditLog.objects.filter(
            action='receipt_email_failed',
            object_id=str(self.receipt.pk)).exists())


class EmailAdminPageTests(TestCase):
    def setUp(self):
        self.ops = get_user_model().objects.create_user(
            username='ops', email='ops@example.com', password='pw',
            is_staff=True)
        self.enroll(self.ops)
        self.failed = make_log(
            email_type='bulk_import_failed',
            subject='Import failed', status=EmailLog.Status.FAILED,
            attempt_count=5, failed_at=timezone.now(),
            last_error='SMTP 535: authentication failed')
        self.sent = make_log(
            email_type='bulk_import_completed',
            subject='Import finished', status=EmailLog.Status.SENT,
            sent_at=timezone.now())
        self.client.force_login(self.ops)

    def enroll(self, user, codes=('emails.view', 'emails.manage')):
        profile, _ = StaffProfile.objects.get_or_create(user=user)
        profile.status = StaffProfile.Status.ACTIVE
        profile.direct_permissions.set(
            Permission.objects.filter(code__in=codes))
        profile.save(update_fields=['status'])
        return profile

    def test_list_page_shows_every_message(self):
        response = self.client.get(reverse('emails:admin-email-list'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Import failed')
        self.assertContains(response, 'Import finished')

    def test_status_filter_narrows_the_list(self):
        response = self.client.get(
            reverse('emails:admin-email-list'), {'status': 'FAILED'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Import failed')
        self.assertNotContains(response, 'Import finished')

    def test_detail_page_renders_the_full_body(self):
        response = self.client.get(
            reverse('emails:admin-email-detail', args=[self.failed.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Import failed')
        self.assertContains(response, 'SMTP 535')

    def test_anonymous_visitors_are_sent_to_the_login_page(self):
        self.client.logout()

        response = self.client.get(reverse('emails:admin-email-list'))

        self.assertEqual(response.status_code, 302)
        self.assertIn('login', response['Location'])

    def test_staff_without_the_permission_get_a_403(self):
        stranger = get_user_model().objects.create_user(
            username='stranger', email='stranger@example.com',
            password='pw', is_staff=True)
        self.enroll(stranger, codes=())
        self.client.force_login(stranger)

        response = self.client.get(reverse('emails:admin-email-list'))

        self.assertEqual(response.status_code, 403)

    def test_retry_puts_a_failed_message_back_on_the_wire(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.get(
                reverse('emails:admin-email-retry', args=[self.failed.pk]))

        self.assertEqual(response.status_code, 302)
        self.failed.refresh_from_db()
        self.assertEqual(self.failed.status, EmailLog.Status.SENT)
        self.assertEqual(self.failed.attempt_count, 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(AuditLog.objects.filter(
            action='email_retry_requested',
            object_id=str(self.failed.pk),
            result='success').exists())

    def test_a_delivered_message_cannot_be_sent_twice(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.get(
                reverse('emails:admin-email-retry', args=[self.sent.pk]))

        self.assertEqual(response.status_code, 302)
        self.sent.refresh_from_db()
        self.assertEqual(self.sent.status, EmailLog.Status.SENT)
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(AuditLog.objects.filter(
            action='email_retry_requested',
            object_id=str(self.sent.pk),
            result='failure').exists())

    def test_bulk_retry_sends_only_what_is_sendable(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse('emails:admin-email-bulk-retry'),
                {'ids': [str(self.failed.pk), str(self.sent.pk)]})

        self.assertEqual(response.status_code, 302)
        self.failed.refresh_from_db()
        self.sent.refresh_from_db()
        self.assertEqual(self.failed.status, EmailLog.Status.SENT)
        self.assertEqual(self.sent.status, EmailLog.Status.SENT)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            AuditLog.objects.filter(
                action='email_retry_requested').count(),
            2)

    def test_bulk_retry_without_a_selection_is_rejected(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse('emails:admin-email-bulk-retry'), {})

        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 0)
