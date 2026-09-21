import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { audit } from '../lib/logger';

const WISHLIST_STORAGE_KEY = 'modeza_wishlist_v1';

interface WishlistContextValue {
  wishlistIds: string[];
  wishlistCount: number;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

function readWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isRemoteReady, setIsRemoteReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadWishlist = async () => {
      if (!user || !supabase) {
        setWishlistIds(readWishlist());
        setIsRemoteReady(true);
        return;
      }

      const anonymousIds = readWishlist();
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('product_id')
        .eq('user_id', user.id);

      if (cancelled) return;

      const remoteIds = error ? [] : (data || []).map((item) => item.product_id);
      const mergedIds = [...new Set([...remoteIds, ...anonymousIds])];
      setWishlistIds(mergedIds);
      setIsRemoteReady(true);

      if (!error && anonymousIds.length > 0) {
        await supabase.from('wishlist_items').upsert(
          anonymousIds.map((productId) => ({ user_id: user.id, product_id: productId })),
          { onConflict: 'user_id,product_id' },
        );
        localStorage.removeItem(WISHLIST_STORAGE_KEY);
      }
    };

    setIsRemoteReady(false);
    void loadWishlist();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!isRemoteReady) return;

    if (!user || !supabase) {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
      return;
    }

    const syncWishlist = async () => {
      const { data } = await supabase
        .from('wishlist_items')
        .select('product_id')
        .eq('user_id', user.id);
      const remoteIds = (data || []).map((item) => item.product_id);
      const removedIds = remoteIds.filter((productId) => !wishlistIds.includes(productId));

      if (removedIds.length > 0) {
        await supabase
          .from('wishlist_items')
          .delete()
          .eq('user_id', user.id)
          .in('product_id', removedIds);
      }

      const newIds = wishlistIds.filter((productId) => !remoteIds.includes(productId));
      if (newIds.length > 0) {
        await supabase.from('wishlist_items').insert(
          newIds.map((productId) => ({ user_id: user.id, product_id: productId })),
        );
      }
    };

    void syncWishlist();
  }, [isRemoteReady, user, wishlistIds]);

  const isWishlisted = (productId: string) => wishlistIds.includes(productId);

  const toggleWishlist = (productId: string) => {
    const isRemoving = wishlistIds.includes(productId);
    setWishlistIds((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
    void audit(
      isRemoving ? 'wishlist_item_removed' : 'wishlist_item_added',
      isRemoving ? 'Removed product from wishlist.' : 'Added product to wishlist.',
      {},
      { productId },
    );
  };

  const removeFromWishlist = (productId: string) => {
    if (!wishlistIds.includes(productId)) return;
    setWishlistIds((current) => current.filter((id) => id !== productId));
    void audit('wishlist_item_removed', 'Removed product from wishlist.', {}, { productId });
  };

  const clearWishlist = () => {
    if (wishlistIds.length === 0) return;
    void audit('wishlist_cleared', 'Cleared the wishlist.', {}, { count: wishlistIds.length });
    setWishlistIds([]);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistCount: wishlistIds.length,
        isWishlisted,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextValue => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
};
