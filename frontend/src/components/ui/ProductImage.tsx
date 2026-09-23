import React, { useEffect, useState } from 'react';

export interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Product image that never renders a broken <img> and never fakes media:
 * an empty or failed image falls back to a neutral branded placeholder.
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        aria-label={alt}
        role="img"
        className={`flex items-center justify-center bg-[#F4ECE9] ${className}`}
      >
        <span className="font-serif text-xs uppercase tracking-[0.35em] text-[#C8A894] select-none">
          Modeza
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover object-center ${imgClassName}`}
    />
  );
};