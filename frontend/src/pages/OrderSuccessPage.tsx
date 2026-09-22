import React, { useCallback, useState, useEffect } from 'react';
import { useRouter } from '../router/RouterContext';
import { useOrders } from '../context/OrdersContext';
import { Button } from '../components/ui/Button';
import { formatPrice } from '../utils/currency';
import { CheckCircle2, PackageCheck, ArrowRight, Printer, Download, Mail, MapPin, Eye } from 'lucide-react';
import { api } from '../services/apiClient';
import { Order } from '../types';
import { ReceiptDTO } from '../types/api';
import { mapServerOrder } from '../utils/orderMapper';

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
  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptUnavailable, setReceiptUnavailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    if (!orderNumber) return;

    const cachedOrder = getOrder(orderNumber);
    if (cachedOrder) {
      setOrder(cachedOrder);
    }

    api
      .getOrder(orderNumber)
      .then((serverOrder) => {
        setOrder(mapServerOrder(serverOrder));
      })
      .catch(() => {
        // Keep the cached order visible if the authoritative refresh is unavailable.
      });
  }, [orderNumber, getOrder]);

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
      <div className="w-full max-w-2xl mx-auto space-y-5 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(`/track?order=${encodeURIComponent(refCode)}`)}
            className="w-full gap-2 uppercase tracking-wider text-xs"
          >
            <Eye className="w-4 h-4" />
            <span>Live Order Tracking</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/shop')}
            className="w-full gap-2 uppercase tracking-wider text-xs"
          >
            <span>Continue Exploring</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="border-t border-[#E8E5DF] pt-5">
          <div className="mb-3 flex items-center justify-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#827E77]">
            <span className="h-px w-8 bg-[#E8E5DF]" aria-hidden="true" />
            <span>Official receipt</span>
            <span className="h-px w-8 bg-[#E8E5DF]" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {receiptLoading ? (
              <Button variant="outline" size="lg" disabled className="w-full gap-2 text-xs" aria-busy="true">
                <Download className="w-3.5 h-3.5" />
                <span>Checking receipt…</span>
              </Button>
            ) : receipt ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => void handleDownloadReceipt()}
                disabled={downloading}
                className="w-full gap-2 text-xs uppercase tracking-wider"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloading ? 'Downloading…' : 'Download Receipt (PDF)'}</span>
              </Button>
            ) : (
              <Button variant="outline" size="lg" disabled className="w-full gap-2 text-xs">
                <Download className="w-3.5 h-3.5" />
                <span>Receipt unavailable</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (receipt) {
                  void handleOpenReceipt();
                } else if (receiptUnavailable) {
                  window.print();
                }
              }}
              disabled={downloading || receiptLoading || (!receipt && !receiptUnavailable)}
              className="w-full gap-2 text-xs uppercase tracking-wider"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </Button>
          </div>
        </div>
      </div>

      {receiptError && (
        <p role="alert" className="pt-2 text-xs text-[#9B1C1C]">
          {receiptError}
        </p>
      )}
    </div>
  );
};

