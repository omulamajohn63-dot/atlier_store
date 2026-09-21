import React, { useState } from 'react';
import { useOrders } from '../context/OrdersContext';
import { useRouter } from '../router/RouterContext';
import { Order, OrderStatus } from '../types';
import { formatPrice } from '../utils/currency';
import { Button } from '../components/ui/Button';
import { api } from '../services/apiClient';
import {
  Search,
  PackageCheck,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { canCancel, canMarkReceived } from '../utils/orderStatus';

export interface OrderTrackingPageProps {
  orderNumber?: string;
}

export const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orderNumber: propOrderNum }) => {
  const { getOrder, cancelOrder, receiveOrder } = useOrders();
  const { navigate } = useRouter();

  const initialCode = propOrderNum || 'ATL-KES-849201';

  // Pre-fill with order number from prop or demo
  const [searchQuery, setSearchQuery] = useState(initialCode);
  const [activeOrder, setActiveOrder] = useState<Order | null>(() => getOrder(initialCode) || null);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Update if propOrderNum changes
  React.useEffect(() => {
    if (propOrderNum) {
      setSearchQuery(propOrderNum);
      const found = getOrder(propOrderNum);
      if (found) {
        setActiveOrder(found);
        setErrorMsg('');
      }
    }
  }, [propOrderNum, getOrder]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setActionSuccessMsg('');

    const cleanQuery = searchQuery.trim();
    const found = getOrder(cleanQuery);
    if (found) {
      setActiveOrder(found);
      return;
    }

    // Query authoritative backend API
    try {
      const serverOrder = await api.getOrder(cleanQuery);
      const mapped: Order = {
        id: serverOrder.id,
        orderNumber: serverOrder.orderNumber,
        customer: {
          firstName: serverOrder.customer.fullName.split(' ')[0] || serverOrder.customer.fullName,
          lastName: serverOrder.customer.fullName.split(' ').slice(1).join(' ') || '',
          email: serverOrder.customer.email,
          phone: serverOrder.customer.phone,
          addressLine1: serverOrder.customer.addressLine1,
          addressLine2: serverOrder.customer.addressLine2,
          city: serverOrder.customer.city,
          stateOrProvince: serverOrder.customer.county,
          postalCode: serverOrder.customer.postalCode || '',
          country: 'Kenya',
        },
        items: serverOrder.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          variantId: i.variantId,
          productName: i.productName,
          variantDetails: `${i.variantSize || ''} ${i.variantColor || ''}`.trim(),
          sku: i.variantSku,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          subtotal: i.lineTotal,
          image: i.imageUrl || '',
        })),
        subtotal: serverOrder.subtotal,
        shippingMethod: serverOrder.shippingMethod,
        shippingCost: serverOrder.shippingCost,
        tax: serverOrder.tax,
        total: serverOrder.total,
        status: serverOrder.status,
        paymentStatus: serverOrder.paymentStatus,
        notes: serverOrder.customer.deliveryInstructions,
        timeline: [
          {
            status: 'confirmed',
            title: 'Order Confirmed & Authorized',
            description: 'Order registered in authoritative modeza database.',
            timestamp: serverOrder.createdAt,
            completed: true,
          },
          {
            status: 'processing',
            title: 'MODEZA Preparation',
            description: 'Garments passed artisan inspection.',
            timestamp: serverOrder.updatedAt,
            completed: serverOrder.status !== 'pending',
          },
        ],
        createdAt: serverOrder.createdAt,
        updatedAt: serverOrder.updatedAt,
      };
      setActiveOrder(mapped);
    } catch {
      setActiveOrder(null);
      setErrorMsg(`No record found for order "${searchQuery}". Please check reference code or contact concierge.`);
    }
  };

  const handleCancel = async (orderNum: string) => {
    if (!window.confirm(`Are you sure you wish to cancel order ${orderNum}? Reserved modeza stock will be returned.`)) {
      return;
    }
    setActionSuccessMsg('');
    setErrorMsg('');
    const result = await cancelOrder(orderNum);
    if (result.success && result.order) {
      setActionSuccessMsg(result.message);
      setActiveOrder(result.order);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleReceive = async (orderNum: string) => {
    if (!window.confirm(`Confirm that you received order ${orderNum}?`)) {
      return;
    }
    setActionSuccessMsg('');
    setErrorMsg('');
    const result = await receiveOrder(orderNum);
    if (result.success && result.order) {
      setActionSuccessMsg(result.message);
      setActiveOrder(result.order);
    } else {
      setErrorMsg(result.message);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#E8EFEA] text-[#2E5A44]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmed</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F5EFEB] text-[#8A745C]">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>MODEZA Preparation</span>
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#E8F0FE] text-[#1A73E8]">
            <Truck className="w-3.5 h-3.5" />
            <span>Courier Dispatch</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#E8EFEA] text-[#2E5A44]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered</span>
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#E8EFEA] text-[#2E5A44]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Received</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FDE8E8] text-[#9B1C1C]">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled & Restocked</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F3F1ED] text-[#63605A]">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
      {/* Editorial Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <span className="text-[11px] uppercase tracking-widest text-[#8A745C] font-semibold">
          Client Services &bull; Order Tracking
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#181716] font-normal tracking-tight">
          Track Your MODEZA Order
        </h1>
        <p className="text-sm text-[#63605A] leading-relaxed">
          Monitor your garment's journey from artisan cutting in Porto to carbon-neutral courier handover.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl p-5 sm:p-6 shadow-xs max-w-2xl mx-auto">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#827E77]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter reference code (e.g. ATL-KES-849201)"
              className="w-full bg-[#FAF9F6] border border-[#E8E5DF] rounded-2xl pl-11 pr-4 py-3 text-xs tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-1 focus:ring-[#8A745C]"
            />
          </div>
          <Button type="submit" variant="primary" size="md" className="uppercase tracking-wider text-xs px-6">
            Locate Order
          </Button>
        </form>

        <div className="mt-3 flex items-center justify-between text-[11px] text-[#827E77] px-1">
          <span>Demo Tracking Reference: <strong className="text-[#181716]">ATL-KES-849201</strong></span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('ATL-KES-849201');
              const found = getOrder('ATL-KES-849201');
              if (found) setActiveOrder(found);
            }}
            className="text-[#8A745C] hover:underline"
          >
            Load Sample
          </button>
        </div>
      </div>

      {/* Error / Alert */}
      {errorMsg && (
        <div className="p-4 bg-[#FDF2F2] border border-[#F8B4B4] rounded-2xl text-xs text-[#9B1C1C] flex items-center gap-2.5 max-w-2xl mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="p-4 bg-[#EDF7ED] border border-[#B7EB8F] rounded-2xl text-xs text-[#1E4620] flex items-center gap-2.5 max-w-2xl mx-auto">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Order Results View */}
      {activeOrder && (
        <div className="space-y-8 bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl p-6 sm:p-10 shadow-xs">
          {/* Header Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F1ED] pb-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-medium text-lg text-[#181716]">
                  {activeOrder.orderNumber}
                </span>
                {getStatusBadge(activeOrder.status)}
              </div>
              <span className="text-xs text-[#827E77] mt-1 block">
                Placed on {new Date(activeOrder.createdAt).toLocaleDateString('en-KE', { dateStyle: 'long' })} &bull; Payment:{' '}
                <span className="capitalize font-medium text-[#181716]">{activeOrder.paymentStatus}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {canCancel(activeOrder.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCancel(activeOrder.orderNumber)}
                  className="text-xs text-[#9B1C1C] hover:bg-[#FDF2F2] border-[#F8B4B4]"
                >
                  Cancel & Restock
                </Button>
              )}
              {canMarkReceived(activeOrder.status, activeOrder.paymentMethod) && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleReceive(activeOrder.orderNumber)}
                  className="text-xs"
                >
                  Mark as Received
                </Button>
              )}
            </div>
          </div>

          {/* Timeline Milestones */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-[#181716] uppercase tracking-wider">
              MODEZA Progress Timeline
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
              {activeOrder.timeline.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    step.completed
                      ? 'bg-[#FAF9F6] border-[#8A745C]/40 text-[#181716]'
                      : 'bg-[#FFFFFF] border-[#E8E5DF] text-[#A29E96]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#8A745C]" />
                    ) : (
                      <Clock className="w-4 h-4 text-[#A29E96]" />
                    )}
                    <span className="font-medium text-xs text-[#181716]">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#63605A]">{step.description}</p>
                  {step.timestamp && (
                    <span className="text-[10px] text-[#827E77] mt-2 block font-mono">
                      {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Purchased Pieces Grid */}
          <div className="space-y-4 border-t border-[#F3F1ED] pt-6">
            <h3 className="text-xs font-semibold text-[#181716] uppercase tracking-wider">
              Items in Parcel ({activeOrder.items.reduce((s, i) => s + i.quantity, 0)})
            </h3>
            <div className="divide-y divide-[#F3F1ED]">
              {activeOrder.items.map((item) => (
                <div key={item.id} className="py-4 flex items-center justify-between gap-x-4 gap-y-3 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={item.image}
                      alt={item.productName}
                      referrerPolicy="no-referrer"
                      className="w-16 h-20 object-cover rounded-xl bg-[#EFECE6] shrink-0"
                    />
                    <div>
                      <h4 className="font-serif text-sm text-[#181716]">{item.productName}</h4>
                      <p className="text-xs text-[#827E77]">{item.variantDetails}</p>
                      <span className="text-[10px] font-mono text-[#A29E96]">SKU: {item.sku}</span>
                      <p className="text-xs text-[#63605A] mt-1">
                        Qty: {item.quantity} &times; {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                  <span className="font-medium text-sm text-[#181716]">
                    {formatPrice(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery & Financial Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[#F3F1ED] pt-6 text-xs">
            <div className="space-y-2 bg-[#FAF9F6] p-5 rounded-2xl border border-[#E8E5DF]">
              <div className="flex items-center gap-1.5 font-semibold text-[#181716] mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#8A745C]" />
                <span>Destination Coordinates</span>
              </div>
              <p className="text-[#181716] font-medium">
                {activeOrder.customer.firstName} {activeOrder.customer.lastName}
              </p>
              <p className="text-[#63605A]">
                {activeOrder.customer.addressLine1}
                {activeOrder.customer.addressLine2 ? `, ${activeOrder.customer.addressLine2}` : ''}
              </p>
              <p className="text-[#63605A]">
                {activeOrder.customer.city}, {activeOrder.customer.stateOrProvince} {activeOrder.customer.postalCode},{' '}
                {activeOrder.customer.country}
              </p>
              <p className="text-[#827E77] pt-1">
                Courier: {activeOrder.shippingMethod === 'express' ? 'Carbon-Neutral Priority Air' : 'Standard Land'}
              </p>
            </div>

            <div className="space-y-2 bg-[#FAF9F6] p-5 rounded-2xl border border-[#E8E5DF]">
              <div className="flex items-center gap-1.5 font-semibold text-[#181716] mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#8A745C]" />
                <span>Financial Ledger (KES)</span>
              </div>
              <div className="flex justify-between text-[#63605A]">
                <span>Cart Subtotal</span>
                <span className="text-[#181716]">{formatPrice(activeOrder.subtotal)}</span>
              </div>
              {activeOrder.discount && (
                <div className="flex justify-between text-[#2E5A44]">
                  <span>Privilege ({activeOrder.discount.code})</span>
                  <span>-{formatPrice(activeOrder.discount.amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#63605A]">
                <span>Shipping</span>
                <span className="text-[#181716]">
                  {activeOrder.shippingCost === 0 ? 'Complimentary' : formatPrice(activeOrder.shippingCost)}
                </span>
              </div>
              <div className="flex justify-between text-[#63605A]">
                <span>Kenya VAT (16%)</span>
                <span className="text-[#181716]">{formatPrice(activeOrder.tax)}</span>
              </div>
              <div className="flex justify-between font-serif text-sm font-semibold text-[#181716] pt-2 border-t border-[#E8E5DF]">
                <span>Settled Total</span>
                <span>{formatPrice(activeOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back to Shop link */}
      <div className="text-center pt-4">
        <Button variant="outline" size="md" onClick={() => navigate('/shop')} className="gap-2 text-xs">
          <span>Return to Collection</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
