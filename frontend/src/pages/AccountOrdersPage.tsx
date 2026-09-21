import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search, Truck, Check, X } from 'lucide-react';
import { useOrders } from '../context/OrdersContext';
import { useStore } from '../context/StoreContext';
import { useRouter } from '../router/RouterContext';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { OrdersListSkeleton } from '../components/ui/LoadingState';
import { OrderStatusPill } from '../components/orders/OrderStatusPill';
import { OrderProgress } from '../components/orders/OrderProgress';
import { OrderItemThumb } from '../components/orders/OrderItemThumb';
import { api } from '../services/apiClient';
import { Order, OrderItem } from '../types';
import { formatPrice } from '../utils/currency';
import {
  formatOrderDate,
  mapServerOrder,
  totalQuantity,
} from '../utils/orderMapper';
import {
  isActiveOrder,
  isTrackable,
  ORDER_STATUS_META,
  STATUS_FILTER_GROUPS,
} from '../utils/orderStatus';

interface OrderCardProps {
  order: Order;
}

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const { navigate } = useRouter();
  const { getProductById } = useStore();

  const totalItems = totalQuantity(order);
  const items = order.items;
  const visibleItems = items.slice(0, 4);
  const hiddenCount = items.length - visibleItems.length;
  const isActive = isActiveOrder(order.status);

  const formatPlaced = () =>
    formatOrderDate(order.createdAt, { day: 'numeric', month: 'long', year: 'numeric' });

  const completionTimestamp = useMemo(() => {
    if (order.status === 'delivered' || order.status === 'received') {
      const timelineTimestamp = order.timeline.find(
        (event) => event.status === 'delivered' || event.status === 'received'
      )?.timestamp;
      return timelineTimestamp || order.updatedAt;
    }
    if (order.status === 'cancelled') {
      const timelineTimestamp = order.timeline.find((event) => event.status === 'cancelled')?.timestamp;
      return timelineTimestamp || order.updatedAt;
    }
    return '';
  }, [order]);

  const openDetails = () => navigate(`/account/orders/${encodeURIComponent(order.orderNumber)}`);
  const openTrack = () => navigate(`/track?order=${encodeURIComponent(order.orderNumber)}`);

  const openProduct = (item: OrderItem) => {
    const product = item.productId ? getProductById(item.productId) : undefined;
    if (product) {
      navigate(`/product/${product.slug}`);
    } else {
      openDetails();
    }
  };

  return (
    <article className="rounded-2xl border border-[#E8E5DF] bg-white shadow-xs transition-shadow duration-300 hover:border-[#D8D3CB] hover:shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-[#F3F1ED] px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <a
              href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
              onClick={(event) => {
                event.preventDefault();
                openDetails();
              }}
              className="rounded-sm font-mono text-sm font-semibold tracking-tight text-[#181716] transition-colors hover:text-[#8A745C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] sm:text-base"
            >
              {order.orderNumber}
            </a>
            <OrderStatusPill status={order.status} />
          </div>
          <p className="mt-1.5 text-xs text-[#827E77]">Placed {formatPlaced()}</p>
        </div>
        <div className="min-w-0 sm:text-right">
          <div className="font-serif text-lg leading-none text-[#181716] sm:text-xl">
            {formatPrice(order.total)}
          </div>
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#827E77]">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      {/* Product thumbnails */}
      <div className="flex items-center gap-2.5 overflow-x-auto px-5 pt-5 no-scrollbar sm:gap-3 sm:px-6">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openProduct(item)}
            aria-label={`View ${item.productName}`}
            title={item.productName}
            className="h-16 w-14 overflow-hidden rounded-lg border border-[#E8E5DF] shadow-xs transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] sm:h-20 sm:w-[4.5rem] image-zoom"
          >
            <OrderItemThumb item={item} className="h-full w-full" />
          </button>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={openDetails}
            aria-label={`${hiddenCount} more ${hiddenCount === 1 ? 'item' : 'items'}`}
            className="flex h-16 w-14 flex-col items-center justify-center rounded-lg border border-[#E8E5DF] bg-[#EFECE6] text-[#181716] transition-colors hover:bg-[#E5E1D8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] sm:h-20 sm:w-[4.5rem]"
          >
            <span className="font-serif text-lg leading-none">+{hiddenCount}</span>
            <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#827E77]">
              more
            </span>
          </button>
        )}
      </div>

      {/* Status-specific presentation */}
      {order.status === 'cancelled' ? (
        <div className="mx-5 mt-5 flex items-center gap-2.5 rounded-xl border border-[#E8E5DF] bg-[#FAF9F6] px-4 py-3 sm:mx-6">
          <X className="h-3.5 w-3.5 shrink-0 text-[#827E77]" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-[#63605A]">
            Order cancelled
            {completionTimestamp ? (
              <span>
                {' '}
                on{' '}
                {formatOrderDate(completionTimestamp, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            ) : null}
            .
          </p>
        </div>
      ) : order.status === 'delivered' || order.status === 'received' ? (
        <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
          <Check className="h-3.5 w-3.5 shrink-0 text-[#2E5A44]" aria-hidden="true" />
          <p className="text-xs font-medium text-[#2E5A44]">
            {ORDER_STATUS_META[order.status].label}
            {completionTimestamp ? (
              <span>
                {' '}
                on{' '}
                {formatOrderDate(completionTimestamp, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            ) : null}
          </p>
        </div>
      ) : isActive ? (
        <div className="px-5 pt-5 sm:px-6">
          <OrderProgress order={order} />
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-col gap-2.5 border-t border-[#F3F1ED] px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        {isTrackable(order.status) && (
          <Button type="button" variant="outline" size="sm" onClick={openTrack} className="w-full justify-center gap-1.5 sm:w-auto">
            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            Track Order
          </Button>
        )}
        <Button type="button" variant="primary" size="sm" onClick={openDetails} className="w-full justify-center gap-1.5 sm:w-auto">
          View Order
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <span className="sr-only">
        {ORDER_STATUS_META[order.status].label} order, {totalItems}{' '}
        {totalItems === 1 ? 'item' : 'items'}, total {formatPrice(order.total)}.
      </span>
    </article>
  );
};

export const AccountOrdersPage: React.FC = () => {
  const { navigate } = useRouter();
  const { orders } = useOrders();

  const [hydratedOrders, setHydratedOrders] = useState<Order[] | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [filterKey, setFilterKey] = useState<string>('all');
  const [query, setQuery] = useState('');

  // Best-effort hydration from the existing GET /api/orders endpoint. Local
  // context orders always win (deduped by order number); server-only orders are
  // appended. Failures fall back silently to context data.
  const loadServerOrders = useCallback(async () => {
    setSyncStatus('loading');
    try {
      const response = await api.getOrders();
      setHydratedOrders(response.results.map(mapServerOrder));
      setSyncStatus('done');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadServerOrders();
  }, [loadServerOrders]);

  const mergedOrders = useMemo<Order[]>(() => {
    const seen = new Set<string>();
    const merged: Order[] = [];
    for (const order of [...orders, ...(hydratedOrders ?? [])]) {
      const key = order.orderNumber.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(order);
    }
    return merged;
  }, [orders, hydratedOrders]);

  const filterTabs = useMemo<{ key: string; label: string; count: number }[]>(() => {
    const statusTabs = STATUS_FILTER_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      count: mergedOrders.filter((order) => group.statuses.includes(order.status)).length,
    })).filter((tab) => tab.count > 0);
    return [{ key: 'all', label: 'All', count: mergedOrders.length }, ...statusTabs];
  }, [mergedOrders]);

  const visibleOrders = useMemo(() => {
    let list = mergedOrders;
    if (filterKey !== 'all') {
      const group = STATUS_FILTER_GROUPS.find((entry) => entry.key === filterKey);
      if (group) list = list.filter((order) => group.statuses.includes(order.status));
    }
    const trimmed = query.trim().toLowerCase();
    if (trimmed) {
      list = list.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(trimmed) ||
          order.items.some((item) => item.productName.toLowerCase().includes(trimmed))
      );
    }
    return [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [mergedOrders, filterKey, query]);

  const isLoading = syncStatus === 'loading' && mergedOrders.length === 0;
  const showError = syncStatus === 'error' && mergedOrders.length === 0;
  const hasNoOrders = mergedOrders.length === 0 && !showError;

  const clearFilters = () => {
    setQuery('');
    setFilterKey('all');
  };

  return (
    <section className="w-full">
      {/* Editorial header */}
      <header className="mb-8 space-y-2.5">
        <h1 className="font-serif text-3xl tracking-tight text-[#181716] sm:text-4xl">My Orders</h1>
        <p className="text-sm text-[#63605A]">Track your purchases and view your order history.</p>
      </header>

      {/* Status filters + search */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter orders by status">
          {filterTabs.map((tab) => {
            const selected = filterKey === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilterKey(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] ${
                  selected
                    ? 'border-[#181716] bg-[#181716] text-[#FAF9F6] shadow-xs'
                    : 'border-[#E8E5DF] bg-white text-[#63605A] hover:border-[#D8D3CB] hover:text-[#181716]'
                }`}
              >
                {tab.label}
                <span className={`${selected ? 'text-[#D8D3CB]' : 'text-[#A29E96]'}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#827E77]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders..."
            aria-label="Search orders by order number or product name"
            className="w-full rounded-full border border-[#E8E5DF] bg-white py-3 pl-11 pr-11 text-sm text-[#181716] shadow-xs outline-none transition-colors placeholder:text-[#A29E96] focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#827E77] transition-colors hover:bg-[#F3F1ED] hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {syncStatus === 'loading' && mergedOrders.length > 0 && (
          <p className="px-1 text-[11px] text-[#A29E96]" role="status">
            Refreshing orders from the modeza…
          </p>
        )}
      </div>

      {/* Results */}
      <div className="mt-7">
        {isLoading ? (
          <OrdersListSkeleton />
        ) : showError ? (
          <ErrorState
            variant="page"
            title="Something went wrong"
            message="We couldn't load your orders right now."
            onRetry={() => void loadServerOrders()}
          />
        ) : hasNoOrders ? (
          <div className="rounded-2xl border border-[#E8E5DF] bg-white">
            <EmptyState
              variant="page"
              title="No orders yet"
              description="Your next favorite piece is waiting for you."
              actionLabel="Start Shopping"
              onAction={() => navigate('/shop')}
            />
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-[#E8E5DF] bg-white px-6 py-14 text-center">
            <div className="font-serif text-xl text-[#181716]">No matching orders</div>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-[#63605A]">
              Try a different search or filter to find what you're looking for.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="mt-6 uppercase tracking-wider">
              Clear search and filters
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};