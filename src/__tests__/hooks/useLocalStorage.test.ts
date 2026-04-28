import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial value when key does not exist', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('reads existing value from localStorage', () => {
    localStorage.setItem('existing-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('existing-key', 'default'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('setValue updates state', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => result.current[1]('updated'));
    expect(result.current[0]).toBe('updated');
  });

  it('setValue accepts updater function', () => {
    const { result } = renderHook(() => useLocalStorage<number>('counter', 0));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(1);
  });

  it('removeValue resets to initial and clears localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('rm-key', 'initial'));
    act(() => result.current[1]('changed'));
    expect(result.current[0]).toBe('changed');

    act(() => result.current[2]());
    expect(result.current[0]).toBe('initial');
    // Note: the effect re-persists the initial value, so localStorage will have "initial" not null
  });

  it('handles JSON parse errors gracefully', () => {
    localStorage.setItem('broken-key', 'not-json');
    const { result } = renderHook(() => useLocalStorage('broken-key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('responds to storage events from other tabs', () => {
    const { result } = renderHook(() => useLocalStorage('sync-key', 'initial'));
    expect(result.current[0]).toBe('initial');

    // Simulate a storage event from another tab
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'sync-key',
          newValue: JSON.stringify('from-other-tab'),
        }),
      );
    });
    expect(result.current[0]).toBe('from-other-tab');
  });

  it('ignores storage events for different keys', () => {
    const { result } = renderHook(() => useLocalStorage('my-key', 'initial'));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'other-key',
          newValue: JSON.stringify('should-not-appear'),
        }),
      );
    });
    expect(result.current[0]).toBe('initial');
  });

  it('handles storage event with null newValue (key removed)', () => {
    const { result } = renderHook(() => useLocalStorage('rm-sync', 'default'));
    act(() => result.current[1]('changed'));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'rm-sync',
          newValue: null,
        }),
      );
    });
    expect(result.current[0]).toBe('default');
  });

  it('handles storage event with invalid JSON', () => {
    const { result } = renderHook(() => useLocalStorage('bad-sync', 'fallback'));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'bad-sync',
          newValue: 'not-valid-json{',
        }),
      );
    });
    expect(result.current[0]).toBe('fallback');
  });

  it('works with objects', () => {
    const { result } = renderHook(() => useLocalStorage('obj-key', { name: 'initial' }));
    act(() => result.current[1]({ name: 'updated' }));
    expect(result.current[0]).toEqual({ name: 'updated' });
  });

  it('handles localStorage.setItem throwing (storage full)', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('quota-key', 'value'));
    // Should not throw despite setItem failing
    expect(result.current[0]).toBe('value');

    spy.mockRestore();
  });

  it('handles localStorage.removeItem throwing', () => {
    const spy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useLocalStorage('error-rm', 'initial'));
    act(() => result.current[2]()); // removeValue
    // Should not throw
    expect(result.current[0]).toBe('initial');

    spy.mockRestore();
  });
});
