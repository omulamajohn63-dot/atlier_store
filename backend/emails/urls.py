from django.urls import path

from .views import (
    EmailLogBulkRetryView,
    EmailLogDetailView,
    EmailLogListView,
    EmailLogRetryView,
)

app_name = 'emails'

urlpatterns = [
    path('', EmailLogListView.as_view(), name='admin-email-list'),
    path('retry-bulk/', EmailLogBulkRetryView.as_view(),
         name='admin-email-bulk-retry'),
    path('<uuid:log_id>/', EmailLogDetailView.as_view(),
         name='admin-email-detail'),
    path('<uuid:log_id>/retry/', EmailLogRetryView.as_view(),
         name='admin-email-retry'),
]
