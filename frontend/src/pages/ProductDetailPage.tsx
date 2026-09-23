import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { useRouter } from '../router/RouterContext';
import { useCart } from '../context/CartContext';
import { Price } from '../components/ui/Price';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { QuantitySelector } from '../components/ui/QuantitySelector';
import { ProductCard } from '../components/ProductCard';
import { VariantSelector } from '../components/variant/VariantSelector';
import { formatPrice } from '../utils/currency';
import { addRecentlyViewedProduct } from '../utils/recentlyViewed';
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  ChevronDown,
  Check,
  Sparkles,
  AlertCircle,
  Share2,
  Heart,
  Package,
  Star,
  Bell,
} from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { api } from '../services/apiClient';
import { ProductImage } from '../components/ui/ProductImage';
import { motion } from 'motion/react';
import { audit } from '../lib/logger';
import {
  getAllOptionGroups,
  getPriceSummary,
  getVariantFlow,
  getVisibleOptionGroups,
  isVariantPurchasable,
  optionValueEquals,
  parseVariantSelections,
  selectionsToQuery,
  LOW_STOCK_THRESHOLD,
  VariantSelections,
} from '../utils/variants';

export interface ProductDetailPageProps {
  slug: string;
  onQuickView: (product: Product) => void;
}

/**
 * Reconcile a previously-selected set of options against fresh product data.
 * Options that no longer exist structurally are dropped so the page never
 * holds an invalid selection; stock-based changes simply re-disable options.
 */
