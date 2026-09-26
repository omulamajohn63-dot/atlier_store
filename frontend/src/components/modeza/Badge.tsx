"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default:
          "border border-[#E8E5DF] bg-[#FAF9F6] text-[#63605A] hover:bg-[#F4ECE9] hover:text-[#181716]",
        new: "bg-[#A2574F] text-[#FAF9F6]",
        outline: "border border-[#A2574F] text-[#A2574F] hover:bg-[#F7ECEA]",
        lowStock: "bg-[#FDF2F2] text-[#9E332B] border border-[#F8B4B4]",
        success: "bg-[#E8EFEA] text-[#2E5A44] border border-[#C8D8CA]",
        warning: "bg-[#FFF8F0] text-[#9A6A2B] border border-[#E7D8B3]",
        destructive: "bg-[#FDF2F2] text-[#9E332B] border border-[#F8B4B4]",
        danger: "bg-[#9E332B] text-white",
        secondary: "bg-[#F4ECE9] text-[#181716] hover:bg-[#E5E1D8]",
      },
      size: {
        sm: "px-2 py-0.5 text-[9px]",
        md: "px-2.5 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}

export { Badge, badgeVariants };