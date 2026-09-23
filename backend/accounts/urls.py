from django.urls import path

from .views import (
    AdminAccessView,
    CustomerNotificationsView,
    CurrentUserView,
    MarkAllCustomerNotificationsReadView,
    MarkCustomerNotificationsPresentedView,
    MarkCustomerNotificationReadView,
    OwnerAccessView,
)


urlpatterns = [
    path('auth/me', CurrentUserView.as_view(), name='current-user'),
    path('admin/access', AdminAccessView.as_view(), name='admin-access'),
    path('admin/owner-access', OwnerAccessView.as_view(), name='owner-access'),
    path('notifications', CustomerNotificationsView.as_view(),
         name='customer-notifications'),
    path('notifications/presented/',
         MarkCustomerNotificationsPresentedView.as_view(),
         name='customer-notifications-presented'),
    path('notifications/read-all/',
         MarkAllCustomerNotificationsReadView.as_view(),
         name='customer-notifications-read-all'),
    path('notifications/<uuid:notification_id>/read/',
         MarkCustomerNotificationReadView.as_view(), name='customer-notification-read'),
]
