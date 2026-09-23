import React from 'react';
import { formatPrice, DEFAULT_CURRENCY } from '../../utils/currency';

export interface PriceProps {
  amount: number;
  compareAtAmount?: number;
  currency?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showCurrency?: boolean;
}

export const Price: React.FC<PriceProps> = ({
  amount,
  compareAtAmount,
  currency = DEFAULT_CURRENCY.symbol,
  size = 'md',
  className = '',
  showCurrency = true,
}) => {
  const sizeStyles = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
    xl: 'text-xl font-serif font-medium',
    '2xl': 'text-2xl font-serif font-medium',
  };

  const isDiscounted = compareAtAmount !== undefined && compareAtAmount > amount;

  return (
    <div className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className={`text-[#A2574F] font-medium tracking-tight ${sizeStyles[size]}`}>
        {showCurrency ? formatPrice(amount, { symbol: currency }) : formatPrice(amount, { symbol: '' })}
      </span>
      {isDiscounted && (
        <>
          <span className="text-xs text-[#827E77] line-through font-normal">
            {showCurrency ? formatPrice(compareAtAmount, { symbol: currency }) : formatPrice(compareAtAmount, { symbol: '' })}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E68057] text-[10px] font-semibold uppercase tracking-wider text-[#181716]">
            -{Math.round(((compareAtAmount! - amount) / compareAtAmount!) * 100)}%
          </span>
        </>
      )}
    </div>
  );
};

export interface InstallmentPriceProps {
  amount: number;
  installments?: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const InstallmentPrice: React.FC<InstallmentPriceProps> = ({
  amount,
  installments = 4,
  currency = DEFAULT_CURRENCY.symbol,
  size = 'sm',
  className = '',
}) => {
  const installmentAmount = amount / installments;

  const sizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`text-[#827E77] ${sizeStyles[size]}`}>
        {installments}x {formatPrice(installmentAmount, { symbol: currency })}
      </span>
      <span className="text-[10px] text-[#A29E96]">interest-free</span>
    </div>
  );
};