function reconcileSelections(product: Product, prev: VariantSelections): VariantSelections {
  const groups = getAllOptionGroups(product);
  const next: VariantSelections = {};
  for (const group of groups) {
    const selection = prev[group.key];
    if (selection && group.options.some((option) => optionValueEquals(option.value, selection))) {
      next[group.key] = selection;
    }
  }
  return next;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ slug, onQuickView }) => {
  const { navigate } = useRouter();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { getProductBySlug, products, refreshCatalog } = useStore();

  const product = getProductBySlug(slug);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selections, setSelections] = useState<VariantSelections>({});
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>('composition');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyState, setNotifyState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [notifyMessage, setNotifyMessage] = useState('');

  const hasAnyVariants = (product?.variants?.length ?? 0) > 0;
  const priceSummary = product ? getPriceSummary(product) : null;
  const visibleGroups = product ? getVisibleOptionGroups(product) : [];
  const flow = product ? getVariantFlow(product, selections) : { requiresSelection: false, variant: undefined };
  const resolvedVariant = flow.variant;
  const stillSelecting = flow.requiresSelection;
  const resolvedVariantPurchasable = isVariantPurchasable(resolvedVariant);

  // Restore deep-linked selections from the URL once, when the slug loads.
  useEffect(() => {
    if (product) {
      setSelections(parseVariantSelections(product, window.location.search));
    }
    setQuantity(1);
    setStockError(null);
  }, [slug, product?.id]);

  // Reconcile selections whenever refreshed product data arrives so the page
  // never holds options that no longer exist (e.g. variant removed by admin).
  useEffect(() => {
    if (product) {
      setSelections((prev) => reconcileSelections(product, prev));
    }
  }, [product]);

  // Record this piece in the visitor's recently-viewed trail and audit the view.
  useEffect(() => {
    if (product?.id) {
      addRecentlyViewedProduct(product.id);
      void audit('product_viewed', 'Viewed product detail.', {}, { slug, productId: product.id });
    }
  }, [product?.id]);

  const handleVariantChange = (next: VariantSelections) => {
    setSelections(next);
    setQuantity(1);
    setStockError(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}${selectionsToQuery(next)}`);
    }
  };

  const handleAddToCart = async () => {
    if (!product || !resolvedVariant || !resolvedVariantPurchasable) return;
    setStockError(null);
    const result = await addToCart(product, resolvedVariant, quantity);
    if (result.success) {
      setAddedToast(true);
      window.setTimeout(() => setAddedToast(false), 2500);
    } else {
      setStockError(result.message || 'Unable to add piece to bag.');
      void refreshCatalog();
    }
  };

  const handleNotifyMe = async () => {
    if (!resolvedVariant) return;
    const email = notifyEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotifyState('error');
      setNotifyMessage('Enter a valid email address.');
      return;
    }
    setNotifyState('saving');
    setNotifyMessage('');
    try {
      const result = await api.subscribeBackInStock(resolvedVariant.id, email);
      setNotifyState('done');
      setNotifyMessage(
        result.alreadySubscribed
          ? 'You are already on the list — we will notify you when it is back.'
          : (result.message || 'We will notify you when this item is back in stock.')
      );
    } catch (err: unknown) {
      const errorObj = err as Error & { code?: string };
      setNotifyState('error');
      setNotifyMessage(errorObj.message || 'The request could not be saved. Please try again.');
    }
  };

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-5">
        <h1 className="font-serif text-3xl text-[#181716]">
          {products.length === 0 ? 'Loading this piece...' : 'Piece no longer available'}
        </h1>
        <p className="text-sm text-[#63605A]">
          {products.length === 0
            ? 'We are refreshing the collection from the modeza catalogue.'
            : 'This product may have been archived or removed, but the rest of the collection is still available.'}
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/shop')}>
          Return to collection
        </Button>
      </div>
    );
  }

  const saved = isWishlisted(product.id);

  const renderAvailability = () => {
    if (!hasAnyVariants) {
      return { tone: 'error', icon: AlertCircle, text: 'Currently unavailable online' };
    }
    if (stillSelecting) {
      return {
        tone: 'idle',
        icon: null,
        text:
          visibleGroups.length === 1
            ? `Choose ${visibleGroups[0].label.toLowerCase()} to check availability`
            : 'Choose your options to check availability',
      };
    }
    if (!resolvedVariantPurchasable) {
      return { tone: 'error', icon: AlertCircle, text: 'Out of stock' };
    }
    if (resolvedVariant && resolvedVariant.stockQuantity <= LOW_STOCK_THRESHOLD) {
      return {
        tone: 'low',
        icon: Sparkles,
        text: `Small-batch rarity: Only ${resolvedVariant.stockQuantity} pieces remaining`,
      };
    }
    return { tone: 'success', icon: Check, text: 'In Stock • Ready for MODEZA Dispatch' };
  };

  const availability = renderAvailability();

  const renderPrice = () => {
    if (resolvedVariant) {
      return (
        <Price
          amount={resolvedVariant.price}
          compareAtAmount={product.compareAtPrice}
          size="xl"
        />
      );
    }
    const from = priceSummary && !priceSummary.same;
    return (
      <div className="inline-flex items-baseline gap-1.5">
        {from && <span className="text-sm text-[#827E77] font-normal">From</span>}
        <Price amount={priceSummary ? priceSummary.min : product.price} size="xl" />
      </div>
    );
  };

  const cta = (() => {
    if (!hasAnyVariants || (!stillSelecting && !resolvedVariant) || !resolvedVariantPurchasable) {
      return { label: 'Sold Out', disabled: true };
    }
    if (stillSelecting) {
      return {
        label: visibleGroups.length === 1 ? `Select ${visibleGroups[0].label}` : 'Select Options',
        disabled: true,
      };
    }
    return {
      label: `Add to Cart • ${formatPrice((resolvedVariant?.price || 0) * quantity)}`,
      disabled: false,
    };
  })();

  const isLowStockForBadge = !!resolvedVariantPurchasable && !!resolvedVariant && resolvedVariant.stockQuantity <= LOW_STOCK_THRESHOLD;

  // Related products from same category or featured
  const relatedProducts = products.filter(
    (p) => p.id !== product.id && (p.categorySlug === product.categorySlug || p.isFeatured)
  ).slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 pb-28 lg:pb-0 2xl:max-w-[88rem]">
      {/* 1. BREADCRUMBS */}
      <nav className="text-xs text-[#827E77] flex items-center gap-2 flex-wrap" aria-label="Breadcrumb">
        <button onClick={() => navigate('/')} className="hover:text-[#181716] transition-colors">
          Home
        </button>
        <span>/</span>
        <button onClick={() => navigate('/shop')} className="hover:text-[#181716] transition-colors">
          Shop
        </button>
        <span>/</span>
        <button
          onClick={() => navigate(`/shop/${product.categorySlug}`)}
          className="hover:text-[#181716] transition-colors capitalize"
        >
          {product.categorySlug}
        </button>
        <span>/</span>
        <span className="text-[#181716] font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      {/* 2. MAIN PRODUCT OVERVIEW (GALLERY + PURCHASE SPEC) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Gallery Visuals (Col 7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Visual Large Frame */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="aspect-[3/4] w-full rounded-3xl overflow-hidden bg-[#F4ECE9] border border-[#E8E5DF] relative group shadow-xl hover:shadow-2xl transition-all"
          >
            <ProductImage
              src={product.images[activeImageIndex] || product.images[0]}
              alt={`${product.name} view ${activeImageIndex + 1}`}
              className="h-full w-full"
              imgClassName="transition-transform duration-700 ease-out group-hover:scale-105"
            />

            {/* Wishlist overlay button */}
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-3 text-[#181716] shadow-md transition-all hover:bg-[#A2574F] hover:text-white hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
              aria-label={`${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
              title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`h-5 w-5 ${saved ? 'fill-current text-[#9E332B]' : ''}`} />
            </button>

            {/* Sale badge */}
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="absolute top-4 left-4 px-3.5 py-1.5 bg-[#E68057] text-[#181716] text-[10px] uppercase font-semibold tracking-widest rounded-full shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Archive Sale
              </span>
            )}

            {/* Bottom gradient overlay for image caption */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#181716]/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <p className="text-[10px] text-[#FAF9F6] uppercase tracking-widest">
                View {activeImageIndex + 1} of {product.images.length} &bull; {product.name}
              </p>
            </div>
          </motion.div>

          {/* Thumbnail Strip */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2" role="tablist" aria-label="Product images">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={activeImageIndex === idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-20 h-24 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-[#F4ECE9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
                    activeImageIndex === idx
                      ? 'border-[#A2574F] shadow-md scale-102'
                      : 'border-transparent opacity-65 hover:opacity-100 hover:border-[#D8D3CB]'
                  }`}
                >
                  <ProductImage
                    src={img}
                    alt={`${product.name} thumb ${idx + 1}`}
                    className="h-full w-full"
                  />
                  {activeImageIndex === idx && (
                    <span className="absolute inset-0 ring-2 ring-inset ring-white/30 pointer-events-none" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Purchase Column (Col 5) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 space-y-6 lg:sticky lg:top-24"
        >
          <div className="space-y-3 border-b border-[#E8E5DF] pb-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-widest font-semibold text-[#A2574F]">
                  {product.categorySlug}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    alert('Product link copied to clipboard.');
                  }}
                  className="text-[#827E77] hover:text-[#181716] p-1.5 rounded-full hover:bg-[#F3F1ED] transition-all"
                  title="Share piece"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {product.isNewArrival && <Badge variant="new" size="sm">New Arrival</Badge>}
              {product.isBestSeller && <Badge variant="outline" size="sm"><Star className="w-2.5 h-2.5 fill-current" /> Best Seller</Badge>}
              {isLowStockForBadge && <Badge variant="lowStock" size="sm">Low Stock</Badge>}
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#181716] font-normal leading-snug text-balance">
              {product.name}
            </h1>

            <p className="text-xs text-[#63605A] italic text-pretty">{product.tagline}</p>

            <div className="pt-2 flex items-baseline gap-3 flex-wrap">
              {renderPrice()}
            </div>

            {resolvedVariant && priceSummary && !priceSummary.same && (
              <p className="text-[11px] text-[#827E77]">
                Prices vary by selection &mdash; pieces start from {formatPrice(priceSummary.min)}
              </p>
            )}
          </div>

          {/* Variant Selection */}
          <div className="space-y-5">
            {visibleGroups.length > 0 && (
              <VariantSelector
                product={product}
                selections={selections}
                onChange={handleVariantChange}
                size="lg"
              />
            )}

            {/* Availability status */}
            <div>
              {availability.icon ? (
                <p
                  className={`text-xs flex items-center gap-1.5 font-medium rounded-lg px-3 py-2.5 ${
                    availability.tone === 'success'
                      ? 'text-[#2E5A44] bg-[#E8EFEA] border border-[#C8D8CA]'
                      : availability.tone === 'low'
                        ? 'text-[#8A6024] bg-[#FFF8F0] border border-[#ECD9BD]'
                        : 'text-[#9E332B] bg-[#FDF2F2] border border-[#F8B4B4]'
                  }`}
                >
                  <availability.icon className="w-3.5 h-3.5" />
                  <span>{availability.text}</span>
                </p>
              ) : (
                <p className="text-xs text-[#827E77] bg-[#FAF9F6] border border-dashed border-[#E8E5DF] rounded-lg px-3 py-2.5">
                  {availability.text}
                </p>
              )}
            </div>
          </div>

          {/* Quantity & Add to Cart Controls */}
          <div className="pt-1 space-y-3">
            <div className="flex items-center gap-3">
              <QuantitySelector
                quantity={quantity}
                max={resolvedVariant?.stockQuantity || 1}
                onChange={setQuantity}
                disabled={cta.disabled}
                size="md"
              />
              <Button
                variant="primary"
                size="lg"
                disabled={cta.disabled}
                onClick={handleAddToCart}
                aria-label={cta.label}
                className="flex-1 text-sm tracking-wider uppercase shadow-md hover:shadow-lg"
              >
                {cta.label}
              </Button>
            </div>

            {cta.disabled && resolvedVariant && !resolvedVariantPurchasable && !stillSelecting && (
              <div className="rounded-xl border border-[#E8E5DF] bg-[#FAF9F6] p-4 space-y-3">
                <p className="text-xs text-[#63605A] flex items-center gap-2">
                  <Bell className="w-4 h-4 shrink-0" />
                  Sold out — leave your email and we will notify you when it is back.
                </p>
                {notifyState === 'done' ? (
                  <p className="text-xs text-[#2E5A44] bg-[#E8EFEA] border border-[#2E5A44]/20 rounded-lg px-3 py-2.5" role="status">
                    <Check className="inline w-4 h-4 mr-1.5" />
                    {notifyMessage}
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => { setNotifyEmail(e.target.value); setNotifyState('idle'); }}
                      placeholder="you@example.com"
                      aria-label="Email for back-in-stock notification"
                      className="flex-1 rounded-lg border border-[#E8E5DF] bg-white px-3 py-2 text-sm text-[#181716] outline-none focus:border-[#181716]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => void handleNotifyMe()}
                      disabled={notifyState === 'saving'}
                      className="text-xs uppercase tracking-wider"
                    >
                      {notifyState === 'saving' ? 'Notifying…' : 'Notify Me'}
                    </Button>
                  </div>
                )}
                {notifyState === 'error' && (
                  <p className="text-xs text-[#9B1C1C] flex items-center gap-1.5" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {notifyMessage}
                  </p>
                )}
              </div>
            )}

            {addedToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-[#E8EFEA] border border-[#2E5A44]/20 rounded-xl text-xs text-[#2E5A44] flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Added to cart! View in drawer or cart page.
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/cart')}
                  className="font-semibold underline text-sm"
                >
                  Go to Cart
                </button>
              </motion.div>
            )}

            {stockError && (
              <div className="p-3.5 bg-[#FDF2F2] border border-[#F8B4B4] rounded-xl text-xs text-[#9B1C1C] flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stockError}</span>
              </div>
            )}
          </div>

          {/* Value Assurance Badges */}
          <div className="grid grid-cols-3 gap-3 py-4 border-y border-[#E8E5DF] text-[11px] text-[#63605A]">
            <div className="flex flex-col items-center text-center gap-1.5 p-2 rounded-xl hover:bg-[#FAF9F6] transition-colors">
              <Truck className="w-4.5 h-4.5 text-[#A2574F]" strokeWidth={1.5} />
              <span className="text-center text-pretty">Complimentary over KSh 15k</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-2 rounded-xl hover:bg-[#FAF9F6] transition-colors">
              <RotateCcw className="w-4.5 h-4.5 text-[#A2574F]" strokeWidth={1.5} />
              <span className="text-center text-pretty">30-Day European Returns</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-2 rounded-xl hover:bg-[#FAF9F6] transition-colors">
              <ShieldCheck className="w-4.5 h-4.5 text-[#A2574F]" strokeWidth={1.5} />
              <span className="text-center text-pretty">Artisan Studio Certified</span>
            </div>
          </div>

          {/* Accordion Sections for Detailed Info */}
          <div className="space-y-2.5 text-xs">
            {/* 1. Composition & Craftsmanship */}
            <div className="border border-[#E8E5DF] rounded-xl overflow-hidden bg-[#FFFFFF] shadow-sm hover:shadow-md transition-shadow">
              <button
                type="button"
                onClick={() =>
                  setOpenAccordion(openAccordion === 'composition' ? null : 'composition')
                }
                className="w-full px-5 py-4 text-left font-medium text-[#181716] flex justify-between items-center hover:bg-[#FAF9F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A2574F]"
                aria-expanded={openAccordion === 'composition'}
              >
                <span className="text-sm">Composition & Care</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#827E77] transition-transform duration-300 ${
                    openAccordion === 'composition' ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openAccordion === 'composition' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 pt-0 space-y-3 text-[#63605A] border-t border-[#F3F1ED]"
                >
                  <p className="mt-3 text-xs leading-relaxed text-pretty">{product.description}</p>
                  <ul className="list-disc pl-5 space-y-1.5 pt-1">
                    {product.details.map((detail, idx) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>

            {/* 2. Sizing & Fit Guide */}
            <div className="border border-[#E8E5DF] rounded-xl overflow-hidden bg-[#FFFFFF] shadow-sm hover:shadow-md transition-shadow">
              <button
                type="button"
                onClick={() => setOpenAccordion(openAccordion === 'sizing' ? null : 'sizing')}
                className="w-full px-5 py-4 text-left font-medium text-[#181716] flex justify-between items-center hover:bg-[#FAF9F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A2574F]"
                aria-expanded={openAccordion === 'sizing'}
              >
                <span className="text-sm">Sizing & Fit Recommendations</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#827E77] transition-transform duration-300 ${
                    openAccordion === 'sizing' ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openAccordion === 'sizing' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 pt-0 space-y-4 text-[#63605A] border-t border-[#F3F1ED]"
                >
                  <p className="mt-3 text-xs leading-relaxed text-pretty">
                    Designed for a relaxed silhouette with fluid drape. We suggest choosing your usual
                    size. For a structured, fitted contour, take one size down.
                  </p>
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center text-[10px]" role="table" aria-label="Size conversion chart">
                    {[
                      { size: 'XS', eu: 'EU 34', us: 'US 2' },
                      { size: 'S', eu: 'EU 36', us: 'US 4' },
                      { size: 'M', eu: 'EU 38', us: 'US 6' },
                      { size: 'L', eu: 'EU 40', us: 'US 8' },
                    ].map((row) => (
                      <div key={row.size} role="row" className="bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E8E5DF] hover:border-[#A2574F] transition-colors">
                        <span role="columnheader" className="font-semibold block text-[#181716]">{row.size}</span>
                        <span role="cell" className="block">{row.eu}</span>
                        <span role="cell" className="block">{row.us}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* 3. Shipping & Returns */}
            <div className="border border-[#E8E5DF] rounded-xl overflow-hidden bg-[#FFFFFF] shadow-sm hover:shadow-md transition-shadow">
              <button
                type="button"
                onClick={() => setOpenAccordion(openAccordion === 'shipping' ? null : 'shipping')}
                className="w-full px-5 py-4 text-left font-medium text-[#181716] flex justify-between items-center hover:bg-[#FAF9F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A2574F]"
                aria-expanded={openAccordion === 'shipping'}
              >
                <span className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#A2574F]" />
                  Complimentary Delivery & Returns
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#827E77] transition-transform duration-300 ${
                    openAccordion === 'shipping' ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openAccordion === 'shipping' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 pt-0 space-y-2 text-[#63605A] border-t border-[#F3F1ED]"
                >
                  <p className="mt-3 text-xs leading-relaxed text-pretty">
                    Orders are packaged in recyclable modeza boxes with cotton dustbags. Standard
                    delivery takes 2-4 business days. Returns are accepted within 30 days of receipt in
                    original unworn condition.
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile sticky purchase bar (lg:hidden) */}
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.3, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-0 z-[300] border-t border-[#E8E5DF] bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur shadow-[0_-4px_20px_rgb(24_23_22/0.06)] lg:hidden"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-[#827E77]">Total</p>
            {resolvedVariant ? (
              <Price amount={resolvedVariant.price * quantity} size="md" />
            ) : (
              <div className="inline-flex items-baseline gap-1">
                {priceSummary && !priceSummary.same && (
                  <span className="text-[10px] text-[#827E77]">From</span>
                )}
                <Price amount={priceSummary ? priceSummary.min : product.price} size="md" />
              </div>
            )}
          </div>
          <QuantitySelector
            quantity={quantity}
            max={resolvedVariant?.stockQuantity || 1}
            onChange={setQuantity}
            disabled={cta.disabled}
            size="sm"
          />
          <Button
            variant="primary"
            size="md"
            disabled={cta.disabled}
            onClick={handleAddToCart}
            className="shrink-0 text-xs uppercase tracking-wider max-w-[9.5rem]"
          >
            {cta.label.replace(/ •.*/, '')}
          </Button>
        </div>
      </motion.div>

      {/* 3. RELATED PRODUCTS ("You May Also Appreciate") */}
      {relatedProducts.length > 0 && (
        <section className="pt-12 border-t border-[#E8E5DF]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#827E77] font-semibold block mb-1.5 flex items-center gap-2">
                <span className="w-8 h-px bg-[#A2574F]" />
                Wardrobe Styling
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#181716] text-balance">
                Complete The Look
              </h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/shop')}>
              Explore Catalog
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {relatedProducts.map((p, index) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProductCard
                  product={p}
                  onQuickView={onQuickView}
                  onClick={() => navigate(`/product/${p.slug}`)}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};