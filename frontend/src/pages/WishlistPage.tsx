import React from 'react';
import { Heart, ArrowRight, Trash2 } from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/Button';

export const WishlistPage: React.FC = () => {
  const { navigate } = useRouter();
  const { products } = useStore();
  const { wishlistIds, removeFromWishlist, clearWishlist } = useWishlist();
  const wishlistProducts = wishlistIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 2xl:max-w-[88rem]">
      <header className="flex flex-col gap-5 border-b border-[#E8E5DF] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8A745C]">Saved pieces</p>
          <h1 className="mt-2 font-serif text-4xl font-normal text-[#181716]">Your Wishlist</h1>
          <p className="mt-2 text-sm text-[#63605A]">Keep the pieces you love close while you decide.</p>
        </div>
        {wishlistProducts.length > 0 && (
          <button type="button" onClick={clearWishlist} className="flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-wider text-[#63605A] transition-colors hover:text-[#9E332B] sm:self-auto">
            <Trash2 className="h-3.5 w-3.5" /> Clear wishlist
          </button>
        )}
      </header>

      {wishlistProducts.length === 0 ? (
        <div className="mx-auto max-w-xl border border-[#E8E5DF] bg-white px-6 py-20 text-center shadow-xs">
          <Heart className="mx-auto h-8 w-8 stroke-[1.3] text-[#8A745C]" />
          <h2 className="mt-5 font-serif text-2xl text-[#181716]">Your wishlist is empty</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#63605A]">Save pieces from the collection and they will appear here.</p>
          <Button variant="primary" size="md" onClick={() => navigate('/shop')} className="mt-7 gap-2">
            Explore the collection
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {wishlistProducts.map((product) => (
            <div key={product.id} className="relative">
              <ProductCard product={product} onClick={() => navigate(`/product/${product.slug}`)} />
              <button
                type="button"
                onClick={() => removeFromWishlist(product.id)}
                className="absolute right-3 top-3 z-20 rounded-full bg-white/95 p-2 text-[#9E332B] shadow-sm transition-colors hover:bg-[#181716] hover:text-white"
                aria-label={`Remove ${product.name} from wishlist`}
                title="Remove from wishlist"
              >
                <Heart className="h-4 w-4 fill-current" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
