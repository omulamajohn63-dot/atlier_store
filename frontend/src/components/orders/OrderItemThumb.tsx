import React, { useState } from 'react';
import { OrderItem } from '../../types';

export interface OrderItemThumbProps {
  item: OrderItem;
  className?: string;
}

/**
 * Product thumbnail for order items. Renders the item image at a consistent
 * aspect ratio with object-fit, and falls back to an elegant serif monogram
 * when no image is available or the image fails to load.
 */
export const OrderItemThumb: React.FC<OrderItemThumbProps> = ({ item, className = '' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showPlaceholder = !item.image || imageFailed;
  const initial = (item.productName || 'A').trim().charAt(0).toUpperCase();

  return (
    <div className={`relative overflow-hidden bg-[#F4ECE9] ${className}`}>
      {showPlaceholder ? (
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-serif text-xl text-[#C0857B]">{initial}</span>
        </div>
      ) : (
        <img
          src={item.image}
          alt={item.productName}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover object-center"
        />
      )}
    </div>
  );
};