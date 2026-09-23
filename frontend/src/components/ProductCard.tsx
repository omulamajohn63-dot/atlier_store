import React, { useState } from 'react';
import { Product } from '../types';
import { Price } from './ui/Price';
import { Badge } from './ui/Badge';
import { Eye, Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { ColorSwatches } from './variant/ColorSwatches';
import {
  getColorSwatches,
  getPriceSummary,
  getVariantSummary,
  getVisibleOptionGroups,
  isVariantPurchasable,
} from '../utils/variants';

export interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  onClick?: (product: Product) => void;
  variant?: 'default' | 'compact' | 'featured';
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onQuickView,
  onClick,
  variant = 'default',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addToCart, isLoading } = useCart();
  const saved = isWishlisted(product.id);

  const hasVariants = (product.variants?.length ?? 0) > 0;
  const totalStock = (product.variants ?? []).reduce((acc, v) => acc + v.stockQuantity, 0);
  const visibleOptionGroups = hasVariants ? getVisibleOptionGroups(product) : [];
  const hasOptionsToSelect = visibleOptionGroups.length > 0;
  const isSoldOut = totalStock <= 0;
  const isLowStock = !isSoldOut && totalStock <= 4;
  const hasMultipleImages = product.images.length > 1;
  const selectedVariant =
    hasVariants
      ? product.variants.find((variant) => isVariantPurchasable(variant)) || product.variants[0]
      : undefined;

  const priceSummary = getPriceSummary(product);
  const swatches = getColorSwatches(product);
  const colorCount = swatches.length;
  const variantSummary = getVariantSummary(product);

  const handleAddToCart = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!selectedVariant || !isVariantPurchasable(selectedVariant)) return;

    const result = await addToCart(product, selectedVariant, 1);
    if (result.success) {
      setIsAdded(true);
      window.setTimeout(() => setIsAdded(false), 1600);
    }
  };

  const handleViewOptions = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick?.(product);
  };

  const primaryActionDisabled = hasOptionsToSelect ? false : isSoldOut || isLoading;
  const primaryActionLabel = hasOptionsToSelect
    ? 'View Options'
    : isSoldOut
      ? 'Sold Out'
      : isAdded
        ? 'Added to Cart'
        : 'Add to Cart';

  const variantStyles = {
    default: 'group relative flex flex-col cursor-pointer',
    compact: 'group relative flex flex-col cursor-pointer',
    featured: 'group relative flex flex-col cursor-pointer',
  };

  const imageAspectRatio = variant === 'compact' ? 'aspect-[4/5]' : 'aspect-[3/4]';

  const renderPriceLine = () => (
    <div className="flex items-baseline gap-1.5 flex-wrap">
      {!priceSummary.same && <span className="text-[11px] text-[#827E77] font-normal">From</span>}
      <Price
        amount={priceSummary.min}
        compareAtAmount={product.compareAtPrice}
        size="sm"
      />
    </div>
  );

  const renderVariantMeta = () => (
    <>
      {variantSummary && (
        <p className="text-[11px] text-[#827E77] flex items-center gap-1.5">
          {variantSummary}
        </p>
      )}
      {colorCount >= 2 && (
        <ColorSwatches options={swatches} size="sm" compact />
      )}
    </>
  );

  if (variant === 'compact') {
    return (
      <div
        className={variantStyles[variant]}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onClick?.(product)}
      >
        <div className="relative w-full overflow-hidden rounded-xl bg-[#F4ECE9] mb-2.5">
          <img
            src={isHovered && hasMultipleImages ? product.images[1] : product.images[0]}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleWishlist(product.id);
            }}
            className="absolute right-2 top-2 z-20 rounded-full bg-white/95 p-1.5 text-[#181716] shadow-sm transition-colors hover:bg-[#181716] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
            aria-label={`${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
          >
            <Heart className={`h-3.5 w-3.5 ${saved ? 'fill-current text-[#9E332B]' : ''}`} />
          </button>
        </div>
        <div className="flex flex-col flex-grow space-y-1">
          <span className="text-[10px] font-medium tracking-widest uppercase text-[#827E77]">
            {product.categorySlug}
          </span>
          <h4 className="font-serif text-sm text-[#181716] group-hover:text-[#A2574F] transition-colors line-clamp-1">
            {product.name}
          </h4>
          {renderPriceLine()}
          {renderVariantMeta()}
        </div>
      </div>
    );
  }

  return (
    <div
      className={variantStyles[variant]}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick?.(product)}
    >
      {/* Visual Image Frame (Portrait 3:4) */}
      <div className="relative overflow-hidden rounded-xl bg-[#F4ECE9] mb-3.5 image-zoom">
        <div className={`${imageAspectRatio} w-full`}>
          <img
            src={isHovered && hasMultipleImages ? product.images[1] : product.images[0]}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center transition-transform duration-500 ease-out"
          />
        </div>

        {/* Overlay Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {isSoldOut ? (
            <Badge variant="neutral">Sold Out</Badge>
          ) : product.compareAtPrice && product.compareAtPrice > product.price ? (
            <Badge variant="sale">Sale</Badge>
          ) : product.isNewArrival ? (
            <Badge variant="new">New</Badge>
          ) : null}

          {isLowStock && <Badge variant="lowStock">Low Stock</Badge>}
          {product.isBestSeller && !isSoldOut && <Badge variant="outline">Best Seller</Badge>}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleWishlist(product.id);
          }}
          className="absolute right-3 top-3 z-20 rounded-full bg-white/95 p-2 text-[#181716] shadow-sm transition-all duration-200 hover:bg-[#A2574F] hover:text-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
          aria-label={`${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
          title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`h-4 w-4 ${saved ? 'fill-current text-[#9E332B]' : ''}`} />
        </button>

        {/* Quick View Button (Desktop Hover Reveal) */}
        {onQuickView && (
          <div className="absolute inset-x-3 bottom-3 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product);
              }}
              className="w-full py-2.5 px-4 bg-[#FFFFFF]/95 backdrop-blur-xs text-[#181716] text-xs font-medium uppercase tracking-wider rounded-lg shadow-sm hover:bg-[#FFFFFF] hover:shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Quick View</span>
            </button>
          </div>
        )}

        {/* Primary CTA Overlay on Hover */}
        {!isSoldOut && (
          <div className="absolute inset-x-3 bottom-3 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-75">
            <button
              type="button"
              onClick={hasOptionsToSelect ? handleViewOptions : handleAddToCart}
              disabled={primaryActionDisabled}
              aria-label={
                hasOptionsToSelect
                  ? `View options for ${product.name}`
                  : `Add ${product.name} to cart`
              }
              className="w-full py-2.5 px-4 bg-[#A2574F] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider rounded-lg shadow-sm hover:bg-[#83443D] hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {hasOptionsToSelect ? (
                <>
                  <span>View Options</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Adding...' : 'Add to Cart'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Product Metadata */}
      <div className="flex flex-col flex-grow space-y-2">
        <span className="text-[10px] font-medium tracking-widest uppercase text-[#827E77]">
          {product.categorySlug}
        </span>

        <h4 className="font-serif text-base text-[#181716] group-hover:text-[#A2574F] transition-colors line-clamp-1">
          {product.name}
        </h4>

        {product.tagline && (
          <p className="text-[11px] text-[#63605A] italic line-clamp-1">
            {product.tagline}
          </p>
        )}

        <div className="pt-1">
          {renderPriceLine()}
        </div>

        {hasVariants && renderVariantMeta()}

        <button
          type="button"
          onClick={hasOptionsToSelect ? handleViewOptions : handleAddToCart}
          disabled={primaryActionDisabled}
          aria-label={
            hasOptionsToSelect
              ? `View options for ${product.name}`
              : isSoldOut
                ? `${product.name} is sold out`
                : `Add ${product.name} to cart`
          }
          className="mt-2 w-full rounded-lg border border-[#181716] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#181716] transition-all duration-200 hover:bg-[#A2574F] hover:border-[#A2574F] hover:text-[#FAF9F6] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] disabled:cursor-not-allowed disabled:border-[#D8D3CB] disabled:text-[#A29E96] disabled:hover:bg-transparent disabled:hover:shadow-none active:scale-[0.98]"
        >
          {hasOptionsToSelect ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              {primaryActionLabel}
              <ArrowRight className="w-3 h-3" />
            </span>
          ) : (
            primaryActionLabel
          )}
        </button>
      </div>
    </div>
  );
};