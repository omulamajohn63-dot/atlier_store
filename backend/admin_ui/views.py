import csv
import io
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.views import LoginView, LogoutView
from django.db.models import Count, Q, Sum
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.safestring import mark_safe
from django.views import View

from catalog.models import Category, Product, ProductVariant
from catalog.services import ProductGenerationService, import_products_from_file
from botique_backend.storage import object_key_from_url
from inventory.services import adjust_stock
from orders.models import Order, OrderItem
from orders.services import approve_order

from .forms import (
    AdminLoginForm,
    AdminSignupForm,
    CategoryForm,
    ProductCreateForm,
    ProductUpdateForm,
    StockAdjustmentForm,
)
from .models import AdminNotification, notify_staff


def is_staff(user):
    return user.is_authenticated and user.is_staff


def is_superuser(user):
    return user.is_authenticated and user.is_superuser


class AdminLandingPageView(View):
    template_name = 'admin_ui/admin_landing_page.html'

    def get(self, request):
        return render(request, self.template_name, {
            'page_title': 'ATELIER Admin',
            'is_authenticated_staff': bool(
                request.user.is_authenticated and request.user.is_staff),
            'is_superuser': bool(request.user.is_authenticated and request.user.is_superuser),
            'user': request.user if request.user.is_authenticated else None,
        })


class AdminLoginView(LoginView):
    template_name = 'admin_ui/admin_login.html'
    authentication_form = AdminLoginForm
    redirect_authenticated_user = True
    next_page = reverse_lazy('admin-dashboard')


class AdminLogoutView(LogoutView):
    next_page = 'admin-landing'
    http_method_names = ['get', 'post', 'options']

    def get(self, request, *args, **kwargs):
        return self.post(request, *args, **kwargs)


