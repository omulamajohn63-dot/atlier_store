import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'sandstone';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  fullWidth = false,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-200 select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-4 py-2 rounded-full gap-1.5',
    md: 'text-sm px-6 py-3 rounded-full gap-2',
    lg: 'text-base px-8 py-4 rounded-full gap-2.5',
    xl: 'text-lg px-10 py-5 rounded-full gap-3',
  };

  const variantStyles = {
    primary:
      'bg-[#A2574F] text-[#FAF9F6] hover:bg-[#83443D] active:bg-[#6E3832] shadow-sm hover:shadow-[0_4px_14px_-2px_rgba(162,87,79,0.4)]',
    secondary:
      'bg-[#F4ECE9] text-[#181716] hover:bg-[#E5E1D8] active:bg-[#D8D3CB] shadow-sm hover:shadow-md',
    outline:
      'border border-[#181716] text-[#181716] bg-transparent hover:bg-[#181716] hover:text-[#FAF9F6] active:bg-[#0F0E0E]',
    ghost:
      'text-[#181716] bg-transparent hover:bg-[#F3F1ED] active:bg-[#F4ECE9] rounded-full',
    sandstone:
      'bg-[#E68057] text-[#181716] hover:bg-[#C9603F] shadow-[0_4px_14px_-2px_rgba(230,128,87,0.4)] hover:shadow-[0_6px_20px_-3px_rgba(230,128,87,0.5)]',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyles} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
          <span>Processing...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};