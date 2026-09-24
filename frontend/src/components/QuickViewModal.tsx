import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useRouter } from '../router/RouterContext';
import { useStore } from '../context/StoreContext';
import {
  getPriceSummary,
  getVariantFlow,
  getVisibleOptionGroups,
  isVariantPurchasable,
  LOW_STOCK_THRESHOLD,
  parseVariantSelections,
  type VariantSelections,
} from '../utils/variants';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './modeza';
import { Price } from './ui/Price';
import { ProductImage } from './ui/ProductImage';
import { QuantitySelector } from './ui/QuantitySelector';
import { VariantSelector } from './variant/VariantSelector';

export interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product: initialProduct,
  isOpen,
  onClose,
}) => {
  const { addToCart, isLoading: isCartLoading } = useCart();
  const { getProductById, refreshCatalog } = useStore();
  const { navigate } = useRouter();
  const product = initialProduct ? getProductById(initialProduct.id) || initialProduct : null;

  const [selections, setSelections] = useState<VariantSelections>({});
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (product) {
      setSelections(parseVariantSelections(product, ''));
      setQuantity(1);
      setActiveImageIndex(0);
      setAddedToCart(false);
      setIsAdding(false);
      setErrorMessage(null);
    }
  }, [product?.id]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  if (!product) return null;

  const hasAnyVariants = (product.variants?.length ?? 0) > 0;
  const priceSummary = getPriceSummary(product);
  const visibleGroups = getVisibleOptionGroups(product);
  const flow = getVariantFlow(product, selections);
  const resolvedVariant = flow.variant;
  const stillSelecting = flow.requiresSelection;
  const resolvedVariantPurchasable = isVariantPurchasable(resolvedVariant);
  const activeImage = product.images[activeImageIndex] || product.images[0];

  const handleAddToCart = async () => {
    if (!resolvedVariant || !resolvedVariantPurchasable || isAdding || isCartLoading) return;
    setErrorMessage(null);
    setIsAdding(true);
    try {
      const result = await addToCart(product, resolvedVariant, quantity);
      if (result.success) {
        setAddedToCart(true);
        closeTimerRef.current = window.setTimeout(() => {
          onClose();
          closeTimerRef.current = null;
        }, 1200);
      } else {
        setErrorMessage(result.message || 'Unable to add piece to bag.');
        void refreshCatalog();
      }
    } finally {
      setIsAdding(false);
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
        <Price
          amount={resolvedVariant.price}
          compareAtAmount={product.compareAtPrice}
          size="lg"
        />
      );
    }

    const showFrom = priceSummary && !priceSummary.same;
    return (
      <div className="mt-2 inline-flex items-baseline gap-1.5">
        {showFrom && <span className="text-xs font-normal text-[#827E77]">From</span>}
        <Price amount={priceSummary ? priceSummary.min : product.price} size="lg" />
      </div>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {isOpen && (
        <DialogContent className="block max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none overflow-y-auto overscroll-contain rounded-2xl border border-[#E8E5DF] bg-[#FAF9F6] p-0 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="flex flex-col justify-between border-b border-[#E8E5DF] bg-white p-4 sm:p-6 md:border-b-0 md:border-r">
              <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-[#E8E5DF] bg-[#F4ECE9]">
                <ProductImage
                  src={activeImage}
                  alt={`${product.name} view ${activeImageIndex + 1}`}
                  className="h-full w-full"
                  imgClassName="transition-transform duration-500 group-hover:scale-105"
                />
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <Badge variant="warning" size="lg" className="absolute left-4 top-4 shadow-sm">
                    Archive Sale
                  </Badge>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="mt-4 flex justify-center gap-2 overflow-x-auto pb-2" aria-label="Product images">
                  {product.images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      className={`h-20 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-offset-2 ${
                        activeImageIndex === index
                          ? 'scale-105 border-[#A2574F] shadow-sm'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      aria-label={`View image ${index + 1} of ${product.images.length}`}
                      aria-pressed={activeImageIndex === index}
                    >
                      <ProductImage src={image} alt="" className="h-full w-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between space-y-6 p-5 sm:p-8">
              <div className="space-y-5" aria-busy={isAdding}>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#A2574F]">
                      {product.categorySlug}
                    </span>
                    {product.isNewArrival && <Badge variant="new" size="sm">New</Badge>}
                    {product.isBestSeller && <Badge variant="outline" size="sm">Best Seller</Badge>}
                  </div>
                  <DialogTitle className="font-serif text-xl font-normal leading-snug text-[#181716] sm:text-2xl">
                    {product.name}
                  </DialogTitle>
                  {product.tagline && (
                    <p className="mt-1 line-clamp-2 text-xs italic text-[#63605A]">{product.tagline}</p>
                  )}
                  {renderPrice()}
                </div>

                <DialogDescription className="line-clamp-4 text-xs leading-relaxed text-[#63605A]">
                  {product.description}
                </DialogDescription>

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

                <div>
                  {!hasAnyVariants ? (
                    <Badge variant="destructive" size="lg" className="w-full justify-start gap-1.5 rounded-lg px-3 py-2.5 text-xs normal-case tracking-normal">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Currently unavailable online
                    </Badge>
                  ) : stillSelecting ? (
                    <Badge size="lg" className="w-full justify-start rounded-lg border-dashed px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-[#827E77]">
                      {visibleGroups.length === 1
                        ? `Choose ${visibleGroups[0].label.toLowerCase()} to check availability`
                        : 'Choose your options to check availability'}
                    </Badge>
                  ) : !resolvedVariantPurchasable ? (
                    <Badge variant="destructive" size="lg" className="w-full justify-start gap-1.5 rounded-lg px-3 py-2.5 text-xs normal-case tracking-normal">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Out of stock
                    </Badge>
                  ) : resolvedVariant.stockQuantity <= LOW_STOCK_THRESHOLD ? (
                    <Badge variant="warning" size="lg" className="w-full justify-start gap-1.5 rounded-lg px-3 py-2.5 text-xs normal-case tracking-normal">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      Small-batch rarity: only {resolvedVariant.stockQuantity} pieces remaining
                    </Badge>
                  ) : (
                    <Badge variant="success" size="lg" className="w-full justify-start gap-1.5 rounded-lg px-3 py-2.5 text-xs normal-case tracking-normal">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      In stock &bull; ready for MODEZA dispatch
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-medium text-[#63605A]">Quantity</span>
                  <QuantitySelector
                    quantity={quantity}
                    max={resolvedVariant?.stockQuantity || 1}
                    disabled={cta.disabled || isAdding}
                    onChange={setQuantity}
                    size="sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-y border-[#E8E5DF] py-4 text-[10px] text-[#63605A] sm:gap-3">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Truck className="h-4 w-4 text-[#A2574F]" aria-hidden="true" />
                  <span>Complimentary over KSh 15k</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <RotateCcw className="h-4 w-4 text-[#A2574F]" aria-hidden="true" />
                  <span>30-Day Returns</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <ShieldCheck className="h-4 w-4 text-[#A2574F]" aria-hidden="true" />
                  <span>Secure Checkout</span>
                </div>
              </div>

              <div className="space-y-3 border-t border-[#E8E5DF] pt-2">
                {addedToCart ? (
                  <div
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#2E5A44]/20 bg-[#E8EFEA] px-4 py-3 text-xs text-[#2E5A44]"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Added to cart
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate('/cart');
                      }}
                      className="rounded-sm text-sm font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
                    >
                      View Cart
                    </button>
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      fullWidth
                      disabled={cta.disabled || isAdding || isCartLoading}
                      isLoading={isAdding || isCartLoading}
                      onClick={handleAddToCart}
                      className="text-xs uppercase tracking-wider"
                    >
                      {cta.label}
                    </Button>
                    {errorMessage && (
                      <p
                        role="alert"
                        className="flex w-full items-start gap-2 rounded-xl border border-[#F8B4B4] bg-[#FDF2F2] px-3 py-2.5 text-xs text-[#9B1C1C]"
                      >
                        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {errorMessage}
                      </p>
                    )}
                  </>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => {
                    onClose();
                    navigate(`/product/${product.slug}`);
                  }}
                  className="w-full rounded-xl py-2.5 text-xs font-medium normal-case tracking-normal text-[#63605A] hover:text-[#181716]"
                >
                  View Full Piece Specifications
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
};
