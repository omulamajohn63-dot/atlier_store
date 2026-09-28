"""Customer-facing actions the assistant may *prepare* — never execute.

``prepare_add_to_cart`` validates the target and returns a typed action the
storefront confirms with the customer (cart is only modified by the customer
clicking it). ``create_support_request`` escalates to staff via the
existing admin notification pipeline.
"""
import re

from admin_ui.models import notify_staff
from catalog.models import Product

LOW_STOCK_THRESHOLD = 3
MAX_QUANTITY = 10

_MCP_RE = re.compile(
    r'(?i)\b(?:\d{4}[\s-]?){2}\d{4}\b'
    r'|\bpin\b[^.;]{0,40}?\d{3,12}\b'
    r'|\bpassword\b[\s:=]*\S+')


def _clean_text(text, limit=500):
    text = (text or '').strip()
    text = _MCP_RE.sub('[redacted]', text)
    return text[:limit]


def _find_product(identifier):
    identifier = (identifier or '').strip()
    if not identifier:
        return None
    qs = Product.objects.filter(status=Product.Status.ACTIVE,
                                category__is_active=True)
    product = qs.filter(slug=identifier).first()
    if product is None:
        product = qs.filter(name__iexact=identifier).first()
    if product is None:
        product = qs.filter(name__icontains=identifier).first()
    return product


def _options(product):
    variants = [v for v in product.variants.all() if v.is_active]
    if not variants:
        return [{'size': product.size, 'colour': product.color,
                 'available': product.stock_quantity > 0,
                 'lowStock': 0 < product.stock_quantity <= LOW_STOCK_THRESHOLD}]
    return [{'size': v.size, 'colour': v.color, 'available': v.stock_quantity > 0,
             'lowStock': 0 < v.stock_quantity <= LOW_STOCK_THRESHOLD}
            for v in variants]


def prepare_add_to_cart(*, context=None, product='', size='', colour='',
                        quantity=1):
    target = _find_product(product)
    if target is None:
        return {'error': {'code': 'not_found',
                          'message': 'Product not found — search first.'}}

    variants = [v for v in target.variants.all() if v.is_active]
    chosen = None
    if variants:
        candidates = variants
        if size:
            candidates = [v for v in candidates
                          if (v.size or '').lower() == size.lower()]
        if colour:
            candidates = [v for v in candidates
                          if colour.lower() in (v.color or '').lower()]
        in_stock = [v for v in candidates if v.stock_quantity > 0]
        if not candidates:
            return {'error': {'code': 'combination_unavailable',
                              'message': 'That size/colour combination does '
                                         'not exist for this product.',
                              'options': _options(target)}}
        if not in_stock:
            return {'error': {'code': 'out_of_stock',
                              'message': 'That option is currently out of stock.',
                              'options': _options(target)}}
        chosen = in_stock[0]
    else:
        if target.stock_quantity <= 0:
            return {'error': {'code': 'out_of_stock',
                              'message': 'That item is currently out of stock.',
                              'options': _options(target)}}

    quantity = max(1, min(int(quantity or 1), MAX_QUANTITY))
    action = {
        'type': 'add_to_cart',
        'slug': target.slug,
        'name': target.name,
        'price': round(target.price_minor / 100, 2),
        'quantity': quantity,
        'size': chosen.size if chosen else target.size,
        'colour': chosen.color if chosen else target.color,
        'variantSku': chosen.sku if chosen else '',
        'variantId': str(chosen.id) if chosen else '',
        'lowStock': ((chosen.stock_quantity if chosen else target.stock_quantity)
                     <= LOW_STOCK_THRESHOLD),
    }
    return {
        'action': action,
        'message': f'{target.name} is ready to add — confirm in the cart panel.',
        'options': _options(target),
    }


def create_support_request(*, context=None, message='', order_number=''):
    summary = _clean_text(message, 400)
    if not summary:
        return {'error': {'code': 'empty_message',
                          'message': 'Describe the issue first.'}}
    order_ref = _clean_text(order_number, 40) if order_number else ''
    user_label = (context.user.email if context and getattr(context, 'user', None)
                  and context.user.is_authenticated else 'Guest shopper')

    notify_staff(
        category='customer',
        title='Assistant: customer needs support',
        message=f'{user_label}: {summary}'
                + (f' (order {order_ref})' if order_ref else ''),
        link='/admin/dashboard/assistant',
        event_key=f'assistant-support:{user_label}:{summary[:80]}',
        severity='info',
        event_type='assistant_escalated',
    )
    return {
        'ok': True,
        'message': "We've notified Modeza support about your message. "
                   'A member of the team will follow up.',
    }
