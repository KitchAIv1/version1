import React, { useState, useRef, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { useFeed } from '../../hooks/useFeed';
import RecipeCard from '../../components/RecipeCard';
import { supabase } from '../../services/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FeedItem } from '../../hooks/useFeed';

interface MutationContext {
  previousFeed?: FeedItem[];
}

export default function FeedScreen() {
  const {
    data: feedItems,
    isLoading,
    error: feedError,
  } = useFeed();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const validViewableItems = viewableItems.filter(item => item.isViewable && item.index !== null);

      if (validViewableItems.length > 0) {
        const newIndex = validViewableItems[0].index!;
        setCurrentIndex(prevIndex => {
          if (prevIndex !== newIndex) {
            console.log(`FeedScreen: onViewableItemsChanged - Setting new current index: ${newIndex} (was ${prevIndex})`);
            return newIndex;
          }
          return prevIndex;
        });
      } else {
        console.log('FeedScreen: onViewableItemsChanged - No valid viewable items.');
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
    waitForInteraction: true,
  }).current;

  const itemHeight = containerHeight ? Math.floor(containerHeight) : 0;
  const itemsToRender: FeedItem[] = feedItems || [];

  const handleContainerLayout = (event: any) => {
    const { height, width } = event.nativeEvent.layout;
    if (height > 0 && containerHeight === null) {
      console.log(`FeedScreen container layout - Height: ${height}, Width: ${width}`);
      setContainerHeight(height);
    }
  };

  const queryClient = useQueryClient();

  const likeMut = useMutation<void, Error, string, MutationContext>({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('like_recipe', { recipe_id: id });
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousFeed = queryClient.getQueryData<FeedItem[]>(['feed']);
      queryClient.setQueryData<FeedItem[]>(['feed'], (oldData) => {
        if (!oldData) return [];
        return oldData.map((item) =>
          item.id === id
            ? { ...item, liked: !item.liked, likes: item.liked ? (item.likes ?? 1) - 1 : (item.likes ?? 0) + 1 }
            : item
        );
      });
      return { previousFeed };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const saveMut = useMutation<void, Error, string, MutationContext>({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('save_recipe', { recipe_id: id });
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousFeed = queryClient.getQueryData<FeedItem[]>(['feed']);
      queryClient.setQueryData<FeedItem[]>(['feed'], (oldData) => {
        if (!oldData) return [];
        return oldData.map((item) =>
          item.id === id ? { ...item, saved: !item.saved } : item
        );
      });
      return { previousFeed };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  if (feedError) {
    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <Text style={styles.errorText}>Error loading feed: {feedError.message}</Text>
      </View>
    );
  }

  if (isLoading || containerHeight === null) {
    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }
  
  if (!isLoading && itemsToRender.length === 0 && !feedError) {
    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <Text style={styles.emptyText}>No recipes found.</Text>
      </View>
    );
  }

  if (itemHeight <= 0 && itemsToRender.length > 0) {
    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <Text style={styles.errorText}>Container height not determined for list.</Text>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {itemHeight > 0 && itemsToRender.length > 0 ? (
        <View style={styles.flashListContainer}>
          <FlashList<FeedItem>
            data={itemsToRender}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <RecipeCard
                item={{
                  ...item,
                  onLike: () => likeMut.mutate(item.id),
                  onSave: () => saveMut.mutate(item.id),
                }}
                isActive={index === currentIndex}
                containerHeight={itemHeight}
              />
            )}
            estimatedItemSize={itemHeight}
            pagingEnabled
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            extraData={currentIndex}
          />
        </View>
      ) : (
        <View style={styles.centeredMessageContainer}>
          <Text style={styles.emptyText}>No feed items to display.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    flashListContainer: {
        flex: 1,
        width: '100%',
    },
    emptyText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
        padding: 20,
        textAlign: 'center',
    },
    centeredMessageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
}); 