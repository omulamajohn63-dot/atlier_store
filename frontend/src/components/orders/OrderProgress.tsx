import React from 'react';
import { Check } from 'lucide-react';
import { Order } from '../../types';
import { ORDER_STATUS_META, PROGRESS_STEPS } from '../../utils/orderStatus';
import { formatOrderDate } from '../../utils/orderMapper';

export interface OrderProgressProps {
  order: Order;
  className?: string;
}

/**
 * Compact delivery-lifecycle tracker. Rendered only for active orders
 * (cancelled orders use a different presentation elsewhere).
 * Completion is derived from the real order.status so it always reflects
 * the backend state; per-step dates come from the order timeline when present.
 */
export const OrderProgress: React.FC<OrderProgressProps> = ({ order, className = '' }) => {
  const currentRank = ORDER_STATUS_META[order.status].rank;
  const timelineByStatus = new Map(order.timeline.map((event) => [event.status, event.timestamp]));

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center">
        {PROGRESS_STEPS.map((step, index) => {
          const stepRank = ORDER_STATUS_META[step.status].rank;
          const reached = currentRank >= stepRank;
          const isCurrent = order.status === step.status;
          const isLast = index === PROGRESS_STEPS.length - 1;

          return (
            <React.Fragment key={step.status}>
              <span
                className={
                  reached && isCurrent
                    ? 'flex h-[15px] w-[15px] items-center justify-center rounded-full bg-white ring-2 ring-[#A2574F]/40'
                    : reached
                    ? `flex h-[15px] w-[15px] items-center justify-center rounded-full ${ORDER_STATUS_META[step.status].dotClass} text-white`
                    : 'flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[#D8D3CB] bg-white'
                }
                aria-hidden="true"
              >
                {reached && !isCurrent && (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} stroke="currentColor" />
                )}
                {reached && isCurrent && (
                  <span className="h-2 w-2 rounded-full bg-[#A2574F]" />
                )}
              </span>

              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`mx-1.5 h-[2px] flex-1 rounded-full ${
                    currentRank > stepRank || (currentRank === stepRank && reached)
                      ? 'bg-[#C8C3BA]'
                      : 'bg-[#E8E5DF]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step labels + dates, aligned with the dots above */}
      <div className="flex pt-2.5">
        {PROGRESS_STEPS.map((step) => {
          const timestamp = timelineByStatus.get(step.status);
          return (
            <div key={step.status} className="min-w-0 flex-1 text-center">
              <div
                className={`truncate text-[10px] font-medium uppercase tracking-[0.1em] ${
                  currentRank >= ORDER_STATUS_META[step.status].rank
                    ? 'text-[#181716]'
                    : 'text-[#A29E96]'
                }`}
              >
                {step.label}
              </div>
              <div className="mt-0.5 truncate text-[9px] text-[#A29E96]">
                {formatOrderDate(timestamp, { month: 'short', day: 'numeric' }) || '—'}
              </div>
            </div>
          );
        })}
      </div>

      <p className="sr-only">
        Order status: {ORDER_STATUS_META[order.status].label}.
      </p>
    </div>
  );
};