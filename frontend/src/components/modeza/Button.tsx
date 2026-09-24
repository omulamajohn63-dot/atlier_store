"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-[#A2574F] text-[#FAF9F6] hover:bg-[#83443D] active:bg-[#6E3832] shadow-sm hover:shadow-[0_4px_14px_-2px_rgba(162,87,79,0.4)]",
        secondary:
          "bg-[#F4ECE9] text-[#181716] hover:bg-[#E5E1D8] active:bg-[#D8D3CB] shadow-sm hover:shadow-md",
        outline:
          "border border-[#181716] text-[#181716] bg-transparent hover:bg-[#181716] hover:text-[#FAF9F6] active:bg-[#0F0E0E]",
        ghost:
          "text-[#181716] bg-transparent hover:bg-[#F3F1ED] active:bg-[#F4ECE9]",
        sandstone:
          "bg-[#E68057] text-[#181716] hover:bg-[#C9603F] shadow-[0_4px_14px_-2px_rgba(230,128,87,0.4)] hover:shadow-[0_6px_20px_-3px_rgba(230,128,87,0.5)]",
        destructive:
          "bg-[#9E332B] text-[#FAF9F6] hover:bg-[#8B2A24] shadow-sm hover:shadow-[0_4px_14px_-2px_rgba(158,51,43,0.4)]",
        modeza: "bg-[#A2574F] text-[#FAF9F6] hover:bg-[#83443D] shadow-sm hover:shadow-[0_4px_14px_-2px_rgba(162,87,79,0.4)]",
        "modeza-outline": "border-[#A2574F] text-[#A2574F] hover:bg-[#F7ECEA]",
        "modeza-ghost": "text-[#A2574F] hover:bg-[#F7ECEA]",
        "modeza-sandstone": "bg-[#E68057] text-[#181716] hover:bg-[#C9603F]",
      },
      size: {
        sm: "h-8 px-3 rounded-full gap-1.5 text-xs",
        md: "h-10 px-4 rounded-full gap-2 text-sm",
        lg: "h-12 px-6 rounded-full gap-2.5 text-base",
        xl: "h-14 px-8 rounded-full gap-3 text-lg",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, isLoading = false, asChild = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
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
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };