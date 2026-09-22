import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Download,
  MapPin,
  Printer,
  Truck,
  X,
} from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useOrders } from '../context/OrdersContext';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { OrderDetailSkeleton } from '../components/ui/LoadingState';
import { OrderStatusPill } from '../components/orders/OrderStatusPill';
import { OrderProgress } from '../components/orders/OrderProgress';
import { OrderItemThumb } from '../components/orders/OrderItemThumb';
import { api } from '../services/apiClient';
import { Order, PaymentStatus } from '../types';
import { ReceiptDTO } from '../types/api';
import { formatPrice } from '../utils/currency';
import { formatOrderDate, mapServerOrder, totalQuantity } from '../utils/orderMapper';
import {
  canCancel,
  canMarkReceived,
  isActiveOrder,
  isTrackable,
} from '../utils/orderStatus';

interface CustomerOrderDetailPageProps {
  orderNumber?: string;
}

const statusLabel: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

function paymentMethodLabel(method?: string): string {
  switch ((method || 'mpesa').toLowerCase()) {
    case 'card':
      return 'Card';
    case 'cash_on_delivery':
      return 'Cash on Delivery';
    case 'pay_on_delivery':
      return 'Pay on Delivery';
    case 'mpesa':
    default:
      return 'M-Pesa';
  }
}

