import React, { useState, useEffect } from 'react';
import { useRouter } from '../router/RouterContext';
import { useOrders } from '../context/OrdersContext';
import { Button } from '../components/ui/Button';
import { formatPrice } from '../utils/currency';
import { CheckCircle2, PackageCheck, ArrowRight, Printer, Mail, MapPin, Eye } from 'lucide-react';
import { api } from '../services/apiClient';
import { Order } from '../types';

export interface OrderSuccessPageProps {
  orderNumber?: string;
}

export const OrderSuccessPage: React.FC<OrderSuccessPageProps> = ({ orderNumber }) => {
  const { navigate } = useRouter();
  const { getOrder, orders } = useOrders();

  const [order, setOrder] = useState<Order | null>(() => {
    if (orderNumber) {
      return getOrder(orderNumber) || null;
    }
    return orders[0] || null;
  });

  useEffect(() => {
    if (orderNumber && !order) {
      const found = getOrder(orderNumber);
      if (found) {
        setOrder(found);
      } else {
        api.getOrder(orderNumber).then((serverOrder) => {
          setOrder({
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
            timeline: [],
            createdAt: serverOrder.createdAt,
            updatedAt: serverOrder.updatedAt,
          });
        }).catch(() => {
          // ignore
        });
      }
    }
  }, [orderNumber, order, getOrder]);

  const resolvedOrder = order;
  const refCode = resolvedOrder ? resolvedOrder.orderNumber : (orderNumber || '');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center space-y-8">
      {/* Visual confirmation badge */}
      <div className="w-20 h-20 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] flex items-center justify-center mx-auto text-[#2E5A44] shadow-xs">
        <CheckCircle2 className="w-10 h-10 stroke-[1.5]" />
      </div>

      <div className="space-y-3">
        <span className="text-xs uppercase tracking-widest text-[#8A745C] font-semibold">
          Order Confirmation &bull; {refCode}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#181716] font-normal tracking-tight">
          Thank you. Your order has been placed.
        </h1>
        <p className="text-sm text-[#63605A] max-w-lg mx-auto leading-relaxed">
          An email receipt with full tracking credentials and modeza preparation notes has been sent
          to <span className="font-medium text-[#181716]">{resolvedOrder ? resolvedOrder.customer.email : 'your address'}</span>.
        </p>
      </div>

      {/* Order Status Box */}
      <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl p-6 sm:p-8 text-left space-y-6 shadow-xs max-w-xl mx-auto">
        <div className="flex items-center justify-between border-b border-[#F3F1ED] pb-4">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#827E77] block">
              Reference Code
            </span>
            <span className="font-mono font-medium text-sm text-[#181716]">{refCode}</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-[#827E77] block">
              Status
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8EFEA] text-[#2E5A44]">
              <PackageCheck className="w-3.5 h-3.5" />
              <span className="capitalize">{resolvedOrder ? resolvedOrder.status : 'Preparing in MODEZA'}</span>
            </span>
          </div>
        </div>

        {resolvedOrder && (
          <div className="space-y-3">
            <span className="text-[11px] uppercase tracking-wider text-[#827E77] block">
              Reserved MODEZA Pieces ({resolvedOrder.items.reduce((s, i) => s + i.quantity, 0)})
            </span>
            <div className="divide-y divide-[#F3F1ED]">
              {resolvedOrder.items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.productName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-12 object-cover rounded-lg bg-[#EFECE6]"
                    />
                    <div>
                      <p className="font-medium text-[#181716]">{item.productName}</p>
                      <p className="text-[#827E77]">{item.variantDetails}</p>
                    </div>
                  </div>
                  <span className="font-medium text-[#181716]">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#F3F1ED] text-xs">
              <span className="font-medium text-[#63605A]">Total Settled</span>
              <span className="font-serif font-semibold text-sm text-[#181716]">
                {formatPrice(resolvedOrder.total)}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-xs text-[#63605A] border-t border-[#F3F1ED] pt-4">
          <div>
            <span className="font-medium text-[#181716] block mb-0.5">Estimated Dispatch</span>
            <span>2 business days (Express Courier)</span>
          </div>
          <div>
            <span className="font-medium text-[#181716] block mb-0.5">Destination</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#8A745C] shrink-0" />
              <span className="truncate">
                {resolvedOrder ? `${resolvedOrder.customer.city}, ${resolvedOrder.customer.country}` : 'Nairobi, Kenya'}
              </span>
            </span>
          </div>
        </div>

        <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#E8E5DF] flex items-center gap-3 text-xs text-[#63605A]">
          <Mail className="w-4 h-4 text-[#8A745C] shrink-0" />
          <span>
            You will receive SMS and email notifications when courier collection is confirmed.
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate(`/track?order=${encodeURIComponent(refCode)}`)}
          className="gap-2 uppercase tracking-wider text-xs"
        >
          <Eye className="w-4 h-4" />
          <span>Live Order Tracking</span>
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={() => navigate('/shop')}
          className="gap-2 uppercase tracking-wider text-xs"
        >
          <span>Continue Exploring</span>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={() => window.print()}
          className="gap-2 text-xs"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Receipt</span>
        </Button>
      </div>
    </div>
  );
};

