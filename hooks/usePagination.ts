import { useState, useCallback, useRef } from 'react';

interface PaginationOptions<T> {
  data: T[];
  pageSize?: number;
  initialLoad?: number;
}

interface PaginationState<T> {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  refresh: () => Promise<void>;
}

export function usePagination<T>({
  data,
  pageSize = 20,
  initialLoad = 20
}: PaginationOptions<T>): PaginationState<T> {
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const totalItems = data.length;

  // Calculate current items
  const currentItems = data.slice(0, (currentPage + 1) * pageSize);
  const hasMore = currentItems.length < totalItems;

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    setLoading(true);

    // Simulate network delay
    setTimeout(() => {
      setCurrentPage(prev => prev + 1);
      setLoading(false);
    }, 300);
  }, [loading, hasMore]);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    setCurrentPage(0);

    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const reset = useCallback(() => {
    setCurrentPage(0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  return {
    items: currentItems,
    loading: loading || refreshing,
    hasMore,
    loadMore,
    reset,
    refresh
  };
}

// Hook specifically for feed posts with virtual scrolling optimization
export function useFeedPagination<T>({
  data,
  pageSize = 15,
  bufferSize = 50 // Keep extra items in memory for smooth scrolling
}: PaginationOptions<T> & { bufferSize?: number }) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: pageSize });
  const [loading, setLoading] = useState(false);

  // Get items within buffer range
  const bufferedStart = Math.max(0, visibleRange.start - bufferSize);
  const bufferedEnd = Math.min(data.length, visibleRange.end + bufferSize);
  const visibleItems = data.slice(bufferedStart, bufferedEnd);

  const loadMore = useCallback(() => {
    if (loading || visibleRange.end >= data.length) return;

    setLoading(true);
    setTimeout(() => {
      setVisibleRange(prev => ({
        ...prev,
        end: Math.min(data.length, prev.end + pageSize)
      }));
      setLoading(false);
    }, 200);
  }, [loading, visibleRange.end, data.length, pageSize]);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setVisibleRange({ start: 0, end: pageSize });
    await new Promise(resolve => setTimeout(resolve, 300));
    setLoading(false);
  }, [pageSize]);

  const updateVisibleRange = useCallback((start: number, end: number) => {
    setVisibleRange({ start, end });
  }, []);

  return {
    items: visibleItems,
    loading,
    hasMore: visibleRange.end < data.length,
    loadMore,
    refresh,
    updateVisibleRange,
    visibleRange,
    bufferedStart
  };
}