class AdminRegisterView(View):
    template_name = 'admin_ui/admin_register.html'

    def get(self, request):
        return self.render_form(
            request, AdminSignupForm(allow_superuser=bool(request.user.is_superuser)))

    def post(self, request):
        form = AdminSignupForm(
            request.POST, allow_superuser=bool(request.user.is_superuser))
        if form.is_valid():
            user = form.save()
            notify_staff(
                category='system',
                title='New admin account created',
                message=f'{user.get_full_name() or user.username} ({user.email}) was added as an administrator.',
                recipient=user,
            )
            messages.success(
                request, f'Administrator {user.username} created and granted admin powers.')
            if request.user.is_authenticated:
                return redirect('admin-users')
            return redirect('admin-login')
        return self.render_form(request, form)

    def render_form(self, request, form):
        return render(request, self.template_name, {
            'form': form,
            'page_title': 'Create administrator account',
            'page_subtitle': 'Grant admin powers to a new staff account.',
            'submit_label': 'Create administrator',
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ConfirmActionView(View):
    template_name = 'admin_ui/confirm_page.html'

    @staticmethod
    def _parse_product_ids(raw_value):
        if not raw_value:
            return []

        values = raw_value if isinstance(
            raw_value, (list, tuple)) else [raw_value]
        ids = []
        for item in values:
            for candidate in str(item).split(','):
                value = candidate.strip()
                if not value:
                    continue
                try:
                    ids.append(str(uuid.UUID(value)))
                except ValueError:
                    continue
        return list(dict.fromkeys(ids))

    def _product_title(self, product):
        return product.name if product else 'this product'

    def get(self, request):
        action = request.GET.get('action') or 'confirm'
        product_id = request.GET.get('product_id')
        product_ids = self._parse_product_ids(request.GET.get('product_ids'))

        if action == 'delete-product' and product_id:
            product = Product.objects.filter(pk=product_id).first()
            message = f"Are you sure you want to delete product {self._product_title(product)}?"
            confirm_url = '/admin/dashboard/confirm/'
            confirm_post = {'action': 'delete-product',
                            'product_id': product_id}
        elif action == 'delete-selected-products' and product_ids:
            products = list(Product.objects.filter(pk__in=product_ids)[:50])
            product_count = len(products)
            message = f"Are you sure you want to delete {product_count} product{'s' if product_count != 1 else ''}?"
            confirm_url = '/admin/dashboard/confirm/'
            confirm_post = {'action': 'delete-selected-products',
                            'product_ids': product_ids}
        elif action == 'archive-product' and product_id:
            product = Product.objects.filter(pk=product_id).first()
            message = f"Are you sure you want to archive product {self._product_title(product)}?"
            confirm_url = '/admin/dashboard/confirm/'
            confirm_post = {'action': 'archive-product',
                            'product_id': product_id}
        elif action == 'update-product' and product_id:
            product = Product.objects.filter(pk=product_id).first()
            message = f"Are you sure you want to update product {self._product_title(product)}?"
            confirm_url = '/admin/dashboard/confirm/'
            confirm_post = {'action': 'update-product',
                            'product_id': product_id}
        else:
            message = 'Are you sure you want to continue with this action?'
            confirm_url = '/admin/dashboard/'
            confirm_post = {}

        return render(request, self.template_name, {
            'page_title': 'Confirm action',
            'page_subtitle': 'Review the action before continuing.',
            'message': message,
            'confirm_url': confirm_url,
            'confirm_post': confirm_post,
        })

    def post(self, request):
        action = request.POST.get('action')
        product_id = request.POST.get('product_id')
        product_ids_raw = request.POST.getlist('product_ids')
        product_ids = []
        for value in product_ids_raw:
            product_ids.extend(self._parse_product_ids(value))

        if action == 'delete-product' and product_id:
            product = Product.objects.filter(pk=product_id).first()
            if product:
                try:
                    DashboardView.delete_product(product)
                    messages.success(request, 'Product deleted.')
                except IntegrityError:
                    messages.error(
                        request,
                        'This product cannot be deleted because it is referenced by an order, cart, or inventory record. Archive it instead.',
                    )
            return redirect('admin-products')

        if action == 'delete-selected-products':
            selected_ids = list(dict.fromkeys(product_ids))
            if not selected_ids:
                messages.error(
                    request, 'Select at least one product to delete.')
                return redirect('admin-products')

            products = list(Product.objects.filter(pk__in=selected_ids))
            deleted = 0
            for product in products:
                try:
                    DashboardView.delete_product(product)
                    deleted += 1
                except IntegrityError:
                    continue

            if deleted:
                messages.success(
                    request, f'{deleted} product{"s" if deleted != 1 else ""} deleted.')
            if deleted != len(products):
                messages.warning(
                    request, 'Some selected products could not be deleted because they are referenced by orders or carts.')
            return redirect('admin-products')

        if action == 'archive-product' and product_id:
            product = Product.objects.filter(pk=product_id).first()
            if product:
                DashboardView.archive_product(product)
                messages.success(request, 'Product archived.')
            return redirect('admin-products')

        if action == 'update-product' and product_id:
            product = Product.objects.filter(pk=product_id).first()
            if not product:
                messages.error(request, 'Product not found.')
                return redirect('admin-products')

            form = ProductUpdateForm(
                request.POST, request.FILES, product=product)
            if form.is_valid():
                DashboardView.update_product(
                    product, form.cleaned_data, request.FILES.get('image_file'))
                messages.success(request, f'Product {product.name} updated.')
                return redirect('admin-products')

            messages.error(
                request, 'Please correct the product details before confirming.')
            return redirect(f'/admin/dashboard/products/{product_id}/edit/')

        messages.error(request, 'Unknown action.')
        return redirect('admin-dashboard')


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class UnreadNotificationsView(View):
    def get(self, request):
        base = AdminNotification.objects.filter(
            recipient=request.user,
            is_read=False,
        )
        total_unread = base.count()
        notifications = base.order_by('-created_at')[:5]

        results = [
            {
                'id': str(item.id),
                'title': item.title,
                'message': item.message,
                'link': item.link,
                'category': item.category,
                'created_at': item.created_at.isoformat(),
            }
            for item in notifications
        ]

        return JsonResponse({
            'count': total_unread,
            'unread_count': total_unread,
            'results': results,
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class AdminNotificationsPageView(View):
    template_name = 'admin_ui/notifications_page.html'

    def get(self, request):
        notifications = list(AdminNotification.objects.filter(
            recipient=request.user).order_by('-created_at'))
        unread_count = sum(1 for item in notifications if not item.is_read)
        return render(request, self.template_name, {
            'notifications': notifications,
            'unread_count': unread_count,
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class MarkAllNotificationsReadView(View):
    def post(self, request):
        updated = AdminNotification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'ok': True, 'unread_count': 0, 'updated': updated})
        return redirect('admin-notifications')


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class MarkNotificationReadView(View):
    def post(self, request, notification_id):
        notification = AdminNotification.objects.filter(
            pk=notification_id,
            recipient=request.user,
        ).first()
        if not notification:
            return JsonResponse({'ok': False}, status=404)

        notification.is_read = True
        notification.save(update_fields=['is_read'])
        unread_count = AdminNotification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).count()
        return JsonResponse({'ok': True, 'unread_count': unread_count})


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ApproveOrderPageView(View):
    def post(self, request, order_id):
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return HttpResponse('Order not found.', status=404)
        try:
            approve_order(order)
        except Exception:
            messages.error(request, 'Only paid orders can be approved.')
            return redirect('admin-orders')
        messages.success(request, 'Order approved.')
        return redirect('admin-orders')


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductImportPageView(View):
    template_name = 'admin_ui/product_import_page.html'

    def get(self, request):
        return self.render_page(request, result=None)

    def post(self, request):
        file = request.FILES.get('file')
        image_files = request.FILES.getlist('image_files')
        result = None

        if not file:
            messages.error(request, 'Please upload a CSV/XLSX file.')
        else:
            result = import_products_from_file(
                file,
                image_files,
                created_by=request.user,
            )
            messages.success(
                request,
                f'Import complete: {result.rows_success} rows succeeded, {result.rows_failed} failed.',
            )

        return self.render_page(request, result=result)

    def render_page(self, request, result=None):
        return render(request, self.template_name, {
            'page_title': 'Bulk Product Import',
            'page_subtitle': 'Upload products with an optional image set.',
            'result': result,
            'download_template_url': '/admin/dashboard/products/import/download-template/',
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductImportTemplateDownloadView(View):
    def get(self, request):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'name', 'price', 'category', 'sku',
            'stock_quantity', 'description', 'size', 'color', 'is_active',
        ])
        writer.writerow([
            'Silk Wrap Dress', '2450', 'Dresses', 'SKU-DRESS-001',
            '10', 'Soft silk wrap dress', 'M', 'Ivory', 'true',
        ])
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = (
            'attachment; filename="product_import_template.csv"'
        )
        return response


class AdminPageView(View):
    template_name = 'admin_ui/admin_page.html'

    COLUMN_KEY_ALIASES = {
        'checkbox': 'checkbox',
        'product image': 'image',
        'product name': 'name',
        'category': 'category',
        'price': 'price',
        'stock': 'stock',
        'status': 'status',
        'actions': 'actions',
        'category image': 'image',
        'category name': 'name',
        'description': 'description',
        'products': 'products',
        'cover image': 'image',
        'collection name': 'name',
        'last updated': 'date',
        'product': 'name',
        'sku': 'sku',
        'current stock': 'stock',
        'low stock threshold': 'threshold',
        'customer': 'customer',
        'email': 'email',
        'order number': 'order',
        'date': 'date',
        'items': 'items',
        'total': 'total',
        'payment status': 'payment',
        'order status': 'status',
        'orders': 'orders',
        'total spent': 'spent',
        'last order': 'last_order',
        'joined date': 'joined',
        'discount name': 'name',
        'code': 'code',
        'type': 'type',
        'value': 'value',
        'usage': 'usage',
        'start date': 'start',
        'end date': 'end',
        'section': 'name',
        'preview': 'preview',
        'banner image': 'image',
        'title': 'title',
        'cta': 'cta',
        'position': 'position',
        'campaign name': 'name',
        'date': 'date',
        'product count': 'count',
        'metric': 'name',
        'period': 'period',
        'report metric': 'name',
        'method name': 'name',
        'delivery estimate': 'estimate',
        'provider': 'name',
        'connection status': 'status',
        'enabled': 'enabled',
        'configure': 'configure',
        'admin': 'name',
        'role': 'role',
        'last active': 'last',
        'account item': 'name',
        'notification': 'name',
        'type': 'type',
        'read': 'read',
    }

    PAGE_MAP = {
        'products': {
            'title': 'Products',
            'subtitle': 'Manage your boutique product catalog.',
            'primary_action': '+ Add Product',
            'primary_url': '/admin/dashboard/products/new/',
            'filters': ['Search products', 'Category filter', 'Collection filter', 'Status filter', 'Stock filter', 'Sort dropdown'],
            'columns': ['Checkbox', 'Product Image', 'Product Name', 'Category', 'Price', 'Stock', 'Status', 'Actions'],
            'empty_title': 'No products found.',
            'empty_description': 'Add Your First Product',
            'rows': [],
        },
        'categories': {
            'title': 'Categories',
            'subtitle': 'Manage product categories.',
            'primary_action': '+ Add Category',
            'primary_url': '/admin/dashboard/categories/new/',
            'filters': ['Search categories'],
            'columns': ['Category Image', 'Category Name', 'Description', 'Products', 'Status', 'Actions'],
            'rows': [],
        },
        'inventory': {
            'title': 'Inventory',
            'subtitle': 'Monitor and manage product inventory.',
            'primary_action': '+ Adjust Stock',
            'primary_url': '/admin/dashboard/inventory/adjust/',
            'filters': ['Stock status', 'Category', 'Collection'],
            'columns': ['Product', 'SKU', 'Category', 'Current Stock', 'Low Stock Threshold', 'Status', 'Actions'],
            'rows': [],
        },
        'orders': {
            'title': 'Orders',
            'subtitle': 'Track and manage customer purchases.',
            'primary_action': '+ Create Order',
            'primary_url': '/admin/dashboard/orders/new/',
            'filters': ['Search order number', 'Search customer', 'Order status', 'Payment status', 'Date filter'],
            'columns': ['Order Number', 'Customer', 'Date', 'Items', 'Total', 'Payment Status', 'Order Status', 'Actions'],
            'rows': [],
        },
        'customers': {
            'title': 'Customers',
            'subtitle': 'Manage customer accounts.',
            'primary_action': '+ Invite Customer',
            'primary_url': '/admin/dashboard/customers/new/',
            'filters': ['Search customers', 'Customer status', 'Date joined', 'Sort'],
            'columns': ['Customer', 'Email', 'Orders', 'Total Spent', 'Last Order', 'Joined Date', 'Actions'],
            'rows': [],
        },
        'analytics': {
            'title': 'Analytics Overview',
            'subtitle': 'Deeper store business insights.',
            'primary_action': 'Export Report',
            'primary_url': '/admin/dashboard/reports/',
            'filters': ['Date range'],
            'columns': ['Metric', 'Value', 'Period'],
            'rows': [
                {'name': 'Total Revenue', 'value': 'KES 276,000',
                    'period': 'This Year'},
                {'name': 'Total Orders', 'value': '248', 'period': 'This Year'},
                {'name': 'Returning Customers',
                    'value': '34%', 'period': 'This Year'},
            ],
        },
        'reports': {
            'title': 'Sales Reports',
            'subtitle': 'Detailed sales reporting.',
            'primary_action': 'Export Report',
            'primary_url': '/admin/dashboard/reports/export/',
            'filters': ['Date range selector'],
            'columns': ['Report Metric', 'Value'],
            'rows': [
                {'name': 'Gross Sales', 'value': 'KES 482,000'},
                {'name': 'Net Sales', 'value': 'KES 441,200'},
                {'name': 'Refunds', 'value': 'KES 3,400'},
            ],
        },
        'performance': {
            'title': 'Product Performance',
            'subtitle': 'Understand product performance.',
            'primary_action': 'Export Performance',
            'primary_url': '/admin/dashboard/performance/export/',
            'filters': ['Product performance'],
            'columns': ['Product', 'Units Sold', 'Revenue', 'Stock'],
            'rows': [
                {'name': 'Atelier Silk Wrap Dress', 'units': '34',
                    'revenue': 'KES 163,200', 'stock': '12'},
            ],
        },
        'admin-users': {
            'title': 'Admin Users',
            'subtitle': 'Manage administrators and staff.',
            'primary_action': '+ Invite Admin',
            'primary_url': '/admin/dashboard/admin-users/invite/',
            'filters': ['Role filter', 'Status filter'],
            'columns': ['Admin', 'Email', 'Role', 'Status', 'Last Active', 'Actions'],
            'rows': [],
        },
        'profile': {
            'title': 'My Profile',
            'subtitle': 'Admin profile and account settings.',
            'primary_action': 'Account Settings',
            'primary_url': '/admin/dashboard/profile/settings/',
            'filters': ['Profile'],
            'columns': ['Account Item', 'Value'],
            'rows': [
                {'name': 'My Profile', 'value': 'Active'},
                {'name': 'Change Password', 'value': 'Enabled'},
                {'name': 'Sign Out', 'value': 'Available'},
            ],
        },
    }

    @method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    @staticmethod
    def _normalize_database_row(row):
        return row

    def _render_product_cell(self, column, row):
        safe_column = column.lower().strip()
        if safe_column == 'checkbox':
            return mark_safe('<input type="checkbox" class="admin-row-check" />')
        if safe_column == 'product image':
            image = row.get('image') or ''
            if image:
                return mark_safe(
                    f'<img class="admin-product-thumb" src="{image}" alt="{row.get("name", "Product")}" />'
                )
            return mark_safe('<span class="admin-product-thumb-placeholder">Image</span>')
        if safe_column == 'product name':
            product_id = row.get('id') or ''
            product_name = row.get('name') or 'Unnamed product'
            if product_id:
                return mark_safe(
                    f'<a href="/admin/dashboard/products/{product_id}/" class="admin-product-name-link">{product_name}</a>'
                )
            return mark_safe(product_name)
        if safe_column == 'actions':
            actions = row.get('actions') or []
            product_id = row.get('id') or ''
            options = ['<option selected disabled>Actions</option>']
            route_map = {
                'View': f'/admin/dashboard/products/{product_id}/',
                'Edit': f'/admin/dashboard/products/{product_id}/edit/',
                'Duplicate': f'/admin/dashboard/products/{product_id}/duplicate/',
                'Archive': f'/admin/dashboard/confirm/?action=archive-product&product_id={product_id}',
                'Delete': f'/admin/dashboard/confirm/?action=delete-product&product_id={product_id}',
            }
            for action in actions:
                route = route_map.get(action)
                if route:
                    options.append(
                        f'<option value="{route}">{action}</option>')
            return mark_safe(
                '<select class="admin-action-select" onchange="if (this.value) window.location.href=this.value" aria-label="Actions">'
                + ''.join(options) + '</select>'
            )
        key = self.COLUMN_KEY_ALIASES.get(safe_column, safe_column)
        return row.get(key, '')

    def _render_category_cell(self, column, row):
        safe_column = column.lower().strip()
        if safe_column == 'category image':
            image = row.get('image') or ''
            if image:
                return mark_safe(
                    f'<img class="admin-product-thumb" src="{image}" alt="{row.get("name", "Category")}" />'
                )
            return mark_safe('<span class="admin-product-thumb-placeholder">Image</span>')
        if safe_column == 'actions':
            actions = row.get('actions') or []
            category_id = row.get('id') or ''
            options = ['<option selected disabled>Actions</option>']
            route_map = {
                'Edit': f'/admin/dashboard/categories/{category_id}/edit/',
                'Delete': f'/admin/dashboard/categories/{category_id}/delete/',
            }
            for action in actions:
                route = route_map.get(action)
                if route:
                    options.append(
                        f'<option value="{route}">{action}</option>')
            return mark_safe(
                '<select class="admin-action-select" onchange="if (this.value) window.location.href=this.value" aria-label="Actions">'
                + ''.join(options) + '</select>'
            )
        key = self.COLUMN_KEY_ALIASES.get(safe_column, safe_column)
        return row.get(key, '')

    def _render_order_cell(self, column, row):
        safe_column = column.lower().strip()
        if safe_column == 'actions':
            order_id = row.get('id') or ''
            actions = [
                f'<a class="admin-action-link" href="/admin/dashboard/orders/{order_id}/">View</a>'
            ]
            if row.get('payment') == 'Paid' and row.get('status') != 'Confirmed':
                actions.append(
                    f'<form method="post" action="/admin/dashboard/orders/{order_id}/approve/" style="display:inline;">'
                    '<input type="hidden" name="csrfmiddlewaretoken" value="{{ csrf_token }}">'
                    '<button type="submit" class="admin-action-link" style="background:#2f3a32;color:#fff;border:none;cursor:pointer;">Approve</button>'
                    '</form>'
                )
            return mark_safe(' '.join(actions))
        if safe_column == 'status':
            value = row.get('status', '')
            css = str(value).lower().replace(' ', '-')
            return mark_safe(f'<span class="status-badge {css}">{value}</span>')
        key = self.COLUMN_KEY_ALIASES.get(safe_column, safe_column)
        return row.get(key, '')

    def _render_page_cell(self, page, column, row):
        if page == 'products':
            return self._render_product_cell(column, row)
        if page == 'categories':
            return self._render_category_cell(column, row)
        if page == 'orders':
            return self._render_order_cell(column, row)
        safe_column = column.lower().strip()
        key = self.COLUMN_KEY_ALIASES.get(safe_column, safe_column)
        return row.get(key, '')

    def get(self, request, page='products', *args, **kwargs):
        order_id = kwargs.get('order_id')
        page_data = self.PAGE_MAP.get(page, {
            'title': page.replace('-', ' ').title(),
            'subtitle': 'Manage this admin area.',
            'primary_action': 'Create',
            'primary_url': '/admin/dashboard/',
            'filters': [],
            'columns': ['Name', 'Status'],
            'rows': [],
        })

        if order_id:
            page_data = dict(page_data)
            page_data['selected_order_id'] = str(order_id)
        query = (request.GET.get('q') or request.GET.get(
            'search') or '').strip()

        if page == 'products':
            product_rows = []
            products = Product.objects.select_related(
                'category').prefetch_related('variants').order_by('-created_at')
            if query:
                products = products.filter(
                    Q(name__icontains=query)
                    | Q(description__icontains=query)
                    | Q(slug__icontains=query)
                    | Q(category__name__icontains=query)
                    | Q(variants__sku__icontains=query)
                ).distinct()
            for product in products:
                image = Product.normalize_images(product.images)[
                    0] if Product.normalize_images(product.images) else ''
                stock_total = sum(
                    variant.stock_quantity for variant in product.variants.all())
                product_price = Decimal(product.price_minor) / Decimal(100)
                product_rows.append({
                    'checkbox': mark_safe('<input type="checkbox" class="admin-row-check" />'),
                    'id': str(product.pk),
                    'image': image,
                    'name': product.name,
                    'category': product.category.name,
                    'price': f'KES {product_price:.2f}',
                    'stock': str(stock_total),
                    'status': product.get_status_display(),
                    'actions': ['View', 'Edit', 'Duplicate', 'Archive', 'Delete'],
                })
            page_data = dict(page_data)
            page_data['rows'] = product_rows

        if page == 'categories':
            category_rows = []
            categories = Category.objects.annotate(
                product_count=Count('products')).order_by('name')
            if query:
                categories = categories.filter(
                    Q(name__icontains=query) | Q(description__icontains=query)
                )
            for category in categories:
                category_rows.append({
                    'id': str(category.pk),
                    'image': category.image_url or '',
                    'name': category.name,
                    'description': category.description,
                    'products': str(category.product_count),
                    'status': 'Active' if category.is_active else 'Inactive',
                    'actions': ['Edit', 'Delete'],
                })
            page_data = dict(page_data)
            page_data['rows'] = category_rows

        if page == 'inventory':
            inventory_rows = []
            variants = ProductVariant.objects.select_related(
                'product__category').order_by('product__name', 'sku')
            if query:
                variants = variants.filter(
                    Q(sku__icontains=query)
                    | Q(product__name__icontains=query)
                    | Q(product__category__name__icontains=query)
                )
            for variant in variants:
                product = variant.product
                stock = variant.stock_quantity
                inventory_rows.append({
                    'id': str(product.pk),
                    'name': product.name,
                    'sku': variant.sku,
                    'category': product.category.name,
                    'stock': str(stock),
                    'threshold': '3',
                    'status': 'Low Stock' if stock <= 3 else 'In Stock' if stock > 0 else 'Out of Stock',
                    'actions': 'View',
                })
            page_data = dict(page_data)
            page_data['rows'] = inventory_rows

        if page == 'orders':
            order_rows = []
            orders = Order.objects.order_by('-created_at')
            status = request.GET.get('status')
            payment_status = request.GET.get('payment_status')

            if status:
                orders = orders.filter(status=status)
            if payment_status:
                orders = orders.filter(payment_status=payment_status)
            if query:
                orders = orders.filter(
                    Q(order_number__icontains=query)
                    | Q(customer__fullName__icontains=query)
                    | Q(customer__full_name__icontains=query)
                    | Q(customer__email__icontains=query)
                    | Q(customer__name__icontains=query)
                )
            for order in orders:
                customer = order.customer or {}
                customer_name = (
                    customer.get('fullName')
                    or customer.get('full_name')
                    or customer.get('name')
                    or ' '.join(filter(None, [
                        customer.get('first_name'),
                        customer.get('last_name'),
                    ]))
                    or customer.get('email')
                    or 'Guest customer'
                )
                order_rows.append({
                    'id': str(order.pk),
                    'order': f'#{order.order_number}',
                    'customer': customer_name,
                    'date': order.created_at.strftime('%b %d, %Y'),
                    'item_count': str(order.items.count()),
                    'total': f'KES {Decimal(order.total_minor) / Decimal(100):.2f}',
                    'payment': order.get_payment_status_display(),
                    'status': order.get_status_display(),
                    'actions': 'View',
                })
            page_data = dict(page_data)
            page_data['rows'] = order_rows

        if page == 'customers':
            customer_rows = []
            User = get_user_model()
            users = User.objects.filter(is_staff=False).annotate(
                order_count=Count('orders'),
                total_spent=Sum('orders__total_minor')
            ).order_by('-date_joined')
            if query:
                users = users.filter(Q(username__icontains=query) | Q(email__icontains=query) | Q(
                    first_name__icontains=query) | Q(last_name__icontains=query))
            for u in users:
                last_order = u.orders.order_by('-created_at').first()
                spent = Decimal(u.total_spent or 0) / Decimal(100)
                customer_rows.append({
                    'id': str(u.pk),
                    'customer': u.get_full_name() or u.username,
                    'email': u.email,
                    'orders': str(u.order_count),
                    'spent': f'KES {spent:.2f}',
                    'last_order': last_order.created_at.strftime('%b %d, %Y') if last_order else '-',
                    'joined': u.date_joined.strftime('%b %d, %Y'),
                    'actions': 'View'
                })
            page_data = dict(page_data)
            page_data['rows'] = customer_rows

        if page == 'admin-users':
            admin_rows = []
            User = get_user_model()
            admins = User.objects.filter(is_staff=True).order_by('username')
            if query:
                admins = admins.filter(
                    Q(username__icontains=query) | Q(email__icontains=query))
            for a in admins:
                admin_rows.append({
                    'id': str(a.pk),
                    'name': a.get_full_name() or a.username,
                    'email': a.email,
                    'role': 'Super Admin' if a.is_superuser else 'Staff',
                    'status': 'Active' if a.is_active else 'Inactive',
                    'last': a.last_login.strftime('%b %d, %Y') if a.last_login else 'Never',
                    'actions': 'View'
                })
            page_data = dict(page_data)
            page_data['rows'] = admin_rows

        if page == 'profile':
            u = request.user
            profile_rows = [
                {'name': 'My Profile', 'value': u.get_full_name() or u.username},
                {'name': 'Email', 'value': u.email},
                {'name': 'Role', 'value': 'Super Admin' if u.is_superuser else 'Staff'},
                {'name': 'Sign Out', 'value': 'Available'},
            ]
            page_data = dict(page_data)
            page_data['rows'] = profile_rows

        if page == 'analytics':
            total_revenue = Decimal(Order.objects.filter(status__in=[
                                    'confirmed', 'processing', 'shipped', 'delivered']).aggregate(s=Sum('total_minor'))['s'] or 0) / Decimal(100)
            total_orders = Order.objects.count()
            analytics_rows = [
                {'name': 'Total Revenue', 'value': f'KES {total_revenue:.2f}',
                    'period': 'All Time'},
                {'name': 'Total Orders', 'value': str(
                    total_orders), 'period': 'All Time'},
            ]
            page_data = dict(page_data)
            page_data['rows'] = analytics_rows

        if page == 'reports':
            gross = Decimal(Order.objects.aggregate(
                s=Sum('total_minor'))['s'] or 0) / Decimal(100)
            refunds = Decimal(Order.objects.filter(payment_status='refunded').aggregate(
                s=Sum('total_minor'))['s'] or 0) / Decimal(100)
            net = gross - refunds
            report_rows = [
                {'name': 'Gross Sales', 'value': f'KES {gross:.2f}'},
                {'name': 'Refunds', 'value': f'KES {refunds:.2f}'},
                {'name': 'Net Sales', 'value': f'KES {net:.2f}'},
            ]
            page_data = dict(page_data)
            page_data['rows'] = report_rows

        if page == 'performance':
            perf_rows = []
            items = OrderItem.objects.values('product__id', 'product_name').annotate(
                units=Sum('quantity'), rev=Sum('line_total_minor')).order_by('-units')[:20]
            for it in items:
                try:
                    p = Product.objects.get(pk=it['product__id'])
                    stock = sum(v.stock_quantity for v in p.variants.all())
                except:
                    stock = 0
                rev = Decimal(it['rev'] or 0) / Decimal(100)
                perf_rows.append({
                    'name': it['product_name'] or 'Unknown',
                    'units': str(it['units']),
                    'revenue': f'KES {rev:.2f}',
                    'stock': str(stock)
                })
            page_data = dict(page_data)
            page_data['rows'] = perf_rows

        columns = page_data.get('columns', [])
        rows = page_data.get('rows', [])
        grid_rows = []

        for row in rows:
            grid_row = []
            for column in columns:
                grid_row.append(self._render_page_cell(page, column, row))
            grid_rows.append(grid_row)

        page_context = {
            'page': page,
            'title': page_data['title'],
            'subtitle': page_data['subtitle'],
            'primary_action': page_data['primary_action'],
            'primary_url': page_data['primary_url'],
            'filters': page_data.get('filters', []),
            'columns': columns,
            'rows': rows,
            'empty_title': page_data.get('empty_title', 'No items found.'),
            'empty_description': page_data.get('empty_description', 'Create the first item to start managing this section.'),
        }

        return render(request, self.template_name, {
            'page_data': page_context,
            'page': page,
            'page_title': page_data['title'],
            'page_subtitle': page_data['subtitle'],
            'page_metric': page,
            'page_primary_action': page_data['primary_action'],
            'page_primary_url': page_data['primary_url'],
            'admin_page_filters': page_data.get('filters', []),
            'admin_page_columns': columns,
            'admin_page_rows': grid_rows,
            'show_search': True,
            'empty_title': page_data.get('empty_title', 'No items found.'),
            'empty_description': page_data.get('empty_description', 'Create the first item to start managing this section.'),
            'data_loaded': True,
            'bulk_actions': page_data.get('bulk_actions', [
                'Publish', 'Archive', 'Delete', 'Assign Category', 'Assign Collection'
            ]) if page == 'products' else [],
            'title': page_data['title'],
            'description': page_data['subtitle'],
            'admin_page': page,
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class DashboardView(View):
    template_name = 'admin_ui/dashboard.html'

    def get(self, request):
        return self.render_dashboard(request)

    def post(self, request):
        action = request.POST.get('action')
        if action == 'create-product':
            form = ProductCreateForm(request.POST, request.FILES)
            if form.is_valid():
                metadata = ProductGenerationService.generate_product_metadata(
                    form.cleaned_data['name'])
                data = {**form.cleaned_data, **(metadata or {})}
                self.create_product(data,
                                    request.FILES.get('image_file'))
                messages.success(request, 'Product and first variant created.')
                return redirect('admin-products')
            return self.render_dashboard(request, product_form=form)
        if action == 'update-product':
            product = Product.objects.filter(
                pk=request.POST.get('product_id')).first()
            if not product:
                messages.error(request, 'Product not found.')
                return redirect('admin-products')
            form = ProductUpdateForm(
                request.POST, request.FILES, product=product)
            if form.is_valid():
                self.update_product(product, form.cleaned_data,
                                    request.FILES.get('image_file'))
                messages.success(request, 'Product updated.')
                return redirect('admin-products')
            return self.render_dashboard(request, product_form=form)
        if action == 'archive-product':
            product = Product.objects.filter(
                pk=request.POST.get('product_id')).first()
            if not product:
                messages.error(request, 'Product not found.')
                return redirect('admin-products')
            self.archive_product(product)
            messages.success(request, 'Product archived.')
            return redirect('admin-products')
        if action == 'delete-product':
            product = Product.objects.filter(
                pk=request.POST.get('product_id')).first()
            if not product:
                messages.error(request, 'Product not found.')
                return redirect('admin-products')
            try:
                self.delete_product(product)
            except IntegrityError:
                messages.error(
                    request,
                    'This product cannot be deleted because it is referenced by an order, cart, or inventory record. Archive it instead.',
                )
            else:
                messages.success(request, 'Product deleted.')
            return redirect('admin-products')
        if action == 'delete-selected-products':
            raw_ids = request.POST.getlist('product_ids')
            selected_ids = []
            for raw in raw_ids:
                selected_ids.extend(
                    [part.strip() for part in raw.split(',') if part.strip()]
                )
            selected_ids = list(dict.fromkeys(selected_ids))
            if not selected_ids:
                messages.error(
                    request, 'Select at least one product to delete.')
                return redirect('admin-products')

            products = list(Product.objects.filter(pk__in=selected_ids))
            if not products:
                messages.error(request, 'No products were found to delete.')
                return redirect('admin-products')

            deleted = 0
            for product in products:
                try:
                    self.delete_product(product)
                    deleted += 1
                except IntegrityError:
                    continue
            if deleted:
                messages.success(
                    request,
                    f'{deleted} product{"s" if deleted != 1 else ""} deleted.'
                )
            if deleted != len(products):
                messages.warning(
                    request,
                    'Some selected products could not be deleted because they are referenced by orders or carts.'
                )
            return redirect('admin-products')
        if action == 'adjust-stock':
            form = StockAdjustmentForm(request.POST)
            if form.is_valid():
                data = form.cleaned_data
                adjust_stock(data['variant'].id, data['delta'],
                             data['reason'], request.user)
                messages.success(request, 'Inventory updated.')
                return redirect('admin-dashboard')
            return self.render_dashboard(request, stock_form=form)
        if action == 'delete-category':
            category = Category.objects.filter(
                pk=request.POST.get('category_id')).first()
            if not category:
                messages.error(request, 'Category not found.')
                return redirect('admin-dashboard')
            try:
                category.delete()
            except IntegrityError:
                messages.error(
                    request,
                    'This category cannot be deleted because products still use it. Edit or move those products first.',
                )
            else:
                messages.success(request, 'Category deleted.')
            return redirect('admin-dashboard')
        messages.error(request, 'Unknown dashboard action.')
        return redirect('admin-dashboard')

    def render_dashboard(self, request, product_form=None, stock_form=None):
        products = Product.objects.select_related(
            'category').prefetch_related('variants')
        categories = Category.objects.annotate(product_count=Count('products'))
        variants = ProductVariant.objects.select_related(
            'product').order_by('product__name', 'sku')

        range_value = request.GET.get('range', '7')
        try:
            sales_window_days = int(range_value)
        except (TypeError, ValueError):
            sales_window_days = 7
        sales_window_days = max(7, min(sales_window_days, 90))

        # Core dashboard metrics and lightweight activity feeds.
        # The total revenue KPI must be derived from the database by excluding pending/cancelled
        # order rows, so only approved, active revenue streams are counted.
        total_revenue_minor = Order.objects.exclude(
            status=Order.Status.PENDING
        ).exclude(
            status=Order.Status.CANCELLED
        ).aggregate(
            total_revenue=Sum('total_minor')
        ).get('total_revenue') or 0
        total_revenue_kes = Decimal(total_revenue_minor) / Decimal('100')

        # A real pending-revenue KPI must read the live Order table directly from the database.
        pending_revenue_minor = Order.objects.filter(
            status=Order.Status.PENDING
        ).aggregate(
            pending_revenue=Sum('total_minor')
        ).get('pending_revenue') or 0
        pending_revenue_kes = Decimal(pending_revenue_minor) / Decimal('100')

        total_orders = Order.objects.count()
        total_customers = get_user_model().objects.filter(is_staff=False).count()
        low_stock_variants = ProductVariant.objects.filter(
            stock_quantity__lte=3).select_related('product')
        low_stock_count = low_stock_variants.count()
        recent_orders = Order.objects.order_by('-created_at')[:5]

        sales_overview = []
        end_day = timezone.now().date()
        max_total = 0
        for offset in range(sales_window_days):
            day = end_day - timedelta(days=sales_window_days - 1 - offset)
            total_minor = Order.objects.filter(created_at__date=day).aggregate(
                total=Sum('total_minor'))['total'] or 0
            daily_total = Decimal(total_minor) / Decimal(100)
            max_total = max(max_total, float(daily_total))
            sales_overview.append({
                'label': day.strftime('%a'),
                'value': daily_total,
                'day': day.strftime('%b %d'),
            })

        for point in sales_overview:
            percentage = 0
            if max_total:
                percentage = (float(point['value']) / max_total) * 100
            point['height'] = max(8, percentage)

        for order in recent_orders:
            order.total_display = f'KES {Decimal(order.total_minor) / Decimal(100):.2f}'

        # Build recent activity list from known order and product changes.
        # This mirrors the requested admin dashboard experience without changing the existing data model.
        recent_activity = []
        for order in recent_orders:
            customer = order.customer or {}
            name = (
                customer.get('fullName')
                or customer.get('full_name')
                or customer.get('name')
                or ' '.join(filter(None, [
                    customer.get('first_name'),
                    customer.get('last_name'),
                ]))
                or customer.get('email')
                or 'Guest customer'
            )
            recent_activity.append({
                'title': f'New order received: #{order.order_number}',
                'description': f'{name} • KES {Decimal(order.total_minor)/Decimal(100):.2f}',
                'timestamp': order.created_at.strftime('%b %d, %Y'),
                'icon': 'Order',
            })

        for product in Product.objects.order_by('-updated_at')[:3]:
            recent_activity.append({
                'title': f'Product updated: {product.name}',
                'description': product.status,
                'timestamp': product.updated_at.strftime('%b %d, %Y'),
                'icon': 'Product',
            })

        # Keep the list concise and relevant for the template.
        recent_activity = recent_activity[:5]

        return render(request, self.template_name, {
            'products': products,
            'categories': categories,
            'categories_count': Category.objects.filter(is_active=True).count(),
            'total_stock': sum(variant.stock_quantity for variant in variants),
            'low_stock_count': low_stock_count,
            'product_form': product_form or ProductCreateForm(),
            'stock_form': stock_form or StockAdjustmentForm(),
            'total_revenue_kes': total_revenue_kes,
            'pending_revenue_kes': pending_revenue_kes,
            'total_orders': total_orders,
            'total_customers': total_customers,
            'orders_needing_attention': Order.objects.filter(
                status__in=['pending', 'confirmed', 'processing']
            ).count(),
            'orders': recent_orders,
            'low_stock_products': low_stock_variants[:8],
            'recent_activity': recent_activity,
            'sales_overview': sales_overview,
            'sales_range': sales_window_days,
        })

    @staticmethod
    def sync_image_fields(product, image_path):
        image_path = (image_path or '').strip()
        if not image_path:
            return product

        existing_images = [img for img in Product.normalize_images(
            product.images) if img and img != image_path]
        product.images = [image_path, *existing_images]
        return product

    @staticmethod
    @transaction.atomic
    def create_product(data, uploaded_image=None):
        image_path = ''
        if uploaded_image:
            file_name = uploaded_image.name
            safe_name = f"{uuid.uuid4()}_{file_name}"
            saved_path = default_storage.save(
                f'products/{safe_name}', uploaded_image)
            image_path = default_storage.url(saved_path)

        product = Product.objects.create(
            category=data['category'],
            name=data['name'],
            slug=data['slug'],
            description=data['description'],
            price_minor=int(
                (data['price'] * Decimal('100')).quantize(Decimal('1'))),
            status=data['status'],
            images=[image_path] if image_path else [],
        )
        ProductVariant.objects.create(
            product=product,
            sku=data['sku'] or ProductGenerationService.generate_internal_code(
                data['name']),
            size=data['size'],
            color=data['color'],
            stock_quantity=data['stock_quantity'],
        )

    @staticmethod
    @transaction.atomic
    def update_product(product, data, uploaded_image=None):
        image_path = ''
        if uploaded_image:
            file_name = uploaded_image.name
            safe_name = f"{uuid.uuid4()}_{file_name}"
            saved_path = default_storage.save(
                f'products/{safe_name}', uploaded_image)
            image_path = default_storage.url(saved_path)

        product.category = data['category']
        product.name = data['name']
        product.slug = data['slug']
        product.description = data['description']
        product.price_minor = int(
            (data['price'] * Decimal('100')).quantize(Decimal('1')))
        product.status = data['status']

        if image_path:
            DashboardView.sync_image_fields(product, image_path)

        product.save()

    @staticmethod
    @transaction.atomic
    def archive_product(product):
        product.status = Product.Status.ARCHIVED
        product.save(update_fields=['status', 'updated_at'])

    @staticmethod
    @transaction.atomic
    def delete_product(product):
        image_paths = Product.normalize_images(product.images)
        product.delete()
        for image_path in image_paths:
            storage_path = object_key_from_url(image_path) or image_path.removeprefix(
                settings.MEDIA_URL)
            if storage_path:
                default_storage.delete(storage_path)


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class CategoryCreatePageView(View):
    template_name = 'admin_ui/category_form_page.html'

    def get(self, request):
        return self.render_form(request, CategoryForm())

    def post(self, request):
        form = CategoryForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Category created.')
            return redirect('admin-dashboard')
        return self.render_form(request, form)

    def render_form(self, request, form):
        return render(request, self.template_name, {
            'form': form,
            'page_title': 'Add a category',
            'page_subtitle': 'Create a collection for organizing your products.',
            'submit_label': 'Add category',
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class CategoryEditPageView(View):
    template_name = 'admin_ui/category_form_page.html'

    def get_category(self, category_id):
        return Category.objects.filter(pk=category_id).first()

    def get(self, request, category_id):
        category = self.get_category(category_id)
        if not category:
            messages.error(request, 'Category not found.')
            return redirect('admin-dashboard')
        return self.render_form(request, CategoryForm(instance=category), category)

    def post(self, request, category_id):
        category = self.get_category(category_id)
        if not category:
            messages.error(request, 'Category not found.')
            return redirect('admin-dashboard')
        form = CategoryForm(request.POST, instance=category)
        if form.is_valid():
            form.save()
            messages.success(request, 'Category updated.')
            return redirect('admin-dashboard')
        return self.render_form(request, form, category)

    def render_form(self, request, form, category=None):
        return render(request, self.template_name, {
            'form': form,
            'category': category,
            'page_title': 'Edit category',
            'page_subtitle': 'Update the collection details shown to customers.',
            'submit_label': 'Save changes',
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class CategoryDeletePageView(View):
    def get(self, request, category_id):
        category = Category.objects.filter(pk=category_id).first()
        if not category:
            messages.error(request, 'Category not found.')
            return redirect('admin-dashboard')
        try:
            category.delete()
        except IntegrityError:
            messages.error(request,
                           'This category cannot be deleted because products still use it. Edit or move those products first.')
        else:
            messages.success(request, 'Category deleted.')
        return redirect('admin-dashboard')


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductCreatePageView(View):
    template_name = 'admin_ui/product_form_page.html'

    def get(self, request):
        return self.render_form(request, ProductCreateForm())

    def post(self, request):
        form = ProductCreateForm(request.POST, request.FILES)
        if form.is_valid():
            metadata = ProductGenerationService.generate_product_metadata(
                form.cleaned_data['name'])
            data = {**form.cleaned_data, **(metadata or {})}
            DashboardView.create_product(data, request.FILES.get('image_file'))
            messages.success(request, 'Product and first variant created.')
            return redirect('admin-dashboard')
        return self.render_form(request, form)

    def render_form(self, request, form):
        return render(request, self.template_name, {
            'form': form,
            'page_title': 'Add a product',
            'page_subtitle': 'Create a new product and first inventory entry.',
            'submit_label': 'Add to shop',
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductEditPageView(View):
    template_name = 'admin_ui/product_form_page.html'

    def get(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            messages.error(request, 'Product not found.')
            return redirect('admin-dashboard')
        form = ProductUpdateForm(
            initial={
                'product_id': product.pk,
                'name': product.name,
                'slug': product.slug,
                'category': product.category_id,
                'description': product.description,
                'price': product.price_display,
                'status': product.status,
            },
            product=product,
        )
        return self.render_form(request, form, product)

    def post(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            messages.error(request, 'Product not found.')
            return redirect('admin-products')
        form = ProductUpdateForm(request.POST, request.FILES, product=product)
        if form.is_valid():
            DashboardView.update_product(product, form.cleaned_data,
                                         request.FILES.get('image_file'))
            messages.success(request, 'Product updated.')
            return redirect('admin-products')
        return self.render_form(request, form, product)

    def render_form(self, request, form, product=None):
        return render(request, self.template_name, {
            'form': form,
            'product': product,
            'page_title': 'Edit product',
            'page_subtitle': 'Adjust product details and update the item description.',
            'submit_label': 'Save changes',
            'show_archive': bool(product),
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductDetailPageView(View):
    template_name = 'admin_ui/product_detail_page.html'

    def get(self, request, product_id):
        product = Product.objects.select_related('category').prefetch_related(
            'variants').filter(pk=product_id).first()
        if not product:
            messages.error(request, 'Product not found.')
            return redirect('admin-dashboard')
        primary_variant = product.variants.order_by('sku').first()
        stock_adjust_url = (
            f'/admin/dashboard/inventory/adjust/?variant={primary_variant.id}'
            if primary_variant else '/admin/dashboard/inventory/adjust/'
        )
        return render(request, self.template_name, {
            'product': product,
            'primary_variant': primary_variant,
            'stock_adjust_url': stock_adjust_url,
            'page_title': 'Product Details',
            'page_subtitle': product.name,
            'page_primary_action': 'Edit Product',
            'page_primary_url': f'/admin/dashboard/products/{product.id}/edit/',
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class OrderDetailPageView(View):
    template_name = 'admin_ui/order_detail_page.html'

    def get(self, request, order_id):
        order = Order.objects.prefetch_related(
            'items__variant', 'items__product').filter(pk=order_id).first()
        if not order:
            messages.error(request, 'Order not found.')
            return redirect('admin-orders')

        customer = order.customer or {}
        customer_name = (
            customer.get('fullName')
            or customer.get('full_name')
            or customer.get('name')
            or 'Guest customer'
        )
        customer_email = customer.get('email') or (
            order.user.email if order.user else '')
        subtotal = Decimal(order.subtotal_minor) / Decimal(100)
        shipping_total = Decimal(order.shipping_cost_minor) / Decimal(100)
        total = Decimal(order.total_minor) / Decimal(100)

        items = []
        for item in order.items.all():
            items.append({
                'id': item.id,
                'product_name': item.product_name,
                'variant_sku': item.variant_sku,
                'variant_size': item.variant_size,
                'variant_color': item.variant_color,
                'image_url': item.image_url,
                'quantity': item.quantity,
                'line_total_minor': item.line_total_minor,
                'line_total_display': Decimal(item.line_total_minor) / Decimal(100),
            })

        is_delivery_payment = order.payment_method in {
            'cash_on_delivery',
            'pay_on_delivery',
        }
        can_approve = (
            (
                order.payment_status == Order.PaymentStatus.PAID
                or is_delivery_payment
            )
            and order.status != Order.Status.CONFIRMED
        )

        return render(request, self.template_name, {
            'order': order,
            'customer_name': customer_name,
            'customer_email': customer_email,
            'subtotal': subtotal,
            'shipping_total': shipping_total,
            'total': total,
            'items': items,
            'page_title': f'Order {order.order_number}',
            'page_subtitle': 'Review the full order and approve payment.',
            'can_approve': can_approve,
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductDuplicatePageView(View):
    def get(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            messages.error(request, 'Product not found.')
            return redirect('admin-dashboard')
        try:
            with transaction.atomic():
                new_product = Product.objects.create(
                    category=product.category,
                    name=f'{product.name} Copy',
                    slug=f'{product.slug}-copy-{uuid.uuid4().hex[:8]}',
                    tagline=product.tagline,
                    description=product.description,
                    details=list(product.details or []),
                    price_minor=product.price_minor,
                    compare_at_price_minor=product.compare_at_price_minor,
                    images=list(product.images or []),
                    status=product.status,
                    is_featured=product.is_featured,
                    is_new_arrival=product.is_new_arrival,
                    is_best_seller=product.is_best_seller,
                )
                for variant in product.variants.all():
                    ProductVariant.objects.create(
                        product=new_product,
                        sku=f'{variant.sku}-copy',
                        size=variant.size,
                        color=variant.color,
                        color_hex=variant.color_hex,
                        price_minor=variant.price_minor,
                        stock_quantity=variant.stock_quantity,
                        is_active=variant.is_active,
                    )
            messages.success(request, 'Product duplicated.')
            return redirect(f'/admin/dashboard/products/{new_product.pk}/edit/')
        except IntegrityError:
            messages.error(
                request, 'The duplicated product could not be created.')
            return redirect('admin-dashboard')


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductArchivePageView(View):
    def get(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            messages.error(request, 'Product not found.')
            return redirect('admin-products')
        DashboardView.archive_product(product)
        messages.success(request, 'Product archived.')
        return redirect('admin-products')


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProductDeletePageView(View):
    def get(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            messages.error(request, 'Product not found.')
            return redirect('admin-products')
        try:
            DashboardView.delete_product(product)
        except IntegrityError:
            messages.error(
                request, 'This product cannot be deleted because it is referenced by an order, cart, or inventory record. Archive it instead.')
        else:
            messages.success(request, 'Product deleted.')
        return redirect('admin-products')


@method_decorator(user_passes_test(is_superuser, login_url='admin-login'), name='dispatch')
class AdminUserInvitePageView(View):
    template_name = 'admin_ui/admin_user_invite_page.html'

    def get(self, request):
        return render(request, self.template_name, {
            'page_title': 'Invite Admin',
            'page_subtitle': 'Create a staff administrator account and grant admin powers.',
            'submit_label': 'Send Invite',
            'form': AdminSignupForm(allow_superuser=True),
        })

    def post(self, request):
        form = AdminSignupForm(request.POST, allow_superuser=True)
        if form.is_valid():
            user = form.save()
            notify_staff(
                category='system',
                title='New admin account created',
                message=f'{user.get_full_name() or user.username} ({user.email}) was added as an administrator.',
                recipient=user,
            )
            messages.success(
                request, f'Administrator {user.username} created and granted admin powers.')
            return redirect('admin-users')
        return render(request, self.template_name, {
            'page_title': 'Invite Admin',
            'page_subtitle': 'Create a staff administrator account and grant admin powers.',
            'submit_label': 'Send Invite',
            'form': form,
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class ProfileSettingsPageView(View):
    template_name = 'admin_ui/profile_settings_page.html'

    def get(self, request):
        return render(request, self.template_name, {
            'page_title': 'My Profile',
            'page_subtitle': 'Admin profile and account settings.',
            'submit_label': 'Save Settings',
            'form': None,
            'user': request.user,
        })


@method_decorator(user_passes_test(is_staff, login_url='admin-login'), name='dispatch')
class StockAdjustmentPageView(View):
    template_name = 'admin_ui/stock_form_page.html'

    def get(self, request):
        variant_id = request.GET.get('variant')
        initial = {}
        if variant_id:
            variant = ProductVariant.objects.filter(pk=variant_id).first()
            if variant:
                initial['variant'] = variant
        return self.render_form(request, StockAdjustmentForm(initial=initial))

    def post(self, request):
        form = StockAdjustmentForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            adjust_stock(data['variant'].id, data['delta'],
                         data['reason'], request.user)
            messages.success(request, 'Inventory updated.')
            return redirect('admin-dashboard')
        return self.render_form(request, form)

    def render_form(self, request, form):
        return render(request, self.template_name, {
            'form': form,
            'page_title': 'Update availability',
            'page_subtitle': 'Keep your stock counts accurate and up to date.',
            'submit_label': 'Update quantity',
        })
