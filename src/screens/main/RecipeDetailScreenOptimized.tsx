import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Animated,
  StatusBar,
  Share,
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  useFocusEffect,
  useIsFocused,
} from '@react-navigation/native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';

// Optimized imports
import { MainStackParamList } from '../../navigation/types';
import useRecipeDetails, {
  RecipeDetailsData,
} from '../../hooks/useRecipeDetails';
import { useAuth } from '../../providers/AuthProvider';
import {
  useScreenLoadTracking,
  useApiPerformanceTracking,
} from '../../hooks/usePerformanceMonitoring';

// PHASE 3: Add enhanced performance monitoring and loading improvements
import { usePerformanceTracking } from '../../utils/performanceWrapper';
import { LoadingEnhancement } from '../../components/LoadingEnhancement';
import { performanceBenchmark } from '../../utils/performanceBenchmark';
import { supabase } from '../../services/supabase';
import { useGroceryManager } from '../../hooks/useGroceryManager';
import { COLORS } from '../../constants/theme';
import { useDailyMealPlan, MealSlot } from '../../hooks/useDailyMealPlan';
import {
  useLikeMutation,
  useSaveMutation,
} from '../../hooks/useRecipeMutations';
import { useCommentCountSync } from '../../hooks/useCommentCountSync';

// Lazy-loaded components for better performance
const ActionOverlay = React.lazy(
  () => import('../../components/ActionOverlay'),
);
const IngredientsTab = React.lazy(
  () => import('../recipe-detail-tabs/IngredientsTab'),
);
const StepsTab = React.lazy(() => import('../recipe-detail-tabs/StepsTab'));
const MacrosTab = React.lazy(() => import('../recipe-detail-tabs/MacrosTab'));
const AddToMealPlannerModal = React.lazy(
  () => import('../../components/modals/AddToMealPlannerModal'),
);
const CommentsModal = React.lazy(
  () => import('../../components/CommentsModal'),
);

// Types
type RecipeDetailScreenRouteProp = RouteProp<
  MainStackParamList,
  'RecipeDetail'
>;

// Constants
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const HEADER_HEIGHT = screenHeight * 0.4;
const TAB_ROUTES = {
  INGREDIENTS: 'Ingredients',
  STEPS: 'Steps',
  MACROS: 'Macros',
} as const;

// Optimized Tab Navigator Component
const OptimizedTabNavigator = React.memo<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: string[];
  tabContent: React.ReactNode;
  onTabChange?: (tab: string) => void;
}>(({ activeTab, setActiveTab, tabs, tabContent, onTabChange }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      onTabChange?.(tab);

      Animated.spring(animatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start(() => {
        animatedValue.setValue(0);
      });
    },
    [setActiveTab, onTabChange, animatedValue],
  );

  const tabButtons = useMemo(
    () =>
      tabs.map(tab => (
        <TouchableOpacity
          key={`tab-${tab}`}
          style={[
            styles.tabButton,
            activeTab === tab && styles.activeTabButton,
          ]}
          onPress={() => handleTabChange(tab)}>
          <Text
            style={[
              styles.tabButtonText,
              activeTab === tab && styles.activeTabButtonText,
            ]}>
            {tab}
          </Text>
        </TouchableOpacity>
      )),
    [tabs, activeTab, handleTabChange],
  );

  return (
    <View style={styles.customTabContainer}>
      <View style={styles.tabBarContainer}>{tabButtons}</View>
      <Animated.View
        style={[
          styles.tabContentContainer,
          {
            opacity: animatedValue.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 0.8, 1],
            }),
            transform: [
              {
                scale: animatedValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0.98, 1],
                }),
              },
            ],
          },
        ]}>
        {tabContent}
      </Animated.View>
    </View>
  );
});
OptimizedTabNavigator.displayName = 'OptimizedTabNavigator';

