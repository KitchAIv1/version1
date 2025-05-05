import React, { useState, useRef, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { useFeed } from '../../hooks/useFeed';
import RecipeCard from '../../components/RecipeCard';
import { RecipeItem } from '../../types';
import type { InfiniteData } from '@tanstack/react-query';

export default function FeedScreen() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useFeed();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        setCurrentIndex(newIndex);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const itemHeight = containerHeight ? Math.floor(containerHeight) : 0;

  const items: RecipeItem[] = (data as InfiniteData<RecipeItem[], number> | undefined)?.pages.flat() || [];

  const handleContainerLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && containerHeight === null) {
      setContainerHeight(height);
    }
  };

  const renderListFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.container}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  };

  if (isLoading && items.length === 0) {
    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (containerHeight === null) {
    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <Text style={styles.container}>No recipes found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {itemHeight > 0 && (
        <FlashList<RecipeItem>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <RecipeCard
              item={item}
              isActive={index === currentIndex}
              containerHeight={itemHeight}
            />
          )}
          estimatedItemSize={itemHeight}
          pagingEnabled
          disableIntervalMomentum={true}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderListFooter}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        alignItems: 'center',
        justifyContent: 'center',
    }
}); 