import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, ArrowRight, Sparkles, Tag, Zap } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { useRouter } from '../router/RouterContext';
import { Price } from './ui/Price';
import { ProductImage } from './ui/ProductImage';

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigate } = useRouter();
  const { products } = useStore();

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        p.categorySlug.toLowerCase().includes(q) ||
        (p.tagline?.toLowerCase().includes(q) ?? false)
    );
  }, [query, products]);

  const handleSelectProduct = (product: Product) => {
    onClose();
    navigate(`/product/${product.slug}`);
  };

  const popularSearches = ['Silk Dresses', 'Cashmere Knits', 'Tailored Trousers', 'Leather Accessories', 'Evening Wear', 'New Arrivals'];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] overflow-y-auto p-4 sm:p-6 lg:p-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#181716]/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto max-w-2xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E8E5DF] overflow-hidden z-10"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-6 py-5 border-b border-[#E8E5DF] bg-[#FAF9F6]">
              <div className="relative w-full flex items-center">
                <Search className="w-5.5 h-5.5 text-[#827E77] absolute left-4" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  placeholder="Search collection by piece, fabric, or category (e.g. silk, coat, trouser)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 text-base sm:text-lg text-[#181716] placeholder-[#A29E96] bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl focus:outline-none focus:border-[#A2574F] focus:ring-2 focus:ring-[#A2574F]/20 transition-all"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-4 p-1.5 text-[#827E77] hover:text-[#181716] hover:bg-[#F3F1ED] rounded-full transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Suggestions or Results */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {!query ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-[#827E77] mb-3 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#A2574F]" />
                      Popular Searches
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {popularSearches.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setQuery(item)}
                          className="px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] text-xs text-[#63605A] hover:border-[#A2574F] hover:text-[#181716] hover:bg-[#FFFFFF] transition-all active:scale-[0.98]"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-[#827E77] mb-3 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-[#A2574F]" />
                      Shop by Category
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Dresses', path: '/shop/dresses' },
                        { label: 'Tops & Knitwear', path: '/shop/tops' },
                        { label: 'Trousers', path: '/shop/bottoms' },
                        { label: 'Outerwear', path: '/shop/outerwear' },
                        { label: 'Skirts', path: '/shop/bottoms' },
                        { label: 'Accessories', path: '/shop/accessories' },
                        { label: 'Shoes', path: '/shop/shoes' },
                        { label: 'Sale', path: '/shop?sale=true' },
                      ].map((cat) => (
                        <button
                          key={cat.label}
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(cat.path);
                          }}
                          className="px-4 py-3 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] text-sm text-[#181716] text-left hover:border-[#181716] hover:bg-[#FFFFFF] hover:shadow-sm transition-all text-start"
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[#E8E5DF]">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-[#827E77] mb-3 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-[#A2574F]" />
                      Quick Links
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'New Arrivals', action: () => navigate('/shop?collection=new-arrivals') },
                        { label: 'Best Sellers', action: () => navigate('/shop?collection=best-sellers') },
                        { label: 'Sale', action: () => navigate('/shop?sale=true') },
                        { label: 'All Products', action: () => navigate('/shop') },
                      ].map((link) => (
                        <button
                          key={link.label}
                          type="button"
                          onClick={() => { link.action(); onClose(); }}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] text-sm text-[#181716] hover:border-[#181716] hover:bg-[#FFFFFF] hover:shadow-sm transition-all"
                        >
                          <span>{link.label}</span>
                          <ArrowRight className="w-4 h-4 text-[#A29E96]" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="py-16 text-center text-[#63605A]">
                  <div className="w-16 h-16 rounded-full bg-[#F3F1ED] flex items-center justify-center mx-auto mb-4 text-[#A29E96]">
                    <Search className="w-7 h-7" />
                  </div>
                  <p className="font-serif text-lg text-[#181716] mb-1">No matching pieces</p>
                  <p className="text-xs text-[#827E77] mb-6">
                    Try searching for general terms like "silk", "trousers", or "cardigan".
                  </p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-xs font-semibold uppercase tracking-wider text-[#A2574F] hover:text-[#181716] flex items-center justify-center gap-1.5 mx-auto transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-[#827E77] mb-2 pb-2 border-b border-[#E8E5DF]">
                    Found {results.length} piece{results.length === 1 ? '' : 's'}
                  </p>
                  {results.slice(0, 8).map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.02 }}
                      onClick={() => handleSelectProduct(product)}
                      className="group flex items-center justify-between p-3 rounded-xl hover:bg-[#FAF9F6] cursor-pointer transition-all border border-transparent hover:border-[#E8E5DF] active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative w-14 h-16 shrink-0 rounded-lg overflow-hidden bg-[#F4ECE9] border border-[#E8E5DF]">
                          <ProductImage
                            src={product.images[0]}
                            alt={product.name}
                            className="h-full w-full"
                            imgClassName="transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-[#827E77] block mb-0.5">
                            {product.categorySlug}
                          </span>
                          <h5 className="font-serif text-sm text-[#181716] group-hover:text-[#A2574F] transition-colors truncate">
                            {product.name}
                          </h5>
                          <Price amount={product.price} size="sm" className="mt-0.5" />
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#A29E96] group-hover:text-[#181716] group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </motion.div>
                  ))}
                  {results.length > 8 && (
                    <button
                      type="button"
                      onClick={() => { onClose(); navigate(`/shop?q=${encodeURIComponent(query.trim())}`); }}
                      className="w-full mt-4 px-4 py-3 rounded-xl border border-[#E8E5DF] bg-[#FAF9F6] text-sm text-[#181716] hover:border-[#181716] hover:bg-[#FFFFFF] transition-all flex items-center justify-center gap-2"
                    >
                      <span>View all {results.length} results</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};