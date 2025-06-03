import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  useIsFocused,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useFeed, FeedItem } from '../../hooks/useFeed';
import {
  useLikeMutation,
  useSaveMutation,
} from '../../hooks/useRecipeMutations';
import RecipeCard from '../../components/RecipeCard';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useCacheManager } from '../../hooks/useCacheManager';
import { useCommentCountSync } from '../../hooks/useCommentCountSync';

// Import "What Can I Cook?" components
import InsufficientItemsModal from '../../components/modals/InsufficientItemsModal';
import { useWhatCanICook } from '../../hooks/useWhatCanICook';

export default function FeedScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheManager = useCacheManager();
  const { smartSync, syncSingleRecipe } = useCommentCountSync();
  const { data: feedData, isLoading, error: feedError } = useFeed();
  const isFeedScreenFocused = useIsFocused();
  const flashListRef = useRef<FlashList<FeedItem>>(null);
  const prevFeedItemsRef = useRef<FeedItem[] | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const windowDims = Dimensions.get('window');
  const navigation = useNavigation();

  // Use optimized mutation hooks
  const likeMutation = useLikeMutation(user?.id);
  const saveMutation = useSaveMutation(user?.id);

  // "What Can I Cook?" feature hook
  const {
    pantryItemCount,
    showInsufficientModal,
    handleWhatCanICookPress,
    handleCloseModal,
    handleNavigateToPantry,
  } = useWhatCanICook();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const [itemHeight, setItemHeight] = useState(Dimensions.get('window').height);
  const [loggedViews, setLoggedViews] = useState<Set<string>>(new Set());

  const itemsToRender: FeedItem[] = feedData || [];

  useEffect(() => {
    console.log(
      'FeedScreen Insets:',
      JSON.stringify(insets),
      'WindowHeight:',
      windowDims.height,
      'WindowWidth:',
      windowDims.width,
    );
  }, [insets, windowDims]);

  // EFFICIENT Real-time comment count monitoring
  useEffect(() => {
    if (!feedData || !user?.id) return;

    console.log(
      '[FeedScreen] 🎧 Setting up efficient real-time comment monitoring',
    );

    // Monitor comment queries for changes
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (
        event.type === 'updated' &&
        event.query.queryKey[0] === 'recipe-comments'
      ) {
        const recipeId = event.query.queryKey[1] as string;
        const commentsData = event.query.state.data;

        // Handle both old array format and new {comments: [...]} format
        let comments: any[] = [];
        if (Array.isArray(commentsData)) {
          comments = commentsData;
        } else if (
          commentsData?.comments &&
          Array.isArray(commentsData.comments)
        ) {
          comments = commentsData.comments;
        }

        if (comments.length >= 0) {
          const newCommentCount = comments.length;

          // Use efficient direct cache update instead of invalidation
          syncSingleRecipe(recipeId, user.id);
        }
      }
    });

    return () => {
      console.log('[FeedScreen] 🎧 Cleaning up real-time comment monitoring');
      unsubscribe();
    };
  }, [queryClient, feedData, user?.id, syncSingleRecipe]);

  // SIMPLE LIKE REFRESH: Update like counts when screen is focused (backend fixed)
  useEffect(() => {
    if (isFeedScreenFocused && feedData && feedData.length > 0 && user?.id) {
      // DISABLED - using optimized sync instead
    }
  }, [isFeedScreenFocused, currentIndex, feedData, user?.id, cacheManager]);

  // OPTIMIZED LIKE SYNC: Only sync items that have 0 likes (feed RPC compensation)
  useEffect(() => {
    if (isFeedScreenFocused && feedData && feedData.length > 0 && user?.id) {
      // Get currently visible items
      const startIndex = Math.max(0, currentIndex);
      const endIndex = Math.min(feedData.length, startIndex + 2);
      const visibleItems = feedData.slice(startIndex, endIndex);

      // Only sync items that have 0 likes (indicating feed RPC didn't provide like data)
      const itemsNeedingSync = visibleItems.filter(
        item => (item.likes ?? 0) === 0,
      );

      if (itemsNeedingSync.length > 0) {
        console.log(
          `[FeedScreen] 🔧 Syncing ${itemsNeedingSync.length} items with missing like data`,
        );
        itemsNeedingSync.forEach((item: FeedItem, index: number) => {
          setTimeout(() => {
            cacheManager.updateLikeCount(item.id, user.id);
          }, index * 500);
        });
      }
    }
  }, [isFeedScreenFocused, feedData, currentIndex, user?.id, cacheManager]);

  // EFFICIENT COMMENT COUNT SYNC: Smart sync when returning from recipe details
  useFocusEffect(
    useCallback(() => {
      if (feedData && feedData.length > 0 && user?.id) {
        console.log(
          '[FeedScreen] 🧠 Screen focused - running smart comment count sync',
        );

        // Get visible recipes for smart sync
        const startIndex = Math.max(0, currentIndex);
        const endIndex = Math.min(feedData.length, startIndex + 3);
        const visibleRecipeIds = feedData
          .slice(startIndex, endIndex)
          .map(item => item.id);

        // Use smart sync to only update what needs updating
        smartSync(visibleRecipeIds, user.id);
      }
    }, [feedData, currentIndex, user?.id, smartSync]),
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const validViewableItems = viewableItems.filter(
        item => item.isViewable && item.index !== null,
      );
      if (validViewableItems.length > 0) {
        const newIndex = validViewableItems[0].index!;
        setCurrentIndex(prevIndex => {
          if (prevIndex !== newIndex) {
            return newIndex;
          }
          return prevIndex;
        });
        const recipeItem = itemsToRender[newIndex];
        if (user?.id && recipeItem?.id && !loggedViews.has(recipeItem.id)) {
          console.log(
            `[FeedScreen] Logging view for recipe ${recipeItem.id} by user ${user.id}`,
          );
          supabase
            .rpc('log_recipe_view', {
              p_user_id: user.id,
              p_recipe_id: recipeItem.id,
            })
            .then(({ error: rpcError }) => {
              if (rpcError) {
                // Check if it's a duplicate key error (user already viewed this recipe)
                if (rpcError.code === '23505') {
                  console.log(
                    `[FeedScreen] View already logged for recipe ${recipeItem.id} - skipping`,
                  );
                  setLoggedViews(prev => new Set(prev).add(recipeItem.id)); // Mark as logged to prevent retries
                  return;
                }
                console.error(
                  '[FeedScreen] Error logging view for recipe',
                  recipeItem.id,
                  ':',
                  rpcError.message,
                );
              } else {
                console.log(
                  '[FeedScreen] Successfully logged view for recipe',
                  recipeItem.id,
                );
                setLoggedViews(prev => new Set(prev).add(recipeItem.id));
              }
            });
        }
      }
    },
    [itemsToRender, user, loggedViews],
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
    waitForInteraction: true,
  }).current;

  const handleContainerLayout = (event: any) => {
    const measuredHeight = event.nativeEvent.layout.height;
    if (measuredHeight > 0) {
      console.log(
        'FeedScreen onLayout (containerForLayout) fired. Measured Height:',
        measuredHeight,
      );
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
        translucent
      />
      <View style={styles.containerForLayout} onLayout={handleContainerLayout}>
        {isLoading || !layoutReady ? (
          <View style={styles.centeredMessageContainer}>
            <ActivityIndicator size="large" color="#666" />
          </View>
        ) : feedError ? (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.errorText}>
              Error loading feed: {feedError.message}
            </Text>
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
              keyExtractor={item => item.id}
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
                  pantryItemCount={pantryItemCount}
                  onWhatCanICookPress={handleWhatCanICookPress}
                />
              )}
              estimatedItemSize={itemHeight}
              pagingEnabled
              disableIntervalMomentum
              showsVerticalScrollIndicator={false}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
              extraData={{ currentIndex, isFeedScreenFocused }}
              overrideItemLayout={layout => {
                layout.size = itemHeight;
              }}
              removeClippedSubviews
              decelerationRate="fast"
            />
          </View>
        )}
      </View>

      {/* "What Can I Cook?" Insufficient Items Modal */}
      <InsufficientItemsModal
        visible={showInsufficientModal}
        onClose={handleCloseModal}
        onNavigateToPantry={handleNavigateToPantry}
        currentItemCount={pantryItemCount}
      />
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
