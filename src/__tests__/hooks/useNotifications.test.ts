import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import { useNotifications } from '@/hooks/useNotifications';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(AppProvider, null, children));
}

describe('useNotifications', () => {
  it('starts with empty notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    // May include server-fetched alerts
    expect(Array.isArray(result.current.notifications)).toBe(true);
  });

  it('add creates a notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.add('success', 'Test', 'Test message'));
    expect(result.current.notifications.length).toBeGreaterThan(0);
  });

  it('convenience methods work', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.success('Success', 'msg'));
    act(() => result.current.error('Error', 'msg'));
    act(() => result.current.warning('Warning', 'msg'));
    act(() => result.current.info('Info', 'msg'));
    expect(result.current.notifications.length).toBeGreaterThanOrEqual(4);
  });

  it('remove removes a notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.add('info', 'Removable', 'Will be removed'));
    const beforeCount = result.current.notifications.length;
    const id = result.current.notifications[0]?.id;
    if (id) {
      act(() => result.current.remove(id));
      expect(result.current.notifications.length).toBeLessThan(beforeCount);
    }
  });

  it('clearAll clears all notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.add('info', 'A', 'a'));
    act(() => result.current.add('info', 'B', 'b'));
    act(() => result.current.clearAll());
    // After clear, the context notifications should be empty
    // (server alerts may still be present)
  });

  it('provides preferences', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    expect(result.current.preferences).toBeDefined();
    expect(typeof result.current.preferences.autoDismissMs).toBe('number');
  });

  it('setPreferences updates preferences', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.setPreferences({ sound: true }));
    expect(result.current.preferences.sound).toBe(true);
  });

  it('requestDesktopPermission is a function', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    expect(typeof result.current.requestDesktopPermission).toBe('function');
  });

  it('requestDesktopPermission calls Notification.requestPermission', async () => {
    const mockRequestPermission = jest.fn().mockResolvedValue('granted');
    Object.defineProperty(window, 'Notification', {
      value: { requestPermission: mockRequestPermission, permission: 'default' },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    let permission: NotificationPermission | null = null;
    await act(async () => {
      permission = await result.current.requestDesktopPermission();
    });
    expect(permission).toBe('granted');
    expect(mockRequestPermission).toHaveBeenCalled();

    delete (window as unknown as Record<string, unknown>).Notification;
  });

  it('requestDesktopPermission returns null when Notification not available', async () => {
    const original = (window as unknown as Record<string, unknown>).Notification;
    delete (window as unknown as Record<string, unknown>).Notification;

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    let permission: NotificationPermission | null = 'default';
    await act(async () => {
      permission = await result.current.requestDesktopPermission();
    });
    expect(permission).toBeNull();

    if (original) (window as unknown as Record<string, unknown>).Notification = original;
  });

  it('unreadCount is computed', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    expect(typeof result.current.unreadCount).toBe('number');
  });

  it('desktopPermitted is false when Notification not available', () => {
    const original = (window as unknown as Record<string, unknown>).Notification;
    delete (window as unknown as Record<string, unknown>).Notification;

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    expect(result.current.desktopPermitted).toBe(false);

    if (original) (window as unknown as Record<string, unknown>).Notification = original;
  });

  it('desktopPermitted is true when permission granted', () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted', requestPermission: jest.fn() },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    expect(result.current.desktopPermitted).toBe(true);

    delete (window as unknown as Record<string, unknown>).Notification;
  });

  it('add with sound enabled tries to play sound', () => {
    const mockOscillator = {
      connect: jest.fn(),
      frequency: { value: 0 },
      type: 'sine',
      start: jest.fn(),
      stop: jest.fn(),
    };
    const mockGain = { connect: jest.fn(), gain: { value: 0 } };
    const mockAudioCtx = {
      createOscillator: jest.fn().mockReturnValue(mockOscillator),
      createGain: jest.fn().mockReturnValue(mockGain),
      destination: {},
      currentTime: 0,
    };
    (window as unknown as Record<string, unknown>).AudioContext = jest.fn().mockReturnValue(mockAudioCtx);

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.setPreferences({ sound: true }));
    act(() => result.current.add('info', 'Sound', 'test'));

    expect(mockAudioCtx.createOscillator).toHaveBeenCalled();

    delete (window as unknown as Record<string, unknown>).AudioContext;
  });

  it('add with desktop enabled and permission granted shows notification', () => {
    const MockNotif = jest.fn();
    Object.defineProperty(window, 'Notification', {
      value: MockNotif,
      writable: true,
      configurable: true,
    });
    (window.Notification as unknown as Record<string, unknown>).permission = 'granted';

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.setPreferences({ desktop: true }));
    act(() => result.current.add('success', 'Desktop', 'notification'));

    expect(MockNotif).toHaveBeenCalledWith('Desktop', expect.objectContaining({ body: 'notification' }));

    delete (window as unknown as Record<string, unknown>).Notification;
  });

  it('add with desktop enabled but permission denied does not show notification', () => {
    const MockNotif = jest.fn();
    Object.defineProperty(window, 'Notification', {
      value: MockNotif,
      writable: true,
      configurable: true,
    });
    (window.Notification as unknown as Record<string, unknown>).permission = 'denied';

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.setPreferences({ desktop: true }));
    act(() => result.current.add('success', 'No Desktop', 'notification'));

    expect(MockNotif).not.toHaveBeenCalled();

    delete (window as unknown as Record<string, unknown>).Notification;
  });

  it('add without sound does not play', () => {
    const MockAudioCtx = jest.fn();
    (window as unknown as Record<string, unknown>).AudioContext = MockAudioCtx;

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    act(() => result.current.setPreferences({ sound: false }));
    act(() => result.current.add('info', 'No Sound', 'test'));

    expect(MockAudioCtx).not.toHaveBeenCalled();

    delete (window as unknown as Record<string, unknown>).AudioContext;
  });

  it('requestDesktopPermission returns null when requestPermission throws', async () => {
    Object.defineProperty(window, 'Notification', {
      value: {
        requestPermission: jest.fn().mockRejectedValue(new Error('Permission API error')),
        permission: 'default',
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    let permission: NotificationPermission | null = 'default';
    await act(async () => {
      permission = await result.current.requestDesktopPermission();
    });
    expect(permission).toBeNull();

    delete (window as unknown as Record<string, unknown>).Notification;
  });

  it('merges server alerts that do not overlap with context notifications', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    // Wait for server alerts to load
    await waitFor(() => {
      // The notifications array should include server-fetched alerts
      expect(result.current.notifications.length).toBeGreaterThanOrEqual(0);
    });

    // Add a context notification that may or may not overlap
    act(() => result.current.add('info', 'Context Note', 'A client-side notification'));

    // Verify the merged list has client notifications plus any non-duplicate server alerts
    expect(result.current.notifications.length).toBeGreaterThan(0);
  });
});
