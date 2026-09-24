import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Progress,
} from '../components/modeza';
import { useOrders } from '../context/OrdersContext';
import { useRouter } from '../router/RouterContext';
import { ProductImage } from '../components/ui/ProductImage';
import { api } from '../services/apiClient';
import { formatPrice } from '../utils/currency';
import { mapServerOrder } from '../utils/orderMapper';
import { canCancel, canMarkReceived, ORDER_STATUS_META } from '../utils/orderStatus';
import { Order, OrderStatus, PaymentStatus } from '../types';

export interface OrderTrackingPageProps {
  orderNumber?: string;
}

type OrderAction = 'cancel' | 'receive';

interface PendingOrderAction {
  type: OrderAction;
  orderNumber: string;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case 'confirmed':
      return (
        <Badge variant="success" size="sm" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Confirmed
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" size="sm" className="gap-1.5">
          <PackageCheck className="h-3 w-3" aria-hidden="true" />
          MODEZA Preparation
        </Badge>
      );
    case 'shipped':
      return (
        <Badge variant="default" size="sm" className="gap-1.5 border-[#B9D0F5] bg-[#E8F0FE] text-[#1A73E8]">
          <Truck className="h-3 w-3" aria-hidden="true" />
          Courier Dispatch
        </Badge>
      );
    case 'delivered':
      return (
        <Badge variant="success" size="sm" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Delivered
        </Badge>
      );
    case 'received':
      return (
        <Badge variant="success" size="sm" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Received
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="destructive" size="sm" className="gap-1.5">
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Cancelled &amp; Restocked
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size="sm" className="gap-1.5">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Pending
        </Badge>
      );
  }
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const variant = status === 'paid'
    ? 'success'
    : status === 'failed'
      ? 'destructive'
      : status === 'refunded'
        ? 'secondary'
        : 'warning';

  return <Badge variant={variant} size="sm">Payment {status}</Badge>;
}

