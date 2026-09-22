from django.urls import path

from .views import (
    AdminReceiptRegenerateView,
    OrderReceiptView,
    ReceiptDownloadView,
)

urlpatterns = [
    path('receipts/<str:receipt_number>/download',
         ReceiptDownloadView.as_view(), name='receipt-download'),
    path('receipts/<str:receipt_number>/regenerate',
         AdminReceiptRegenerateView.as_view(), name='admin-receipt-regenerate'),
    path('orders/<str:order_number>/receipt',
         OrderReceiptView.as_view(), name='order-receipt'),
]