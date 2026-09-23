import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  id,
  className = '',
  required,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-[#63605A] mb-1.5"
        >
          {label} {required && <span className="text-[#9E332B]">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#827E77] pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full bg-[#FFFFFF] border rounded-xl px-3.5 py-2.5 text-sm text-[#181716] placeholder-[#A29E96] transition-all duration-200 focus:outline-none focus:ring-1 ${
            error
              ? 'border-[#9E332B] focus:border-[#9E332B] focus:ring-[#9E332B] bg-[#FDF2F2]'
              : 'border-[#E8E5DF] focus:border-[#A2574F] focus:ring-[#A2574F] hover:border-[#D8D3CB]'
          } ${icon ? 'pl-10' : ''} ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-[#9E332B] flex items-center gap-1" role="alert">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-[#827E77]">{helperText}</p>
      ) : null}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  required,
  ...props
}) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-semibold uppercase tracking-wider text-[#63605A] mb-1.5"
        >
          {label} {required && <span className="text-[#9E332B]">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        className={`w-full bg-[#FFFFFF] border rounded-xl px-3.5 py-2.5 text-sm text-[#181716] placeholder-[#A29E96] transition-all duration-200 focus:outline-none focus:ring-1 resize-y min-h-[100px] ${
          error
            ? 'border-[#9E332B] focus:border-[#9E332B] focus:ring-[#9E332B] bg-[#FDF2F2]'
            : 'border-[#E8E5DF] focus:border-[#A2574F] focus:ring-[#A2574F] hover:border-[#D8D3CB]'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${textareaId}-error`} className="mt-1.5 text-xs text-[#9E332B] flex items-center gap-1" role="alert">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      ) : helperText ? (
        <p id={`${textareaId}-helper`} className="mt-1.5 text-xs text-[#827E77]">{helperText}</p>
      ) : null}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  placeholder,
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
          className="block text-xs font-semibold uppercase tracking-wider text-[#63605A] mb-1.5"
        >
          {label} {required && <span className="text-[#9E332B]">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          className={`w-full bg-[#FFFFFF] border rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#181716] transition-all duration-200 focus:outline-none focus:ring-1 appearance-none cursor-pointer ${
            error
              ? 'border-[#9E332B] focus:border-[#9E332B] focus:ring-[#9E332B] bg-[#FDF2F2]'
              : 'border-[#E8E5DF] focus:border-[#A2574F] focus:ring-[#A2574F] hover:border-[#D8D3CB]'
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#827E77]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error ? (
        <p id={`${selectId}-error`} className="mt-1.5 text-xs text-[#9E332B] flex items-center gap-1" role="alert">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="mt-1.5 text-xs text-[#827E77]">{helperText}</p>
      ) : null}
    </div>
  );
};