function getProgressValue(order: Order): number {
  if (order.status === 'cancelled') return 100;
  const rank = Math.max(0, ORDER_STATUS_META[order.status].rank);
  return Math.round((rank / 4) * 100);
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orderNumber: propOrderNum }) => {
  const { getOrder, cancelOrder, receiveOrder } = useOrders();
  const { navigate } = useRouter();
  const [searchQuery, setSearchQuery] = useState(propOrderNum || '');
  const [activeOrder, setActiveOrder] = useState<Order | null>(() => (propOrderNum ? getOrder(propOrderNum) || null : null));
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingOrderAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (propOrderNum) {
      setSearchQuery(propOrderNum);
      const found = getOrder(propOrderNum);
      if (found) {
        setActiveOrder(found);
        setErrorMsg('');
      }
    }
  }, [propOrderNum, getOrder]);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');
    setActionSuccessMsg('');

    const cleanQuery = searchQuery.trim();
    const found = getOrder(cleanQuery);
    if (found) {
      setActiveOrder(found);
      return;
    }

    setIsSearching(true);
    try {
      const serverOrder = await api.getOrder(cleanQuery);
      setActiveOrder(mapServerOrder(serverOrder));
    } catch {
      setActiveOrder(null);
      setErrorMsg(`No record found for order "${searchQuery}". Please check reference code or contact concierge.`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    setActionLoading(true);
    setActionSuccessMsg('');
    setErrorMsg('');

    try {
      const result = pendingAction.type === 'cancel'
        ? await cancelOrder(pendingAction.orderNumber)
        : await receiveOrder(pendingAction.orderNumber);

      if (result.success && result.order) {
        setActionSuccessMsg(result.message);
        setActiveOrder(result.order);
      } else {
        setErrorMsg(result.message);
      }
    } catch {
      setErrorMsg('The order could not be updated right now. Please try again.');
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const progressValue = activeOrder ? getProgressValue(activeOrder) : 0;
  const completedSteps = activeOrder?.timeline.filter((step) => step.completed).length || 0;
  const totalSteps = activeOrder?.timeline.length || 0;
  const pendingActionIsCancellation = pendingAction?.type === 'cancel';

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <Badge variant="outline" size="lg" className="mb-4">Client Services · Order Tracking</Badge>
        <h1 className="font-serif text-3xl font-normal tracking-tight text-[#181716] sm:text-5xl">
          Track your MODEZA order
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#63605A]">
          Follow each real milestone from confirmation through dispatch, with the latest status from your order ledger.
        </p>
      </header>

      <Card className="mx-auto max-w-3xl p-0 shadow-sm sm:p-0">
        <CardHeader className="border-b border-[#F3F1ED] p-5 sm:p-6">
          <CardTitle className="text-xl">Find an order</CardTitle>
          <p className="text-xs leading-5 text-[#63605A]">
            Enter the reference code from your confirmation to view live status and delivery details.
          </p>
        </CardHeader>
        <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                id="tracking-reference"
                label="Order reference"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="e.g. AT-KES12AB34CDEF"
                autoComplete="off"
                icon={<Search className="h-4 w-4" aria-hidden="true" />}
                className="h-12 uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSearching}
              className="w-full sm:w-auto"
            >
              Locate order
            </Button>
          </form>
          <p className="mt-3 text-[11px] leading-5 text-[#827E77]">
            Only orders placed through the boutique can be tracked.
          </p>
        </CardContent>
      </Card>

      {errorMsg && (
        <div
          role="alert"
          className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-[#F8B4B4] bg-[#FDF2F2] p-4 text-sm leading-6 text-[#9B1C1C]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {actionSuccessMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-[#B7EB8F] bg-[#EDF7ED] p-4 text-sm leading-6 text-[#1E4620]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {activeOrder && (
        <Card className="overflow-hidden p-0 shadow-sm" aria-labelledby="tracking-order-heading">
          <div className="border-b border-[#F3F1ED] p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 id="tracking-order-heading" className="break-all font-mono text-lg font-medium text-[#181716] sm:text-xl">
                    {activeOrder.orderNumber}
                  </h2>
                  <StatusBadge status={activeOrder.status} />
                </div>
                <p className="mt-2 text-sm text-[#63605A]">
                  Placed on {new Date(activeOrder.createdAt).toLocaleDateString('en-KE', { dateStyle: 'long' })}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PaymentStatusBadge status={activeOrder.paymentStatus} />
                  <span className="text-xs text-[#827E77]">
                    {activeOrder.items.reduce((sum, item) => sum + item.quantity, 0)} reserved pieces
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {canCancel(activeOrder.status) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => setPendingAction({ type: 'cancel', orderNumber: activeOrder.orderNumber })}
                    className="border-[#F8B4B4] text-[#9B1C1C] hover:border-[#9B1C1C] hover:bg-[#FDF2F2] hover:text-[#9B1C1C]"
                  >
                    Cancel &amp; restock
                  </Button>
                )}
                {canMarkReceived(activeOrder.status, activeOrder.paymentMethod) && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => setPendingAction({ type: 'receive', orderNumber: activeOrder.orderNumber })}
                  >
                    Mark as received
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-10 p-5 sm:p-7">
            <section aria-labelledby="tracking-progress-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A2574F]">Live ledger</p>
                  <h3 id="tracking-progress-heading" className="mt-1 text-sm font-semibold text-[#181716]">
                    Order journey
                  </h3>
                </div>
                <span className="text-xs text-[#827E77]">
                  {completedSteps} of {totalSteps} recorded milestones complete
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Progress
                  value={progressValue}
                  aria-label="Order journey progress"
                  aria-valuetext={`${progressValue}% complete`}
                  className="h-2"
                />
                <span className="shrink-0 text-xs font-semibold text-[#A2574F]">{progressValue}%</span>
              </div>
            </section>

            <section aria-labelledby="tracking-timeline-heading">
              <div className="flex items-center justify-between gap-3">
                <h3 id="tracking-timeline-heading" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                  MODEZA progress timeline
                </h3>
                <Badge variant="default" size="sm">{activeOrder.status}</Badge>
              </div>
              {totalSteps > 0 ? (
                <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {activeOrder.timeline.map((step, index) => (
                    <li
                      key={`${step.status}-${step.timestamp}-${index}`}
                      className={`rounded-2xl border p-4 ${
                        step.completed
                          ? 'border-[#A2574F]/40 bg-[#FAF9F6] text-[#181716]'
                          : 'border-[#E8E5DF] bg-white text-[#827E77]'
                      }`}
                      aria-current={step.status === activeOrder.status ? 'step' : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            step.completed ? 'bg-[#F4ECE9] text-[#A2574F]' : 'bg-[#F3F1ED] text-[#A29E96]'
                          }`}
                          aria-hidden="true"
                        >
                          {step.completed ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#181716]">{step.title}</h4>
                          <p className="mt-1 text-xs leading-5 text-[#63605A]">{step.description}</p>
                          {step.timestamp && (
                            <time dateTime={step.timestamp} className="mt-3 block text-[10px] text-[#827E77]">
                              {formatTimestamp(step.timestamp)}
                            </time>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-[#E8E5DF] p-5 text-sm text-[#63605A]">
                  No timeline events have been recorded for this order yet.
                </p>
              )}
            </section>

            <section aria-labelledby="tracking-items-heading" className="border-t border-[#F3F1ED] pt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="tracking-items-heading" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                  Items in parcel
                </h3>
                <Badge variant="outline" size="sm">
                  {activeOrder.items.reduce((sum, item) => sum + item.quantity, 0)} total
                </Badge>
              </div>
              <ul className="mt-4 divide-y divide-[#F3F1ED]">
                {activeOrder.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <ProductImage src={item.image} alt={item.productName} className="h-20 w-16 shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <h4 className="font-serif text-sm text-[#181716]">{item.productName}</h4>
                        <p className="mt-1 text-xs text-[#827E77]">{item.variantDetails || '—'}</p>
                        <p className="mt-1 text-xs text-[#63605A]">
                          Qty {item.quantity} × {formatPrice(item.unitPrice)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-[#181716]">{formatPrice(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-5 border-t border-[#F3F1ED] pt-7 lg:grid-cols-2" aria-label="Delivery and financial details">
              <Card className="h-full bg-[#FAF9F6] p-5 shadow-none hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#A2574F]" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#181716]">Destination</h3>
                </div>
                <address className="mt-4 text-sm not-italic leading-6 text-[#63605A]">
                  <p className="font-medium text-[#181716]">
                    {activeOrder.customer.firstName} {activeOrder.customer.lastName}
                  </p>
                  <p>
                    {activeOrder.customer.addressLine1}
                    {activeOrder.customer.addressLine2 ? `, ${activeOrder.customer.addressLine2}` : ''}
                  </p>
                  <p>
                    {activeOrder.customer.city}
                    {activeOrder.customer.stateOrProvince ? `, ${activeOrder.customer.stateOrProvince}` : ''}
                    {activeOrder.customer.postalCode ? ` ${activeOrder.customer.postalCode}` : ''}
                  </p>
                  <p>{activeOrder.customer.country}</p>
                </address>
                <p className="mt-4 border-t border-[#E8E5DF] pt-3 text-xs text-[#827E77]">
                  Courier: {activeOrder.shippingMethod === 'express' ? 'Carbon-neutral priority air' : 'Standard land'}
                </p>
              </Card>

              <Card className="h-full bg-[#FAF9F6] p-5 shadow-none hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#A2574F]" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#181716]">Financial ledger (KES)</h3>
                </div>
                <dl className="mt-4 space-y-2.5 text-xs text-[#63605A]">
                  <div className="flex items-center justify-between gap-4">
                    <dt>Cart subtotal</dt>
                    <dd className="font-medium text-[#181716]">{formatPrice(activeOrder.subtotal)}</dd>
                  </div>
                  {activeOrder.discount && (
                    <div className="flex items-center justify-between gap-4 text-[#2E5A44]">
                      <dt>Privilege ({activeOrder.discount.code})</dt>
                      <dd className="font-medium">-{formatPrice(activeOrder.discount.amount)}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <dt>Shipping</dt>
                    <dd className="font-medium text-[#181716]">
                      {activeOrder.shippingCost === 0 ? 'Complimentary' : formatPrice(activeOrder.shippingCost)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>Kenya VAT (16%)</dt>
                    <dd className="font-medium text-[#181716]">{formatPrice(activeOrder.tax)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[#E8E5DF] pt-3 font-serif text-base font-semibold text-[#181716]">
                    <dt>Settled total</dt>
                    <dd>{formatPrice(activeOrder.total)}</dd>
                  </div>
                </dl>
              </Card>
            </section>
          </div>
        </Card>
      )}

      <div className="flex justify-center pt-2">
        <Button type="button" variant="outline" size="md" onClick={() => navigate('/shop')} className="gap-2">
          Return to collection
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionLoading) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingActionIsCancellation ? 'Cancel this order?' : 'Confirm receipt'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingActionIsCancellation
                ? `Cancelling ${pendingAction?.orderNumber} will return the reserved MODEZA stock.`
                : `Confirm that you have received ${pendingAction?.orderNumber}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              aria-busy={actionLoading}
              className={pendingActionIsCancellation ? 'bg-[#9E332B] hover:bg-[#8B2A24]' : undefined}
              onClick={() => void handleConfirmAction()}
            >
              {actionLoading ? 'Updating…' : pendingActionIsCancellation ? 'Cancel order' : 'Confirm receipt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
