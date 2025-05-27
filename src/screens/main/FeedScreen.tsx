import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { useFeed } from '../../hooks/useFeed';
import { useLikeMutation, useSaveMutation } from '../../hooks/useRecipeMutations';
import RecipeCard from '../../components/RecipeCard';
import { supabase } from '../../services/supabase';
import { FeedItem } from '../../hooks/useFeed';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useCacheManager } from '../../hooks/useCacheManager';

export default function FeedScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheManager = useCacheManager();
  const {
    data: feedData,
    isLoading,
    error: feedError,
  } = useFeed();
  const isFeedScreenFocused = useIsFocused();
  const flashListRef = useRef<FlashList<FeedItem>>(null);
  const prevFeedItemsRef = useRef<FeedItem[] | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const windowDims = Dimensions.get('window');

  // Use optimized mutation hooks
  const likeMutation = useLikeMutation(user?.id);
  const saveMutation = useSaveMutation(user?.id);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const [itemHeight, setItemHeight] = useState(Dimensions.get('window').height);
  const [loggedViews, setLoggedViews] = useState<Set<string>>(new Set());

  const itemsToRender: FeedItem[] = feedData || [];

  useEffect(() => {
    console.log('FeedScreen Insets:', JSON.stringify(insets), 'WindowHeight:', windowDims.height, 'WindowWidth:', windowDims.width);
  }, [insets, windowDims]);

  // Automatic comment count refresh when screen is focused and feed data is available
  useEffect(() => {
    if (isFeedScreenFocused && feedData && feedData.length > 0 && user?.id) {
      console.log('[FeedScreen] Screen focused, refreshing comment counts for all feed items');
      
      // Refresh comment counts for ALL feed items, not just first 5
      feedData.forEach((item: FeedItem, index: number) => {
        // Add a small delay between requests to avoid overwhelming the server
        setTimeout(() => {
          cacheManager.updateCommentCount(item.id, user.id);
        }, index * 50); // Reduced delay to 50ms for faster refresh
      });
    }
  }, [isFeedScreenFocused, feedData, user?.id, cacheManager]);

  // Additional refresh when user scrolls to new items
  useEffect(() => {
    if (feedData && feedData.length > 0 && user?.id && currentIndex >= 0) {
      const currentItem = feedData[currentIndex];
      if (currentItem) {
        // Refresh comment count for currently visible item and next few items
        const itemsToRefresh = feedData.slice(currentIndex, currentIndex + 3);
        itemsToRefresh.forEach((item: FeedItem, relativeIndex: number) => {
          setTimeout(() => {
            cacheManager.updateCommentCount(item.id, user.id);
          }, relativeIndex * 100);
        });
      }
    }
  }, [currentIndex, feedData, user?.id, cacheManager]);

  // Reset comment refresh tracking when feed data changes (removed the blocking mechanism)
  useEffect(() => {
    if (feedData) {
      // Don't block refreshes anymore - allow multiple refreshes for accuracy
      console.log('[FeedScreen] Feed data updated, comment counts will be refreshed');
    }
  }, [feedData]);

  // Periodic refresh of comment counts for currently visible items
  useEffect(() => {
    if (!isFeedScreenFocused || !feedData || !user?.id) return;

    const refreshInterval = setInterval(() => {
      // Refresh comment counts for currently visible item and nearby items
      const startIndex = Math.max(0, currentIndex - 1);
      const endIndex = Math.min(feedData.length, currentIndex + 2);
      const visibleItems = feedData.slice(startIndex, endIndex);
      
      console.log(`[FeedScreen] Periodic refresh of comment counts for ${visibleItems.length} visible items`);
      
      visibleItems.forEach((item: FeedItem, index: number) => {
        setTimeout(() => {
          cacheManager.updateCommentCount(item.id, user.id);
        }, index * 200); // Stagger the requests
      });
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [isFeedScreenFocused, currentIndex, feedData, user?.id, cacheManager]);

  useEffect(() => {
    // Don't auto-scroll if any mutation is in progress (cache update from mutation)
    // Also don't scroll if user is actively viewing content (not at the top)
    if (
      isFeedScreenFocused &&
      feedData &&
      feedData.length > 0 &&
      flashListRef.current &&
      prevFeedItemsRef.current !== undefined &&
      prevFeedItemsRef.current !== feedData &&
      !likeMutation.isPending && // Prevent scroll during like mutations
      !saveMutation.isPending && // Prevent scroll during save mutations
      currentIndex === 0 // Only scroll if user is already at the top
    ) {
      console.log('[FeedScreen] Feed items updated (not from mutation), scrolling to top.');
      flashListRef.current.scrollToIndex({ index: 0, animated: true });
    }
    prevFeedItemsRef.current = feedData;
  }, [feedData, isFeedScreenFocused, likeMutation.isPending, saveMutation.isPending, currentIndex]);

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
              // Check if it's a duplicate key error (user already viewed this recipe)
              if (rpcError.code === '23505') {
                console.log(`[FeedScreen] View already logged for recipe ${recipeItem.id} - skipping`);
                setLoggedViews(prev => new Set(prev).add(recipeItem.id)); // Mark as logged to prevent retries
                return;
              }
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
                    onLike: () => likeMutation.mutate(item.id),
                    onSave: () => saveMutation.mutate(item.id),
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