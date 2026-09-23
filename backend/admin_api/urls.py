from django.urls import path

from .views import (AdminCategoryCreateView, AdminNotificationReadView,
                    AdminNotificationsPresentView, AdminNotificationsReadAllView,
                    AdminNotificationsView, AdminProductArchiveView,
                    AdminProductCreateView, AdminProductUpdateView,
                    AdminStockAdjustmentView, AdminUnreadNotificationsView,
                    ExpireReservationsView)


urlpatterns = [
    path('admin/products', AdminProductCreateView.as_view(),
         name='admin-product-create'),
    path('admin/products/<uuid:product_id>',
         AdminProductUpdateView.as_view(), name='admin-product-update'),
    path('admin/products/<uuid:product_id>/archive',
         AdminProductArchiveView.as_view(), name='admin-product-archive'),
    path('admin/categories', AdminCategoryCreateView.as_view(),
         name='admin-category-create'),
    path('admin/inventory/<uuid:variant_id>',
         AdminStockAdjustmentView.as_view(), name='admin-stock-adjustment'),
    path('admin/maintenance/expire-reservations',
         ExpireReservationsView.as_view(), name='admin-expire-reservations'),
    path('admin/notifications',
         AdminNotificationsView.as_view(), name='admin-notifications-api'),
    path('admin/notifications/unread',
         AdminUnreadNotificationsView.as_view(), name='admin-notifications-unread-api'),
    path('admin/notifications/presented',
         AdminNotificationsPresentView.as_view(), name='admin-notifications-presented-api'),
    path('admin/notifications/<uuid:notification_id>/read',
         AdminNotificationReadView.as_view(), name='admin-notification-read-api'),
    path('admin/notifications/read-all',
         AdminNotificationsReadAllView.as_view(), name='admin-notifications-read-all-api'),
]
