import React from 'react';
import { ArrowRight, Bell, CheckCheck, Heart, Package, PackageX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrdersContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationsContext';
import { useRouter } from '../router/RouterContext';
import { OrderStatusPill } from '../components/orders/OrderStatusPill';
import { OrderItemThumb } from '../components/orders/OrderItemThumb';
import { AccountPageHeader } from '../components/account/AccountPageHeader';
import { formatPrice } from '../utils/currency';
import { formatOrderDate } from '../utils/orderMapper';
import { isActiveOrder } from '../utils/orderStatus';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  hint?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, href, hint }) => {
  const { navigate } = useRouter();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="group rounded-2xl border border-[#E8E5DF] bg-white p-5 text-left shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D8D3CB] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF9F6] ring-1 ring-[#E8E5DF]">
          <span className="text-[#A2574F]">{icon}</span>
        </span>
      </div>
      <div className="mt-3 font-serif text-3xl leading-none text-[#181716]">
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A2574F] transition-colors group-hover:text-[#181716]">
        {hint ?? 'View'}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </button>
  );
};

export const AccountOverviewPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { wishlistCount } = useWishlist();
  const { notifications, unreadCount, markAsRead } = useNotifications();

  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0];
  const recentOrders = [...orders]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 3);
  const recentNotifications = notifications.slice(0, 3);
  const activeOrders = orders.filter((order) => isActiveOrder(order.status)).length;
  const receivedOrders = orders.filter((order) => order.status === 'received').length;
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled').length;

  return (
    <section className="w-full space-y-9">
      <AccountPageHeader
        eyebrow={greeting()}
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="A glance at your MODEZA — orders, wishlist and the latest from your boutique."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 md:grid-cols-3">
        <StatCard
          label="Active Orders"
          value={activeOrders}
          icon={<Package className="h-4 w-4" />}
          href="/account/orders"
          hint="View orders"
        />
        <StatCard
          label="Received"
          value={receivedOrders}
          icon={<CheckCheck className="h-4 w-4" />}
          href="/account/orders"
          hint="View orders"
        />
        <StatCard
          label="Cancelled"
          value={cancelledOrders}
          icon={<PackageX className="h-4 w-4" />}
          href="/account/orders"
          hint="View orders"
        />
        <StatCard
          label="Wishlist"
          value={wishlistCount}
          icon={<Heart className="h-4 w-4" />}
          href="/wishlist"
          hint="Browse list"
        />
        <StatCard
          label="Notifications"
          value={unreadCount}
          icon={<Bell className="h-4 w-4" />}
          href="/account/notifications"
          hint={unreadCount > 0 ? `${unreadCount} unread` : 'No unread'}
        />
      </div>

      <section className="rounded-2xl border border-[#E8E5DF] bg-white shadow-xs">
        <div className="flex items-center justify-between gap-4 border-b border-[#F3F1ED] px-6 py-5">
          <div>
            <h2 className="font-serif text-2xl tracking-tight text-[#181716]">Recent Orders</h2>
            <p className="mt-0.5 text-xs text-[#63605A]">Your latest pieces, at a glance.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/account/orders')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A2574F] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
          >
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-serif text-lg text-[#181716]">No orders yet</p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-[#63605A]">
              Your next favorite piece is waiting for you.
            </p>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#A2574F] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAF9F6] transition-colors hover:bg-[#83443D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[#F3F1ED]">
            {recentOrders.map((order) => {
              const thumb = order.items[0];
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/account/orders/${encodeURIComponent(order.orderNumber)}`)}
                    className="group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-[#FAF9F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A2574F] sm:gap-5 sm:px-6"
                  >
                    {thumb && (
                      <OrderItemThumb item={thumb} className="h-14 w-12 shrink-0 rounded-lg border border-[#E8E5DF] shadow-xs sm:h-20 sm:w-[4.5rem]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm font-semibold text-[#181716]">
                        {order.orderNumber}
                      </div>
                      <div className="mt-0.5 text-xs text-[#827E77]">
                        Placed {formatOrderDate(order.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }) || '—'}
                      </div>
                    </div>
                    <OrderStatusPill status={order.status} className="hidden sm:inline-flex" />
                    <span className="shrink-0 font-serif text-sm text-[#181716] sm:text-base">
                      {formatPrice(order.total)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#A29E96] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#E8E5DF] bg-white shadow-xs">
        <div className="flex items-center justify-between gap-4 border-b border-[#F3F1ED] px-6 py-5">
          <div>
            <h2 className="font-serif text-2xl tracking-tight text-[#181716]">Latest Notifications</h2>
            <p className="mt-0.5 text-xs text-[#63605A]">Order and account updates from the modeza.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/account/notifications')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A2574F] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
          >
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {recentNotifications.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Bell className="mx-auto h-8 w-8 text-[#C7BDAB]" strokeWidth={1.5} aria-hidden="true" />
            <p className="mt-3 font-serif text-lg text-[#181716]">You're all caught up</p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-[#63605A]">
              We'll let you know here the moment something happens.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F3F1ED]">
            {recentNotifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) void markAsRead(notification.id);
                    if (notification.link) navigate(notification.link);
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[#FAF9F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A2574F] sm:px-6 ${
                    notification.isRead ? 'bg-white' : 'bg-[#FFFDF8]'
                  }`}
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      notification.isRead ? 'bg-[#E8E5DF]' : 'bg-[#A2574F]'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                      {notification.category}
                    </p>
                    <p className="mt-0.5 font-medium text-[#181716]">{notification.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-[#63605A]">{notification.message}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#A29E96]">
                    {notification.createdAt
                      ? formatOrderDate(notification.createdAt, { day: 'numeric', month: 'short' })
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
};