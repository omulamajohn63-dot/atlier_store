import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Check, Truck, RotateCcw, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useRouter } from '../router/RouterContext';
import { Price } from './ui/Price';
import { Button } from './ui/Button';
import { QuantitySelector } from './ui/QuantitySelector';
import { Badge } from './ui/Badge';
import { ProductImage } from './ui/ProductImage';
import { VariantSelector } from './variant/VariantSelector';
import { formatPrice } from '../utils/currency';
import {
  getPriceSummary,
  getVariantFlow,
  getVisibleOptionGroups,
  isVariantPurchasable,
  parseVariantSelections,
  LOW_STOCK_THRESHOLD,
  VariantSelections,
} from '../utils/variants';

export interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ product: initialProduct, isOpen, onClose }) => {
  const { addToCart } = useCart();
  const { getProductById, refreshCatalog } = useStore();
  const { navigate } = useRouter();

  const product = initialProduct ? (getProductById(initialProduct.id) || initialProduct) : null;

  const [selections, setSelections] = useState<VariantSelections>({});
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setSelections(parseVariantSelections(product, ''));
      setQuantity(1);
      setActiveImageIndex(0);
      setAddedToCart(false);
      setErrorMessage(null);
    }
  }, [product?.id]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!product) return null;

  const hasAnyVariants = (product.variants?.length ?? 0) > 0;
  const priceSummary = getPriceSummary(product);
  const visibleGroups = getVisibleOptionGroups(product);
  const flow = getVariantFlow(product, selections);
  const resolvedVariant = flow.variant;
  const stillSelecting = flow.requiresSelection;
  const resolvedVariantPurchasable = isVariantPurchasable(resolvedVariant);

  const handleAddToCart = async () => {
    if (!resolvedVariant || !resolvedVariantPurchasable) return;
    setErrorMessage(null);
    const result = await addToCart(product, resolvedVariant, quantity);
    if (result.success) {
      setAddedToCart(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setErrorMessage(result.message || 'Unable to add piece to bag.');
      void refreshCatalog();
    }
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
    return { label: 'Add to Cart', disabled: false };
  })();

  const renderPrice = () => {
    if (resolvedVariant) {
      return (
        <Price amount={resolvedVariant.price} compareAtAmount={product.compareAtPrice} size="lg" />
      );
    }
    const from = priceSummary && !priceSummary.same;
    return (
      <div className="inline-flex items-baseline gap-1.5 mt-2">
        {from && <span className="text-xs text-[#827E77] font-normal">From</span>}
        <Price amount={priceSummary ? priceSummary.min : product.price} size="lg" />
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] overflow-y-auto p-4 sm:p-6 lg:p-10 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#181716]/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-3xl bg-[#FAF9F6] rounded-3xl shadow-2xl border border-[#E8E5DF] overflow-hidden z-10 my-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickview-title"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm hover:bg-[#FFFFFF] text-[#63605A] hover:text-[#181716] transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
              aria-label="Close quick view"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Image Preview Column */}
              <div className="p-6 bg-[#FFFFFF] border-b md:border-b-0 md:border-r border-[#E8E5DF] flex flex-col justify-between">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#F4ECE9] border border-[#E8E5DF] group">
                  <ProductImage
                    src={product.images[activeImageIndex] || product.images[0]}
                    alt={`${product.name} view ${activeImageIndex + 1}`}
                    className="h-full w-full"
                    imgClassName="transition-transform duration-500 group-hover:scale-105"
                  />
                  {product.compareAtPrice && product.compareAtPrice > product.price && (
                    <span className="absolute top-4 left-4 px-3 py-1 bg-[#E68057] text-[#181716] text-[10px] uppercase font-semibold tracking-widest rounded-full">
                      Archive Sale
                    </span>
                  )}
                  {product.isNewArrival && (
                    <Badge variant="new" className="absolute top-4 right-4">New</Badge>
                  )}
                </div>

                {product.images.length > 1 && (
                  <div className="flex gap-2 mt-4 justify-center overflow-x-auto pb-2">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-14 h-18 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                          activeImageIndex === idx
                            ? 'border-[#A2574F] shadow-sm scale-105'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        aria-label={`View image ${idx + 1}`}
                        aria-current={activeImageIndex === idx}
                      >
                        <ProductImage
                          src={img}
                          alt=""
                          className="h-full w-full"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info Column */}
              <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-widest text-[#A2574F] font-semibold">
                        {product.categorySlug}
                      </span>
                      {product.isNewArrival && <Badge variant="new" size="sm">New</Badge>}
                      {product.isBestSeller && <Badge variant="outline" size="sm">Best Seller</Badge>}
                    </div>
                    <h3 id="quickview-title" className="font-serif text-xl sm:text-2xl text-[#181716] font-normal leading-snug">
                      {product.name}
                    </h3>
                    <p className="text-xs text-[#63605A] italic mt-1 line-clamp-2">{product.tagline}</p>
                    {renderPrice()}
                  </div>

                  <p className="text-xs text-[#63605A] leading-relaxed line-clamp-3">
                    {product.description}
                  </p>

                  {/* Variant Selection */}
                  {visibleGroups.length > 0 && (
                    <VariantSelector
                      product={product}
                      selections={selections}
                      onChange={(next) => {
                        setSelections(next);
                        setQuantity(1);
                        setErrorMessage(null);
                      }}
                      size="sm"
                    />
                  )}

                  {/* Availability status */}
                  <div>
                    {!hasAnyVariants ? (
                      <p className="text-xs flex items-center gap-1.5 font-medium rounded-lg px-3 py-2.5 text-[#9E332B] bg-[#FDF2F2] border border-[#F8B4B4]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Currently unavailable online
                      </p>
                    ) : stillSelecting ? (
                        <p className="text-xs text-[#827E77] bg-[#FAF9F6] border border-dashed border-[#E8E5DF] rounded-lg px-3 py-2.5">
                          {visibleGroups.length === 1
                            ? `Choose ${visibleGroups[0].label.toLowerCase()} to check availability`
                            : 'Choose your options to check availability'}
                        </p>
                      ) : !resolvedVariantPurchasable ? (
                        <p className="text-xs flex items-center gap-1.5 font-medium rounded-lg px-3 py-2.5 text-[#9E332B] bg-[#FDF2F2] border border-[#F8B4B4]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Out of stock
                        </p>
                      ) : resolvedVariant!.stockQuantity <= LOW_STOCK_THRESHOLD ? (
                        <p className="text-xs flex items-center gap-1.5 font-medium rounded-lg px-3 py-2.5 text-[#8A6024] bg-[#FFF8F0] border border-[#ECD9BD]">
                          <Sparkles className="w-3.5 h-3.5" />
                          Small-batch rarity: Only {resolvedVariant!.stockQuantity} pieces remaining
                        </p>
                      ) : (
                        <p className="text-xs flex items-center gap-1.5 font-medium rounded-lg px-3 py-2.5 text-[#2E5A44] bg-[#E8EFEA] border border-[#C8D8CA]">
                          <Check className="w-3.5 h-3.5" />
                          In Stock &bull; Ready for MODEZA Dispatch
                        </p>
                      )}
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-[#63605A]">Quantity</span>
                    <QuantitySelector
                      quantity={quantity}
                      max={resolvedVariant?.stockQuantity || 1}
                      disabled={cta.disabled}
                      onChange={setQuantity}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Value Props */}
                <div className="grid grid-cols-3 gap-3 py-4 border-y border-[#E8E5DF] text-[10px] text-[#63605A]">
                  <div className="flex flex-col items-center text-center gap-1">
                    <Truck className="w-4 h-4 text-[#A2574F]" />
                    <span className="text-center">Complimentary over KSh 15k</span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-1">
                    <RotateCcw className="w-4 h-4 text-[#A2574F]" />
                    <span className="text-center">30-Day Returns</span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-[#A2574F]" />
                    <span className="text-center">Secure Checkout</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-2 border-t border-[#E8E5DF]">
                  {addedToCart ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full py-3 px-4 rounded-xl bg-[#E8EFEA] border border-[#2E5A44]/20 text-xs text-[#2E5A44] flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5" />
                        Added to cart!
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/cart')}
                        className="font-semibold underline text-sm"
                      >
                        View Cart
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        size="lg"
                        disabled={cta.disabled}
                        onClick={handleAddToCart}
                        className="w-full text-xs uppercase tracking-wider"
                      >
                        {cta.label}
                      </Button>
                      {errorMessage && (
                        <p
                          role="alert"
                          className="w-full text-xs text-[#9B1C1C] bg-[#FDF2F2] border border-[#F8B4B4] rounded-xl px-3 py-2.5 flex items-center gap-2"
                        >
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {errorMessage}
                        </p>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/product/${product.slug}`);
                    }}
                    className="w-full py-2.5 text-xs text-[#63605A] hover:text-[#181716] font-medium flex items-center justify-center gap-1.5 transition-colors hover:bg-[#F3F1ED] rounded-xl"
                  >
                    <span>View Full Piece Specifications</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};