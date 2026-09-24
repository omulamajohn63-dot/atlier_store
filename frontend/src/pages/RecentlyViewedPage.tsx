import React from 'react';
import { ArrowRight, History, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Progress } from '../components/modeza';
import { ProductCard } from '../components/ProductCard';
import { useRouter } from '../router/RouterContext';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { getRecentlyViewed, clearRecentlyViewed } from '../utils/recentlyViewed';

export interface RecentlyViewedPageProps {
  onQuickView?: (product: Product) => void;
}

export const RecentlyViewedPage: React.FC<RecentlyViewedPageProps> = ({ onQuickView }) => {
  const { navigate } = useRouter();
  const { products } = useStore();
  const [entries, setEntries] = React.useState(() => getRecentlyViewed());

  const recentlyViewedProducts = entries
    .map((entry) => products.find((product) => product.id === entry.productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));
  const isResolvingViewedItems = entries.length > 0 && products.length === 0;

  const handleClear = () => {
    clearRecentlyViewed();
    setEntries([]);
  };

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
              <History className="h-3 w-3" aria-hidden="true" />
              Browsing history
            </Badge>
            <h1 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">Recently viewed</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
              Pieces you have browsed, kept on this device so you can return to them in a tap.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Badge variant="outline" size="lg" className="border-white/20 bg-white/10 text-white/80" aria-live="polite">
              {entries.length} viewed {entries.length === 1 ? 'piece' : 'pieces'}
            </Badge>
            {recentlyViewedProducts.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-white/65 hover:bg-white/10 hover:text-white focus-visible:ring-offset-[#181716]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear history
              </Button>
            )}
          </div>
        </div>
      </Card>

      {isResolvingViewedItems ? (
        <Card className="p-8 text-center shadow-sm sm:p-14" aria-busy="true">
          <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-[#F3F1ED]" aria-hidden="true" />
          <p className="mt-5 text-sm font-medium text-[#181716]" role="status" aria-live="polite">Loading your browsing history…</p>
          <Progress className="mx-auto mt-5 h-1.5 max-w-xs" aria-label="Loading browsing history" />
        </Card>
      ) : recentlyViewedProducts.length === 0 ? (
        <Card className="mx-auto max-w-xl p-6 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#E8E5DF] bg-[#FAF9F6] text-[#A2574F]">
            <History className="h-7 w-7 stroke-[1.5]" aria-hidden="true" />
          </div>
          <Badge variant="outline" className="mt-5">No browsing history</Badge>
          <h2 className="mt-4 font-serif text-2xl font-normal text-[#181716]">Nothing viewed yet</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#63605A]">
            Visit a piece from the collection and it will appear here for easy return visits.
          </p>
          <Button type="button" variant="primary" size="lg" onClick={() => navigate('/shop')} className="mt-7 gap-2">
            Explore the collection
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Card>
      ) : (
        <section aria-label="Recently viewed products" className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
          {recentlyViewedProducts.map((product) => (
            <article key={product.id} aria-label={product.name}>
              <ProductCard
                product={product}
                onQuickView={onQuickView}
                onClick={() => navigate(`/product/${product.slug}`)}
              />
            </article>
          ))}
        </section>
      )}
    </div>
  );
};
