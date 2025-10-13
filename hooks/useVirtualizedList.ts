import { useState, useCallback, useRef, useEffect } from 'react';
import { FlatList } from 'react-native';

interface VirtualizedListOptions {
  itemHeight?: number;
  estimatedItemSize?: number;
  overscan?: number; // Number of items to render outside visible area
}

interface VirtualizedListState {
  visibleItems: number;
  scrollOffset: number;
  startIndex: number;
  endIndex: number;
}

export function useVirtualizedList({
  itemHeight = 300,
  estimatedItemSize = 300,
  overscan = 5
}: VirtualizedListOptions = {}) {
  const [state, setState] = useState<VirtualizedListState>({
    visibleItems: 0,
    scrollOffset: 0,
    startIndex: 0,
    endIndex: 0
  });

  const flatListRef = useRef<FlatList>(null);
  const containerHeight = useRef<number>(0);

  const onLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    containerHeight.current = height;

    const visibleItems = Math.ceil(height / estimatedItemSize) + overscan * 2;

    setState(prev => ({
      ...prev,
      visibleItems,
      endIndex: Math.min(prev.startIndex + visibleItems, prev.endIndex)
    }));
  }, [estimatedItemSize, overscan]);

  const onScroll = useCallback((event: any) => {
    const scrollOffset = event.nativeEvent.contentOffset.y;
    const startIndex = Math.max(0, Math.floor(scrollOffset / estimatedItemSize) - overscan);
    const visibleItems = Math.ceil(containerHeight.current / estimatedItemSize) + overscan * 2;
    const endIndex = startIndex + visibleItems;

    setState({
      visibleItems,
      scrollOffset,
      startIndex,
      endIndex
    });
  }, [estimatedItemSize, overscan]);

  const scrollToIndex = useCallback((index: number, animated = true) => {
    flatListRef.current?.scrollToIndex({ index, animated });
  }, []);

  const scrollToTop = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  return {
    flatListRef,
    state,
    onLayout,
    onScroll,
    scrollToIndex,
    scrollToTop,
    visibleRange: {
      start: state.startIndex,
      end: state.endIndex
    }
  };
}