import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartItem, Product, ProductVariant, VariantSize } from '../types';
import { useStore } from './StoreContext';
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_COST, VAT_RATE } from '../utils/currency';
import { api } from '../services/apiClient';
import { CartDTO } from '../types/api';

interface AppliedPromo {
  code: string;
  discountAmount: number;
  description: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, variant: ProductVariant, quantity: number) => Promise<{ success: boolean; message?: string }>;
  updateQuantity: (cartItemId: string, newQuantity: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  isLoading: boolean;
  cartCount: number;
  subtotal: number;
  discountAmount: number;
  appliedPromo: AppliedPromo | null;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;
  estimatedShipping: number;
  estimatedTax: number;
  estimatedTotal: number;
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * The backend wraps validation failures in {"error": {"code", "message", "details"}}
 * where `details` carries field-level reasons (e.g. {'quantity': 'Only N items are
 * available.'}, {'variantId': 'Variant is not available.'}) while the top-level
 * message stays generic ("Request validation failed."). Surface the field-level
 * reason to the customer instead of the generic envelope message.
 */
function friendlyCartError(error: Error & { code?: string; details?: Record<string, string> }): string {
  const details = error?.details;
  if (details && typeof details === 'object') {
    const values = Object.values(details).filter((v): v is string => typeof v === 'string');
    const first = values[0];
    if (first) return first;
  }
  if (error?.code === 'CART_ITEM_UNAVAILABLE' || error?.code === 'VARIANT_NOT_AVAILABLE') {
    return 'This piece is no longer available on the modeza boutique.';
  }
  return error?.message || 'Unable to add item to bag.';
}

function mapCartDtoToItems(dto: CartDTO): CartItem[] {
  return dto.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    name: item.product.name,
    size: (item.variant.size || 'One Size') as VariantSize,
    color: item.variant.color || '',
    price: item.unitPrice,
    quantity: item.quantity,
    image: item.product.image || item.product.imageUrl || item.product.images?.[0] || '',
    maxStock: item.variant.stockQuantity,
  }));
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { validatePromoCode } = useStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serverSubtotal, setServerSubtotal] = useState<number>(0);
  const [serverItemCount, setServerItemCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Synchronize cart with authoritative server state on load
  const refreshCart = useCallback(async () => {
    try {
      setIsLoading(true);
      const serverCart = await api.getCart();
      setCart(mapCartDtoToItems(serverCart));
      setServerSubtotal(serverCart.subtotal);
      setServerItemCount(serverCart.itemCount);
    } catch (err) {
      console.warn('[CartContext] Failed to load server cart, using fallback:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (
    product: Product,
    variant: ProductVariant,
    quantity: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true);
      const updatedServerCart = await api.addCartItem(variant.id, quantity);
      setCart(mapCartDtoToItems(updatedServerCart));
      setServerSubtotal(updatedServerCart.subtotal);
      setServerItemCount(updatedServerCart.itemCount);
      setIsCartDrawerOpen(true);
      return { success: true };
    } catch (err: unknown) {
      const errorObj = err as Error & { code?: string; details?: Record<string, string> };
      return { success: false, message: friendlyCartError(errorObj) };
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (cartItemId: string, newQuantity: number): Promise<void> => {
    try {
      if (newQuantity <= 0) {
        await removeFromCart(cartItemId);
        return;
      }
      setIsLoading(true);
      const updatedServerCart = await api.updateCartItem(cartItemId, newQuantity);
      setCart(mapCartDtoToItems(updatedServerCart));
      setServerSubtotal(updatedServerCart.subtotal);
      setServerItemCount(updatedServerCart.itemCount);
    } catch (err) {
      console.error('[CartContext] Update quantity failed:', err);
      // Re-fetch authoritative state to undo invalid optimistic values
      await refreshCart();
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromCart = async (cartItemId: string): Promise<void> => {
    try {
      setIsLoading(true);
      const updatedServerCart = await api.removeCartItem(cartItemId);
      setCart(mapCartDtoToItems(updatedServerCart));
      setServerSubtotal(updatedServerCart.subtotal);
      setServerItemCount(updatedServerCart.itemCount);
    } catch (err) {
      console.error('[CartContext] Remove item failed:', err);
      await refreshCart();
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const cleared = await api.clearCart();
      setCart(mapCartDtoToItems(cleared));
      setServerSubtotal(0);
      setServerItemCount(0);
      setAppliedPromo(null);
    } catch (err) {
      console.error('[CartContext] Clear cart failed:', err);
      setCart([]);
    } finally {
      setIsLoading(false);
    }
  };

  const cartCount = cart.length;
  const subtotal = serverSubtotal || cart.reduce((total, item) => total + item.price * item.quantity, 0);

  // Recalculate promo whenever subtotal changes
  useEffect(() => {
    if (appliedPromo) {
      const check = validatePromoCode(appliedPromo.code, subtotal);
      if (check.valid && check.discount) {
        setAppliedPromo({
          code: check.discount.code,
          discountAmount: check.discountAmount,
          description: check.discount.description,
        });
      } else {
        setAppliedPromo(null);
      }
    }
  }, [subtotal, validatePromoCode]);

  const applyPromoCode = (code: string): { success: boolean; message: string } => {
    const result = validatePromoCode(code, subtotal);
    if (result.valid && result.discount) {
      setAppliedPromo({
        code: result.discount.code,
        discountAmount: result.discountAmount,
        description: result.discount.description,
      });
      return { success: true, message: result.message };
    }
    return { success: false, message: result.message };
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
  };

  const discountAmount = appliedPromo ? appliedPromo.discountAmount : 0;
  const estimatedShipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD
    ? 0
    : Math.round(subtotal * 0.2);
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const estimatedTax = Math.round(taxableSubtotal * VAT_RATE);
  const estimatedTotal = taxableSubtotal + estimatedShipping + estimatedTax;

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart,
        isLoading,
        cartCount,
        subtotal,
        discountAmount,
        appliedPromo,
        applyPromoCode,
        removePromoCode,
        estimatedShipping,
        estimatedTax,
        estimatedTotal,
        isCartDrawerOpen,
        openCartDrawer: () => setIsCartDrawerOpen(true),
        closeCartDrawer: () => setIsCartDrawerOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
