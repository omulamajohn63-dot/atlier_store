import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiClient';
import { CustomerNotification } from '../types';
import { AccountPageHeader } from '../components/account/AccountPageHeader';

type Filter = 'all' | 'unread';

export const AccountNotificationsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { markAsRead, markAllAsRead } = useNotifications();
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let active = true;
    if (isAuthLoading) return () => { active = false; };
    if (!user) {
      setItems([]);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    api
      .getNotifications(500)
      .then((response) => {
        if (active) setItems(response.results || []);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthLoading, user]);

  const visible = filter === 'unread' ? items.filter((item) => !item.isRead) : items;
  const unreadCount = items.filter((item) => !item.isRead).length;

  const handleMarkAll = async () => {
    await markAllAsRead();
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
  };

  const handleOpen = (notification: CustomerNotification) => {
    if (!notification.isRead) {
      void markAsRead(notification.id);
      setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <section className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AccountPageHeader
          eyebrow="Account"
          title="Notifications"
          description="Alerts about your orders, payments and boutique account."
        />
        {unreadCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DF] bg-[#FAF9F6] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#63605A]">
            <span className="h-2 w-2 rounded-full bg-[#A2574F]" aria-hidden="true" />
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-[#E8E5DF] bg-[#FAF9F6] p-1">
          {(['all', 'unread'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                filter === f ? 'bg-[#A2574F] text-[#FAF9F6] shadow-xs' : 'text-[#63605A] hover:text-[#181716]'
              }`}
            >
              {f === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DF] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A2574F] transition-colors hover:border-[#D8D3CB] hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading notifications">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl border border-[#E8E5DF] bg-white">
                <div className="mx-5 mt-5 h-3 skeleton rounded w-24" />
                <div className="mx-5 mt-3 h-3 skeleton rounded w-2/3" />
              </div>
            ))}
            <span className="sr-only">Loading notifications</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-[#E8E5DF] bg-white px-6 py-14 text-center">
            <Inbox className="mx-auto h-8 w-8 text-[#C7BDAB]" strokeWidth={1.5} aria-hidden="true" />
            <p className="mt-3 font-serif text-xl text-[#181716]">
              {filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-[#63605A]">
              {filter === 'unread'
                ? 'No unread notifications right now.'
                : 'Order and account updates will appear here.'}
            </p>
          </div>
        ) : (
          visible.map((notification) => (
            <button
              type="button"
              key={notification.id}
              onClick={() => handleOpen(notification)}
              className={`flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
                notification.isRead
                  ? 'border-[#E8E5DF] bg-white hover:border-[#D8D3CB]'
                  : 'border-[#D8C7A6] bg-[#FFFDF8] hover:border-[#C7BDAB]'
              }`}
            >
              <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FAF9F6] ring-1 ring-[#E8E5DF]">
                <Bell className={`h-3 w-3 ${notification.isRead ? 'text-[#A29E96]' : 'text-[#A2574F]'}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                      {notification.category}
                    </p>
                    <p className="mt-0.5 font-medium text-[#181716]">{notification.title}</p>
                  </div>
                  {!notification.isRead && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#A2574F]" aria-hidden="true" />
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#63605A]">{notification.message}</p>
                <p className="mt-2.5 text-[11px] text-[#A29E96]">
                  {new Date(notification.createdAt).toLocaleString('en-KE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
};