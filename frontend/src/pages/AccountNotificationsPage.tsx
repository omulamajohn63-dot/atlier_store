import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiClient';
import { CustomerNotification } from '../types';
import { AccountPageHeader } from '../components/account/AccountPageHeader';
import { Button } from '../components/modeza/Button';
import { Badge } from '../components/modeza/Badge';
import { Card } from '../components/modeza/Card';
import { Progress } from '../components/modeza/Progress';
import { Tabs, TabsList, TabsTrigger } from '../components/modeza/Tabs';

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AccountPageHeader
          eyebrow="Account"
          title="Notifications"
          description="Alerts about your orders, payments and boutique account."
        />
        {unreadCount > 0 ? (
          <Badge variant="new" size="lg" className="w-fit gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/80" aria-hidden="true" />
            {unreadCount} unread
          </Badge>
        ) : (
          <Badge variant="success" size="lg" className="w-fit gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            All caught up
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value === 'unread' ? 'unread' : 'all')}
          className="w-full sm:w-auto"
        >
          <TabsList aria-label="Filter notifications" className="no-scrollbar flex w-full justify-start gap-1 overflow-x-auto sm:w-auto">
            <TabsTrigger value="all" className="shrink-0 gap-2">
              All
              <span className="text-[10px] opacity-70">{items.length}</span>
            </TabsTrigger>
            <TabsTrigger value="unread" className="shrink-0 gap-2">
              Unread
              <span className="text-[10px] opacity-70">{unreadCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {unreadCount > 0 && (
          <Button
            type="button"
            variant="modeza-outline"
            size="sm"
            onClick={() => void handleMarkAll()}
            className="w-full gap-1.5 sm:w-auto"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading notifications">
            <Card className="border-[#E8E5DF] p-5 sm:p-6" aria-busy="true">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-serif text-lg text-[#181716]">Loading notifications</p>
                  <p className="mt-1 text-xs text-[#827E77]">Checking for the latest MODEZA updates.</p>
                </div>
                <Badge variant="outline" size="sm">Syncing</Badge>
              </div>
              <Progress value={60} className="mt-5 h-1.5" aria-label="Loading notifications" />
            </Card>
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="border-[#E8E5DF] p-5 sm:p-6" aria-hidden="true">
                <div className="flex animate-pulse items-start gap-3.5">
                  <div className="skeleton h-6 w-6 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="skeleton h-2.5 w-24" />
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-3 w-full" />
                  </div>
                </div>
              </Card>
            ))}
            <span className="sr-only">Loading notifications</span>
          </div>
        ) : visible.length === 0 ? (
          <Card className="border-[#E8E5DF] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#E8E5DF] bg-[#FAF9F6] text-[#C7BDAB]">
              <Inbox className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <Badge variant="outline" size="sm" className="mt-5">
              {filter === 'unread' ? 'All caught up' : 'No updates yet'}
            </Badge>
            <h2 className="mt-4 font-serif text-2xl text-[#181716]">
              {filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#63605A]">
              {filter === 'unread'
                ? 'No unread notifications right now.'
                : 'Order and account updates will appear here.'}
            </p>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="notifications-results-heading" className="font-serif text-2xl text-[#181716]">
                {filter === 'unread' ? 'Unread updates' : 'Your updates'}
              </h2>
              <Badge variant="default" size="sm">{visible.length} {visible.length === 1 ? 'notification' : 'notifications'}</Badge>
            </div>
            <ul className="space-y-3" aria-labelledby="notifications-results-heading">
              {visible.map((notification) => (
                <li key={notification.id}>
                  <Card
                    className={`p-0 ${notification.isRead ? 'border-[#E8E5DF] bg-white' : 'border-[#D8C7A6] bg-[#FFFDF8]'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpen(notification)}
                      aria-label={`${notification.title}. ${notification.message}. ${notification.isRead ? 'Read' : 'Unread'}${notification.link ? '. Opens related details.' : ''}`}
                      className="flex w-full items-start gap-3.5 p-4 text-left transition-colors hover:bg-[#FAF9F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-inset sm:p-5"
                    >
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FAF9F6] text-[#A2574F] ring-1 ring-[#E8E5DF]">
                        <Bell className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#827E77]">
                              {notification.category}
                            </span>
                            <span className="mt-0.5 block font-medium text-[#181716]">{notification.title}</span>
                          </span>
                          <Badge variant={notification.isRead ? 'default' : 'new'} size="sm" className="shrink-0" aria-hidden="true">
                            {notification.isRead ? 'Read' : 'Unread'}
                          </Badge>
                        </span>
                        <span className="mt-1.5 block text-sm leading-relaxed text-[#63605A]">{notification.message}</span>
                        <time dateTime={notification.createdAt} className="mt-2.5 block text-[11px] text-[#A29E96]">
                          {new Date(notification.createdAt).toLocaleString('en-KE', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </time>
                      </span>
                    </button>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
};
