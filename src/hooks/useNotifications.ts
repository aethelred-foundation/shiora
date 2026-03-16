'use client';

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useApp } from '@/contexts/AppContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type {
  Notification,
  NotificationType,
  NotificationPreferences,
} from '@/types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: NotificationPreferences = {
  desktop: false,
  sound: false,
  autoDismissMs: 5000,
  maxVisible: 5,
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const ALERTS_HISTORY_KEY = 'alerts-history';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseNotificationsReturn {
  /** Current list of active notifications. */
  notifications: Notification[];
  /** Number of unread notifications. */
  unreadCount: number;

  /** Add a notification to the queue. */
  add: (type: NotificationType, title: string, message: string) => void;
  /** Remove a specific notification by ID. */
  remove: (id: string) => void;
  /** Clear all notifications from the queue. */
  clearAll: () => void;

  /** Notification delivery preferences. */
  preferences: NotificationPreferences;
  /** Update notification preferences. */
  setPreferences: (prefs: Partial<NotificationPreferences>) => void;

  /** Request browser desktop notification permission. */
  requestDesktopPermission: () => Promise<NotificationPermission | null>;
  /** Whether desktop notifications are available and permitted. */
  desktopPermitted: boolean;

  /** Show a success notification (convenience). */
  success: (title: string, message: string) => void;
  /** Show an error notification (convenience). */
  error: (title: string, message: string) => void;
  /** Show a warning notification (convenience). */
  warning: (title: string, message: string) => void;
  /** Show an info notification (convenience). */
  info: (title: string, message: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications(): UseNotificationsReturn {
  const {
    notifications: contextNotifications,
    addNotification,
    removeNotification,
  } = useApp();

  const queryClient = useQueryClient();

  const [preferences, setPreferencesRaw] = useLocalStorage<NotificationPreferences>(
    'shiora_notification_prefs',
    DEFAULT_PREFERENCES,
  );

  // ---- Fetch alert history from the API ----------------------------------

  const alertsQuery = useQuery({
    queryKey: [ALERTS_HISTORY_KEY],
    queryFn: () => api.get<Notification[]>('/api/alerts/history'),
    staleTime: 30_000,
  });

  // Merge server-side alert history with client-side context notifications
  const notifications = useMemo(() => {
    const serverAlerts = alertsQuery.data ?? [];
    const contextIds = new Set((contextNotifications as Notification[]).map((n) => n.id));
    // Avoid duplicates: prefer context notifications, append server ones that are new
    const merged = [
      ...(contextNotifications as Notification[]),
      ...serverAlerts.filter((a) => !contextIds.has(a.id)),
    ];
    return merged;
  }, [contextNotifications, alertsQuery.data]);

  // ---- Desktop permission state ------------------------------------------

  const desktopPermittedRef = useRef(false);

  useEffect(() => {
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return;
    if ('Notification' in window) {
      desktopPermittedRef.current = Notification.permission === 'granted';
    }
  }, []);

  const desktopPermitted = useMemo(() => {
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    return window.Notification.permission === 'granted';
  }, []);

  // ---- Desktop notification trigger --------------------------------------

  const showDesktopNotification = useCallback(
    (title: string, message: string) => {
      /* istanbul ignore next -- SSR guard, untestable in JSDOM */
      if (typeof window === 'undefined') return;
      if (!preferences.desktop) return;
      if (!('Notification' in window)) return;
      if (window.Notification.permission !== 'granted') return;

      try {
        new window.Notification(title, {
          body: message,
          icon: '/favicon.ico',
          tag: 'shiora-notification',
        });
      } catch {
        // Service worker may be required on some platforms — fail silently.
      }
    },
    [preferences.desktop],
  );

  // ---- Sound playback ----------------------------------------------------

  const playSound = useCallback(() => {
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return;
    if (!preferences.sound) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gain.gain.value = 0.1;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio context may not be available — fail silently.
    }
  }, [preferences.sound]);

  // ---- Core notification helpers -----------------------------------------

  const add = useCallback(
    (type: NotificationType, title: string, message: string) => {
      addNotification(type, title, message);
      showDesktopNotification(title, message);
      playSound();
    },
    [addNotification, showDesktopNotification, playSound],
  );

  const remove = useCallback(
    (id: string) => {
      removeNotification(id);
    },
    [removeNotification],
  );

  const clearAll = useCallback(() => {
    (contextNotifications as Notification[]).forEach((n) => removeNotification(n.id));
    // Also invalidate server cache so re-fetch reflects cleared state
    queryClient.invalidateQueries({ queryKey: [ALERTS_HISTORY_KEY] });
  }, [contextNotifications, removeNotification, queryClient]);

  // ---- Computed values ---------------------------------------------------

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (n) => !(n as unknown as Record<string, unknown>).read,
      ).length,
    [notifications],
  );

  // ---- Preferences -------------------------------------------------------

  const setPreferences = useCallback(
    (prefs: Partial<NotificationPreferences>) => {
      setPreferencesRaw((prev) => ({ ...prev, ...prefs }));
    },
    [setPreferencesRaw],
  );

  // ---- Desktop permission request ----------------------------------------

  const requestDesktopPermission = useCallback(async (): Promise<NotificationPermission | null> => {
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return null;
    if (!('Notification' in window)) return null;
    try {
      const permission = await window.Notification.requestPermission();
      if (permission === 'granted') {
        setPreferences({ desktop: true });
      }
      return permission;
    } catch {
      return null;
    }
  }, [setPreferences]);

  // ---- Convenience methods -----------------------------------------------

  const success = useCallback(
    (title: string, message: string) => add('success', title, message),
    [add],
  );
  const error = useCallback(
    (title: string, message: string) => add('error', title, message),
    [add],
  );
  const warning = useCallback(
    (title: string, message: string) => add('warning', title, message),
    [add],
  );
  const info = useCallback(
    (title: string, message: string) => add('info', title, message),
    [add],
  );

  return {
    notifications,
    unreadCount,
    add,
    remove,
    clearAll,
    preferences,
    setPreferences,
    requestDesktopPermission,
    desktopPermitted,
    success,
    error,
    warning,
    info,
  };
}
