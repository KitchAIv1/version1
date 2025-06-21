import React, { useCallback, useMemo } from 'react';
import { FlatList, FlatListProps, ViewStyle } from 'react-native';

// Default item height for getItemLayout optimization
const DEFAULT_ITEM_HEIGHT = 80;

interface OptimizedFlatListProps<T>
  extends Omit<FlatListProps<T>, 'getItemLayout'> {
  itemHeight?: number;
  enableGetItemLayout?: boolean;
  optimizationLevel?: 'basic' | 'aggressive';
}

/**
 * Optimized FlatList component with performance enhancements
 * Includes automatic getItemLayout, optimized rendering settings, and memory management
 */
export function OptimizedFlatList<T extends any>({
  data,
  renderItem,
  keyExtractor,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  enableGetItemLayout = true,
  optimizationLevel = 'basic',
  ...props
}: OptimizedFlatListProps<T>) {
  // Memoized key extractor to prevent recreation
  const memoizedKeyExtractor = useCallback(
    (item: T, index: number) => {
      if (keyExtractor) {
        return keyExtractor(item, index);
      }
      // Fallback key extractor
      if (typeof item === 'object' && item !== null && 'id' in item) {
        return String((item as any).id);
      }
      return String(index);
    },
    [keyExtractor],
  );

  // Optimized getItemLayout for fixed height items
  const getItemLayout = useCallback(
    (data: ArrayLike<T> | null | undefined, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight],
  );

  // Performance settings based on optimization level
  const performanceSettings = useMemo(() => {
    const basicSettings = {
      removeClippedSubviews: true,
      maxToRenderPerBatch: 10,
      windowSize: 10,
      initialNumToRender: 8,
      updateCellsBatchingPeriod: 50,
    };

    const aggressiveSettings = {
      removeClippedSubviews: true,
      maxToRenderPerBatch: 5,
      windowSize: 5,
      initialNumToRender: 5,
      updateCellsBatchingPeriod: 100,
      disableVirtualization: false,
    };

    return optimizationLevel === 'aggressive'
      ? aggressiveSettings
      : basicSettings;
  }, [optimizationLevel]);

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={memoizedKeyExtractor}
      getItemLayout={enableGetItemLayout ? getItemLayout : undefined}
      {...performanceSettings}
      {...props}
    />
  );
}

/**
 * Optimized FlatList specifically for pantry items
 */
export function PantryFlatList<T extends any>(
  props: OptimizedFlatListProps<T>,
) {
  return (
    <OptimizedFlatList
      itemHeight={80}
      optimizationLevel="basic"
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
}

/**
 * Optimized FlatList specifically for feed items (full screen)
 */
export function FeedFlatList<T extends any>(props: OptimizedFlatListProps<T>) {
  return (
    <OptimizedFlatList
      itemHeight={600} // Approximate feed item height
      optimizationLevel="aggressive"
      showsVerticalScrollIndicator={false}
      pagingEnabled
      {...props}
    />
  );
}

/**
 * Optimized FlatList for search results
 */
export function SearchFlatList<T extends any>(
  props: OptimizedFlatListProps<T>,
) {
  return (
    <OptimizedFlatList
      itemHeight={70}
      optimizationLevel="basic"
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
}

/**
 * Optimized horizontal FlatList for categories or tags
 */
export function HorizontalFlatList<T extends any>({
  itemWidth = 100,
  ...props
}: OptimizedFlatListProps<T> & { itemWidth?: number }) {
  const getItemLayout = useCallback(
    (data: ArrayLike<T> | null | undefined, index: number) => ({
      length: itemWidth,
      offset: itemWidth * index,
      index,
    }),
    [itemWidth],
  );

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      getItemLayout={getItemLayout}
      removeClippedSubviews
      maxToRenderPerBatch={8}
      windowSize={8}
      initialNumToRender={6}
      {...props}
    />
  );
}

/**
 * Grid FlatList for recipe cards or similar grid layouts
 */
export function GridFlatList<T extends any>({
  numColumns = 2,
  itemHeight = 200,
  ...props
}: OptimizedFlatListProps<T> & { numColumns?: number }) {
  return (
    <OptimizedFlatList
      numColumns={numColumns}
      itemHeight={itemHeight}
      optimizationLevel="basic"
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
}

export default OptimizedFlatList;