export const CustomerOrderDetailPage: React.FC<CustomerOrderDetailPageProps> = ({ orderNumber: propOrderNumber }) => {
  const { navigate } = useRouter();
  const { getOrder, receiveOrder, cancelOrder } = useOrders();
  const [order, setOrder] = useState<Order | null>(() => {
    if (!propOrderNumber) return null;
    return getOrder(propOrderNumber) || null;
  });
  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptUnavailable, setReceiptUnavailable] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const completionTimestamp = useCallback((status: 'delivered' | 'received' | 'cancelled') => {
    if (!order) return '';
    const timelineTimestamp = order.timeline.find((event) => event.status === status)?.timestamp;
    return (
      timelineTimestamp ||
      (status === 'cancelled' ? order.updatedAt : '') ||
      ''
    );
  }, [order]);

  const handleMarkReceived = useCallback(async () => {
    if (!order) return;
    if (!window.confirm(`Mark order ${order.orderNumber} as received?`)) {
      return;
    }

    const result = await receiveOrder(order.orderNumber);
    if (result.success && result.order) {
      setOrder(result.order);
      setError('');
    } else {
      setError(result.message);
    }
  }, [order, receiveOrder]);

  const handleCancel = useCallback(async () => {
    if (!order) return;
    if (!window.confirm(`Cancel order ${order.orderNumber}? Reserved modeza stock will be returned.`)) {
      return;
    }

    const result = await cancelOrder(order.orderNumber);
    if (result.success && result.order) {
      setOrder(result.order);
      setError('');
    } else {
      setError(result.message);
    }
  }, [order, cancelOrder]);

  useEffect(() => {
    const orderNum = propOrderNumber || '';
    if (!orderNum) return;

    const local = getOrder(orderNum);
    if (local) {
      setOrder(local);
      setError('');
      return;
    }

    setLoading(true);
    api
      .getOrder(orderNum)
      .then((serverOrder) => {
        const mapped = mapServerOrder(serverOrder);
        setOrder(mapped);
        setError('');
      })
      .catch(() => {
        setOrder(null);
        setError('No order could be found for this reference.');
      })
      .finally(() => setLoading(false));
  }, [propOrderNumber, getOrder]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!receipt) return;
    setDownloading(true);
    setReceiptError('');
    try {
      const blob = await api.downloadReceipt(receipt.receiptNumber);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${receipt.receiptNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'The receipt could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  }, [receipt]);

  const handleOpenReceipt = useCallback(async () => {
    if (!receipt) return;
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) {
      setReceiptError('Please allow pop-ups to open the receipt.');
      return;
    }
    setDownloading(true);
    setReceiptError('');
    try {
      const blob = await api.downloadReceipt(receipt.receiptNumber);
      const url = URL.createObjectURL(blob);
      receiptWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      receiptWindow.close();
      setReceiptError(err instanceof Error ? err.message : 'The receipt could not be opened.');
    } finally {
      setDownloading(false);
    }
  }, [receipt]);

  useEffect(() => {
    if (!order || order.paymentStatus !== 'paid') {
      setReceipt(null);
      setReceiptUnavailable(false);
      setReceiptError('');
      return;
    }
    let cancelled = false;
    setReceipt(null);
    setReceiptUnavailable(false);
    setReceiptError('');
    setReceiptLoading(true);
    api
      .getOrderReceipt(order.orderNumber)
      .then((data) => {
        if (cancelled) return;
        if (data.status === 'generated') {
          setReceipt(data);
          return;
        }
        setReceiptError('The official receipt is not available yet.');
      })
      .catch((err) => {
        if (cancelled) return;
        const error = err as Error & { code?: string; status?: number };
        if (error.status === 404 && error.code === 'RECEIPT_NOT_FOUND') {
          setReceiptUnavailable(true);
          return;
        }
        setReceiptError(error.message || 'The official receipt could not be checked.');
      })
      .finally(() => {
        if (!cancelled) setReceiptLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order]);

  if (!propOrderNumber) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState
          variant="page"
          title="Missing order reference"
          message="We couldn't identify the order you're looking for."
          onRetry={() => navigate('/account/orders')}
          retryLabel="Back to Orders"
        />
      </div>
    );
  }

  const showErrorPanel = !loading && !order;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
      <a
        href="/account/orders"
        onClick={(event) => {
          event.preventDefault();
          navigate('/account/orders');
        }}
        className="inline-flex items-center gap-2 rounded-sm text-xs font-semibold uppercase tracking-[0.14em] text-[#63605A] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Orders
      </a>

      {loading && <OrderDetailSkeleton />}

      {showErrorPanel && (
        <div className="mt-10">
          <ErrorState
            variant="page"
            title="Something went wrong"
            message="We couldn't load this order right now."
            onRetry={() => {
              setLoading(true);
              api
                .getOrder(propOrderNumber)
                .then((serverOrder) => {
                  setOrder(mapServerOrder(serverOrder));
                  setError('');
                })
                .catch(() => {
                  setOrder(null);
                  setError('No order could be found for this reference.');
                })
                .finally(() => setLoading(false));
            }}
          />
        </div>
      )}

      {order && (
        <div className="mt-8 space-y-10">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#F3F1ED] pb-8">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#827E77]">Order</p>
              <h1 className="font-serif text-3xl tracking-tight text-[#181716] sm:text-4xl">
                {order.orderNumber}
              </h1>
              <p className="text-sm text-[#63605A]">
                Placed {formatOrderDate(order.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <OrderStatusPill status={order.status} />
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E8E5DF] bg-white px-3 py-1 shadow-xs">
                <CreditCard className="h-3 w-3 text-[#8A745C]" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181716] sm:text-[11px]">
                  {paymentMethodLabel(order.paymentMethod)} · {statusLabel[order.paymentStatus]}
                </span>
              </span>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-[1.65fr_1fr] lg:gap-12">
            <div className="space-y-8">
              {/* Status / delivery */}
              {order.status === 'cancelled' ? (
                <section className="rounded-2xl border border-[#E8E5DF] bg-[#FAF9F6] p-5 sm:p-6">
                  <p className="flex items-center gap-2.5 text-sm font-medium text-[#63605A]">
                    <X className="h-4 w-4 shrink-0 text-[#827E77]" aria-hidden="true" />
                    This order was cancelled
                    {completionTimestamp('cancelled') ? (
                      <span>
                        {' '}
                        on{' '}
                        {formatOrderDate(completionTimestamp('cancelled'), {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    ) : null}
                    .
                  </p>
                </section>
              ) : order.status === 'delivered' || order.status === 'received' ? (
                <section className="flex items-center gap-3 rounded-2xl border border-[#C8D8CA] bg-[#F2F6F2] p-5 sm:p-6">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-xs">
                    <Check className="h-4 w-4 text-[#2E5A44]" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#181716]">
                      {order.status === 'delivered'
                        ? 'Delivered'
                        : 'Order received'}
                      {(completionTimestamp('delivered') || completionTimestamp('received')) && (
                        <span>{' '}on{' '}
                          {formatOrderDate(
                            completionTimestamp('delivered') || completionTimestamp('received'),
                            { day: 'numeric', month: 'long', year: 'numeric' }
                          )}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-[#63605A]">
                      Thank you for shopping with the modeza.
                    </p>
                  </div>
                </section>
              ) : isActiveOrder(order.status) ? (
                <section className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                      Order status
                    </h2>
                    {isTrackable(order.status) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/track?order=${encodeURIComponent(order.orderNumber)}`)}
                        className="gap-1.5 text-xs"
                      >
                        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                        Track Order
                      </Button>
                    )}
                  </div>
                  <OrderProgress order={order} className="mt-6" />
                </section>
              ) : null}

              {/* Shipped notice (no fabricated tracking data) */}
              {order.status === 'shipped' && (
                <section className="flex items-start gap-3.5 rounded-2xl border border-[#E8E5DF] bg-[#FAF9F6] p-5 sm:p-6">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[#181716]" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#181716]">Your order is on its way</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#63605A]">
                      Your pieces have been dispatched. You'll receive SMS and email updates as it travels to
                      you.
                    </p>
                  </div>
                </section>
              )}

              {/* Items */}
              <section>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                  {totalQuantity(order)} {totalQuantity(order) === 1 ? 'item' : 'items'}
                </h2>
                <div className="mt-4 divide-y divide-[#F3F1ED] overflow-hidden rounded-2xl border border-[#E8E5DF] bg-white">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center gap-4 p-4 sm:gap-5 sm:p-5">
                      <OrderItemThumb
                        item={item}
                        className="h-20 w-16 shrink-0 rounded-lg border border-[#E8E5DF] shadow-xs sm:h-24 sm:w-20"
                      />
                      <div className="min-w-[7.5rem] flex-1">
                        <h3 className="font-serif text-sm text-[#181716] sm:text-base">{item.productName}</h3>
                        <p className="mt-1 text-xs text-[#63605A]">{item.variantDetails || '—'}</p>
                        <p className="mt-1 text-xs text-[#827E77]">
                          Qty {item.quantity} × {formatPrice(item.unitPrice)}
                        </p>
                      </div>
                      <div className="shrink-0 font-serif text-sm text-[#181716] sm:text-base">
                        {formatPrice(item.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Delivery address */}
              <section className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                  <MapPin className="h-3.5 w-3.5 text-[#8A745C]" aria-hidden="true" />
                  Delivery address
                </h2>
                <div className="mt-4 text-sm text-[#181716]">
                  <p className="font-medium">
                    {order.customer.firstName} {order.customer.lastName}
                  </p>
                  <p className="mt-1 text-[#63605A]">
                    {order.customer.addressLine1}
                    {order.customer.addressLine2 ? `, ${order.customer.addressLine2}` : ''}
                  </p>
                  <p className="text-[#63605A]">
                    {order.customer.city}
                    {order.customer.stateOrProvince ? `, ${order.customer.stateOrProvince}` : ''}
                    {order.customer.postalCode ? ` ${order.customer.postalCode}` : ''}
                  </p>
                  <p className="text-[#63605A]">{order.customer.country}</p>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              {/* Order summary */}
              <section className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                  Order summary
                </h2>
                <dl className="mt-5 space-y-2.5 text-xs text-[#63605A]">
                  <div className="flex items-center justify-between">
                    <dt>Subtotal</dt>
                    <dd className="font-medium text-[#181716]">{formatPrice(order.subtotal)}</dd>
                  </div>
                  {order.discount && (
                    <div className="flex items-center justify-between text-[#2E5A44]">
                      <dt>Privilege ({order.discount.code})</dt>
                      <dd className="font-medium">-{formatPrice(order.discount.amount)}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <dt>Delivery</dt>
                    <dd className="font-medium text-[#181716]">
                      {order.shippingCost === 0 ? 'Complimentary' : formatPrice(order.shippingCost)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>VAT</dt>
                    <dd className="font-medium text-[#181716]">{formatPrice(order.tax)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#F3F1ED] pt-3">
                    <dt className="text-sm font-medium text-[#181716]">Total</dt>
                    <dd className="font-serif text-xl text-[#181716]">{formatPrice(order.total)}</dd>
                  </div>
                </dl>
              </section>

              {/* Payment */}
              <section className="rounded-2xl border border-[#E8E5DF] bg-white p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                  <CreditCard className="h-3.5 w-3.5 text-[#8A745C]" aria-hidden="true" />
                  Payment
                </h2>
                <dl className="mt-4 space-y-2.5 text-xs text-[#63605A]">
                  <div className="flex items-center justify-between">
                    <dt>Method</dt>
                    <dd className="font-medium capitalize text-[#181716]">
                      {paymentMethodLabel(order.paymentMethod)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Status</dt>
                    <dd
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        order.paymentStatus === 'paid'
                          ? 'text-[#2E5A44]'
                          : order.paymentStatus === 'refunded'
                          ? 'text-[#827E77]'
                          : order.paymentStatus === 'failed'
                          ? 'text-[#9E332B]'
                          : 'text-[#63605A]'
                      }`}
                    >
                      {order.paymentStatus === 'paid' && (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {statusLabel[order.paymentStatus]}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Actions */}
              <section className="flex flex-col gap-2.5 rounded-2xl border border-[#E8E5DF] bg-[#FAF9F6] p-5 sm:p-6">
                {isTrackable(order.status) && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => navigate(`/track?order=${encodeURIComponent(order.orderNumber)}`)}
                    className="gap-2 text-xs uppercase tracking-wider"
                  >
                    <Truck className="h-4 w-4" aria-hidden="true" />
                    Track Order
                  </Button>
                )}
                {canMarkReceived(order.status, order.paymentMethod) && (
                  <Button type="button" variant="secondary" size="md" onClick={() => void handleMarkReceived()} className="text-xs uppercase tracking-wider">
                    Mark as Received
                  </Button>
                )}
                {canCancel(order.status) && (
                  <Button type="button" variant="outline" size="md" onClick={handleCancel} className="text-xs uppercase tracking-wider">
                    Cancel Order
                  </Button>
                )}
                {receiptLoading ? (
                  <Button type="button" variant="outline" size="md" disabled className="gap-2 text-xs" aria-busy="true">
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Checking receipt…
                  </Button>
                ) : receipt ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => void handleDownloadReceipt()}
                    disabled={downloading}
                    className="gap-2 text-xs uppercase tracking-wider"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {downloading ? 'Downloading…' : 'Download Receipt (PDF)'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    if (receipt) {
                      void handleOpenReceipt();
                    } else if (receiptUnavailable) {
                      window.print();
                    }
                  }}
                  disabled={downloading || receiptLoading || (!receipt && !receiptUnavailable)}
                  className="gap-2 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  Print Receipt
                </Button>
              </section>

              {receiptError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#F8B4B4] bg-[#FDF2F2] px-4 py-3 text-xs leading-relaxed text-[#9B1C1C]"
                >
                  {receiptError}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#F8B4B4] bg-[#FDF2F2] px-4 py-3 text-xs leading-relaxed text-[#9B1C1C]"
                >
                  {error}
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
};