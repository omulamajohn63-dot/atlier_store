import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../router/RouterContext';
import { setPostAuthDestination } from '../utils/postAuthRedirect';
import { QuantitySelector } from '../components/ui/QuantitySelector';
import { Price } from '../components/ui/Price';
import { Button } from '../components/ui/Button';
import { ShoppingBag, Trash2, ArrowRight, ShieldCheck, Truck, ArrowLeft, Tag, Lock, X } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import {
  formatPrice,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_COST,
  VAT_RATE,
} from '../utils/currency';
import { motion } from 'motion/react';

export const CartPage: React.FC = () => {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    cartCount,
    discountAmount,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    estimatedShipping,
    estimatedTax,
    estimatedTotal,
  } = useCart();
  const { navigate } = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { getProductById } = useStore();

  const goToProduct = (productId: string) => {
    const product = getProductById(productId);
    navigate(product ? `/product/${product.slug}` : '/shop');
  };

  const goToCheckout = () => {
    if (isAuthLoading) return;
    if (!user) {
      setPostAuthDestination('/checkout');
      navigate('/account');
      return;
    }
    navigate('/checkout');
  };

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [orderNote, setOrderNote] = useState('');

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoMsg(null);
    if (!promoCodeInput.trim()) return;

    const res = applyPromoCode(promoCodeInput.trim());
    if (res.success) {
      setPromoMsg({ text: res.message, isError: false });
      setPromoCodeInput('');
    } else {
      setPromoMsg({ text: res.message, isError: true });
    }
  };

  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const progressPercent = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 pb-28 lg:pb-0 2xl:max-w-[88rem]">
      {/* Header */}
      <div className="border-b border-[#E8E5DF] pb-6">
        <nav className="text-xs text-[#827E77] flex items-center gap-2 mb-3" aria-label="Breadcrumb">
          <button onClick={() => navigate('/')} className="hover:text-[#181716] transition-colors">
            Home
          </button>
          <span>/</span>
          <span className="text-[#181716] font-medium">Cart</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#181716] font-normal tracking-tight">
            Your Cart
          </h1>
          <span className="flex items-center gap-2 text-xs text-[#827E77] uppercase tracking-wider font-semibold bg-[#FAF9F6] border border-[#E8E5DF] px-3 py-1.5 rounded-full">
            <ShoppingBag className="w-3.5 h-3.5 text-[#8A745C]" />
            {cartCount} {cartCount === 1 ? 'Piece' : 'Pieces'}
          </span>
        </div>
      </div>

      {cart.length === 0 ? (
        /* Empty Cart State */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="py-20 text-center bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl p-10 max-w-2xl mx-auto shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] flex items-center justify-center mx-auto text-[#8A745C] mb-5">
            <ShoppingBag className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h2 className="font-serif text-2xl text-[#181716] mb-2">Your cart is empty</h2>
          <p className="text-sm text-[#63605A] max-w-md mx-auto leading-relaxed mb-6">
            Take your time browsing our trans-seasonal collection of organic silk, tailoring, and
            artisanal accessories.
          </p>
          <Button variant="primary" size="lg" onClick={() => navigate('/shop')} className="gap-2">
            <span>Discover The Collection</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Populated Cart Layout (Grid: Items Table + Summary Sidebar) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Cart Items List (Col 8) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Free shipping banner with progress bar */}
            <div className="p-5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-2xl text-xs shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2.5 text-[#63605A]">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E8E5DF] flex items-center justify-center text-[#8A745C] flex-shrink-0">
                    <Truck className="w-4.5 h-4.5" strokeWidth={1.5} />
                  </div>
                  {isFreeShipping ? (
                    <span className="text-[#2E5A44] font-medium">
                      Complimentary express dispatch applied to your order.
                    </span>
                  ) : (
                    <span className="text-pretty">
                      Add <strong className="text-[#181716]">{formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)}</strong> more for complimentary delivery.
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] text-[#827E77] hover:text-[#9E332B] transition-colors underline flex items-center gap-1 flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Cart
                </button>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-[#E8E5DF] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${
                    isFreeShipping
                      ? 'bg-gradient-to-r from-[#2E5A44] to-[#2E5A44]/60'
                      : 'bg-gradient-to-r from-[#8A745C] to-[#A6937D]'
                  }`}
                />
              </div>
              {!isFreeShipping && (
                <p className="text-[10px] text-[#827E77] mt-2">
                  Free shipping at {formatPrice(FREE_SHIPPING_THRESHOLD)} &bull; {Math.round(progressPercent)}% there
                </p>
              )}
            </div>

            {/* List of items */}
            <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-2xl overflow-hidden divide-y divide-[#F3F1ED] shadow-sm">
              {cart.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between hover:bg-[#FAF9F6] transition-colors group"
                >
                  {/* Item Image + Details */}
                  <div className="flex gap-4 items-start sm:items-center flex-1 min-w-0">
                    <div
                      className="w-20 h-26 rounded-xl overflow-hidden bg-[#EFECE6] shrink-0 cursor-pointer shadow-sm group-hover:shadow-md transition-shadow"
                      onClick={() => goToProduct(item.productId)}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <h3
                        className="font-serif text-base text-[#181716] font-medium cursor-pointer hover:text-[#8A745C] transition-colors truncate"
                        onClick={() => goToProduct(item.productId)}
                      >
                        {item.name}
                      </h3>
                      <p className="text-xs text-[#827E77] tracking-wider uppercase">
                        {item.color} &bull; Size {item.size}
                      </p>
                      <div className="sm:hidden pt-1">
                        <Price amount={item.price} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Quantity and Line Total */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-[#F3F1ED]">
                    <QuantitySelector
                      quantity={item.quantity}
                      max={item.maxStock}
                      size="sm"
                      onChange={(q) => updateQuantity(item.id, q)}
                    />

                    <div className="text-right min-w-[90px]">
                      <Price amount={item.price * item.quantity} size="md" />
                      {item.quantity > 1 && (
                        <p className="text-[10px] text-[#827E77] mt-0.5">
                          {formatPrice(item.price)} each
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-[#A29E96] hover:text-[#9E332B] transition-all hover:bg-[#FDF2F2] rounded-full"
                      title="Remove piece"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Order notes & Continued shopping */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="text-xs font-semibold text-[#181716] hover:text-[#8A745C] flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Continue Shopping</span>
              </button>

              <div className="w-full sm:w-80">
                <label htmlFor="order-note" className="sr-only">Order note</label>
                <input
                  id="order-note"
                  type="text"
                  placeholder="MODEZA packaging / gift note instructions..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="w-full text-xs px-4 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl text-[#181716] placeholder-[#A29E96] focus:outline-none focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Order Summary Box (Col 4) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8A745C]/20 to-transparent" />
              <h3 className="font-serif text-lg text-[#181716] font-medium border-b border-[#F3F1ED] pb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#8A745C]" />
                Order Summary
              </h3>

              {/* Promo code form */}
              <form onSubmit={handleApplyPromo} className="space-y-3">
                <label className="text-xs text-[#63605A] block" htmlFor="promo-code">
                  Promotional Voucher
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-[#827E77] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="promo-code"
                      type="text"
                      placeholder="e.g. MODEZA10, KARIBU500"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl text-xs uppercase text-[#181716] placeholder-[#A29E96] focus:outline-none focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20 transition-all"
                    />
                  </div>
                  <Button variant="secondary" size="sm" type="submit">
                    Apply
                  </Button>
                </div>

                {promoMsg && (
                  <p className={`text-[11px] font-medium flex items-center gap-1.5 px-3 py-2 rounded-lg ${promoMsg.isError ? 'text-[#9B1C1C] bg-[#FDF2F2]' : 'text-[#2E5A44] bg-[#E8EFEA]'}`}>
                    <span>{promoMsg.isError ? '✕' : '✓'}</span> 
                    <span className="truncate">{promoMsg.text}</span>
                  </p>
                )}

                {appliedPromo && !promoMsg && (
                  <div className="flex items-center justify-between text-[11px] text-[#2E5A44] font-medium bg-[#E8EFEA] px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3 h-3" />
                      {appliedPromo.code} applied
                    </span>
                    <button
                      type="button"
                      onClick={removePromoCode}
                      className="text-[#9B1C1C] hover:underline ml-2 p-1 rounded-full hover:bg-[#FDF2F2] transition-colors"
                      aria-label="Remove promo code"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </form>

              {/* Price Calculations */}
              <div className="space-y-3 text-xs text-[#63605A] border-t border-[#F3F1ED] pt-4">
                <div className="flex justify-between">
                  <span>Cart Subtotal</span>
                  <span className="text-[#181716] font-medium">{formatPrice(subtotal)}</span>
                </div>

                {appliedPromo && (
                  <div className="flex justify-between text-[#2E5A44]">
                    <span>Privilege ({appliedPromo.code})</span>
                    <span className="font-medium">-{formatPrice(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="text-[#181716] font-medium">
                    {estimatedShipping === 0 ? 'Complimentary' : formatPrice(estimatedShipping)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Estimated VAT (16%)</span>
                  <span className="text-[#181716] font-medium">{formatPrice(estimatedTax)}</span>
                </div>

                <div className="flex justify-between items-baseline text-base text-[#181716] font-serif font-medium border-t border-[#F3F1ED] pt-3.5 mt-3">
                  <span>Estimated Total</span>
                  <span className="text-xl">{formatPrice(estimatedTotal)}</span>
                </div>
              </div>

              {/* Checkout CTA */}
              <div className="space-y-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => goToCheckout()}
                  className="w-full gap-2 uppercase tracking-wider text-xs shadow-md hover:shadow-lg"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>

                <div className="flex items-center justify-center gap-2 text-[11px] text-[#827E77] pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8A745C]" />
                  <span>256-Bit SSL Encrypted Transaction</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile sticky checkout bar (lg:hidden) */}
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-[300] border-t border-[#E8E5DF] bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur shadow-[0_-4px_20px_rgb(24_23_22/0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-[#827E77]">Estimated Total</p>
              <p className="font-serif text-lg text-[#181716] leading-tight">{formatPrice(estimatedTotal)}</p>
            </div>
            <Button
              variant="primary"
              onClick={() => goToCheckout()}
              className="flex-1 uppercase tracking-wider text-xs gap-1.5"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};