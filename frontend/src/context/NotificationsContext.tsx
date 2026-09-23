import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CustomerNotification, ToastMessage } from '../types';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from './AuthContext';
import { api } from '../services/apiClient';
import { supabase } from '../services/supabaseClient';

interface NotificationsContextValue {
  notifications: CustomerNotification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const previousIdsRef = useRef<string[]>([]);
  const pollingDisabledRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const refreshNotifications = useCallback(async () => {
    if (!user || pollingDisabledRef.current || refreshInFlightRef.current) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session?.access_token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const response = await api.getNotifications();
      setNotifications(response.results || []);
      setUnreadCount(typeof response.unread_count === 'number' ? response.unread_count : (response.results || []).filter((item) => !item.isRead).length);
    } catch (error) {
      setNotifications([]);
      setUnreadCount(0);
      if ((error as { status?: number }).status === 401) {
        pollingDisabledRef.current = true;
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      previousIdsRef.current = [];
      pollingDisabledRef.current = false;
      return;
    }

    void refreshNotifications();
    const timer = window.setInterval(() => {
      void refreshNotifications();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [refreshNotifications, user]);

  useEffect(() => {
    if (!user || notifications.length === 0) {
      previousIdsRef.current = notifications.map((item) => item.id);
      return;
    }

    const newUnread = notifications.filter((item) => !item.isRead && !previousIdsRef.current.includes(item.id));
    if (newUnread.length > 0) {
      setToasts((current) => {
        const nextToasts: ToastMessage[] = newUnread.slice(0, 3).map((item) => ({
          id: item.id,
          type: item.category === 'payment' ? 'success' : 'info',
          title: item.title,
          description: item.message,
        }));
        return [...nextToasts, ...current].slice(0, 4);
      });
    }

    previousIdsRef.current = notifications.map((item) => item.id);
  }, [notifications, user]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return undefined;

    const timers = toasts.map((toast) => window.setTimeout(() => dismissToast(toast.id), 5000));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const result = await api.markNotificationRead(notificationId);
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, isRead: true } : item));
      if (typeof result.unread_count === 'number') {
        setUnreadCount(result.unread_count);
      } else {
        setUnreadCount((current) => Math.max(current - 1, 0));
      }
    } catch {
      // ignore failed read-state updates for now
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
    } catch {
      // keep local state in sync even if the request fails
    }
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    setToasts([]);
  }, []);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      refreshNotifications,
      markAsRead,
      markAllAsRead,
    }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} onMarkAllRead={markAllAsRead} />
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextValue => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
