import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { useFeed } from '../../hooks/useFeed';
import RecipeCard from '../../components/RecipeCard';
import { supabase } from '../../services/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FeedItem } from '../../hooks/useFeed';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { useIsFocused } from '@react-navigation/native';

interface MutationContext {
  previousFeed?: FeedItem[];
}

export default function FeedScreen() {
  const {
    data: feedItems,
    isLoading,
    error: feedError,
  } = useFeed();
  const isFeedScreenFocused = useIsFocused();
  const flashListRef = useRef<FlashList<FeedItem>>(null);
  const prevFeedItemsRef = useRef<FeedItem[] | undefined>();
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const [itemHeight, setItemHeight] = useState(Dimensions.get('window').height);
  const [loggedViews, setLoggedViews] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const windowDims = Dimensions.get('window');

  const itemsToRender: FeedItem[] = feedItems || [];

  useEffect(() => {
    console.log('FeedScreen Insets:', JSON.stringify(insets), 'WindowHeight:', windowDims.height, 'WindowWidth:', windowDims.width);
  }, [insets, windowDims]);

  useEffect(() => {
    if (
      isFeedScreenFocused &&
      feedItems &&
      feedItems.length > 0 &&
      flashListRef.current &&
      prevFeedItemsRef.current !== undefined &&
      prevFeedItemsRef.current !== feedItems
    ) {
      console.log('[FeedScreen] Feed items updated, scrolling to top.');
      flashListRef.current.scrollToIndex({ index: 0, animated: true });
    }
    prevFeedItemsRef.current = feedItems;
  }, [feedItems, isFeedScreenFocused]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const validViewableItems = viewableItems.filter(item => item.isViewable && item.index !== null);
      if (validViewableItems.length > 0) {
        const newIndex = validViewableItems[0].index!;
        setCurrentIndex(prevIndex => {
          if (prevIndex !== newIndex) { return newIndex; }
          return prevIndex;
        });
        const recipeItem = itemsToRender[newIndex];
        if (user?.id && recipeItem?.id && !loggedViews.has(recipeItem.id)) {
          console.log(`[FeedScreen] Logging view for recipe ${recipeItem.id} by user ${user.id}`);
          supabase.rpc('log_recipe_view', {
            p_user_id: user.id,
            p_recipe_id: recipeItem.id,
          }).then(({ error: rpcError }) => {
            if (rpcError) {
              console.error('[FeedScreen] Error logging view for recipe', recipeItem.id, ':', rpcError.message);
            } else {
              console.log('[FeedScreen] Successfully logged view for recipe', recipeItem.id);
              setLoggedViews(prev => new Set(prev).add(recipeItem.id));
            }
          });
        }
      }
    },
    [itemsToRender, user, loggedViews]
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
    waitForInteraction: true,
  }).current;

  const handleContainerLayout = (event: any) => {
    const measuredHeight = event.nativeEvent.layout.height;
    if (measuredHeight > 0) {
      console.log('FeedScreen onLayout (containerForLayout) fired. Measured Height:', measuredHeight);
      setItemHeight(Math.floor(measuredHeight));
      if (!layoutReady) {
        setLayoutReady(true);
      }
    }
  };
  
  useEffect(() => {
    if (itemHeight > 0) {
        console.log(`FeedScreen: itemHeight set from layout: ${itemHeight}`);
    }
  }, [itemHeight]);
  

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

  return (
    <SafeAreaView style={styles.safeAreaOuter} edges={['left', 'right']}>
      <StatusBar 
        barStyle="light-content"
        backgroundColor="transparent" 
        translucent={true} 
      />
      <View style={styles.containerForLayout} onLayout={handleContainerLayout}>
        {isLoading || !layoutReady ? (
          <View style={styles.centeredMessageContainer}>
            <ActivityIndicator size="large" color="#666" />
          </View>
        ) : feedError ? (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.errorText}>Error loading feed: {feedError.message}</Text>
          </View>
        ) : itemsToRender.length === 0 ? (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.emptyText}>No recipes found.</Text>
          </View>
        ) : (
          <View style={styles.flashListContainer}> 
            <FlashList<FeedItem>
              ref={flashListRef}
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
                  isScreenFocused={isFeedScreenFocused}
                />
              )}
              estimatedItemSize={itemHeight}
              pagingEnabled
              disableIntervalMomentum
              showsVerticalScrollIndicator={false}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
              extraData={{ currentIndex, isFeedScreenFocused }}
              overrideItemLayout={(layout) => {
                layout.size = itemHeight;
              }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeAreaOuter: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    containerForLayout: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    flashListContainer: {
        flex: 1,
        width: '100%',
    },
    centeredMessageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
        textAlign: 'center',
    },
}); 