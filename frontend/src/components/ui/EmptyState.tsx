import React from 'react';
import { Button } from './Button';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'page' | 'card';
  illustration?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  illustration,
}) => {
  const variantStyles = {
    default: 'p-8 sm:p-12 max-w-md mx-auto',
    page: 'p-10 sm:p-14 max-w-lg mx-auto',
    card: 'p-6 max-w-sm',
  };

  const iconContainerStyles = {
    default: 'w-14 h-14 rounded-full bg-[#F3F1ED] flex items-center justify-center text-[#A2574F] mb-4',
    page: 'w-20 h-20 rounded-full bg-[#F3F1ED] flex items-center justify-center text-[#A2574F] mb-5',
    card: 'w-12 h-12 rounded-full bg-[#F3F1ED] flex items-center justify-center text-[#A2574F] mb-3',
  };

  const titleStyles = {
    default: 'font-serif text-xl sm:text-2xl text-[#181716] mb-2',
    page: 'font-serif text-2xl sm:text-3xl text-[#181716] mb-3',
    card: 'font-serif text-lg text-[#181716] mb-1.5',
  };

  const descriptionStyles = {
    default: 'text-sm text-[#63605A] leading-relaxed mb-6',
    page: 'text-base text-[#63605A] leading-relaxed mb-8',
    card: 'text-xs text-[#63605A] leading-relaxed mb-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center ${variantStyles[variant]}`}>
      {illustration ? (
        <div className="mb-5" style={{ width: variant === 'page' ? '120px' : variant === 'card' ? '80px' : '100px' }}>
          {illustration}
        </div>
      ) : Icon && (
        <div className={iconContainerStyles[variant]}>
          <Icon className={variant === 'page' ? 'w-9 h-9' : variant === 'card' ? 'w-5 h-5' : 'w-6 h-6'} strokeWidth={1.5} />
        </div>
      )}
      <h3 className={titleStyles[variant]}>{title}</h3>
      <p className={descriptionStyles[variant]}>{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size={variant === 'page' ? 'lg' : variant === 'card' ? 'sm' : 'md'} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const CartEmptyState: React.FC = () => (
  <EmptyState
    variant="page"
    icon={null}
    illustration={
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#E8E5DF]">
        <ellipse cx="60" cy="100" rx="50" ry="8" fill="currentColor" opacity="0.2" />
        <path d="M35 100 C35 70 55 50 60 45 C65 50 85 70 85 100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M60 45 L60 25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M50 30 L60 25 L70 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="60" cy="15" r="5" fill="currentColor" />
      </svg>
    }
    title="Your bag is empty"
    description="Take your time browsing our trans-seasonal collection of organic silk, tailoring, and artisanal accessories."
    actionLabel="Discover The Collection"
    onAction={() => window.location.href = '/shop'}
  />
);

export const WishlistEmptyState: React.FC = () => (
  <EmptyState
    variant="page"
    title="Your wishlist is empty"
    description="Save pieces you love to your wishlist and revisit them anytime. Your curated edit awaits."
    actionLabel="Explore Collection"
    onAction={() => window.location.href = '/shop'}
  />
);

export const SearchEmptyState: React.FC<{ query: string; onClear: () => void }> = ({ query, onClear }) => (
  <EmptyState
    variant="card"
    title="No results found"
    description={`We couldn't find any pieces matching "${query}". Try adjusting your search or clearing filters.`}
    actionLabel="Clear Search"
    onAction={onClear}
  />
);

export const OrdersEmptyState: React.FC = () => (
  <EmptyState
    variant="page"
    title="No orders yet"
    description="Your order history will appear here once you've made a purchase."
    actionLabel="Start Shopping"
    onAction={() => window.location.href = '/shop'}
  />
);