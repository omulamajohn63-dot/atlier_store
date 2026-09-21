import React from 'react';
import { Minus, Plus } from 'lucide-react';

export interface QuantitySelectorProps {
  quantity: number;
  max?: number;
  min?: number;
  onChange: (newQuantity: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  max = 99,
  min = 1,
  onChange,
  disabled = false,
  size = 'md',
  showLabels = false,
}) => {
  const handleDecrement = () => {
    if (quantity > min && !disabled) {
      onChange(quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (quantity < max && !disabled) {
      onChange(quantity + 1);
    }
  };

  const isAtMin = quantity <= min;
  const isAtMax = quantity >= max;

  const sizeClasses = {
    sm: { container: 'h-9', btn: 'w-9', icon: 'w-3.5 h-3.5', text: 'text-xs', gap: 'px-2' },
    md: { container: 'h-11', btn: 'w-11', icon: 'w-4 h-4', text: 'text-sm', gap: 'px-3' },
    lg: { container: 'h-12', btn: 'w-12', icon: 'w-5 h-5', text: 'text-base', gap: 'px-4' },
  };

  const s = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center border border-[#E8E5DF] rounded-full bg-[#FFFFFF] overflow-hidden ${s.container} transition-all duration-200 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#D8D3CB] hover:shadow-sm'
      }`}
      role="group"
      aria-label="Quantity selector"
    >
      {showLabels && <span className="sr-only">Quantity</span>}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || isAtMin}
        aria-label="Decrease quantity"
        className={`flex items-center justify-center ${s.btn} h-full text-[#181716] hover:bg-[#F3F1ED] disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-200 active:scale-95`}
      >
        <Minus className={s.icon} aria-hidden="true" />
      </button>

      <span
        aria-live="polite"
        aria-atomic="true"
        className={`min-w-[2.5rem] text-center font-medium tabular-nums text-[#181716] ${s.text} ${s.gap}`}
      >
        {quantity}
      </span>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || isAtMax}
        aria-label="Increase quantity"
        className={`flex items-center justify-center ${s.btn} h-full text-[#181716] hover:bg-[#F3F1ED] disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-200 active:scale-95`}
      >
        <Plus className={s.icon} aria-hidden="true" />
      </button>
    </div>
  );
};