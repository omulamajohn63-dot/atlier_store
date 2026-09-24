import React from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/modeza/Button';
import { Badge } from '../components/modeza/Badge';
import { Card } from '../components/modeza/Card';
import { useRouter } from '../router/RouterContext';
import { Product } from '../types';
import { Sparkles, ArrowRight, ShieldCheck, Feather, RefreshCw, Truck, Palette } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';
import { motion } from 'motion/react';

export interface HomePageProps {
  onQuickView: (product: Product) => void;
}

const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ eyebrow, title, actionLabel, onAction }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 pb-4 border-b border-[#E8E5DF] gap-4">
    <div>
      <span className="text-xs uppercase tracking-widest text-[#827E77] font-semibold block mb-1.5 flex items-center gap-2">
        <span className="w-8 h-px bg-[#A2574F]" />
        {eyebrow}
      </span>
      <h2 className="font-serif text-2xl sm:text-3xl text-[#181716] font-normal text-balance">
        {title}
      </h2>
    </div>
    {actionLabel && onAction && (
      <Button
        variant="ghost"
        size="sm"
        onClick={onAction}
        className="gap-1.5 text-xs uppercase tracking-widest font-semibold self-start sm:self-auto"
      >
        <span>{actionLabel}</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Button>
    )}
  </div>
);

