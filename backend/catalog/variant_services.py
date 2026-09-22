"""Centralized ProductVariant validation and SKU rules.

Every variant SKU (single-form, bulk-generated or model-level) must flow
through :func:`normalize_sku` / :func:`build_sku` so the storefront, admin and
orders all see one canonical shape:

* uppercase,
* any run of non-alphanumeric characters (spaces, slashes, punctuation)
  collapses to a single hyphen,
* leading/trailing hyphens removed,
* capped at ``MAX_SKU_LENGTH`` characters,
* guaranteed unique on disk via a ``-1``, ``-2`` ... suffix when the base and
  a shorter variant already exist elsewhere.

:func:`validate_color_hex` is the single source of truth for the admin
``color_hex`` fields (the model stores uppercase ``#RRGGBB``).
"""

import re

from django.core.exceptions import ValidationError

from catalog.models import ProductVariant

MAX_SKU_LENGTH = 80

_HEX_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')
_NON_ALNUM_RE = re.compile(r'[^A-Z0-9]+')
_HYPHEN_RUN_RE = re.compile(r'-+')


def normalize_sku(value):
    """Normalise a user-supplied or derived SKU to the canonical form."""
    if not value:
        return ''
    token = str(value).strip().upper()
    token = _NON_ALNUM_RE.sub('-', token)
    token = _HYPHEN_RUN_RE.sub('-', token)
    return token.strip('-')


def normalize_hex(value):
    """Validate and canonicalise a colour hex value (``#RRGGBB``, uppercase)."""
    value = (value or '').strip()
    if value and not _HEX_RE.match(value):
        raise ValidationError('Use a hex colour such as #2E5A44.')
    return value.upper() if value else ''


def build_sku(product, size='', color=''):
    """Build the canonical SKU from the product identifier + option tokens."""
    prefix = normalize_sku(product.slug or product.name)
    if not prefix:
        prefix = 'PRODUCT'
    parts = [prefix]
    size_token = normalize_sku(size)
    color_token = normalize_sku(color)
    if size_token:
        parts.append(size_token)
    if color_token:
        parts.append(color_token)
    sku = '-'.join(parts)
    return sku[:MAX_SKU_LENGTH] or 'VARIANT'


def unique_sku(product, size='', color='', exclude_id=None, limit=99):
    """Return a unique, normalized SKU for a variant.

    When another variant already owns the natural SKU the caller gets the
    natural SKU suffixed with the first free ``-N`` (e.g. ``-1``). This keeps
    bulk size-matrix creation atomic-friendly: a cross-product SKU clash ends
    in a distinct code instead of silently aborting the whole batch.
    """
    base = build_sku(product, size, color)
    queryset = ProductVariant.objects.filter(sku=base)
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)
    if not queryset.exists():
        return base
    for number in range(1, limit + 1):
        suffix = f'-{number}'
        candidate = base[:MAX_SKU_LENGTH - len(suffix)] + suffix
        existing = ProductVariant.objects.filter(sku=candidate)
        if exclude_id is not None:
            existing = existing.exclude(pk=exclude_id)
        if not existing.exists():
            return candidate
    raise ValidationError(
        {'sku': 'Could not generate a unique SKU for this option.'})


def sku_collides_within(product, size, color, exclude_id=None):
    """Case-insensitive duplicate check for the (product, size, color) option."""
    queryset = ProductVariant.objects.filter(
        product=product,
        size__iexact=(size or ''),
        color__iexact=(color or ''),
    )
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)
    return queryset.exists()