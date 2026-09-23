import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../router/RouterContext';
import { setPostAuthDestination } from '../utils/postAuthRedirect';
import { Button } from './ui/Button';
import { QuantitySelector } from './ui/QuantitySelector';
import { Price } from './ui/Price';
import { formatPrice, FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_COST } from '../utils/currency';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartDrawerOpen,
    closeCartDrawer,
    updateQuantity,
    removeFromCart,
    subtotal,
    discountAmount,
    appliedPromo,
    estimatedShipping,
    estimatedTotal,
    cartCount,
  } = useCart();
  const { navigate } = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const goToCheckout = () => {
    if (isAuthLoading) return;
    closeCartDrawer();
    if (!user) {
      setPostAuthDestination('/checkout');
      navigate('/account');
      return;
    }
    navigate('/checkout');
  };

  const progressPercent = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const amountRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const shippingCost = estimatedShipping;

  return (
    <AnimatePresence>
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCartDrawer}
            className="fixed inset-0 bg-[#181716]/40 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-screen max-w-md bg-[#FAF9F6] shadow-2xl border-l border-[#E8E5DF] flex flex-col"
            >
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-[#E8E5DF] bg-[#FFFFFF] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-[#181716] stroke-[1.5]" />
                  <h3 className="font-serif text-lg text-[#181716] font-medium">
                    Cart ({cartCount})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeCartDrawer}
                  className="p-1 rounded-full text-[#63605A] hover:text-[#181716] hover:bg-[#F3F1ED] transition-colors"
                  aria-label="Close cart drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Free Shipping Progress Indicator */}
              <div className="bg-[#FAF9F6] px-6 py-3.5 border-b border-[#E8E5DF] text-xs">
                {amountRemaining > 0 ? (
                  <p className="text-[#63605A] mb-2">
                    Add <span className="font-semibold text-[#181716]">{formatPrice(amountRemaining)}</span> more to qualify for <span className="font-semibold text-[#181716]">Complimentary Express Shipping</span>.
                  </p>
                ) : (
                  <p className="text-[#2E5A44] font-medium mb-2 flex items-center gap-1.5">
                    <span>✓</span> You have unlocked complimentary express shipping.
                  </p>
                )}
                <div className="w-full bg-[#E8E5DF] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${amountRemaining > 0 ? 'bg-gradient-to-r from-[#E68057] to-[#A2574F]' : 'bg-[#2E5A44]'} h-full transition-all duration-300 rounded-full`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Cart Line Items */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-[#F3F1ED] flex items-center justify-center text-[#A2574F]">
                      <ShoppingBag className="w-7 h-7 stroke-[1.5]" />
                    </div>
                    <div>
                        <h4 className="font-serif text-xl text-[#181716]">Your cart is empty</h4>
                      <p className="text-xs text-[#63605A] mt-1 max-w-xs">
                        Explore our seasonal capsule of elevated apparel and curated accessories.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        closeCartDrawer();
                        navigate('/shop');
                      }}
                    >
                      Browse The Collection
                    </Button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-3 bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl"
                    >
                      {/* Image */}
                      <div className="w-20 h-24 bg-[#F4ECE9] rounded-lg overflow-hidden shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-serif text-sm text-[#181716] font-medium line-clamp-1">
                              {item.name}
                            </h5>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="text-[#A29E96] hover:text-[#9E332B] transition-colors p-0.5"
                              aria-label={`Remove ${item.name} from cart`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-[#827E77] uppercase tracking-wider mt-0.5">
                            {item.color} &bull; Size {item.size}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#F3F1ED]">
                          <QuantitySelector
                            quantity={item.quantity}
                            max={item.maxStock}
                            size="sm"
                            onChange={(q) => updateQuantity(item.id, q)}
                          />
                          <Price amount={item.price * item.quantity} size="sm" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer Summary */}
              {cart.length > 0 && (
                <div className="p-6 bg-[#FFFFFF] border-t border-[#E8E5DF] space-y-4">
                  <div className="space-y-1.5 text-xs text-[#63605A]">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium text-[#181716]">{formatPrice(subtotal)}</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex justify-between text-[#2E5A44]">
                        <span>Privilege ({appliedPromo.code})</span>
                        <span className="font-medium">-{formatPrice(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Estimated Shipping</span>
                      <span className="font-medium text-[#181716]">
                        {shippingCost === 0 ? 'Complimentary' : formatPrice(shippingCost)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#F3F1ED] text-sm font-semibold text-[#181716]">
                      <span>Estimated Total</span>
                      <span>{formatPrice(estimatedTotal)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => {
                        closeCartDrawer();
                        navigate('/cart');
                      }}
                    >
                      View Full Cart
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={goToCheckout}
                      className="gap-1.5"
                    >
                      <span>Checkout</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
