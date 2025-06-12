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
const ActionOverlay = React.lazy(() => import('../../components/ActionOverlay'));
const IngredientsTab = React.lazy(() => import('../recipe-detail-tabs/IngredientsTab'));
const StepsTab = React.lazy(() => import('../recipe-detail-tabs/StepsTab'));
const MacrosTab = React.lazy(() => import('../recipe-detail-tabs/MacrosTab'));
const AddToMealPlannerModal = React.lazy(() => import('../../components/modals/AddToMealPlannerModal'));
const CommentsModal = React.lazy(() => import('../../components/CommentsModal'));

// Types
type RecipeDetailScreenRouteProp = RouteProp<MainStackParamList, 'RecipeDetail'>;

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

  const handleTabChange = useCallback((tab: string) => {
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
  }, [setActiveTab, onTabChange, animatedValue]);

  const tabButtons = useMemo(() => 
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
    )), [tabs, activeTab, handleTabChange]);

  return (
    <View style={styles.customTabContainer}>
      <View style={styles.tabBarContainer}>
        {tabButtons}
      </View>
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
  isMuted: boolean;
  onToggleMute: () => void;
  onLoad: (status: AVPlaybackStatus) => void;
  onError: (error: string) => void;
  initialSeekTime: number;
  recipeId: string;
}>(({ 
  videoUrl, 
  isScreenFocused, 
  isMuted, 
  onToggleMute, 
  onLoad, 
  onError, 
  initialSeekTime,
  recipeId 
}) => {
  const videoRef = useRef<Video>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Optimized video playback control
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && isLoaded) {
      if (isScreenFocused) {
        videoElement
          .playAsync()
          .catch(e => console.error(`Video ${recipeId}: Focus play error:`, e));
      } else {
        videoElement
          .pauseAsync()
          .catch(e => console.error(`Video ${recipeId}: Focus pause error:`, e));
      }
    }
  }, [isLoaded, isScreenFocused, recipeId]);

  const handleLoad = useCallback(async (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (videoRef.current) {
        if (initialSeekTime > 0) {
          await videoRef.current.setPositionAsync(initialSeekTime, {
            toleranceMillisBefore: 100,
            toleranceMillisAfter: 100,
          });
        }
        await videoRef.current.setIsMutedAsync(isMuted);
      }
      setIsLoaded(true);
      onLoad(status);
    } else if (status.error) {
      onError(status.error);
    }
  }, [initialSeekTime, isMuted, onLoad, onError]);

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
        isMuted={isMuted}
      />
      <TouchableOpacity style={styles.muteButton} onPress={onToggleMute}>
        <Ionicons
          name={isMuted ? 'volume-mute' : 'volume-high'}
          size={24}
          color="white"
        />
      </TouchableOpacity>
    </View>
  );
});
OptimizedVideoPlayer.displayName = 'OptimizedVideoPlayer';

