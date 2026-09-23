/**
 * Storefront variant-selection logic.
 *
 * Products are presented as a single item with derived option groups
 * (e.g. Colour, Size) resolved from the underlying variant records. This
 * module holds ALL availability/resolution/price logic so product cards,
 * quick view and the product detail page never drift apart.
 *
 * The customer never sees SKUs or variant IDs; they only pick option values
 * (e.g. "Black" + "Medium") and the system resolves the exact variant.
 */

import { Product, ProductVariant } from '../types';

/** Selected option values keyed by the option group key (e.g. { color: 'Black', size: 'Medium' }). */
export type VariantSelections = Record<string, string>;

export interface VariantOption {
  /** The human facing option value (e.g. "Black", "Medium"). */
  value: string;
  /** Actual product colour hex when the variant data supplies one. */
  colorHex?: string;
}

export interface VariantOptionGroup {
  /** Stable option key derived from the variant attribute (e.g. 'color', 'size'). */
  key: string;
  /** Human facing label (e.g. 'Colour', 'Size'). */
  label: string;
  options: VariantOption[];
}

export interface PriceSummary {
  min: number;
  max: number;
  /** True when every purchasable variant shares the same price. */
  same: boolean;
}

export interface VariantFlow {
  /** Option groups that require a customer decision (more than one value). */
  groups: VariantOptionGroup[];
  /** True while the customer still has to make a selection. */
  requiresSelection: boolean;
}

/** Reused per-variant low-stock messaging threshold (existing product detail convention). */
export const LOW_STOCK_THRESHOLD = 3;

/** Keys on ProductVariant that are never customer-selectable options. */
const NON_OPTION_KEYS = new Set([
  'id',
  'productId',
  'sku',
  'price',
  'stockQuantity',
  'isActive',
  'isAvailable',
  'colorHex',
]);

/** Fashion-first option order; any future attributes (material, length, ...) append after size. */
const OPTION_LABELS: Record<string, string> = {
  color: 'Colour',
  size: 'Size',
};

