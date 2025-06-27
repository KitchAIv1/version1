import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  Suspense,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useQueryClient, useQuery } from '@tanstack/react-query';

// Optimized imports
import { useAuth } from '../../providers/AuthProvider';
import {
  useScreenLoadTracking,
  useApiPerformanceTracking,
} from '../../hooks/usePerformanceMonitoring';
import { FeedItemSkeleton } from '../../components/skeletons';
import { supabase } from '../../services/supabase';

// Lazy-loaded components for better performance
const RecipeCard = React.lazy(() => import('../../components/RecipeCard'));
const InsufficientItemsModal = React.lazy(
  () => import('../../components/modals/InsufficientItemsModal'),
);

// Types
export interface FeedItem {
  id: string;
  recipe_id: string;
  title: string;
  recipe_name?: string;
  description?: string;
  video_url?: string;
  video?: string;
  thumbnail_url?: string;
  creator_user_id?: string;
  username?: string;
  avatar_url?: string;
  likes?: number;
  comments_count?: number;
  created_at: string;
  pantryMatchPct?: number;
  is_liked?: boolean;
  is_saved?: boolean;
  onLike?: () => void;
  onSave?: () => void;
}

interface OptimizedFeedData {
  items: FeedItem[];
  hasMore: boolean;
  nextCursor?: string;
}

// Constants
const ITEM_HEIGHT = Dimensions.get('window').height;
const VIEW_LOG_DEBOUNCE = 1000;

