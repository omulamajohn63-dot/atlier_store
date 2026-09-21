import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, ProductVariant } from '../types';
import { useRouter } from '../router/RouterContext';
import { useCart } from '../context/CartContext';
import { Price } from '../components/ui/Price';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { QuantitySelector } from '../components/ui/QuantitySelector';
import { ProductCard } from '../components/ProductCard';
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
  Info,
  Star,
} from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { motion } from 'motion/react';
import { audit } from '../lib/logger';

export interface ProductDetailPageProps {
  slug: string;
  onQuickView: (product: Product) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ slug, onQuickView }) => {
  const { navigate } = useRouter();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { getProductBySlug, products } = useStore();

  const product = getProductBySlug(slug);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product?.variants[0] || {
      id: 'v-default',
      productId: product?.id || 'prod-1',
      size: 'S',
      color: 'Standard',
      sku: 'SKU-DEF',
      price: product?.price || 24500,
      stockQuantity: 5,
    }
  );
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>('composition');

  // Reset variant and gallery when slug changes or product updates
  useEffect(() => {
    setActiveImageIndex(0);
    setStockError(null);
    if (product?.variants && product.variants.length > 0) {
      // Retain current size selection if available, else pick first in stock
      const match = product.variants.find((v) => v.id === selectedVariant?.id);
      if (match) {
        setSelectedVariant(match);
      } else {
        const firstAvailable = product.variants.find((v) => v.stockQuantity > 0) || product.variants[0];
        setSelectedVariant(firstAvailable);
      }
    }
    setQuantity(1);
  }, [slug, product]);

  // Record this piece in the visitor's recently-viewed trail and audit the view.
  useEffect(() => {
    if (product?.id) {
      addRecentlyViewedProduct(product.id);
      void audit('product_viewed', 'Viewed product detail.', {}, { slug, productId: product.id });
    }
  }, [product?.id]);

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

  const handleAddToCart = async () => {
    if (!selectedVariant || selectedVariant.stockQuantity <= 0) return;
    setStockError(null);
    const result = await addToCart(product, selectedVariant, quantity);
    if (result.success) {
      setAddedToast(true);
      setTimeout(() => setAddedToast(false), 2500);
    } else {
      setStockError(result.message || 'Unable to add piece to bag.');
    }
  };

  const isSoldOut = selectedVariant.stockQuantity <= 0;
  const isLowStock = selectedVariant.stockQuantity > 0 && selectedVariant.stockQuantity <= 3;
  const saved = isWishlisted(product.id);

  // Related products from same category or featured
  const relatedProducts = products.filter(
    (p) => p.id !== product.id && (p.categorySlug === product.categorySlug || p.isFeatured)
  ).slice(0, 3);

  const uniqueColors = Array.from(new Set(product.variants.map((v) => v.color)));

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
            className="aspect-[3/4] w-full rounded-3xl overflow-hidden bg-[#EFECE6] border border-[#E8E5DF] relative group shadow-xl hover:shadow-2xl transition-all"
          >
            <img
              src={product.images[activeImageIndex] || product.images[0]}
              alt={`${product.name} view ${activeImageIndex + 1}`}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              referrerPolicy="no-referrer"
            />

            {/* Wishlist overlay button */}
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-3 text-[#181716] shadow-md transition-all hover:bg-[#181716] hover:text-white hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C]"
              aria-label={`${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
              title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`h-5 w-5 ${saved ? 'fill-current text-[#9E332B]' : ''}`} />
            </button>

            {/* Sale badge */}
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="absolute top-4 left-4 px-3.5 py-1.5 bg-[#9E332B] text-[#FAF9F6] text-[10px] uppercase font-semibold tracking-widest rounded-full shadow-md flex items-center gap-1">
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
                  className={`relative w-20 h-24 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-[#EFECE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] ${
                    activeImageIndex === idx
                      ? 'border-[#181716] shadow-md scale-102'
                      : 'border-transparent opacity-65 hover:opacity-100 hover:border-[#D8D3CB]'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} thumb ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
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
                <span className="text-xs uppercase tracking-widest font-semibold text-[#8A745C]">
                  {product.categorySlug}
                </span>
                <span className="w-1 h-1 rounded-full bg-[#A29E96]" />
                <span className="text-xs text-[#827E77]">Ref. {selectedVariant.sku}</span>
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
              {isLowStock && <Badge variant="lowStock" size="sm">Low Stock</Badge>}
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#181716] font-normal leading-snug text-balance">
              {product.name}
            </h1>

            <p className="text-xs text-[#63605A] italic text-pretty">{product.tagline}</p>

            <div className="pt-2 flex items-baseline gap-3 flex-wrap">
              <Price
                amount={selectedVariant.price}
                compareAtAmount={product.compareAtPrice}
                size="xl"
              />
            </div>
          </div>

          {/* Color Details */}
          {uniqueColors.length > 1 && (
            <div>
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="text-[#63605A]">Colorway</span>
                <span className="font-medium text-[#181716]">{selectedVariant.color}</span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                {uniqueColors.map((c) => {
                  const match = product.variants.find((v) => v.color === c);
                  const isSelected = selectedVariant.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => match && setSelectedVariant(match)}
                      className={`px-4 py-2 rounded-full text-xs border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] ${
                        isSelected
                          ? 'border-[#181716] bg-[#181716] text-[#FAF9F6] font-medium shadow-sm'
                          : 'border-[#E8E5DF] bg-[#FAF9F6] text-[#63605A] hover:border-[#181716] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selection */}
          <div>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-[#63605A]">Select Size</span>
              <button
                type="button"
                onClick={() => setOpenAccordion('sizing')}
                className="text-[#8A745C] hover:underline font-medium inline-flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                Size & Fit Guide
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Available sizes">
              {product.variants.map((variant) => {
                const isSelected = selectedVariant.id === variant.id;
                const outOfStock = variant.stockQuantity <= 0;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={outOfStock}
                    onClick={() => {
                      setSelectedVariant(variant);
                      setQuantity(1);
                    }}
                    className={`h-12 rounded-xl text-xs font-medium border flex items-center justify-center transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] ${
                      isSelected
                        ? 'bg-[#181716] text-[#FAF9F6] border-[#181716] shadow-md'
                        : outOfStock
                        ? 'bg-[#F3F1ED] text-[#A29E96] border-[#E8E5DF] cursor-not-allowed line-through'
                        : 'bg-[#FAF9F6] text-[#181716] border-[#E8E5DF] hover:border-[#181716] hover:bg-[#FFFFFF] hover:shadow-sm'
                    }`}
                  >
                    {variant.size}
                  </button>
                );
              })}
            </div>

            {/* Live Inventory Stock Warning */}
            <div className="mt-3">
              {isSoldOut ? (
                <p className="text-xs text-[#9E332B] flex items-center gap-1.5 font-medium bg-[#FDF2F2] border border-[#F8B4B4] rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Currently out of stock in this size</span>
                </p>
              ) : isLowStock ? (
                <p className="text-xs text-[#8A6024] flex items-center gap-1.5 font-medium bg-[#FFF8F0] border border-[#ECD9BD] rounded-lg px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Small-batch rarity: Only {selectedVariant.stockQuantity} pieces remaining</span>
                </p>
              ) : (
                <p className="text-xs text-[#2E5A44] flex items-center gap-1.5 font-medium bg-[#E8EFEA] border border-[#C8D8CA] rounded-lg px-3 py-2">
                  <Check className="w-3.5 h-3.5" />
                  <span>In Stock &bull; Ready for MODEZA Dispatch</span>
                </p>
              )}
            </div>
          </div>

          {/* Quantity & Add to Cart Controls */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-3">
              <QuantitySelector
                quantity={quantity}
                max={selectedVariant.stockQuantity}
                onChange={setQuantity}
                disabled={isSoldOut}
                size="md"
              />
              <Button
                variant="primary"
                size="lg"
                disabled={isSoldOut}
                onClick={handleAddToCart}
                className="flex-1 text-sm tracking-wider uppercase shadow-md hover:shadow-lg"
              >
                {isSoldOut ? 'Sold Out' : `Add to Cart • ${formatPrice(selectedVariant.price * quantity)}`}
              </Button>
            </div>

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
              <div className="p-3.5 bg-[#FDF2F2] border border-[#F8B4B4] rounded-xl text-xs text-[#9B1C1C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stockError}</span>
              </div>
            )}
          </div>

          {/* Value Assurance Badges */}
          <div className="grid grid-cols-3 gap-3 py-4 border-y border-[#E8E5DF] text-[11px] text-[#63605A]">
            <div className="flex flex-col items-center text-center gap-1.5 p-2 rounded-xl hover:bg-[#FAF9F6] transition-colors">
              <Truck className="w-4.5 h-4.5 text-[#8A745C]" strokeWidth={1.5} />
              <span className="text-center text-pretty">Complimentary over KSh 15k</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-2 rounded-xl hover:bg-[#FAF9F6] transition-colors">
              <RotateCcw className="w-4.5 h-4.5 text-[#8A745C]" strokeWidth={1.5} />
              <span className="text-center text-pretty">30-Day European Returns</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-2 rounded-xl hover:bg-[#FAF9F6] transition-colors">
              <ShieldCheck className="w-4.5 h-4.5 text-[#8A745C]" strokeWidth={1.5} />
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
                className="w-full px-5 py-4 text-left font-medium text-[#181716] flex justify-between items-center hover:bg-[#FAF9F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8A745C]"
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
                className="w-full px-5 py-4 text-left font-medium text-[#181716] flex justify-between items-center hover:bg-[#FAF9F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8A745C]"
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
                      <div key={row.size} role="row" className="bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E8E5DF] hover:border-[#181716] transition-colors">
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
                className="w-full px-5 py-4 text-left font-medium text-[#181716] flex justify-between items-center hover:bg-[#FAF9F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8A745C]"
                aria-expanded={openAccordion === 'shipping'}
              >
                <span className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#8A745C]" />
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
            <Price amount={selectedVariant.price * quantity} size="md" />
          </div>
          <QuantitySelector
            quantity={quantity}
            max={selectedVariant.stockQuantity}
            onChange={setQuantity}
            disabled={isSoldOut}
            size="sm"
          />
          <Button
            variant="primary"
            size="md"
            disabled={isSoldOut}
            onClick={handleAddToCart}
            className="shrink-0 text-xs uppercase tracking-wider"
          >
            {isSoldOut ? 'Sold Out' : addedToast ? 'Added' : 'Add to Cart'}
          </Button>
        </div>
      </motion.div>

      {/* 3. RELATED PRODUCTS ("You May Also Appreciate") */}
      {relatedProducts.length > 0 && (
        <section className="pt-12 border-t border-[#E8E5DF]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#827E77] font-semibold block mb-1.5 flex items-center gap-2">
                <span className="w-8 h-px bg-[#8A745C]" />
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