function capitalization(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function optionLabel(key: string): string {
  return OPTION_LABELS[key] || capitalization(key);
}

function getOptionValue(variant: ProductVariant, key: string): string {
  // ProductVariant only carries colour/size today; guard anything unknown so
  // future attributes can be added to the DTO without breaking resolution.
  const value = (variant as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Derivative option keys for a product: every variant string attribute that
 * is not an identifier/book-keeping field. Colour is preferred first, size
 * second (natural fashion flow), then any other attributes alphabetically.
 */
export function getOptionKeys(product: Product): string[] {
  const keys = new Set<string>();
  for (const variant of product.variants || []) {
    for (const [key, raw] of Object.entries(variant)) {
      if (NON_OPTION_KEYS.has(key)) continue;
      if (typeof raw === 'string' && raw.trim()) keys.add(key);
    }
  }
  const priorityOrder = ['color', 'size'];
  const prioritized = priorityOrder.filter((key) => keys.has(key));
  const remainder = [...keys]
    .filter((key) => !priorityOrder.includes(key))
    .sort();
  return [...prioritized, ...remainder];
}

function buildGroupsForKeys(product: Product, keys: string[]): VariantOptionGroup[] {
  return keys.map((key) => {
    const seen = new Map<string, VariantOption>();
    for (const variant of product.variants || []) {
      const value = getOptionValue(variant, key);
      if (!value) continue;
      const existing = seen.get(value);
      if (!existing) {
        seen.set(value, {
          value,
          colorHex: key === 'color' ? variant.colorHex || undefined : undefined,
        });
      } else if (key === 'color' && !existing.colorHex && variant.colorHex) {
        existing.colorHex = variant.colorHex;
      }
    }
    return { key, label: optionLabel(key), options: [...seen.values()] };
  });
}

/** Every distinct option group present in the product (including single-value groups). */
export function getAllOptionGroups(product: Product): VariantOptionGroup[] {
  return buildGroupsForKeys(product, getOptionKeys(product));
}

/** Groups that present a real customer decision (more than one distinct value). */
export function getVisibleOptionGroups(product: Product): VariantOptionGroup[] {
  return getAllOptionGroups(product).filter((group) => group.options.length >= 2);
}

/** The option keys used when resolving/validating combinations. */
export function getResolutionKeys(product: Product): string[] {
  return getAllOptionGroups(product).map((group) => group.key);
}

export interface VariantFlowResult extends VariantFlow {
  /** The exact resolved variant, once every visible option has a selection. */
  variant?: ProductVariant;
}

/** Whether a single variant record is on sale and has stock. */
export function isVariantPurchasable(variant: ProductVariant | undefined): variant is ProductVariant {
  if (!variant) return false;
  return (
    (variant.isActive ?? true) &&
    (variant.isAvailable ?? true) &&
    Number(variant.stockQuantity) > 0
  );
}

export function optionValueEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Slug used for URL deep-links (e.g. "Midnight Onyx" -> "midnight-onyx"). */
export function slugifyOption(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve the exact variant for a set of selections.
 * - Every visible option group must have a selection before a variant
 *   resolves (avoids "auto-selecting" a half-formed combination).
 * - A product with a single variant (no visible groups) resolves immediately.
 */
export function resolveVariant(
  product: Product | undefined,
  selections: VariantSelections
): ProductVariant | undefined {
  if (!product || !product.variants?.length) return undefined;
  const visible = getVisibleOptionGroups(product);
  if (visible.some((group) => !selections[group.key])) return undefined;
  const keys = getResolutionKeys(product);
  return product.variants.find((variant) =>
    keys.every((key) => {
      const selection = selections[key];
      return !selection || optionValueEquals(getOptionValue(variant, key), selection);
    })
  );
}

/**
 * Cross-option availability filtering. Reports whether choosing `value` for
 * option group `groupKey` can still form a purchasable variant given the
 * current `selections`. Unavailable options are disabled rather than removed.
 */
export function isOptionAvailable(
  product: Product,
  selections: VariantSelections,
  groupKey: string,
  value: string
): boolean {
  const keys = getResolutionKeys(product);
  return (product.variants || []).some((variant) =>
    isVariantPurchasable(variant) &&
    keys.every((key) => {
      const selection = key === groupKey ? value : selections[key];
      return !selection || optionValueEquals(getOptionValue(variant, key), selection);
    })
  );
}

/** Distinct product colours with their actual hex (when available). */
export function getColorSwatches(
  product: Product
): { value: string; colorHex?: string }[] {
  const groups = getAllOptionGroups(product);
  const colorGroup = groups.find((group) => group.key === 'color');
  return colorGroup ? colorGroup.options : [];
}

/** Determine whether there is more than one distinct colourway. */
export function hasMultipleColors(product: Product): boolean {
  return getColorSwatches(product).length >= 2;
}

/** Price summary based on purchasable variants (falls back to product price). */
export function getPriceSummary(product: Product): PriceSummary {
  const finite = (price: number) => typeof price === 'number' && !Number.isNaN(price);
  const purchasablePrices = (product.variants || [])
    .filter(isVariantPurchasable)
    .map((variant) => variant.price)
    .filter(finite);
  const source =
    purchasablePrices.length > 0
      ? purchasablePrices
      : (product.variants || []).map((variant) => variant.price).filter(finite);
  if (source.length > 0) {
    const min = Math.min(...source);
    const max = Math.max(...source);
    return { min, max, same: min === max };
  }
  return { min: product.price, max: product.price, same: true };
}

/** Compact card summary e.g. "3 sizes · 2 colours". Only dimensions with an actual
 * choice (more than one distinct value) appear, so a single-variant or
 * size-only product reads naturally. */
export function getVariantSummary(product: Product): string | null {
  const groups = getAllOptionGroups(product);
  const parts: string[] = [];
  for (const group of groups) {
    const count = group.options.length;
    if (count < 2) continue;
    if (group.key === 'color') {
      parts.push(`${count} colour${count > 1 ? 's' : ''}`);
    } else {
      parts.push(`${count} ${group.label.toLowerCase()}${count > 1 ? 's' : ''}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Full storefront variant flow (groups to display + resolved variant). */
export function getVariantFlow(
  product: Product | undefined,
  selections: VariantSelections
): VariantFlowResult {
  if (!product) return { groups: [], requiresSelection: false };
  const groups = getVisibleOptionGroups(product);
  return {
    groups,
    requiresSelection: groups.length > 0 && !resolveVariant(product, selections),
    variant: resolveVariant(product, selections),
  };
}

/** Build query string (without leading '?') for a set of selections. */
export function selectionsToQuery(selections: VariantSelections): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(selections)) {
    if (value) params.set(key, slugifyOption(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Restore a selection from URL query params. Partially-valid selections are
 * preserved; combinations that cannot resolve (or resolve to an unpurchasable
 * variant) are gracefully dropped so the page never lands in an invalid state.
 */
export function parseVariantSelections(
  product: Product | undefined,
  search: string | undefined
): VariantSelections {
  if (!product) return {};
  const params = new URLSearchParams(search || '');
  const selections: VariantSelections = {};
  for (const group of getAllOptionGroups(product)) {
    const raw = params.get(group.key);
    if (!raw) continue;
    const match = group.options.find((option) => slugifyOption(option.value) === slugifyOption(raw));
    if (match) selections[group.key] = match.value;
  }
  const visible = getVisibleOptionGroups(product);
  const hasEverySelection = visible.every((group) => selections[group.key]);
  if (hasEverySelection) {
    const variant = resolveVariant(product, selections);
    if (!variant || !isVariantPurchasable(variant)) return {};
  }
  return selections;
}