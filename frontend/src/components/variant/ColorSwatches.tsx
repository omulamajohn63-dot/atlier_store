import React from 'react';
import { VariantOption, VariantSelections } from '../../utils/variants';

export interface ColorSwatchesProps {
  options: VariantOption[];
  selected?: string;
  onSelect?: (value: string) => void;
  isOptionAvailable?: (value: string, selections: VariantSelections) => boolean;
  selections?: VariantSelections;
  isDisabled?: (value: string) => boolean;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Compact presentation for product cards (no group label, tighter spacing). */
  compact?: boolean;
  id?: string;
}

const SWATCH_SIZES = {
  sm: { button: 'h-6 w-6', dot: 'h-5 w-5', text: 'text-[10px] py-1.5 px-3' },
  md: { button: 'h-8 w-8', dot: 'h-6 w-6', text: 'text-xs py-2 px-3.5' },
  lg: { button: 'h-10 w-10', dot: 'h-8 w-8', text: 'text-sm py-2.5 px-4' },
};

/**
 * Accessible colour swatches. Uses the actual product colour hex when
 * available and falls back to a labelled text pill otherwise so the colour
 * name is never conveyed by colour alone.
 */
export const ColorSwatches: React.FC<ColorSwatchesProps> = ({
  options,
  selected,
  onSelect,
  isOptionAvailable,
  selections,
  isDisabled,
  maxVisible = 4,
  size = 'md',
  compact = false,
  id,
}) => {
  const s = SWATCH_SIZES[size];
  const visible = options.slice(0, maxVisible);
  const hiddenCount = options.length - visible.length;

  const disabledFor = (value: string): boolean => {
    if (isDisabled) return isDisabled(value);
    if (isOptionAvailable && selections) {
      return !isOptionAvailable(value, selections);
    }
    return false;
  };

  return (
    <div
      id={id}
      className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2.5 flex-wrap'}`}
      role={onSelect ? 'radiogroup' : undefined}
      aria-label={onSelect ? 'Colour' : undefined}
    >
      {visible.map((option) => {
        const isSelected = !!selected && option.value === selected;
        const disabled = disabledFor(option.value);
        const label = `${option.value}${isSelected ? ', selected' : ''}${disabled ? ', unavailable' : ''}`;

        if (!option.colorHex) {
          return (
            <button
              key={option.value}
              type="button"
              role={onSelect ? 'radio' : undefined}
              aria-checked={onSelect ? isSelected : undefined}
              aria-label={label}
              disabled={disabled}
              onClick={() => onSelect?.(option.value)}
              title={option.value}
              className={`rounded-full border transition-all duration-200 text-[#181716] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
                disabled
                  ? 'opacity-40 cursor-not-allowed line-through'
                  : 'cursor-pointer'
              } ${
                isSelected
                  ? 'border-[#A2574F] bg-[#F7ECEA] text-[#83443D] shadow-sm'
                  : 'border-[#D8D3CB] bg-[#FFFFFF] hover:border-[#A2574F] hover:shadow-sm'
              } ${s.text}`}
            >
              {option.value}
            </button>
          );
        }

        const isLight = /^#(?:F{3,}|E{2}FF|F{2}F|FFF)/i.test(option.colorHex) ||
          ['white', 'ivory', 'cream', 'nude', 'ecru', 'chalk', 'bone', 'alabaster'].some(
            (name) => option.value.toLowerCase().includes(name)
          );

        return (
          <button
            key={option.value}
            type="button"
            role={onSelect ? 'radio' : undefined}
            aria-checked={onSelect ? isSelected : undefined}
            aria-label={label}
            disabled={disabled}
            onClick={() => onSelect?.(option.value)}
            title={option.value}
            className={`relative rounded-full transition-all duration-200 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
              disabled
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-pointer hover:shadow-md active:scale-95'
            } ${
              isSelected
                ? 'ring-2 ring-[#A2574F] ring-offset-2 ring-offset-white'
                : 'ring-1 ring-[#00000014]'
            } ${s.button}`}
          >
            <span
              className={`${s.dot} rounded-full border border-[#00000024] ${
                isLight ? 'border-[#0000002B]' : ''
              }`}
              style={{ backgroundColor: option.colorHex }}
              aria-hidden="true"
            />
          </button>
        );
      })}

      {hiddenCount > 0 && (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-[#F4ECE9] text-[#63605A] font-semibold ${
            compact ? 'h-6 min-w-6 px-1.5 text-[10px]' : 'h-8 min-w-8 px-2 text-xs'
          }`}
          title={`${hiddenCount} more colour${hiddenCount > 1 ? 's' : ''}`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};