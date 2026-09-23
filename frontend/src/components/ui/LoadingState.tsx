import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col animate-pulse space-y-3.5">
      {/* Aspect Ratio 3:4 portrait skeleton */}
      <div className="w-full aspect-[3/4] skeleton rounded-xl" />
      <div className="space-y-2">
        <div className="h-2.5 skeleton rounded w-1/3" />
        <div className="h-4 skeleton rounded w-3/4" />
        <div className="h-3 skeleton rounded w-1/4" />
        <div className="h-10 skeleton rounded-full w-3/4 mt-2" />
      </div>
    </div>
  );
};

export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start animate-pulse">
      <div className="lg:col-span-7 space-y-4">
        <div className="aspect-[3/4] w-full rounded-2xl skeleton" />
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-20 h-24 rounded-xl skeleton shrink-0" />
          ))}
        </div>
      </div>
      <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
        <div className="space-y-2 border-b border-[#E8E5DF] pb-5">
          <div className="h-3 skeleton rounded w-1/3" />
          <div className="h-8 skeleton rounded w-3/4" />
          <div className="h-3 skeleton rounded w-1/2" />
          <div className="flex items-baseline gap-3 pt-2">
            <div className="h-8 skeleton rounded w-24" />
            <div className="h-5 skeleton rounded w-16" />
          </div>
        </div>
        <div>
          <div className="h-3 skeleton rounded w-1/4 mb-2" />
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 skeleton rounded-full px-3" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-3 skeleton rounded w-1/4 mb-2" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 skeleton rounded-xl" />
            ))}
          </div>
        </div>
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 skeleton rounded-full w-24 flex-1" />
            <div className="h-12 skeleton rounded-full flex-1" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 py-4 border-y border-[#E8E5DF]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-1 p-3 skeleton rounded-xl" />
          ))}
        </div>
        <div className="space-y-2 text-xs">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-[#E8E5DF] rounded-xl overflow-hidden bg-[#FFFFFF]">
              <div className="h-12 skeleton rounded-t-xl" />
              <div className="p-4 pt-0 space-y-2 skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const LoadingSpinner: React.FC<{ label?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  label = 'Loading...',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#63605A]">
      <svg
        className={`animate-spin text-[#181716] ${sizeClasses[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-xs uppercase tracking-widest font-medium text-[#827E77]">{label}</span>
    </div>
  );
};

export const InlineLoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; color?: string }> = ({
  size = 'md',
  color = '#181716',
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]}`}
      style={{ color }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

export const OrdersListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-5" role="status" aria-label="Loading your orders">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 animate-pulse">
            <div className="space-y-2.5">
              <div className="h-4 skeleton rounded w-40" />
              <div className="h-3 skeleton rounded w-32" />
            </div>
            <div className="space-y-2.5">
              <div className="ml-auto h-5 skeleton rounded w-24" />
              <div className="ml-auto h-3 skeleton rounded w-16" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2.5 animate-pulse">
            {Array.from({ length: 4 }).map((_, thumb) => (
              <div key={thumb} className="h-16 w-14 skeleton rounded-lg sm:h-20 sm:w-[4.5rem]" />
            ))}
            <div className="h-16 w-14 skeleton rounded-lg sm:h-20 sm:w-[4.5rem]" />
          </div>
          <div className="mt-5 space-y-2 animate-pulse">
            <div className="h-2 skeleton rounded w-full" />
            <div className="h-2 skeleton rounded w-2/3" />
          </div>
          <div className="mt-5 flex justify-end animate-pulse">
            <div className="h-9 skeleton rounded-full w-32" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading your orders</span>
    </div>
  );
};

export const OrderDetailSkeleton: React.FC = () => {
  return (
    <div className="mt-8 space-y-8" role="status" aria-label="Loading order details">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[#F3F1ED] pb-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-3 skeleton rounded w-24" />
          <div className="h-9 skeleton rounded w-64" />
          <div className="h-4 skeleton rounded w-44" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 skeleton rounded-full w-28" />
          <div className="h-8 skeleton rounded-full w-24" />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.65fr_1fr] lg:gap-12">
        <div className="space-y-8">
          <div className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6 animate-pulse">
            <div className="h-3 skeleton rounded w-28" />
            <div className="mt-5 h-3 skeleton rounded w-full" />
            <div className="mt-2 h-3 skeleton rounded w-3/4" />
          </div>
          <div className="space-y-3.5">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 rounded-2xl border border-[#E8E5DF] bg-white p-4 animate-pulse sm:gap-5 sm:p-5">
                <div className="h-20 w-16 shrink-0 skeleton rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton rounded w-3/4" />
                  <div className="h-3 skeleton rounded w-1/3" />
                  <div className="h-3 skeleton rounded w-1/2" />
                </div>
                <div className="h-5 skeleton rounded w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6 animate-pulse">
            <div className="h-3 skeleton rounded w-32" />
            <div className="mt-4 space-y-2">
              <div className="h-3 skeleton rounded w-1/2" />
              <div className="h-3 skeleton rounded w-2/3" />
              <div className="h-3 skeleton rounded w-1/3" />
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6 space-y-3 animate-pulse">
            <div className="h-3 skeleton rounded w-28" />
            <div className="h-3 skeleton rounded w-full" />
            <div className="h-3 skeleton rounded w-full" />
            <div className="h-3 skeleton rounded w-full" />
            <div className="h-6 skeleton rounded w-1/2 pt-1" />
          </div>
          <div className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6 space-y-3 animate-pulse">
            <div className="h-3 skeleton rounded w-24" />
            <div className="h-3 skeleton rounded w-1/2" />
            <div className="h-3 skeleton rounded w-2/3" />
          </div>
          <div className="rounded-2xl border border-[#E8E5DF] bg-[#FAF9F6] p-5 sm:p-6 space-y-2.5 animate-pulse">
            <div className="h-10 skeleton rounded-full w-full" />
            <div className="h-10 skeleton rounded-full w-full" />
          </div>
        </aside>
      </div>
      <span className="sr-only">Loading order details</span>
    </div>
  );
};

export const PageLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FAF9F6]">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" label="Loading MODEZA..." />
        <div className="w-48 h-1 bg-[#F4ECE9] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#A2574F] to-[#C0857B] animate-shimmer" />
        </div>
      </div>
    </div>
  );
};