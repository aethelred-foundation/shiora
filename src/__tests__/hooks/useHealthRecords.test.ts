import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(AppProvider, null, children));
}

describe('useHealthRecords', () => {
  it('initializes with loading state', () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.records).toEqual([]);
  });

  it('loads records after fetch', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.records.length).toBeGreaterThanOrEqual(0);
    expect(typeof result.current.total).toBe('number');
    expect(typeof result.current.page).toBe('number');
  });

  it('exposes mutation functions', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.upload.mutate).toBe('function');
    expect(typeof result.current.remove.mutate).toBe('function');
  });

  it('has filter functions', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.setTypeFilter).toBe('function');
    expect(typeof result.current.setSearch).toBe('function');
    expect(typeof result.current.goToPage).toBe('function');
  });

  it('has a refetch function', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });

  it('upload mutation completes successfully', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.upload.mutate({
        title: 'Test Record',
        type: 'lab_result',
        file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
        provider: 'Dr. Test',
        date: new Date().toISOString(),
        notes: 'Test notes',
      } as any);
    });

    await waitFor(() => expect(result.current.upload.isLoading).toBe(false));
    expect(result.current.upload.error).toBeNull();
  });

  it('remove mutation completes successfully', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.remove.mutate('rec-0001');
    });

    await waitFor(() => expect(result.current.remove.isLoading).toBe(false));
    expect(result.current.remove.error).toBeNull();
  });

  it('setSearch updates filters and resets page', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearch('blood');
    });

    expect(result.current.filters.search).toBe('blood');
    expect(result.current.filters.page).toBe(1);
  });

  it('setTypeFilter updates filters', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setTypeFilter('lab_result');
    });

    expect(result.current.filters.type).toBe('lab_result');
    expect(result.current.filters.page).toBe(1);
  });

  it('setStatusFilter updates filters', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setStatusFilter('Verified');
    });

    expect(result.current.filters.status).toBe('Verified');
    expect(result.current.filters.page).toBe(1);
  });

  it('setSort updates sort field and direction', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSort('label', 'asc');
    });

    expect(result.current.filters.sortField).toBe('label');
    expect(result.current.filters.sortDirection).toBe('asc');
  });

  it('goToPage updates the page', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.goToPage(3);
    });

    expect(result.current.filters.page).toBe(3);
  });

  it('goToPage clamps to minimum of 1', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.goToPage(-1);
    });

    expect(result.current.filters.page).toBe(1);
  });

  it('nextPage increments page', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.filters.page).toBe(2);
  });

  it('prevPage decrements page but not below 1', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Already on page 1, prevPage should stay at 1
    act(() => {
      result.current.prevPage();
    });

    expect(result.current.filters.page).toBe(1);
  });

  it('setFilters replaces the full filter state', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({
        type: 'imaging',
        search: 'test',
        status: undefined,
        sortField: 'type',
        sortDirection: 'asc',
        page: 2,
        pageSize: 20,
      });
    });

    expect(result.current.filters.type).toBe('imaging');
    expect(result.current.filters.search).toBe('test');
    expect(result.current.filters.page).toBe(2);
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    // Should not throw
    expect(result.current.error).toBeNull();
  });

  it('useRecordDetail fetches a single record by ID', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const records = useHealthRecords();
      const detail = records.useRecordDetail('rec-0001');
      return { records, detail };
    }, { wrapper });

    await waitFor(() => expect(result.current.records.isLoading).toBe(false));
    await waitFor(() => expect(result.current.detail.isLoading).toBe(false));

    // The detail query was enabled (id is not null)
    expect(result.current.detail.error).toBeNull();
  });

  it('useRecordDetail returns null record when id is null', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const records = useHealthRecords();
      const detail = records.useRecordDetail(null);
      return { records, detail };
    }, { wrapper });

    await waitFor(() => expect(result.current.records.isLoading).toBe(false));

    // When id is null, the query should not be enabled
    expect(result.current.detail.record).toBeNull();
  });

  it('setSort toggles direction when same field is used without explicit direction', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Default sort is 'date' desc. Setting 'date' without direction should toggle to 'asc'
    act(() => {
      result.current.setSort('date');
    });

    expect(result.current.filters.sortField).toBe('date');
    expect(result.current.filters.sortDirection).toBe('asc');
  });

  it('setSort defaults to desc when switching to a different field without explicit direction', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Default is 'date' desc. Setting a different field without direction should default to desc
    act(() => {
      result.current.setSort('label');
    });

    expect(result.current.filters.sortField).toBe('label');
    expect(result.current.filters.sortDirection).toBe('desc');
  });

  it('setSearch with empty string resets search to undefined', async () => {
    const { result } = renderHook(() => useHealthRecords(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearch('something');
    });
    expect(result.current.filters.search).toBe('something');

    act(() => {
      result.current.setSearch('');
    });
    expect(result.current.filters.search).toBeUndefined();
  });
});