// Optimized hooks
const useOptimizedFeed = () => {
  const { user } = useAuth();
  const { startApiCall, endApiCall } = useApiPerformanceTracking();

  return useQuery<OptimizedFeedData, Error>({
    queryKey: ['feed', 'optimized', user?.id],
    queryFn: async () => {
      const callId = `feed_fetch_${Date.now()}`;
      startApiCall(callId);

      try {
        if (!user?.id) throw new Error('User authentication required');

        const { data: rawData, error: rpcError } = await supabase.rpc(
          'get_community_feed_pantry_match_v4',
          {
            user_id: user.id,
            limit_count: 20,
            offset_count: 0,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        if (!rawData) {
          throw new Error('Feed data not found.');
        }

        // Optimized data processing
        const processedItems: FeedItem[] = Array.isArray(rawData)
          ? rawData
              .map((item: Record<string, unknown>, index: number) => ({
                id: (item.id ||
                  item.recipe_id ||
                  `feed_item_${index}`) as string,
                recipe_id: (item.id ||
                  item.recipe_id ||
                  `feed_item_${index}`) as string,
                title: (item.title ||
                  item.recipe_name ||
                  'Untitled Recipe') as string,
                recipe_name: (item.recipe_name ||
                  item.title ||
                  'Untitled Recipe') as string,
                description: (item.description || '') as string,
                video_url: (item.video_url || item.video || '') as string,
                video: (item.video || item.video_url || '') as string,
                thumbnail_url: (item.thumbnail_url || undefined) as
                  | string
                  | undefined,
                creator_user_id: (item.creator_user_id ||
                  item.user_id ||
                  '') as string,
                username: (item.username || 'Unknown User') as string,
                avatar_url: (item.avatar_url || undefined) as
                  | string
                  | undefined,
                likes: (item.likes || 0) as number,
                comments_count: (item.comments_count || 0) as number,
                created_at: (item.created_at ||
                  new Date().toISOString()) as string,
                pantryMatchPct: (item.pantryMatchPct ||
                  item.pantry_match_pct ||
                  0) as number,
                is_liked: (item.is_liked || false) as boolean,
                is_saved: (item.is_saved || false) as boolean,
              }))
              .filter((item: FeedItem) => item.id && item.title)
          : [];

        const result = {
          items: processedItems,
          hasMore: processedItems.length >= 20,
          nextCursor: processedItems.length >= 20 ? '20' : undefined,
        };

        // Track API performance
        endApiCall(callId, 'feed_fetch');

        return result;
      } catch (error) {
        endApiCall(callId, 'feed_fetch');
        throw error;
      }
    },
    enabled: !!user?.id,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

const useOptimizedMutations = (userId?: string) => {
  const queryClient = useQueryClient();
  const { startApiCall, endApiCall } = useApiPerformanceTracking();

  const likeMutation = useCallback(
    async (recipeId: string) => {
      if (!userId) return;

      const callId = `like_recipe_${Date.now()}`;
      startApiCall(callId);

      try {
        // Optimistic update
        queryClient.setQueryData(
          ['feed', 'optimized', userId],
          (oldData: OptimizedFeedData | undefined) => {
            if (!oldData) return oldData;

            return {
              ...oldData,
              items: oldData.items.map(item =>
                item.id === recipeId
                  ? {
                      ...item,
                      is_liked: !item.is_liked,
                      likes: (item.likes || 0) + (item.is_liked ? -1 : 1),
                    }
                  : item,
              ),
            };
          },
        );

        // API call
        const { error } = await supabase.rpc('toggle_recipe_like', {
          user_id_param: userId,
          recipe_id_param: recipeId,
        });

        if (error) throw error;

        endApiCall(callId, 'like_recipe');
      } catch (error) {
        // Revert optimistic update
        queryClient.invalidateQueries({
          queryKey: ['feed', 'optimized', userId],
        });
        endApiCall(callId, 'like_recipe');
      }
    },
    [userId, queryClient, startApiCall, endApiCall],
  );

  const saveMutation = useCallback(
    async (recipeId: string) => {
      if (!userId) return;

      const callId = `save_recipe_${Date.now()}`;
      startApiCall(callId);

      try {
        // Optimistic update
        queryClient.setQueryData(
          ['feed', 'optimized', userId],
          (oldData: OptimizedFeedData | undefined) => {
            if (!oldData) return oldData;

            return {
              ...oldData,
              items: oldData.items.map(item =>
                item.id === recipeId
                  ? { ...item, is_saved: !item.is_saved }
                  : item,
              ),
            };
          },
        );

        // API call
        const { error } = await supabase.rpc('save_recipe_video', {
          user_id_param: userId,
          recipe_id_param: recipeId,
        });

        if (error) throw error;

        endApiCall(callId, 'save_recipe');
      } catch (error) {
        // Revert optimistic update
        queryClient.invalidateQueries({
          queryKey: ['feed', 'optimized', userId],
        });
        endApiCall(callId, 'save_recipe');
      }
    },
    [userId, queryClient, startApiCall, endApiCall],
  );

  return { likeMutation, saveMutation };
};

const useOptimizedWhatCanICook = () => {
  const { user } = useAuth();

  const { data: pantryData } = useQuery({
    queryKey: ['pantryCount', user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };

      const { count, error } = await supabase
        .from('pantry_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) throw error;
      return { count: count || 0 };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const [showInsufficientModal, setShowInsufficientModal] = useState(false);

  const handleWhatCanICookPress = useCallback(() => {
    const itemCount = pantryData?.count || 0;
    if (itemCount < 3) {
      setShowInsufficientModal(true);
    } else {
      // Navigate to what can I cook screen
      Alert.alert('What Can I Cook?', 'Feature coming soon!');
    }
  }, [pantryData?.count]);

  const handleCloseModal = useCallback(() => {
    setShowInsufficientModal(false);
  }, []);

  const handleNavigateToPantry = useCallback(() => {
    setShowInsufficientModal(false);
    // Navigate to pantry
  }, []);

  return {
    pantryItemCount: pantryData?.count || 0,
    showInsufficientModal,
    handleWhatCanICookPress,
    handleCloseModal,
    handleNavigateToPantry,
  };
};

// Memoized components
const OptimizedRecipeCard = React.memo<{
  item: FeedItem;
  isActive: boolean;
  containerHeight: number;
  isScreenFocused: boolean;
  pantryItemCount: number;
  onWhatCanICookPress: () => void;
  onLike: () => void;
  onSave: () => void;
}>(
  ({
    item,
    isActive,
    containerHeight,
    isScreenFocused,
    pantryItemCount,
    onWhatCanICookPress,
    onLike,
    onSave,
  }) => (
    <Suspense fallback={<FeedItemSkeleton />}>
      <RecipeCard
        item={{
          ...item,
          onLike,
          onSave,
        }}
        isActive={isActive}
        containerHeight={containerHeight}
        isScreenFocused={isScreenFocused}
        pantryItemCount={pantryItemCount}
        onWhatCanICookPress={onWhatCanICookPress}
      />
    </Suspense>
  ),
);
OptimizedRecipeCard.displayName = 'OptimizedRecipeCard';

// Styles moved before component to fix "used before defined" errors
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryText: {
    color: '#10b981',
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  emptyContainer: {
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
});

// Main FeedScreen component
export const FeedScreenOptimized = React.memo(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isFeedScreenFocused = useIsFocused();

  // Performance tracking
  useScreenLoadTracking('FeedScreen');

  // Optimized data fetching
  const {
    data: feedData,
    isLoading,
    error: feedError,
    refetch: refetchFeed,
  } = useOptimizedFeed();

  const { likeMutation, saveMutation } = useOptimizedMutations(user?.id);
  const {
    pantryItemCount,
    showInsufficientModal,
    handleWhatCanICookPress,
    handleCloseModal,
    handleNavigateToPantry,
  } = useOptimizedWhatCanICook();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const [itemHeight, setItemHeight] = useState(ITEM_HEIGHT);
  const [loggedViews, setLoggedViews] = useState<Set<string>>(() => new Set());

  // Refs
  const flashListRef = useRef<FlashList<FeedItem>>(null);
  const viewLogTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoized values
  const itemsToRender = useMemo(() => feedData?.items || [], [feedData?.items]);

  // Optimized view logging with debouncing
  const logRecipeView = useCallback(
    (recipeId: string) => {
      if (!user?.id || loggedViews.has(recipeId)) return;

      // Clear previous timeout
      if (viewLogTimeoutRef.current) {
        clearTimeout(viewLogTimeoutRef.current);
      }

      // Debounce view logging
      viewLogTimeoutRef.current = setTimeout(async () => {
        try {
          const { error } = await supabase.rpc('log_recipe_view', {
            p_user_id: user.id,
            p_recipe_id: recipeId,
          });

          if (error && error.code !== '23505') {
            // Ignore duplicate key errors
            return;
          }
          setLoggedViews(prev => new Set(prev).add(recipeId));
        } catch (error) {
          // Silent error handling for view logging
        }
      }, VIEW_LOG_DEBOUNCE);
    },
    [user?.id, loggedViews],
  );

  // Optimized viewable items handler
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const validViewableItems = viewableItems.filter(
        item => item.isViewable && item.index !== null && item.item,
      );

      if (validViewableItems.length > 0) {
        const newIndex = validViewableItems[0].index!;
        const recipeItem = validViewableItems[0].item as FeedItem;

        setCurrentIndex(prevIndex => {
          if (prevIndex !== newIndex) {
            // Log view for new visible item
            if (recipeItem?.id) {
              logRecipeView(recipeItem.id);
            }
            return newIndex;
          }
          return prevIndex;
        });
      }
    },
    [logRecipeView],
  );

  const viewabilityConfig = useMemo(
    () => ({
      viewAreaCoveragePercentThreshold: 50,
      waitForInteraction: true,
    }),
    [],
  );

  // Optimized layout handler
  const handleContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const measuredHeight = event.nativeEvent.layout.height;
      if (measuredHeight > 0) {
        setItemHeight(Math.floor(measuredHeight));
        if (!layoutReady) {
          setLayoutReady(true);
        }
      }
    },
    [layoutReady],
  );

  // Optimized render item
  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => (
      <OptimizedRecipeCard
        item={item}
        isActive={index === currentIndex}
        containerHeight={itemHeight}
        isScreenFocused={isFeedScreenFocused}
        pantryItemCount={pantryItemCount}
        onWhatCanICookPress={handleWhatCanICookPress}
        onLike={() => likeMutation(item.id)}
        onSave={() => saveMutation(item.id)}
      />
    ),
    [
      currentIndex,
      itemHeight,
      isFeedScreenFocused,
      pantryItemCount,
      handleWhatCanICookPress,
      likeMutation,
      saveMutation,
    ],
  );

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  // Optimized focus effect for smart sync
  useFocusEffect(
    useCallback(() => {
      if (isFeedScreenFocused && itemsToRender.length > 0 && user?.id) {
        // Invalidate relevant queries on focus
        queryClient.invalidateQueries({
          queryKey: ['recipe-comments'],
          refetchType: 'none', // Don't refetch immediately
        });
      }
    }, [isFeedScreenFocused, itemsToRender.length, user?.id, queryClient]),
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewLogTimeoutRef.current) {
        clearTimeout(viewLogTimeoutRef.current);
      }
    };
  }, []);

  // Loading state with skeleton
  if (isLoading && !feedData) {
    return (
      <SafeAreaView style={styles.safeAreaOuter} edges={['left', 'right']}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={[styles.containerForLayout, { paddingTop: insets.top }]}>
          <FlashList
            data={Array(3).fill(null)}
            renderItem={() => <FeedItemSkeleton />}
            keyExtractor={(_, index) => `feed-skeleton-${index}`}
            estimatedItemSize={itemHeight}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (feedError) {
    return (
      <SafeAreaView style={styles.safeAreaOuter} edges={['left', 'right']}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
          <Text style={styles.errorText}>
            Error loading feed: {feedError.message}
          </Text>
          <Text style={styles.retryText} onPress={() => refetchFeed({} as any)}>
            Tap to retry
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (itemsToRender.length === 0) {
    return (
      <SafeAreaView style={styles.safeAreaOuter} edges={['left', 'right']}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
          <Text style={styles.emptyText}>No recipes found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeAreaOuter} edges={['left', 'right']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.containerForLayout} onLayout={handleContainerLayout}>
        {layoutReady && (
          <View style={styles.flashListContainer}>
            <FlashList<FeedItem>
              ref={flashListRef}
              data={itemsToRender}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              estimatedItemSize={itemHeight}
              pagingEnabled
              disableIntervalMomentum
              showsVerticalScrollIndicator={false}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
              extraData={{ currentIndex, isFeedScreenFocused }}
              overrideItemLayout={layout => {
                // eslint-disable-next-line no-param-reassign
                layout.size = itemHeight;
              }}
              decelerationRate="fast"
              // VIDEO-FRIENDLY: Removed removeClippedSubviews to prevent video playback issues
            />
          </View>
        )}
      </View>

      {/* "What Can I Cook?" Insufficient Items Modal */}
      <Suspense fallback={null}>
        <InsufficientItemsModal
          visible={showInsufficientModal}
          onClose={handleCloseModal}
          onNavigateToPantry={handleNavigateToPantry}
          currentItemCount={pantryItemCount}
        />
      </Suspense>
    </SafeAreaView>
  );
});

FeedScreenOptimized.displayName = 'FeedScreenOptimized';

export default FeedScreenOptimized;
