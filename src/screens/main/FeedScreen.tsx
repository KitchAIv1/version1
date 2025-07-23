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
import { registerFeedRefresh } from '../../utils/feedRefresh';

// Import "What Can I Cook?" components
import InsufficientItemsModal from '../../components/modals/InsufficientItemsModal';
import { useWhatCanICook } from '../../hooks/useWhatCanICook';

// Import SafeWrapper for error boundary protection
import SafeWrapper from '../../components/SafeWrapper';
import { logMemoryUsage, useMemoryMonitor, SafeViewLogger } from '../../utils/memoryUtils';
import { createResilientSupabaseCall } from '../../utils/networkResilience';

// PHASE 3: Add performance monitoring and loading enhancements
import { usePerformanceTracking } from '../../utils/performanceWrapper';
import { LoadingEnhancement } from '../../components/LoadingEnhancement';
import { performanceBenchmark } from '../../utils/performanceBenchmark';
import { 
  useStandardizedScreenPerformance, 
  getStandardizedLoadingConfig 
} from '../../utils/codeConsolidation';
import { feedLog, performanceLog, logPerformanceMetric, logBetaEvent } from '../../config/logger';

// Move styles to top to fix "styles used before defined" errors
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

export default React.memo(function FeedScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheManager = useCacheManager();
  const { smartSync, syncSingleRecipe } = useCommentCountSync();
  
  // PHASE 3: Non-intrusive performance monitoring wrapper
  const { trackSearch } = usePerformanceTracking('FeedScreen');
  const { trackVideoOperation, trackApiCall, logMemoryPeriodically } = useStandardizedScreenPerformance('FeedScreen');
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
  const [viewLogger] = useState(() => new SafeViewLogger(1000)); // Memory-efficient view logging

  const itemsToRender: FeedItem[] = feedData || [];

  // MEMORY MONITORING: Track memory usage in development
  const { logMemory } = useMemoryMonitor('FeedScreen', 30000);
  
  // PHASE 3: Start periodic memory logging
  useEffect(() => {
    logMemoryPeriodically();
  }, [logMemoryPeriodically]);

  // 🔝 REGISTER FEED REFRESH: Connect tab press to scroll-to-top
  useEffect(() => {
    const handleFeedRefresh = () => {
      console.log("🔝 Tab press detected - scrolling to top (TikTok-style)");
      
      if (flashListRef.current) {
        setCurrentIndex(0);
        try {
          flashListRef.current.scrollToIndex({
            index: 0,
            animated: true,
          });
        } catch (error) {
          // Fallback to scrollToOffset if scrollToIndex fails
          console.warn("ScrollToIndex failed, using scrollToOffset:", error);
          flashListRef.current.scrollToOffset({
            offset: 0,
            animated: true,
          });
        }
      }
    };

    // Register the refresh function with MainTabs
    registerFeedRefresh(handleFeedRefresh);
    
    // Cleanup on unmount
    return () => {
      registerFeedRefresh(() => {});
    };
  }, []);
  // 🔝 TIKTOK-STYLE SCROLL TO TOP: Auto scroll when feed refreshes
  useEffect(() => {
    if (feedData && feedData.length > 0 && flashListRef.current) {
      // Check if this is a refresh (not initial load)
      const prevData = prevFeedItemsRef.current;
      const isRefresh = prevData && prevData.length > 0 && 
                       feedData.length > 0 && 
                       prevData[0]?.id !== feedData[0]?.id;
      
      if (isRefresh) {
        console.log('🔝 Feed refreshed - auto-scrolling to top (TikTok-style)');
        // Reset current index to 0
        setCurrentIndex(0);
        
        // Scroll to top with smooth animation
        setTimeout(() => {
          flashListRef.current?.scrollToIndex({
            index: 0,
            animated: true,
          });
        }, 100); // Small delay to ensure FlashList is ready
      }
      
      // Update previous data reference
      prevFeedItemsRef.current = feedData;
    }
  }, [feedData]);

  // MEMORY OPTIMIZATION: SafeViewLogger handles cleanup automatically
  useEffect(() => {
    // Log current view logger size periodically in development
    if (__DEV__) {
      const monitorInterval = setInterval(() => {
        logPerformanceMetric('FeedScreen View Logger', viewLogger.getSize(), { metric: 'items_tracked' });
      }, 60000); // Check every minute
      
      return () => clearInterval(monitorInterval);
    }
    
    // Return cleanup function for all paths
    return () => {
      // No cleanup needed in production mode
    };
  }, [viewLogger]);

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
      feedLog.info('[FeedScreen] 🎧 Cleaning up real-time comment monitoring');
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
        // MEMORY OPTIMIZATION: Use refs to track timeouts for cleanup
        const timeouts: ReturnType<typeof setTimeout>[] = [];
        itemsNeedingSync.forEach((item: FeedItem, index: number) => {
          const timeout = setTimeout(() => {
            cacheManager.updateLikeCount(item.id, user.id);
          }, index * 500);
          timeouts.push(timeout);
        });

        // Cleanup function to clear timeouts if component unmounts
        return () => {
          timeouts.forEach(timeout => clearTimeout(timeout));
        };
      }
    }
    
    // Return cleanup function for all paths
    return () => {
      // No cleanup needed when conditions aren't met
    };
  }, [isFeedScreenFocused, feedData, currentIndex, user?.id, cacheManager]);

  // 🎯 OPTIMIZED FOCUS EFFECT: Only handle essential comment sync
  useFocusEffect(
    useCallback(() => {
      if (feedData && feedData.length > 0 && user?.id) {
        logBetaEvent('FeedScreen', 'smart-sync-triggered', { feedItemCount: feedData?.length });
        
        const startIndex = Math.max(0, currentIndex);
        const endIndex = Math.min(feedData.length, startIndex + 3);
        const visibleRecipeIds = feedData
          .slice(startIndex, endIndex)
          .map(item => item.id);

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
            // MEMORY MONITORING: Log memory usage on scroll
            if (__DEV__ && newIndex % 5 === 0) { // Log every 5th item
              logMemoryUsage(`FeedScreen - Item ${newIndex}`);
            }
            return newIndex;
          }
          return prevIndex;
        });
        const recipeItem = itemsToRender[newIndex];
        if (user?.id && recipeItem?.id && !viewLogger.hasLogged(recipeItem.id)) {
          console.log(
            `[FeedScreen] Logging view for recipe ${recipeItem.id} by user ${user.id}`,
          );
          
          // PHASE 3: Track video view performance (non-intrusive)
          const viewStartTime = Date.now();
          
          createResilientSupabaseCall(async () => {
            const result = await supabase.rpc('log_recipe_view', {
              p_user_id: user.id,
              p_recipe_id: recipeItem.id,
            });
            return result;
          })
            .then((result: any) => {
              const { error: rpcError } = result;
              if (rpcError) {
                // Check if it's a duplicate key error (user already viewed this recipe)
                if (rpcError.code === '23505') {
                  console.log(
                    `[FeedScreen] View already logged for recipe ${recipeItem.id} - skipping`,
                  );
                  viewLogger.markAsLogged(recipeItem.id); // Mark as logged to prevent retries
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
                viewLogger.markAsLogged(recipeItem.id);
                
                // PHASE 3: Track video view logging performance (development only)
                if (__DEV__) {
                  const viewDuration = Date.now() - viewStartTime;
                  if (viewDuration > 100) { // Only log if slower than 100ms
                    console.log(`[Performance] 🎬 Video view log: ${viewDuration}ms`);
                  }
                }
              }
            });
        }
      }
    },
    [itemsToRender, user, viewLogger],
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
      logPerformanceMetric('FeedScreen Layout', itemHeight, { metric: 'item_height' });
    }
  }, [itemHeight]);

  return (
    <SafeWrapper componentName="FeedScreen">
      <SafeAreaView style={styles.safeAreaOuter} edges={['left', 'right']}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        


        <View style={styles.containerForLayout} onLayout={handleContainerLayout}>
          {!isLoading && itemsToRender.length === 0 && (
            <View style={styles.centeredMessageContainer}>
              <Text style={styles.emptyText}>No recipes found</Text>
            </View>
          )}

          {feedError && (
            <View style={styles.centeredMessageContainer}>
              <Text style={styles.errorText}>Error loading feed</Text>
            </View>
          )}

          {/* Enhanced loading with skeletons */}
          {isLoading && (
            <View style={styles.centeredMessageContainer}>
              <ActivityIndicator size="large" color="#666" />
            </View>
          )}

          {layoutReady && itemsToRender.length > 0 && (
            <View style={styles.flashListContainer}>
              <FlashList<FeedItem>
                ref={flashListRef}
                data={itemsToRender}
                keyExtractor={item => item.id}
                renderItem={({ item, index }) => {
                  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Pass adjacent video URLs for preloading
                  const nextVideoUrl = index < itemsToRender.length - 1 
                    ? itemsToRender[index + 1]?.video_url || itemsToRender[index + 1]?.video 
                    : undefined;
                  const prevVideoUrl = index > 0 
                    ? itemsToRender[index - 1]?.video_url || itemsToRender[index - 1]?.video 
                    : undefined;

                  return (
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
                      // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Enable video preloading
                      nextVideoUrl={nextVideoUrl}
                      prevVideoUrl={prevVideoUrl}
                    />
                  );
                }}
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
                              decelerationRate="fast"
              // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Optimized FlashList settings for video
              // VIDEO-FRIENDLY OPTIMIZATIONS: Removed aggressive optimizations that interfere with video playback:
                // - removeClippedSubviews: Causes videos to unmount/remount when scrolling
                // - drawDistance: Limits render distance causing video state loss  
                // - getItemType: Aggressive recycling interferes with video component state
              />
            </View>
          )}
        </View>

        {/* "What Can I Cook?" Insufficient Items Modal */}
        <InsufficientItemsModal
          visible={showInsufficientModal}
          onClose={handleCloseModal}
          currentItemCount={pantryItemCount}
        />
      </SafeAreaView>
    </SafeWrapper>
  );
});
