import React from 'react';
import { ArrowRight, Heart, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Progress } from '../components/modeza';
import { ProductCard } from '../components/ProductCard';
import { useRouter } from '../router/RouterContext';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { Product } from '../types';

export interface WishlistPageProps {
  onQuickView?: (product: Product) => void;
}

export const WishlistPage: React.FC<WishlistPageProps> = ({ onQuickView }) => {
  const { navigate } = useRouter();
  const { products } = useStore();
  const { wishlistIds, removeFromWishlist, clearWishlist } = useWishlist();
  const wishlistProducts = wishlistIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));
  const isResolvingSavedItems = wishlistIds.length > 0 && products.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 2xl:max-w-[88rem]">
      <Card className="relative overflow-hidden rounded-[2rem] border-[#181716] bg-[#181716] p-0 text-[#FAF9F6] shadow-sm hover:shadow-md">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#A2574F]/25 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#E68057]/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
          <div className="max-w-2xl">
            <Badge variant="new" size="lg" className="mb-4 gap-1.5">
              <Heart className="h-3 w-3" aria-hidden="true" />
              Saved pieces
            </Badge>
            <h1 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">Your wishlist</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
              Keep the pieces you love close while you decide. Your saved edit stays available on this device.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Badge variant="outline" size="lg" className="border-white/20 bg-white/10 text-white/80" aria-live="polite">
              {wishlistIds.length} saved {wishlistIds.length === 1 ? 'piece' : 'pieces'}
            </Badge>
            {wishlistProducts.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearWishlist}
                className="text-white/65 hover:bg-white/10 hover:text-white focus-visible:ring-offset-[#181716]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear wishlist
              </Button>
            )}
          </div>
        </div>
      </Card>

      {isResolvingSavedItems ? (
        <Card className="p-8 text-center shadow-sm sm:p-14" aria-busy="true">
          <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-[#F3F1ED]" aria-hidden="true" />
          <p className="mt-5 text-sm font-medium text-[#181716]" role="status" aria-live="polite">Loading your saved pieces…</p>
          <Progress className="mx-auto mt-5 h-1.5 max-w-xs" aria-label="Loading saved pieces" />
        </Card>
      ) : wishlistProducts.length === 0 ? (
        <Card className="mx-auto max-w-xl p-6 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#E8E5DF] bg-[#FAF9F6] text-[#A2574F]">
            <Heart className="h-7 w-7 stroke-[1.5]" aria-hidden="true" />
          </div>
          <Badge variant="outline" className="mt-5">No saved pieces</Badge>
          <h2 className="mt-4 font-serif text-2xl font-normal text-[#181716]">Your wishlist is empty</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#63605A]">
            Save pieces from the collection and they will appear here for an easy return visit.
          </p>
          <Button type="button" variant="primary" size="lg" onClick={() => navigate('/shop')} className="mt-7 gap-2">
            Explore the collection
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Card>
      ) : (
        <section aria-label="Saved products" className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
          {wishlistProducts.map((product) => (
            <article key={product.id} aria-label={product.name} className="relative">
              <ProductCard
                product={product}
                onQuickView={onQuickView}
                onClick={() => navigate(`/product/${product.slug}`)}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  removeFromWishlist(product.id);
                }}
                className="absolute right-3 top-3 z-30 h-9 w-9 bg-white/95 p-0 text-[#9E332B] shadow-sm hover:bg-[#A2574F] hover:text-white"
                aria-label={`Remove ${product.name} from wishlist`}
                title="Remove from wishlist"
              >
                <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
              </Button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};
