import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, CheckCheck } from 'lucide-react';
import { ToastMessage } from '../../types';

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onMarkAllRead?: () => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss, onMarkAllRead }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-4 bottom-6 z-[800] flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-6 sm:w-full"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const iconMap = {
            success: <CheckCircle2 className="w-4 h-4 text-[#2E5A44] shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-[#9E332B] shrink-0" />,
            info: <Info className="w-4 h-4 text-[#A2574F] shrink-0" />,
          };

          const borderColors = {
            success: 'border-[#C8D8CA] bg-[#E8EFEA]',
            error: 'border-[#F8B4B4] bg-[#FDF2F2]',
            info: 'border-[#E7D8B3] bg-[#FFF8F0]',
          };

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto rounded-xl shadow-xl p-4 flex items-start justify-between gap-3 text-sm text-[#181716] ${borderColors[toast.type]}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{iconMap[toast.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs tracking-wide text-[#181716] uppercase">{toast.title}</p>
                  {toast.description && (
                    <p className="text-xs text-[#63605A] mt-0.5">{toast.description}</p>
                  )}
                  {onMarkAllRead && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#C7BDAB] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A2574F] hover:bg-[#FAF9F6] transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-[#A29E96] hover:text-[#181716] p-0.5 rounded transition-colors hover:bg-[#F3F1ED]"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export interface SimpleToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const SimpleToast: React.FC<SimpleToastProps> = ({
  message,
  type = 'info',
  onClose,
  duration = 4000,
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-[#2E5A44]" />,
    error: <AlertCircle className="w-4 h-4 text-[#9E332B]" />,
    info: <Info className="w-4 h-4 text-[#A2574F]" />,
  };

  const bgColors = {
    success: 'bg-[#E8EFEA] border-[#C8D8CA]',
    error: 'bg-[#FDF2F2] border-[#F8B4B4]',
    info: 'bg-[#FFF8F0] border-[#E7D8B3]',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-auto fixed inset-x-4 bottom-6 z-[800] flex w-auto max-w-sm items-center gap-3 rounded-xl border p-4 text-sm text-[#181716] shadow-xl sm:inset-x-auto sm:right-6 sm:w-auto ${bgColors[type]}`}
      onClick={onClose}
      role="alert"
    >
      <div className="mt-0.5 shrink-0">{iconMap[type]}</div>
      <p className="font-medium text-[#181716]">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-[#A29E96] hover:text-[#181716] p-0.5 rounded transition-colors hover:bg-[#F3F1ED] ml-2 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};