// Optimized Recipe Info Component
const OptimizedRecipeInfo = React.memo<{
  recipeDetails: RecipeDetailsData;
  matchedCount: number;
  totalCount: number;
  onNavigateToAuthor: () => void;
}>(({ recipeDetails, matchedCount, totalCount, onNavigateToAuthor }) => {
  const prepTime = recipeDetails?.prep_time_minutes;
  const cookTime = recipeDetails?.cook_time_minutes;
  const totalTime = (prepTime || 0) + (cookTime || 0);

  return (
    <View style={styles.recipeInfoSection}>
      <Text style={styles.recipeTitleText} numberOfLines={3} ellipsizeMode="tail">
        {recipeDetails.title}
      </Text>

      {/* Author Info Row */}
      {(recipeDetails?.username || recipeDetails?.is_ai_generated) && (
        <TouchableOpacity
          style={styles.authorInfoRow}
          onPress={recipeDetails?.is_ai_generated ? undefined : onNavigateToAuthor}
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
});
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
}>(({ recipeDetails, user, likeMutation, saveMutation, onComment, onShare, recipeId }) => {
  const handleLike = useCallback(() => {
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please log in to like recipes.');
      return;
    }
    likeMutation.mutate(recipeId);
  }, [user?.id, likeMutation, recipeId]);

  const handleSave = useCallback(() => {
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please log in to save recipes.');
      return;
    }
    saveMutation.mutate(recipeId);
  }, [user?.id, saveMutation, recipeId]);

  return (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[
          styles.actionButton,
          (!user?.id || likeMutation.isPending) && styles.actionButtonDisabled,
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
          (!user?.id || saveMutation.isPending) && styles.actionButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!user?.id || saveMutation.isPending}>
        {saveMutation.isPending ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons
            name={recipeDetails?.is_saved_by_user ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={COLORS.primary}
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={onComment}>
        <Ionicons name="chatbubble-outline" size={24} color={COLORS.primary} />
        {recipeDetails?.comments_count !== undefined && (
          <Text style={styles.actionCount}>{recipeDetails.comments_count}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={onShare}>
        <Ionicons name="share-outline" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
});
OptimizedActionRow.displayName = 'OptimizedActionRow';

// Main RecipeDetailScreen component
export const RecipeDetailScreenOptimized = React.memo(() => {
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { syncSingleRecipe } = useCommentCountSync();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { groceryList, fetchGroceryList } = useGroceryManager();
  const isScreenFocused = useIsFocused();

  // Performance tracking
  useScreenLoadTracking('RecipeDetailScreen');
  const { startApiCall, endApiCall } = useApiPerformanceTracking();

  // Route params
  const id = route.params?.id;
  const initialSeekTime = route.params?.initialSeekTime ?? 0;
  const initialTabFromParams = route.params?.initialTab;

  // State
  const [isMuted, setIsMuted] = useState(false);
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
  const { addRecipeToSlot } = useDailyMealPlan(format(new Date(), 'yyyy-MM-dd'));

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
        fetchGroceryList(user.id)
          .finally(() => endApiCall(callId, 'grocery_list_fetch'));
      }

      lastFocusTimeRef.current = now;
    }, [user?.id, fetchGroceryList, isAnyModalOpen, startApiCall, endApiCall]),
  );

  // Optimized comment sync
  useEffect(() => {
    if (isScreenFocused && !isAnyModalOpen && id && user?.id) {
      const callId = `comment_sync_${Date.now()}`;
      startApiCall(callId);
      syncSingleRecipe(id, user.id)
        .finally(() => endApiCall(callId, 'comment_sync'));
    }
  }, [isScreenFocused, isAnyModalOpen, id, user?.id, syncSingleRecipe, startApiCall, endApiCall]);

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
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

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

  const handleTabChange = useCallback((tab: string) => {
    if (currentScrollPosition > HEADER_HEIGHT) {
      scrollViewRef.current?.scrollTo({
        y: HEADER_HEIGHT,
        animated: true,
      });
    }
  }, [currentScrollPosition]);

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

  const handleAddToMealPlan = useCallback(async (date: Date, slot: MealSlot) => {
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
        e.message || 'An unexpected error occurred while adding to meal plan.',
      );
    }
    setIsPlannerModalVisible(false);
  }, [recipeDetails, addRecipeToSlot, queryClient]);

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
                  'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/app-assets/kitch-ai-recipe-default.jpg',
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
          <OptimizedVideoPlayer
            videoUrl={recipeDetails?.video_url}
            isScreenFocused={isScreenFocused}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onLoad={handleLoad}
            onError={handleError}
            initialSeekTime={initialSeekTime}
            recipeId={id || ''}
          />
        )}

        {/* Cart Icon with Badge */}
        <TouchableOpacity
          style={styles.cartButtonContainer}
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'GroceryList' })
          }>
          <Ionicons name="cart-outline" size={28} color={COLORS.white || '#FFF'} />
          {groceryList.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{groceryList.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* View Count */}
        {recipeDetails && typeof recipeDetails.views_count === 'number' && (
          <View style={styles.videoViewCountContainer}>
            <Ionicons name="eye-outline" style={styles.videoViewCountIcon} />
            <Text style={styles.videoViewCountText}>
              {recipeDetails.views_count.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Action Overlay */}
        <Suspense fallback={null}>
          <ActionOverlay
            recipeDetails={recipeDetails}
            onLike={() => likeMutation.mutate(id)}
            onSave={() => saveMutation.mutate(id)}
            onComment={handleCommentPress}
            onShare={handleShare}
            onAddToMealPlan={handleOpenPlannerModal}
            user={user}
            likeMutation={likeMutation}
            saveMutation={saveMutation}
          />
        </Suspense>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 80 },
        ]}
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
        />

        {/* Divider */}
        <View style={[styles.sectionDivider, { marginTop: 16, marginBottom: 10 }]} />

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
          setActiveTab={setActiveTab}
          tabs={Object.values(TAB_ROUTES)}
          tabContent={renderTabContent()}
          onTabChange={handleTabChange}
        />
      </ScrollView>

      {/* Modals */}
      <Suspense fallback={null}>
        <AddToMealPlannerModal
          visible={isPlannerModalVisible}
          onClose={handleClosePlannerModal}
          onAddToMealPlan={handleAddToMealPlan}
          recipeTitle={recipeDetails?.title || ''}
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
  muteButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
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
  videoViewCountContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  videoViewCountIcon: {
    fontSize: 15,
    color: 'white',
    marginRight: 5,
  },
  videoViewCountText: {
    fontSize: 13,
    color: 'white',
    fontWeight: '600',
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
  },
  recipeTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text || '#000',
    marginBottom: 12,
    lineHeight: 30,
  },
  authorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
});

export default RecipeDetailScreenOptimized; 