// Optimized Video Player Component
const OptimizedVideoPlayer = React.memo<{
  videoUrl?: string;
  isScreenFocused: boolean;
  onLoad: (status: AVPlaybackStatus) => void;
  onError: (error: string) => void;
  initialSeekTime: number;
  recipeId: string;
}>(
  ({
    videoUrl,
    isScreenFocused,
    onLoad,
    onError,
    initialSeekTime,
    recipeId,
  }) => {
    const videoRef = useRef<Video>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Utility function to format time
    const formatTime = (milliseconds: number): string => {
      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Toggle mute function (Instagram style)
    const toggleMute = useCallback(async () => {
      if (videoRef.current) {
        try {
          await videoRef.current.setIsMutedAsync(!isMuted);
          setIsMuted(!isMuted);
        } catch (error) {
          console.error('Error toggling mute:', error);
        }
      }
    }, [isMuted]);

    // Optimized video playback control
    useEffect(() => {
      const videoElement = videoRef.current;
      if (videoElement && isLoaded) {
        if (isScreenFocused) {
          videoElement
            .playAsync()
            .then(() => setIsPlaying(true))
            .catch(e =>
              console.error(`Video ${recipeId}: Focus play error:`, e),
            );
        } else {
          videoElement
            .pauseAsync()
            .then(() => setIsPlaying(false))
            .catch(e =>
              console.error(`Video ${recipeId}: Focus pause error:`, e),
            );
        }
      }
    }, [isLoaded, isScreenFocused, recipeId]);

    const handleLoad = useCallback(
      async (status: AVPlaybackStatus) => {
        if (status.isLoaded) {
          if (videoRef.current) {
            if (initialSeekTime > 0) {
              await videoRef.current.setPositionAsync(initialSeekTime, {
                toleranceMillisBefore: 100,
                toleranceMillisAfter: 100,
              });
            }
          }
          setIsLoaded(true);
          setDuration(status.durationMillis || 0);
          setCurrentPosition(status.positionMillis || 0);
          onLoad(status);
        } else if (status.error) {
          onError(status.error);
        }
      },
      [initialSeekTime, onLoad, onError],
    );

    // Progress tracking effect
    useEffect(() => {
      if (!isLoaded || !isPlaying || isDragging) return;
      
      const interval = setInterval(() => {
        if (videoRef.current) {
          videoRef.current.getStatusAsync().then((status) => {
            if (status.isLoaded && status.positionMillis !== undefined) {
              setCurrentPosition(status.positionMillis);
            }
          });
        }
      }, 500);
      
      return () => clearInterval(interval);
    }, [isLoaded, isPlaying, isDragging]);

    if (!videoUrl) {
      return (
        <View style={[styles.video, styles.videoPlaceholder]}>
          <Ionicons name="videocam-off-outline" size={48} color="#ccc" />
          <Text style={{ color: '#ccc' }}>Video not available</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <TouchableOpacity
          style={styles.videoTouchArea}
          onPress={toggleMute}
          activeOpacity={1}>
          <Video
            ref={videoRef}
            style={styles.videoPlayer}
            source={{ uri: videoUrl }}
            useNativeControls={false}
            resizeMode={ResizeMode.COVER}
            isLooping
            onLoad={handleLoad}
            onError={onError}
            progressUpdateIntervalMillis={500}
            shouldPlay={isScreenFocused}
            isMuted={isMuted}
          />
        </TouchableOpacity>
        
        {/* Custom Video Controls - Instagram Style */}
        {isLoaded && (
          <View style={styles.instagramProgressContainer}>
            <TouchableOpacity
              onPress={(event) => {
                const { locationX } = event.nativeEvent;
                const progressBarWidth = screenWidth; // Full screen width
                const percentage = Math.max(0, Math.min(1, locationX / progressBarWidth));
                const newPosition = percentage * duration;
                
                if (videoRef.current && duration > 0) {
                  videoRef.current.setPositionAsync(newPosition);
                  setCurrentPosition(newPosition);
                }
              }}
              activeOpacity={1}
              style={{ flex: 1, height: 20, justifyContent: 'center' }}>
              <View style={styles.instagramProgressBar}>
                <View 
                  style={[
                    styles.instagramProgressFill, 
                    { width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%` }
                  ]} 
                />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);
OptimizedVideoPlayer.displayName = 'OptimizedVideoPlayer';

// Optimized Recipe Info Component
const OptimizedRecipeInfo = React.memo<{
  recipeDetails: RecipeDetailsData;
  matchedCount: number;
  totalCount: number;
  onNavigateToAuthor: () => void;
  navigation: any;
}>(
  ({
    recipeDetails,
    matchedCount,
    totalCount,
    onNavigateToAuthor,
    navigation,
  }) => {
    const prepTime = recipeDetails?.prep_time_minutes;
    const cookTime = recipeDetails?.cook_time_minutes;
    const totalTime = (prepTime || 0) + (cookTime || 0);

    return (
      <View style={styles.recipeInfoSection}>
        {/* Recipe Title - Centered without interference */}
        <Text
          style={styles.recipeTitleText}
          numberOfLines={3}
          ellipsizeMode="tail">
          {recipeDetails.title}
        </Text>
        
        {/* View Count - Separate layer, doesn't affect layout */}
        {typeof recipeDetails.views_count === 'number' && (
          <View style={styles.viewCountBadge}>
            <Ionicons name="eye-outline" size={16} color={COLORS.textSecondary || '#666'} />
            <Text style={styles.viewCountText}>
              {recipeDetails.views_count.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Author Info Row */}
        {(recipeDetails?.username || recipeDetails?.is_ai_generated) && (
          <TouchableOpacity
            style={styles.authorInfoRow}
            onPress={
              recipeDetails?.is_ai_generated ? undefined : onNavigateToAuthor
            }
            disabled={recipeDetails?.is_ai_generated}>
            {recipeDetails?.is_ai_generated ? (
              <View style={styles.authorAvatarPlaceholder}>
                <Ionicons name="sparkles" size={18} color="#10b981" />
              </View>
            ) : recipeDetails.avatar_url ? (
              <Image
                source={{ uri: recipeDetails.avatar_url }}
                style={styles.authorAvatarImage}
              />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={COLORS.primary || '#00796b'}
                />
              </View>
            )}
            <Text style={styles.authorNameText}>
              {recipeDetails?.is_ai_generated
                ? 'Kitch AI'
                : recipeDetails.username || 'Unknown Author'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Pantry Badge Row */}
        <View style={styles.pantryBadgeRow}>
          <Ionicons name="restaurant-outline" style={styles.pantryBadgeIcon} />
          <Text style={styles.pantryBadgeInfoText}>
            {matchedCount}/{totalCount} Ingredients in pantry
          </Text>
        </View>

        {/* Time Info Row */}
        <View style={styles.timeInfoRow}>
          {prepTime !== null && (
            <Text style={styles.timeDetailText}>Prep: {prepTime} min</Text>
          )}
          {cookTime !== null && (
            <Text style={styles.timeDetailText}>Cook: {cookTime} min</Text>
          )}
          {totalTime > 0 && (
            <Text style={styles.timeDetailText}>Total: {totalTime} min</Text>
          )}
        </View>
      </View>
    );
  },
);
OptimizedRecipeInfo.displayName = 'OptimizedRecipeInfo';

// Optimized Action Row Component
const OptimizedActionRow = React.memo<{
  recipeDetails: RecipeDetailsData;
  user: any;
  likeMutation: any;
  saveMutation: any;
  onComment: () => void;
  onShare: () => void;
  recipeId: string;
}>(
  ({
    recipeDetails,
    user,
    likeMutation,
    saveMutation,
    onComment,
    onShare,
    recipeId,
  }) => {
    const handleLike = useCallback(() => {
      if (!user?.id) {
        Alert.alert(
          'Authentication Required',
          'Please log in to like recipes.',
        );
        return;
      }
      likeMutation.mutate(recipeId);
    }, [user?.id, likeMutation, recipeId]);

    const handleSave = useCallback(() => {
      if (!user?.id) {
        Alert.alert(
          'Authentication Required',
          'Please log in to save recipes.',
        );
        return;
      }
      saveMutation.mutate(recipeId);
    }, [user?.id, saveMutation, recipeId]);

    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            (!user?.id || likeMutation.isPending) &&
              styles.actionButtonDisabled,
          ]}
          onPress={handleLike}
          disabled={!user?.id || likeMutation.isPending}>
          {likeMutation.isPending ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons
              name={recipeDetails?.is_liked_by_user ? 'heart' : 'heart-outline'}
              size={26}
              color={
                recipeDetails?.is_liked_by_user ? COLORS.error : COLORS.primary
              }
            />
          )}
          {recipeDetails?.likes !== undefined && (
            <Text style={styles.actionCount}>{recipeDetails.likes}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            (!user?.id || saveMutation.isPending) &&
              styles.actionButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!user?.id || saveMutation.isPending}>
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons
              name={
                recipeDetails?.is_saved_by_user
                  ? 'bookmark'
                  : 'bookmark-outline'
              }
              size={24}
              color={COLORS.primary}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onComment}>
          <Ionicons
            name="chatbubble-outline"
            size={24}
            color={COLORS.primary}
          />
          {recipeDetails?.comments_count !== undefined && (
            <Text style={styles.actionCount}>
              {recipeDetails.comments_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onShare}>
          <Ionicons name="share-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    );
  },
);
OptimizedActionRow.displayName = 'OptimizedActionRow';

// Main RecipeDetailScreen component
export const RecipeDetailScreenOptimized = React.memo(() => {

  
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { syncSingleRecipe } = useCommentCountSync();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { groceryList, fetchGroceryList } = useGroceryManager();
  const isScreenFocused = useIsFocused();

    // Performance tracking - Using optimized monitoring (removed duplicate tracking)
  useScreenLoadTracking('RecipeDetailScreen');
  const { startApiCall, endApiCall } = useApiPerformanceTracking();

  // Route params
  const id = route.params?.id;
  const initialSeekTime = route.params?.initialSeekTime ?? 0;
  const initialTabFromParams = route.params?.initialTab;

  // State
  const [isLoaded, setIsLoaded] = useState(false);
  const [videoPlayerError, setVideoPlayerError] = useState<string | null>(null);
  const [currentScrollPosition, setCurrentScrollPosition] = useState(0);
  const [isPlannerModalVisible, setIsPlannerModalVisible] = useState(false);
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  // Set initial activeTab based on route param
  const [activeTab, setActiveTab] = useState(() => {
    if (
      initialTabFromParams &&
      Object.values(TAB_ROUTES).includes(
        initialTabFromParams as (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES],
      )
    ) {
      return initialTabFromParams as (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES];
    }
    return TAB_ROUTES.INGREDIENTS;
  });

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const lastFocusTimeRef = useRef(Date.now());

  // Meal Planner integration
  const { addRecipeToSlot } = useDailyMealPlan(
    format(new Date(), 'yyyy-MM-dd'),
  );

  // Optimized data fetching
  const {
    data: recipeDetails,
    isLoading,
    error,
  } = useRecipeDetails(id, user?.id);

  // Optimized mutations
  const likeMutation = useLikeMutation(user?.id);
  const saveMutation = useSaveMutation(user?.id);

  // Track modal state changes
  useEffect(() => {
    setIsAnyModalOpen(isPlannerModalVisible || isCommentsModalVisible);
  }, [isPlannerModalVisible, isCommentsModalVisible]);

  // Optimized focus effect
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;

      const now = Date.now();
      const timeSinceLastFocus = now - lastFocusTimeRef.current;

      if (
        !isAnyModalOpen &&
        (timeSinceLastFocus > 5000 || timeSinceLastFocus > 30000)
      ) {
        const callId = `grocery_list_fetch_${Date.now()}`;
        startApiCall(callId);
        fetchGroceryList(user.id).finally(() =>
          endApiCall(callId, 'grocery_list_fetch'),
        );
      }

      lastFocusTimeRef.current = now;
    }, [user?.id, fetchGroceryList, isAnyModalOpen, startApiCall, endApiCall]),
  );

  // Optimized comment sync
  useEffect(() => {
    if (isScreenFocused && !isAnyModalOpen && id && user?.id) {
      const callId = `comment_sync_${Date.now()}`;
      startApiCall(callId);
      syncSingleRecipe(id, user.id).finally(() =>
        endApiCall(callId, 'comment_sync'),
      );
    }
  }, [
    isScreenFocused,
    isAnyModalOpen,
    id,
    user?.id,
    syncSingleRecipe,
    startApiCall,
    endApiCall,
  ]);

  // Reset video error when video_url changes
  useEffect(() => {
    setVideoPlayerError(null);
    setIsLoaded(false);
  }, [recipeDetails?.video_url]);

  // Memoized calculations
  const ingredients = useMemo(() => {
    if (!recipeDetails?.ingredients) return [];
    try {
      const { parseIngredients } = require('../../utils/parseIngredients');
      return parseIngredients(recipeDetails.ingredients);
    } catch {
      return recipeDetails.ingredients;
    }
  }, [recipeDetails?.ingredients]);

  const matchedSet = useMemo(
    () =>
      new Set(
        (recipeDetails?.matched_ingredients || []).map(name =>
          name.trim().toLowerCase(),
        ),
      ),
    [recipeDetails?.matched_ingredients],
  );

  const matchedCount = useMemo(
    () =>
      ingredients.filter((ing: any) =>
        matchedSet.has(ing.name?.trim().toLowerCase()),
      ).length,
    [ingredients, matchedSet],
  );

  const totalCount = ingredients.length;

  // Optimized handlers
  const handleLoad = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
    }
  }, []);

  const handleError = useCallback((error: string) => {
    setVideoPlayerError(
      'Video playback failed. Please check your connection or try again later.',
    );
    setIsLoaded(false);
  }, []);

  const handleShare = useCallback(async () => {
    if (!recipeDetails) return;

    try {
      await Share.share({
        message: `Check out this recipe: ${recipeDetails.title}`,
        url: `https://kitchai.app/recipe/${id}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [recipeDetails, id]);

  const handleCommentPress = useCallback(() => {
    setIsCommentsModalVisible(true);
  }, []);

  const handleNavigateToAuthorProfile = useCallback(() => {
    if (recipeDetails?.user_id) {
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { userId: recipeDetails.user_id },
      });
    }
  }, [recipeDetails?.user_id, navigation]);

  const handleTabChange = useCallback(
    (tab: string) => {
      // PHASE 3: Track tab switching performance (non-intrusive)
      const tabStartTime = Date.now();
      
      if (currentScrollPosition > HEADER_HEIGHT) {
        scrollViewRef.current?.scrollTo({
          y: HEADER_HEIGHT,
          animated: true,
        });
      }
      
      // PHASE 3: Log tab performance in development
      if (__DEV__) {
        const tabDuration = Date.now() - tabStartTime;
      }
    },
    [currentScrollPosition],
  );

  const handleScroll = useCallback((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    setCurrentScrollPosition(scrollY);
  }, []);

  const handleOpenPlannerModal = useCallback(() => {
    if (!recipeDetails) {
      Alert.alert('Error', 'Recipe details not loaded yet.');
      return;
    }
    setIsPlannerModalVisible(true);
  }, [recipeDetails]);

  const handleClosePlannerModal = useCallback(() => {
    setIsPlannerModalVisible(false);
  }, []);

  const handleAddToMealPlan = useCallback(
    async (date: Date, slot: MealSlot) => {
      if (!recipeDetails) {
        Alert.alert('Error', 'Cannot add to plan, recipe details are missing.');
        return;
      }

      const dateString = format(date, 'yyyy-MM-dd');
      try {
        await addRecipeToSlot({
          planDate: dateString,
          slot,
          recipeId: recipeDetails.recipe_id,
          recipeTitle: recipeDetails.title,
          recipeThumbnailUrl: recipeDetails.video_url || undefined,
        });

        Alert.alert(
          'Success',
          `Added ${recipeDetails.title} to your meal plan for ${format(date, 'MMM d, yyyy')} (${slot}).`,
        );

        queryClient.invalidateQueries({
          queryKey: ['dailyMealPlan', dateString],
        });
      } catch (e: any) {
        Alert.alert(
          'Error',
          e.message ||
            'An unexpected error occurred while adding to meal plan.',
        );
      }
      setIsPlannerModalVisible(false);
    },
    [recipeDetails, addRecipeToSlot, queryClient],
  );

  const handleCloseCommentsModal = useCallback(() => {
    setIsCommentsModalVisible(false);
  }, []);

  // Memoized tab content
  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case TAB_ROUTES.INGREDIENTS:
        return (
          <Suspense fallback={<ActivityIndicator size="large" />}>
            <IngredientsTab />
          </Suspense>
        );
      case TAB_ROUTES.STEPS:
        return (
          <Suspense fallback={<ActivityIndicator size="large" />}>
            <StepsTab steps={recipeDetails?.preparation_steps} />
          </Suspense>
        );
      case TAB_ROUTES.MACROS:
        return (
          <Suspense fallback={<ActivityIndicator size="large" />}>
            <MacrosTab />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<ActivityIndicator size="large" />}>
            <IngredientsTab />
          </Suspense>
        );
    }
  }, [activeTab, recipeDetails?.preparation_steps]);

  // Wrapper function for setActiveTab to handle type conversion
  const handleSetActiveTab = useCallback((tab: string) => {
    if (Object.values(TAB_ROUTES).includes(tab as any)) {
      setActiveTab(tab as (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES]);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Error state
  if (error || !recipeDetails) {
    return (
      <View style={styles.centeredContainer}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.errorText}>
          {error || 'Could not load recipe details.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={currentScrollPosition > 50 ? 'dark-content' : 'light-content'}
      />

      {/* Fixed Video header */}
      <View style={styles.headerContainer}>
        {videoPlayerError ? (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF9800" />
            <Text style={styles.videoErrorText}>{videoPlayerError}</Text>
          </View>
        ) : recipeDetails?.is_ai_generated ? (
          <View style={styles.aiRecipeImageContainer}>
            <Image
              source={{
                uri:
                  recipeDetails.thumbnail_url ||
                  'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/porkstirfry.jpeg',
              }}
              style={styles.aiRecipeImage}
              resizeMode="cover"
            />
            <View style={styles.aiRecipeBadge}>
              <Ionicons name="sparkles" size={16} color="#10b981" />
              <Text style={styles.aiRecipeBadgeText}>AI Generated</Text>
            </View>
          </View>
        ) : (
          (() => {
        
            return (
              <OptimizedVideoPlayer
                videoUrl={recipeDetails?.video_url || undefined}
                isScreenFocused={isScreenFocused}
                onLoad={handleLoad}
                onError={handleError}
                initialSeekTime={initialSeekTime}
                recipeId={id || ''}
              />
            );
          })()
        )}

        {/* Back Arrow Button - Following React Navigation Best Practices */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <Ionicons name="arrow-back" size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Cart Icon with Badge */}
        <TouchableOpacity
          style={styles.cartButtonContainer}
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'GroceryList' })
          }>
          <Ionicons
            name="cart-outline"
            size={28}
            color={COLORS.white || '#FFF'}
          />
          {groceryList.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{groceryList.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces
        overScrollMode="always">
        {/* Recipe Info Section */}
        <OptimizedRecipeInfo
          recipeDetails={recipeDetails}
          matchedCount={matchedCount}
          totalCount={totalCount}
          onNavigateToAuthor={handleNavigateToAuthorProfile}
          navigation={navigation}
        />

        {/* Divider */}
        <View
          style={[styles.sectionDivider, { marginTop: 16, marginBottom: 10 }]}
        />

        {/* Action Row */}
        <OptimizedActionRow
          recipeDetails={recipeDetails}
          user={user}
          likeMutation={likeMutation}
          saveMutation={saveMutation}
          onComment={handleCommentPress}
          onShare={handleShare}
          recipeId={id || ''}
        />

        {/* Tab Navigator */}
        <OptimizedTabNavigator
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          tabs={Object.values(TAB_ROUTES)}
          tabContent={renderTabContent()}
          onTabChange={handleTabChange}
        />
      </ScrollView>

      {/* Modals */}
      <Suspense fallback={null}>
        <AddToMealPlannerModal
          isVisible={isPlannerModalVisible}
          onClose={handleClosePlannerModal}
          onAddToPlan={handleAddToMealPlan}
          recipeName={recipeDetails?.title || ''}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CommentsModal
          visible={isCommentsModalVisible}
          onClose={handleCloseCommentsModal}
          recipeId={id || ''}
        />
      </Suspense>
    </View>
  );
});

RecipeDetailScreenOptimized.displayName = 'RecipeDetailScreenOptimized';

// Styles
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.white || '#fff',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white || '#fff',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error || '#ff0000',
    textAlign: 'center',
    marginHorizontal: 20,
  },
  headerContainer: {
    height: HEADER_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  videoPlayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  videoErrorText: {
    color: '#FF9800',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 25,
    padding: 12,
    zIndex: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  aiRecipeImageContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiRecipeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  aiRecipeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiRecipeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  recipeInfoSection: {
    padding: 16,
    backgroundColor: COLORS.white || '#fff',
    position: 'relative',
  },
  recipeTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text || '#000',
    marginBottom: 12,
    lineHeight: 30,
    textAlign: 'center',
  },
  authorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  authorAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  authorAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  authorNameText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text || '#000',
  },
  pantryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pantryBadgeIcon: {
    fontSize: 18,
    color: COLORS.primary || '#00796b',
    marginRight: 8,
  },
  pantryBadgeInfoText: {
    fontSize: 14,
    color: COLORS.textSecondary || '#666',
    fontWeight: '500',
  },
  timeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 4,
    paddingBottom: 8,
  },
  timeDetailText: {
    color: COLORS.textSecondary || '#555',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border || '#eaeaea',
    marginHorizontal: 40,
    marginTop: 4,
    marginBottom: 16,
    opacity: 0.7,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 6,
    paddingBottom: 2,
    marginBottom: 0,
    borderBottomWidth: 0,
    borderColor: COLORS.border || '#eaeaea',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 70,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.surface || '#f0f0f0',
    opacity: 0.6,
  },
  actionCount: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary || '#666',
  },
  customTabContainer: {
    width: '100%',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#eaeaea',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary || '#00796b',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary || '#666',
    textTransform: 'capitalize',
  },
  activeTabButtonText: {
    color: COLORS.primary || '#00796b',
    fontWeight: '600',
  },
  tabContentContainer: {
    // No padding/margin here since individual tab components have their own
  },
  cartButtonContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.error || '#ff0000',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  videoTouchArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  instagramProgressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 15,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  instagramProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 0,
    overflow: 'hidden',
    marginHorizontal: 0,
  },
  instagramProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary || '#00796b',
    borderRadius: 0,
  },
  viewCountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  viewCountText: {
    fontSize: 12,
    color: COLORS.textSecondary || '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default RecipeDetailScreenOptimized;
