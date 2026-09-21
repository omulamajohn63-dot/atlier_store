import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { CategorySlug, Product } from '../types';
import { ShopOccasion } from '../router/RouterContext';
import { useRouter } from '../router/RouterContext';
import { Search, SlidersHorizontal, ArrowUpDown, X, Package, Filter } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';
import { audit } from '../lib/logger';

export interface ShopPageProps {
  initialCategory?: CategorySlug;
  initialCollection?: 'best-sellers' | 'new-arrivals';
  initialOccasion?: ShopOccasion;
  initialQuery?: string;
  initialSale?: boolean;
  onQuickView: (product: Product) => void;
}

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest';

const OCCASION_CATEGORIES: Record<ShopOccasion, CategorySlug[]> = {
  everyday: ['women', 'men', 'tops', 'bottoms', 'shoes'],
  evening: ['dresses', 'outerwear'],
  'special-occasions': ['dresses', 'accessories', 'outerwear'],
};

const OCCASION_TITLES: Record<ShopOccasion, string> = {
  everyday: 'The Everyday Edit',
  evening: 'Evening & Occasion',
  'special-occasions': 'Special Occasions',
};

export const ShopPage: React.FC<ShopPageProps> = ({
  initialCategory = 'all',
  initialCollection,
  initialOccasion,
  initialQuery,
  initialSale,
  onQuickView,
}) => {
  const { navigate } = useRouter();
  const { products, categories: storeCategories } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug>(initialCategory);
  const [selectedCollection, setSelectedCollection] = useState(initialCollection);
  const [selectedOccasion, setSelectedOccasion] = useState<ShopOccasion | undefined>(initialOccasion);
  const [selectedSale, setSelectedSale] = useState<boolean>(Boolean(initialSale));
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [itemsToShow, setItemsToShow] = useState(6);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSelectedCategory(initialCategory);
    setSelectedCollection(initialCollection);
    setSelectedOccasion(initialOccasion);
    setSelectedSale(Boolean(initialSale));
    setSearchQuery(initialQuery || '');
    setOnlyInStock(false);
    setSortBy('featured');
    setItemsToShow(6);
  }, [initialCategory, initialCollection, initialOccasion, initialQuery, initialSale]);

  useEffect(() => {
    if (initialQuery) {
      void audit('search_performed', 'Storefront search performed.', {}, { query: initialQuery });
    }
    if (initialCategory && initialCategory !== 'all') {
      void audit('category_viewed', 'Viewed category.', {}, { category: initialCategory });
    }
  }, [initialCategory, initialQuery]);

  // Filter in-stock items if checked
  const filteredProducts = useMemo(() => {
    let list = products.filter((product) => {
      const matchesCategory = selectedCategory === 'all' || product.categorySlug === selectedCategory;
      const matchesCollection = selectedCollection === 'best-sellers'
        ? product.isBestSeller
        : selectedCollection === 'new-arrivals'
          ? product.isNewArrival
          : true;
      const matchesOccasion = !selectedOccasion
        ? true
        : OCCASION_CATEGORIES[selectedOccasion].includes(product.categorySlug);
      const matchesSale = !selectedSale || product.compareAtPrice !== undefined;
      const search = searchQuery.trim().toLowerCase();
      const matchesSearch = !search || [product.name, product.tagline, product.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search));
      return matchesCategory && matchesCollection && matchesOccasion && matchesSale && matchesSearch;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'newest') return b.createdAt.localeCompare(a.createdAt);
      return Number(b.isFeatured) - Number(a.isFeatured) || b.createdAt.localeCompare(a.createdAt);
    });

    if (onlyInStock) {
      list = list.filter((p) => {
        const totalStock = p.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
        return totalStock > 0;
      });
    }
    return list;
  }, [products, selectedCategory, selectedCollection, selectedOccasion, selectedSale, searchQuery, sortBy, onlyInStock]);

  const isAllProductsView = selectedCategory === 'all' && !selectedCollection && !selectedOccasion && !selectedSale && !searchQuery && !onlyInStock;
  const displayedProducts = isAllProductsView ? filteredProducts : filteredProducts.slice(0, itemsToShow);
  const hasMore = !isAllProductsView && itemsToShow < filteredProducts.length;

  const headerTitle = selectedSale
    ? 'The Sale Edit'
    : selectedOccasion
      ? OCCASION_TITLES[selectedOccasion]
      : selectedCollection === 'best-sellers'
        ? 'Best Sellers'
        : selectedCollection === 'new-arrivals'
          ? 'New Arrivals'
          : selectedCategory === 'all'
            ? 'The Complete Wardrobe'
            : storeCategories.find((c) => c.slug === selectedCategory)?.name || 'The Collection';

  const headerDescription = selectedSale
    ? 'Focused reductions on select pieces from the permanent collection, while they last.'
    : storeCategories.find((c) => c.slug === selectedCategory)?.description ||
    'Tailored from organic fibers with meticulous attention to line, drape, and enduring tactility.';

  const clearFilters = () => {
    setSearchQuery('');
    setOnlyInStock(false);
    setSelectedCategory('all');
    setSelectedCollection(undefined);
    setSelectedOccasion(undefined);
    setSelectedSale(false);
    setSortBy('featured');
    setItemsToShow(6);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* 1. SHOP HEADER & BREADCRUMB */}
      <div className="border-b border-[#E8E5DF] pb-8 relative">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8A745C]/10 to-transparent pointer-events-none" />

        <nav className="text-xs text-[#827E77] flex items-center gap-2 mb-4" aria-label="Breadcrumb">
          <button onClick={() => navigate('/')} className="hover:text-[#181716] transition-colors">
            Home
          </button>
          <span>/</span>
          <span className="text-[#181716] font-medium">Shop</span>
          {selectedCategory !== 'all' && (
            <>
              <span>/</span>
              <span className="text-[#181716] font-medium capitalize">{selectedCategory}</span>
            </>
          )}
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif text-3xl sm:text-4xl text-[#181716] font-normal tracking-tight text-balance">
                {headerTitle}
              </h1>
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#EFECE6] text-[10px] font-semibold uppercase tracking-wider text-[#63605A] hover:bg-[#181716] hover:text-[#FAF9F6] transition-all"
                >
                  <X className="w-3 h-3" />
                  Clear Category
                </button>
              )}
              {selectedOccasion && (
                <button
                  type="button"
                  onClick={() => setSelectedOccasion(undefined)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#EFECE6] text-[10px] font-semibold uppercase tracking-wider text-[#63605A] hover:bg-[#181716] hover:text-[#FAF9F6] transition-all"
                >
                  <X className="w-3 h-3" />
                  Clear Occasion
                </button>
              )}
              {selectedSale && (
                <button
                  type="button"
                  onClick={() => setSelectedSale(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#EFECE6] text-[10px] font-semibold uppercase tracking-wider text-[#63605A] hover:bg-[#181716] hover:text-[#FAF9F6] transition-all"
                >
                  <X className="w-3 h-3" />
                  Clear Sale
                </button>
              )}
            </div>
            <p className="text-sm text-[#63605A] max-w-xl text-pretty">
              {headerDescription}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#827E77] tracking-wider uppercase font-semibold">
              Showing {displayedProducts.length} of {filteredProducts.length} pieces
            </span>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH CONTROL TOOLBAR */}
      <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-[#E8E5DF] flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#827E77] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog (/api/products)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl text-xs text-[#181716] placeholder-[#A29E96] focus:outline-none focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#827E77] hover:text-[#181716] hover:bg-[#F3F1ED] rounded-full p-0.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters and Sorting controls */}
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
          {/* Mobile filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden flex items-center gap-2 text-xs font-semibold text-[#181716] bg-[#FAF9F6] px-3 py-2.5 rounded-xl border border-[#E8E5DF] hover:border-[#181716] transition-all"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {(onlyInStock || searchQuery || selectedOccasion || selectedSale) && <span className="w-1.5 h-1.5 rounded-full bg-[#8A745C]" />}
          </button>

          <div className="hidden lg:flex items-center gap-3">
            {/* In stock toggle */}
            <label className="flex items-center gap-2.5 text-xs text-[#63605A] cursor-pointer bg-[#FAF9F6] px-3.5 py-2.5 rounded-xl border border-[#E8E5DF] hover:border-[#181716] transition-all select-none">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded text-[#181716] focus:ring-[#8A745C] selection:bg-transparent cursor-pointer"
              />
              <span>In Stock Only</span>
            </label>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#FAF9F6] px-3.5 py-2.5 rounded-xl border border-[#E8E5DF] text-xs text-[#63605A] hover:border-[#181716] transition-all">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#827E77]" />
              <span className="text-[#827E77]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-[#181716] font-medium focus:outline-none cursor-pointer pr-1 appearance-none"
                aria-label="Sort products"
              >
                <option value="featured">Featured First</option>
                <option value="newest">New Arrivals</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {(searchQuery || onlyInStock || selectedCategory !== 'all' || selectedCollection || selectedOccasion || selectedSale) && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#9E332B] hover:text-[#181716] px-3 py-2.5 rounded-xl hover:bg-[#FDF2F2] transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="lg:hidden bg-[#FFFFFF] border border-[#E8E5DF] rounded-2xl p-4 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#181716]">Filters</span>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="text-[#827E77] hover:text-[#181716] p-1 rounded-full hover:bg-[#F3F1ED] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#63605A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyInStock}
              onChange={(e) => setOnlyInStock(e.target.checked)}
              className="rounded text-[#181716] focus:ring-[#8A745C] cursor-pointer"
            />
            <span>In Stock Only</span>
          </label>

          <div className="flex items-center gap-1.5 bg-[#FAF9F6] px-3.5 py-2.5 rounded-xl border border-[#E8E5DF] text-xs text-[#63605A]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#827E77]" />
            <span className="text-[#827E77]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-[#181716] font-medium focus:outline-none cursor-pointer pr-1 flex-1"
              aria-label="Sort products"
            >
              <option value="featured">Featured First</option>
              <option value="newest">New Arrivals</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* 3. PRODUCT GRID OR EMPTY STATE */}
      {displayedProducts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-20 text-center bg-[#FFFFFF] border border-[#E8E5DF] rounded-2xl p-10 space-y-4 shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] flex items-center justify-center mx-auto text-[#8A745C]">
            <Package className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="font-serif text-xl text-[#181716]">No pieces match your criteria</h3>
          <p className="text-xs text-[#63605A] max-w-sm mx-auto leading-relaxed">
            Try resetting your active search or removing the "In Stock Only" filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="gap-2"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Clear All Filters
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {displayedProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (index % 6) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProductCard
                product={product}
                onQuickView={onQuickView}
                onClick={() => navigate(`/product/${product.slug}`)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* 5. LOAD MORE / PAGINATION BEHAVIOR */}
      {hasMore && (
        <div className="pt-8 text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setItemsToShow((prev) => prev + 6)}
            className="px-8 hover-lift-sm"
          >
            Load Additional Pieces ({filteredProducts.length - itemsToShow} remaining)
          </Button>
        </div>
      )}
    </div>
  );
};