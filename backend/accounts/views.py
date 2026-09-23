import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_ui.models import CustomerNotification

from .permissions import IsAdmin, IsAuthenticatedSupabaseUser, IsStaffOrAdmin

logger = logging.getLogger("accounts.notifications")


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticatedSupabaseUser]

    def get(self, request):
        return Response({
            'id': request.user.username.removeprefix('supabase_'),
            'email': request.user.email,
            'role': getattr(request.user, 'supabase_role', 'customer'),
        })


class AdminAccessView(APIView):
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        return Response({'status': 'ok', 'role': request.user.supabase_role})


class OwnerAccessView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response({'status': 'ok', 'role': request.user.supabase_role})


class CustomerNotificationsView(APIView):
    permission_classes = [IsAuthenticatedSupabaseUser]

    def get(self, request):
        queryset = CustomerNotification.objects.filter(user=request.user)
        total = queryset.count()
        unread_count = queryset.filter(is_read=False).count()
        limit = min(int(request.query_params.get('limit', 20)), 500)
        notifications = queryset.order_by('-created_at')[:limit]
        return Response({
            'count': total,
            'unread_count': unread_count,
            'results': [{
                'id': str(notification.id),
                'category': notification.category,
                'title': notification.title,
                'message': notification.message,
                'link': notification.link,
                'isRead': notification.is_read,
                'presented': notification.presented_at is not None,
                'createdAt': notification.created_at.isoformat(),
            } for notification in notifications],
        })


class MarkCustomerNotificationsPresentedView(APIView):
    """Atomically claim popup presentation for a set of notification IDs.

    Only the caller that wins the compare-and-set is told the IDs were
    actually ``presented_at``; concurrent clients (other tabs, polls racing)
    receive an empty ``presented`` list for IDs already surfaced, so a single
    notification can never be popped more than once regardless of polling,
    refresh, or page remount.
    """

    permission_classes = [IsAuthenticatedSupabaseUser]

    def post(self, request):
        ids = request.data.get('ids') or []
        if not isinstance(ids, list):
            return Response(
                {'ok': False, 'error': 'ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cleaned = []
        for raw in ids[:100]:
            try:
                cleaned.append(raw if isinstance(raw, str) else str(raw))
            except (TypeError, ValueError):
                continue
        if not cleaned:
            return Response({'ok': True, 'presented': []})

        try:
            with transaction.atomic():
                rows = CustomerNotification.objects.select_for_update().filter(
                    user=request.user,
                    pk__in=cleaned,
                )
                won = []
                for notification in rows:
                    if notification.presented_at is None and not notification.is_read:
                        notification.presented_at = timezone.now()
                        notification.save(update_fields=['presented_at'])
                        won.append(notification.pk)
        except Exception:
            logger.warning(
                'notification_present_failed recipient=%s ids=%d',
                request.user.pk, len(cleaned), exc_info=True)
            return Response(
                {'ok': False, 'presented': []},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        logger.debug(
            'notification_presented recipient=%s total=%d won=%d',
            request.user.pk, len(cleaned), len(won))
        return Response({
            'ok': True,
            'presented': [str(nid) for nid in won],
        })


class MarkAllCustomerNotificationsReadView(APIView):
    permission_classes = [IsAuthenticatedSupabaseUser]

    def post(self, request):
        updated = CustomerNotification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(is_read=True)
        return Response({'ok': True, 'unread_count': 0, 'updated': updated})


class MarkCustomerNotificationReadView(APIView):
    permission_classes = [IsAuthenticatedSupabaseUser]

    def post(self, request, notification_id):
        notification = CustomerNotification.objects.filter(
            user=request.user,
            pk=notification_id,
        ).first()
        if not notification:
            return Response({'ok': False}, status=404)

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        unread_count = CustomerNotification.objects.filter(
            user=request.user, is_read=False).count()
        return Response({'ok': True, 'unread_count': unread_count})
