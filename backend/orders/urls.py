from django.urls import path

from .views import OrderDetailView, OrdersView


urlpatterns = [
    path('orders', OrdersView.as_view(), name='order-list'),
    path('orders/<str:order_number>',
         OrderDetailView.as_view(), name='order-detail'),
    path('orders/<str:order_number>/cancel',
         OrderDetailView.as_view(), name='order-cancel'),
    path('orders/<str:order_number>/receive',
         OrderDetailView.as_view(), name='order-receive'),
    path('orders/<str:order_number>/mark-received-paid',
         OrderDetailView.as_view(), name='order-mark-received-paid'),
    path('orders/<str:order_number>/return',
         OrderDetailView.as_view(), name='order-return'),
]
