from django.contrib import admin

from .models import (
    Promotion,
    PromotionCategory,
    PromotionCustomer,
    PromotionProduct,
    PromotionRedemption,
    PromotionVariant,
)


class TargetInline(admin.TabularInline):
    extra = 0


class PromotionProductInline(TargetInline):
    model = PromotionProduct


class PromotionCategoryInline(TargetInline):
    model = PromotionCategory


class PromotionVariantInline(TargetInline):
    model = PromotionVariant


class PromotionCustomerInline(TargetInline):
    model = PromotionCustomer


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ('name', 'promotion_type', 'coupon_code', 'status', 'starts_at', 'ends_at', 'priority', 'stackable')
    list_filter = ('promotion_type', 'status', 'is_automatic')
    search_fields = ('name', 'coupon_code')
    inlines = [PromotionProductInline, PromotionCategoryInline, PromotionVariantInline, PromotionCustomerInline]


@admin.register(PromotionRedemption)
class PromotionRedemptionAdmin(admin.ModelAdmin):
    list_display = ('promotion', 'order', 'coupon_code', 'discount_minor', 'voided', 'redeemed_at')
    list_filter = ('voided',)
    readonly_fields = ('redeemed_at',)
