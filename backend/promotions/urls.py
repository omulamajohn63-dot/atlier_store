from django.urls import path

from .admin_views import (
    AdminPromotionActionView,
    AdminPromotionAnalyticsView,
    AdminPromotionDetailView,
    AdminPromotionListCreateView,
    AdminPromotionPreviewView,
)
from .views import PromotionApplyView, PromotionAvailableView, PromotionRemoveView

urlpatterns = [
    path('promotions/apply', PromotionApplyView.as_view(), name='promo-apply'),
    path('promotions/remove', PromotionRemoveView.as_view(), name='promo-remove'),
    path('promotions/available', PromotionAvailableView.as_view(), name='promo-available'),
    path('admin/promotions', AdminPromotionListCreateView.as_view(), name='admin-promo-list'),
    path('admin/promotions/<uuid:promo_id>', AdminPromotionDetailView.as_view(), name='admin-promo-detail'),
    path('admin/promotions/<uuid:promo_id>/analytics', AdminPromotionAnalyticsView.as_view(),
         name='admin-promo-analytics'),
    path('admin/promotions/<uuid:promo_id>/preview', AdminPromotionPreviewView.as_view(),
         name='admin-promo-preview'),
    path('admin/promotions/<uuid:promo_id>/<str:action>', AdminPromotionActionView.as_view(),
         name='admin-promo-action'),
]