export const HomePage: React.FC<HomePageProps> = ({ onQuickView }) => {
  const { navigate } = useRouter();
  const { products } = useStore();

  const newArrivals = (products.filter((p) => p.isNewArrival).length > 0
    ? products.filter((p) => p.isNewArrival)
    : [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).slice(0, 4);
  const bestSellers = (products.filter((p) => p.isBestSeller).length > 0
    ? products.filter((p) => p.isBestSeller)
    : products).slice(0, 4);

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative bg-[#FAF9F6] overflow-hidden">
        {/* Decorative gradient blobs */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-[#A2574F]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[#A2574F]/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Hero Copy */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] text-xs font-medium uppercase tracking-widest text-[#63605A] shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#A2574F]" />
                <span>Autumn/Winter 2026 Collection</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="font-serif text-4xl sm:text-5xl lg:text-6xl 2xl:text-7xl text-[#181716] font-normal tracking-tight leading-[1.12] text-balance"
              >
                Architectural ease, sculpted from organic fibers.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-base sm:text-lg text-[#63605A] leading-relaxed max-w-xl font-normal text-pretty"
              >
                Curated trans-seasonal garments designed with intentional simplicity. Every silhouette
                is cut from certified 22mm mulberry silk, responsible wool, and Mongolian cashmere.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="pt-2 flex flex-wrap items-center gap-4"
              >
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/shop')}
                  className="gap-2 shadow-md hover:shadow-lg"
                >
                  <span>Explore Collection</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/shop/dresses')}
                >
                  Shop Silk Dresses
                </Button>
              </motion.div>

              {/* Value propositions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-3 gap-4 pt-8 border-t border-[#E8E5DF] text-xs text-[#63605A]"
              >
                <div className="space-y-1.5">
                  <span className="font-serif text-xl sm:text-2xl text-[#181716] block font-medium">
                    100%
                  </span>
                  <span className="text-[#827E77]">Traceable Fibers</span>
                </div>
                <div className="space-y-1.5">
                  <span className="font-serif text-xl sm:text-2xl text-[#181716] block font-medium">
                    Limited
                  </span>
                  <span className="text-[#827E77]">Small-Batch Runs</span>
                </div>
                <div className="space-y-1.5">
                  <span className="font-serif text-xl sm:text-2xl text-[#181716] block font-medium">
                    Direct
                  </span>
                  <span className="text-[#827E77]">Artisan Studios</span>
                </div>
              </motion.div>
            </div>

            {/* Hero Visual Imagery Composition */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 relative"
            >
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Main Large Visual Frame */}
                <div className="aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl bg-[#F4ECE9] border border-[#E8E5DF] relative group image-zoom">
                  <img
                    src="https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=1000&auto=format&fit=crop"
                    alt="Boutique Silk Editorial Look"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {/* Overlay badge on image */}
                  <div className="absolute top-4 left-4">
                    <Badge variant="new">Featured Collection</Badge>
                  </div>
                </div>

                {/* Floating Inset Badge */}
                <div className="absolute -bottom-6 -left-6 bg-[#FFFFFF] p-5 rounded-2xl border border-[#E8E5DF] shadow-xl max-w-xs hidden sm:block animate-slide-up stagger-1">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-[#A2574F] block mb-1">
                    Featured Silhouette
                  </span>
                  <p className="font-serif text-sm text-[#181716]">The Drape Silk Midi Dress</p>
                  <p className="text-xs text-[#827E77] mt-1">The signature piece of the season</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. EDITORIAL BRAND STORY / CRAFTSMANSHIP */}
      <section className="bg-[#FFFFFF] border-y border-[#E8E5DF] py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-b from-[#A2574F]/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="text-xs uppercase tracking-widest text-[#A2574F] font-semibold block mb-2 flex items-center gap-2">
                  <span className="w-8 h-px bg-[#A2574F]" />
                  Conscious Craft & Tailoring
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#181716] font-normal leading-tight text-balance">
                  Designed to be worn effortlessly. Crafted to last decades.
                </h2>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <p className="text-sm sm:text-base text-[#63605A] leading-relaxed text-pretty">
                  MODEZA began with an aversion to planned obsolescence and excessive synthetic blends.
                  We develop our pieces through quiet iterative refinement: prioritizing weighted silks,
                  virgin wools from audited ethical farms, and buttons carved from natural corozo nuts.
                </p>
                <p className="text-sm sm:text-base text-[#63605A] leading-relaxed text-pretty">
                  By eliminating wholesale intermediaries, we invest directly in generational tailoring
                  studios in northern Portugal and Tuscany, offering couture-grade craftsmanship without
                  artificial luxury markups.
                </p>
              </motion.div>

              <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {[
                  { icon: Feather, label: 'Natural Yarns', desc: '100% traceable' },
                  { icon: Truck, label: 'Express Courier', desc: '2-4 business days' },
                  { icon: RefreshCw, label: '30-Day Returns', desc: 'Complimentary' },
                  { icon: ShieldCheck, label: 'Secure Checkout', desc: 'SSL encrypted' },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.4, delay: 0.1 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#E8E5DF] hover:shadow-md hover:border-[#D8D3CB] transition-all hover-lift-sm"
                  >
                    <div className="w-9 h-9 rounded-full bg-white border border-[#E8E5DF] flex items-center justify-center mx-auto mb-2 text-[#A2574F]">
                      <item.icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#181716] block">{item.label}</span>
                    <span className="text-[10px] text-[#827E77]">{item.desc}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6"
            >
              <div className="aspect-[4/5] max-w-[540px] mx-auto rounded-[2rem] overflow-hidden shadow-2xl bg-[#F4ECE9] border border-[#E8E5DF] relative group image-zoom">
                <img
                  src="https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=1000&auto=format&fit=crop"
                  alt="Craftsmanship MODEZA Tailoring"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {/* Floating caption badge */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-[#FFFFFF]/95 backdrop-blur-sm p-3 rounded-2xl border border-[#E8E5DF] shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] flex items-center justify-center text-[#A2574F]">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#181716]">The MODEZA Process</p>
                      <p className="text-[9px] text-[#827E77]">Studio 4, Porto</p>
                    </div>
                  </div>
                  <Badge variant="outline" size="sm">Est. 2018</Badge>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. SHOP BY CATEGORY SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Shop the Edit"
          title="Shop By Category"
          actionLabel="Explore All"
          onAction={() => navigate('/shop')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.filter((category) => category.slug !== 'all').map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card
                className="group relative overflow-hidden rounded-3xl p-6 text-left hover:shadow-xl hover:border-[#D8D3CB] hover-lift transition-all cursor-pointer"
                onClick={() => navigate(`/shop/${category.slug}`)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#F4ECE9] to-transparent opacity-70" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-b from-[#A2574F]/10 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-[#A2574F] font-semibold">
                      Collection
                    </span>
                    <h3 className="font-serif text-2xl text-[#181716] mt-3 text-balance">
                      {category.name}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#63605A] mt-2 line-clamp-2">
                      {category.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="group-hover:bg-[#A2574F] group-hover:text-[#FAF9F6] group-hover:border-[#A2574F] transition-all duration-300 shrink-0 shadow-sm group-hover:shadow-md rounded-full border border-[#E8E5DF] p-3.5 text-[#181716]"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. NEW ARRIVALS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Fresh Off The Loom"
          title="New Arrivals"
          actionLabel="Browse New Arrivals"
          onAction={() => navigate('/shop?collection=new-arrivals')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {newArrivals.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProductCard
                product={product}
                onQuickView={onQuickView}
                onClick={() => navigate(`/product/${product.slug}`)}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. FULL-WIDTH CAMPAIGN SECTION */}
      <section className="relative bg-[#181716] text-[#FAF9F6] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=1800&auto=format&fit=crop"
            alt="Campaign"
            className="w-full h-full object-cover opacity-60 transition-transform duration-[2000ms] hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#181716]/95 via-[#181716]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#993A8B]/25 via-transparent to-[#A2574F]/20 pointer-events-none" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl space-y-6"
          >
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[#E7D6BD] font-semibold">
              <Sparkles className="w-4 h-4" />
              MODEZA Edit 2026
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl 2xl:text-6xl mt-2 leading-tight text-balance">
              A softer uniform for considered days.
            </h2>
            <p className="text-sm sm:text-base text-[#F1ECE4] leading-relaxed max-w-xl text-pretty">
              Quiet strength in fine wool, silk, and woven cotton — built for ease, movement, and intent.
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              <Button
                variant="modeza-sandstone"
                size="lg"
                onClick={() => navigate('/shop')}
                className="gap-2"
              >
                <span>Shop the Capsule</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigate('/about')}
                className="border-white/60 text-white hover:bg-white/10 hover:border-white"
              >
                The MODEZA Story
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 6. BEST SELLERS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Most Loved Pieces"
          title="Best Sellers"
          actionLabel="Shop All"
          onAction={() => navigate('/shop?collection=best-sellers')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {bestSellers.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProductCard
                product={product}
                onQuickView={onQuickView}
                onClick={() => navigate(`/product/${product.slug}`)}
              />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};