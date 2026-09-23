import React from 'react';
import { Product } from '../../types';
import {
  getVisibleOptionGroups,
  isOptionAvailable,
  VariantSelections,
} from '../../utils/variants';
import { ColorSwatches } from './ColorSwatches';

export interface VariantSelectorProps {
  product: Product;
  selections: VariantSelections;
  onChange: (selections: VariantSelections) => void;
  /** Larger touch targets intended for the product detail page. */
  size?: 'sm' | 'md' | 'lg';
}

const PILL_GRID_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'grid grid-cols-4 gap-1.5',
  md: 'grid grid-cols-4 gap-2',
  lg: 'grid grid-cols-4 sm:grid-cols-6 gap-2.5',
};

/**
 * Derives option groups (Colour, Size, ...) from the product's variant data
 * and renders them as accessible swatches / pills with cross-option
 * availability filtering. Selecting a value never produces an invalid
 * combination adding to cart.
 */
export const VariantSelector: React.FC<VariantSelectorProps> = ({
  product,
  selections,
  onChange,
  size = 'md',
}) => {
  const groups = getVisibleOptionGroups(product);

  const handleSelect = (key: string, value: string) => {
    onChange({ ...selections, [key]: value });
  };

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const isColor = group.key === 'color';
        const selectedValue = selections[group.key];
        const groupId = `variant-option-${group.key}`;

        return (
          <div key={group.key}>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-[#63605A]">{group.label}</span>
              {selectedValue && (
                <span className="font-medium text-[#181716]">{selectedValue}</span>
              )}
            </div>

            {isColor ? (
              <ColorSwatches
                id={groupId}
                options={group.options}
                selected={selectedValue}
                onSelect={(value) => handleSelect(group.key, value)}
                isOptionAvailable={(value, current) =>
                  isOptionAvailable(product, current, group.key, value)
                }
                selections={selections}
                size={size}
              />
            ) : (
              <div
                id={groupId}
                className={PILL_GRID_CLASSES[size]}
                role="radiogroup"
                aria-label={group.label}
              >
                {group.options.map((option) => {
                  const isSelected = selectedValue === option.value;
                  const unavailable = !isOptionAvailable(
                    product,
                    selections,
                    group.key,
                    option.value
                  );

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-disabled={unavailable}
                      aria-label={`${option.value}${unavailable ? ', unavailable' : ''}`}
                      disabled={unavailable}
                      onClick={() => handleSelect(group.key, option.value)}
                      className={`min-h-11 rounded-xl text-xs font-medium border flex items-center justify-center transition-all duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
                        smallPillStyles({
                          isSelected,
                          unavailable,
                        })
                      }`}
                    >
                      {option.value}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

function smallPillStyles(options: {
  isSelected: boolean;
  unavailable: boolean;
}): string {
  if (options.isSelected) {
    return 'bg-[#181716] text-[#FAF9F6] border-[#181716] shadow-md';
  }
  if (options.unavailable) {
    return 'bg-[#F3F1ED] text-[#A29E96] border-[#E8E5DF] cursor-not-allowed line-through';
  }
  return 'bg-[#FAF9F6] text-[#181716] border-[#E8E5DF] hover:border-[#A2574F] hover:bg-[#FFFFFF] hover:shadow-sm';
}