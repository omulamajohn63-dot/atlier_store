import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface CollapsibleGroupProps {
  title: string;
  defaultOpen?: boolean;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const CollapsibleGroup: React.FC<CollapsibleGroupProps> = ({
  title,
  defaultOpen = false,
  active = false,
  className = '',
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
          active ? 'bg-[#F4ECE9]' : 'hover:bg-[#F4ECE9]'
        }`}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
            active ? 'text-[#A2574F]' : 'text-[#827E77]'
          }`}
        >
          {title}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[#827E77] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div id={contentId} hidden={!open}>
        <div className="mt-1 space-y-1">{children}</div>
      </div>
    </section>
  );
};
