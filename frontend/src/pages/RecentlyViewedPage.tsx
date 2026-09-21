import React from 'react';
import { ArrowRight, History, Trash2 } from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { getRecentlyViewed, clearRecentlyViewed } from '../utils/recentlyViewed';

export const RecentlyViewedPage: React.FC = () => {
  const { navigate } = useRouter();
  const { products } = useStore();
  const [entries, setEntries] = React.useState(() => getRecentlyViewed());

  const recentlyViewedProducts = entries
    .map((entry) => products.find((product) => product.id === entry.productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  const handleClear = () => {
    clearRecentlyViewed();
    setEntries([]);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 2xl:max-w-[88rem]">
      <header className="flex flex-col gap-5 border-b border-[#E8E5DF] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8A745C]">Browsing history</p>
          <h1 className="mt-2 font-serif text-4xl font-normal text-[#181716]">Recently Viewed</h1>
          <p className="mt-2 text-sm text-[#63605A]">
            Pieces you've browsed, kept on this device so you can return to them in a tap.
          </p>
        </div>
        {recentlyViewedProducts.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-wider text-[#63605A] transition-colors hover:text-[#9E332B] sm:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear history
          </button>
        )}
      </header>

      {recentlyViewedProducts.length === 0 ? (
        <div className="mx-auto max-w-xl border border-[#E8E5DF] bg-white px-6 py-20 text-center shadow-xs">
          <History className="mx-auto h-8 w-8 stroke-[1.3] text-[#8A745C]" />
          <h2 className="mt-5 font-serif text-2xl text-[#181716]">Nothing viewed yet</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#63605A]">
            Visit a piece from the collection and it will appear here for easy return visits.
          </p>
          <Button variant="primary" size="md" onClick={() => navigate('/shop')} className="mt-7 gap-2">
            Explore the collection
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recentlyViewedProducts.map((product) => (
            <ProductCard key={product.id} product={product} onClick={() => navigate(`/product/${product.slug}`)} />
          ))}
        </div>
      )}
    </div>
  );
};