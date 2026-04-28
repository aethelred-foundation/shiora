import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'hello' },
    });

    rerender({ value: 'world' });
    expect(result.current).toBe('hello');

    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('world');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => jest.advanceTimersByTime(100));
    rerender({ value: 'c' });
    act(() => jest.advanceTimersByTime(100));
    rerender({ value: 'd' });

    // Only 200ms elapsed since last change, should still be 'a'
    expect(result.current).toBe('a');

    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('d');
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 'first' },
    });
    rerender({ value: 'second' });

    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe('first');

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('second');
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('delays callback execution', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    const [debounced] = result.current;

    act(() => debounced('arg1'));
    expect(fn).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(300));
    expect(fn).toHaveBeenCalledWith('arg1');
  });

  it('cancel prevents execution', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    const [debounced, cancel] = result.current;

    act(() => debounced('arg1'));
    act(() => cancel());
    act(() => jest.advanceTimersByTime(300));

    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel does nothing when no timer pending', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    const [, cancel] = result.current;
    // Call cancel without any pending call
    act(() => cancel());
    expect(fn).not.toHaveBeenCalled();
  });

  it('uses default delay of 300ms', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn));
    const [debounced] = result.current;

    act(() => debounced());
    act(() => jest.advanceTimersByTime(299));
    expect(fn).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalled();
  });

  it('resets timer on rapid calls', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    const [debounced] = result.current;

    act(() => debounced('a'));
    act(() => jest.advanceTimersByTime(100));
    act(() => debounced('b'));
    act(() => jest.advanceTimersByTime(100));
    act(() => debounced('c'));
    act(() => jest.advanceTimersByTime(300));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });
});
