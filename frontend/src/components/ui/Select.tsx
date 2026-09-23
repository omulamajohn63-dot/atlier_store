import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  id,
  className = '',
  required,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium uppercase tracking-wider text-[#63605A] mb-1.5"
        >
          {label} {required && <span className="text-[#9E332B]">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          required={required}
          className={`w-full appearance-none bg-[#FFFFFF] border rounded-lg pl-3.5 pr-10 py-2.5 text-sm text-[#181716] transition-colors focus:outline-none focus:ring-1 ${
            error
              ? 'border-[#9E332B] focus:border-[#9E332B] focus:ring-[#9E332B]'
              : 'border-[#E8E5DF] focus:border-[#A2574F] focus:ring-[#A2574F]'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#63605A]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-[#9E332B]">{error}</p>}
    </div>
  );
};
