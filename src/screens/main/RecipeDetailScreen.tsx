// RecipeDetailScreen placeholder
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Share,
  Alert,
  Image,
  ScrollView,
  Animated,
  LayoutChangeEvent,
  StatusBar,
  Keyboard,
  KeyboardEvent,
  Platform,
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  useFocusEffect,
  useIsFocused,
  NavigationState,
} from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { MainStackParamList } from '../../navigation/types';
import useRecipeDetails, {
  RecipeDetailsData,
} from '../../hooks/useRecipeDetails';
import { RecipeItem } from '../../types';
import { useAuth } from '../../providers/AuthProvider';
import ActionOverlay from '../../components/ActionOverlay';
import IngredientsTab from '../recipe-detail-tabs/IngredientsTab';
import StepsTab from '../recipe-detail-tabs/StepsTab';
import MacrosTab from '../recipe-detail-tabs/MacrosTab';
import { supabase } from '../../services/supabase';
import { useGroceryManager } from '../../hooks/useGroceryManager';
import { COLORS } from '../../constants/theme';
import FloatingTabBar from '../../components/FloatingTabBar';
import { TikTokVideoControls } from '../../components/TikTokVideoControls';
import { useDailyMealPlan, MealSlot } from '../../hooks/useDailyMealPlan';
import AddToMealPlannerModal from '../../components/modals/AddToMealPlannerModal';
import CommentsModal from '../../components/CommentsModal';
import {
  useLikeMutation,
  useSaveMutation,
} from '../../hooks/useRecipeMutations';
import { useCommentCountSync } from '../../hooks/useCommentCountSync';

// Define route prop type
type RecipeDetailScreenRouteProp = RouteProp<
  MainStackParamList,
  'RecipeDetail'
>;

// Create Tab Navigator
const Tab = createMaterialTopTabNavigator();

// Define tab routes constant (keep this outside the component function)
const TAB_ROUTES = {
  INGREDIENTS: 'Ingredients',
  STEPS: 'Steps',
  MACROS: 'Macros',
};

// Create custom Tab Navigator to handle scroll issues
function CustomTabNavigator({
  activeTab,
  setActiveTab,
  tabs,
  tabContent,
  onTabChange,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: string[];
  tabContent: React.ReactNode;
  onTabChange?: (tab: string) => void;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);

    // Animate the tab transition
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start(() => {
      animatedValue.setValue(0);
    });
  };

  return (
    <View style={styles.customTabContainer}>
      <View style={styles.tabBarContainer}>
        {tabs.map(tab => (
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
        ))}
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
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const HEADER_HEIGHT = screenHeight * 0.4; // 40% of screen height

export default function RecipeDetailScreen() {
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { syncSingleRecipe } = useCommentCountSync();
  const id = route.params?.id;
  const initialSeekTime = route.params?.initialSeekTime ?? 0;
  const initialTabFromParams = route.params?.initialTab; // Read the initialTab param
  const videoRef = useRef<Video>(null);
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { groceryList, fetchGroceryList } = useGroceryManager();
  const scrollViewRef = useRef<ScrollView>(null);
  const isScreenFocused = useIsFocused(); // Added

  // Track modal states to prevent unnecessary operations when returning from modals
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  const lastFocusTimeRef = useRef(Date.now());

  // Meal Planner integration (V2)
  const { addRecipeToSlot } = useDailyMealPlan(
    format(new Date(), 'yyyy-MM-dd'),
  ); // Pass default date
  const [isPlannerModalVisible, setIsPlannerModalVisible] = useState(false);

  // Comments Modal state
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);

  // Track original tab bar measurements
  // const tabBarRef = useRef<View>(null);
  // const [tabBarPosition, setTabBarPosition] = useState(0);
  // const [tabBarHeight, setTabBarHeight] = useState(0);

  // State for floating tab bar control with debouncing
  const [shouldShowFloatingBar, setShouldShowFloatingBar] = useState(false);
  const floatingTabBarVisible = useRef(new Animated.Value(0)).current;
  const floatingBarAnimating = useRef(false);

  // Track tab content heights
  const [tabContentHeights, setTabContentHeights] = useState<
    Record<string, number>
  >({
    [TAB_ROUTES.INGREDIENTS]: 0,
    [TAB_ROUTES.STEPS]: 0,
    [TAB_ROUTES.MACROS]: 0,
  });

  const [currentScrollPosition, setCurrentScrollPosition] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  // Set initial activeTab based on route param or default to Ingredients
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
  const [videoPlayerError, setVideoPlayerError] = useState<string | null>(null);

  // Debug logging helper for visibility changes
  const logVisibilityChange = useRef(0);

  // Optimized focus effect - only fetch grocery list when truly needed
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;

      const now = Date.now();
      const timeSinceLastFocus = now - lastFocusTimeRef.current;

      // Only fetch if:
      // 1. More than 5 seconds since last focus (not just returning from modal)
      // 2. No modals are currently open
      // 3. This is the initial focus (timeSinceLastFocus > 30000)
      if (
        !isAnyModalOpen &&
        (timeSinceLastFocus > 5000 || timeSinceLastFocus > 30000)
      ) {
        console.log('RecipeDetailScreen focused, fetching grocery list...');
        fetchGroceryList(user.id);
        
        // ENHANCED: Also refresh recipe data if returning from a potential edit
        if (id && timeSinceLastFocus > 3000) {
          console.log(
            `[RecipeDetailScreen] Refreshing recipe data after focus (${timeSinceLastFocus}ms since last focus)`,
          );
          queryClient.invalidateQueries({
            queryKey: ['recipeDetails', id, user.id],
          });
          queryClient.invalidateQueries({
            queryKey: ['pantryMatch', id, user.id],
          });
        }
      }

      lastFocusTimeRef.current = now;
    }, [user?.id, fetchGroceryList, isAnyModalOpen, id, queryClient]),
  );

  // Track modal state changes
  useEffect(() => {
    setIsAnyModalOpen(isPlannerModalVisible || isCommentsModalVisible);
  }, [isPlannerModalVisible, isCommentsModalVisible]);

  // Fetch recipe details
  const {
    data: recipeDetails,
    isLoading,
    error,
  } = useRecipeDetails(id, user?.id);

  // Log when recipe details change, especially like state
  useEffect(() => {
    if (recipeDetails) {
      console.log(`[RecipeDetailScreen] Recipe details updated for ${id}:`, {
        is_liked_by_user: recipeDetails.is_liked_by_user,
        likes: recipeDetails.likes,
        is_saved_by_user: recipeDetails.is_saved_by_user,
        title: recipeDetails.title,
        timestamp: new Date().toISOString(),
      });
    }
  }, [
    recipeDetails?.is_liked_by_user,
    recipeDetails?.likes,
    recipeDetails?.is_saved_by_user,
    id,
  ]);

  // Optimized focus logging - reduce noise
  useEffect(() => {
    if (isScreenFocused && !isAnyModalOpen) {
      console.log(
        `[RecipeDetailScreen] Screen focused for recipe ${id}, current state:`,
        {
          is_liked_by_user: recipeDetails?.is_liked_by_user,
          likes: recipeDetails?.likes,
          is_saved_by_user: recipeDetails?.is_saved_by_user,
          comments_count: recipeDetails?.comments_count,
          timestamp: new Date().toISOString(),
        },
      );

      // EFFICIENT COMMENT COUNT SYNC: Update comment count when screen becomes focused
      if (id && user?.id) {
        console.log(
          `[RecipeDetailScreen] 🎯 Efficient sync comment count for recipe ${id}`,
        );
        syncSingleRecipe(id, user.id);
      }
    }
  }, [
    isScreenFocused,
    recipeDetails?.is_liked_by_user,
    recipeDetails?.likes,
    recipeDetails?.is_saved_by_user,
    recipeDetails?.comments_count,
    id,
    isAnyModalOpen,
    syncSingleRecipe,
    user?.id,
  ]);

  // Effect to reset video error when video_url changes
  useEffect(() => {
    setVideoPlayerError(null); // Clear previous errors when new video data comes in
    setIsLoaded(false); // Reset loaded state for the new video
  }, [recipeDetails?.video_url]);

  // --- Video Player Logic ---
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && isLoaded) {
      // Ensure video is loaded
      if (isScreenFocused) {
        videoElement
          .playAsync()
          .catch(e =>
            console.error(`RecipeDetailScreen ${id}: Focus play error:`, e),
          );
      } else {
        videoElement
          .pauseAsync()
          .catch(e =>
            console.error(`RecipeDetailScreen ${id}: Focus pause error:`, e),
          );
      }
    }
  }, [isLoaded, isScreenFocused, id, videoRef]); // Dependencies for focus-aware playback

  const handleLoad = async (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (videoRef.current) {
        if (initialSeekTime > 0) {
          // Set position but don't auto-play here; useEffect will handle it based on focus.
          await videoRef.current.setPositionAsync(initialSeekTime, {
            toleranceMillisBefore: 100,
            toleranceMillisAfter: 100,
          });
        }
        // Ensure video respects the current isMuted state upon loading
        await videoRef.current.setIsMutedAsync(isMuted);
        
        // Set video duration for TikTok controls
        if (status.durationMillis) {
          setVideoDuration(status.durationMillis / 1000);
        }
      }
      setIsLoaded(true); // This will trigger the focus-aware useEffect to potentially play the video
    } else if (status.error) {
      console.error(
        'Detail screen video load error from handleLoad:',
        status.error,
      );
      // Consider calling handleError if status.error is a string message, or adapt handleError
      // For now, just logging as original code did.
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) {
      console.error('toggleMute: videoRef.current is null or undefined');
      return; // Exit if no video ref
    }
    videoRef.current
      .setIsMutedAsync(!isMuted)
      .catch(e => console.error('setIsMutedAsync error:', e));
    setIsMuted(prevMuted => !prevMuted);
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await videoRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Toggle play error:', error);
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.positionMillis) {
        setVideoPosition(status.positionMillis / 1000);
      }
      if (status.durationMillis && videoDuration === 0) {
        setVideoDuration(status.durationMillis / 1000);
      }
      setIsPlaying(status.isPlaying || false);
    }
  };

  const handleError = (error: string) => {
    console.error(`RecipeDetailScreen ${id}: Video onError event:`, error);
    setVideoPlayerError(
      'Video playback failed. Please check your connection or try again later.',
    ); // Set user-friendly error
    setIsLoaded(false);
  };
  // --- End Video Player ---

  // Use optimized mutation hooks
  const likeMutation = useLikeMutation(user?.id);
  const saveMutation = useSaveMutation(user?.id);

  // Measure tab bar position after render and when recipe details change
  // useLayoutEffect(() => {
  //   if (!isLoading && recipeDetails) {
  //     const measureTabBar = () => {
  //       if (tabBarRef.current) {
  //         tabBarRef.current.measure((x, y, width, height, pageX, pageY) => {
  //           if (pageY > 0) {
  //             setTabBarPosition(pageY);
  //             setTabBarHeight(height);
  //             console.log('Tab bar measured:', { position: pageY, height });
  //           }
  //         });
  //       }
  //     };
  //
  //     // Measure after a delay to ensure layout is complete
  //     const initialTimer = setTimeout(measureTabBar, 300);
  //
  //     // Measure again after a longer delay as a backup
  //     const backupTimer = setTimeout(measureTabBar, 1000);
  //
  //     return () => {
  //       clearTimeout(initialTimer);
  //       clearTimeout(backupTimer);
  //     };
  //   }
  // }, [isLoading, recipeDetails]);

  // --- Optimistic updates for like/save ---
  // Removed old mutation logic - now using optimized hooks

  // --- Share Functionality ---
  const handleShare = async () => {
    const shareUrl = recipeDetails?.video_url || 'https://yourapp.com';
    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(shareUrl, {
          dialogTitle: `Check out this recipe: ${recipeDetails?.title || 'Recipe'}`,
        });
      } else {
        Alert.alert('Sharing not available on this device');
      }
    } catch (shareError: any) {
      console.error('Error sharing:', shareError);
      Alert.alert('Error', 'Could not share recipe.');
    }
  };
  // --- End Share ---

  // Calculate pantry badge values using the same logic as IngredientsTab
  const ingredients = React.useMemo(() => {
    if (!recipeDetails?.ingredients) return [];
    // Use the same parseIngredients utility
    try {
      const { parseIngredients } = require('../../utils/parseIngredients');
      return parseIngredients(recipeDetails.ingredients);
    } catch {
      return recipeDetails.ingredients;
    }
  }, [recipeDetails]);

  const matchedSet = React.useMemo(
    () =>
      new Set(
        (recipeDetails?.matched_ingredients || []).map(name =>
          name.trim().toLowerCase(),
        ),
      ),
    [recipeDetails],
  );

  const matchedCount = React.useMemo(
    () =>
      ingredients.filter((ing: any) =>
        matchedSet.has(ing.name?.trim().toLowerCase()),
      ).length,
    [ingredients, matchedSet],
  );

  const totalCount = ingredients.length;

  // Prepare time information
  const prepTime = recipeDetails?.prep_time_minutes;
  const cookTime = recipeDetails?.cook_time_minutes;
  const totalTime = (prepTime || 0) + (cookTime || 0);

  // Comment button handler - track modal state
  const handleCommentPress = () => {
    setIsCommentsModalVisible(true);
  };

  // Handle tab content layout changes to measure their heights
  const handleTabContentLayout = useCallback(
    (tab: string, event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      setTabContentHeights(prev => ({
        ...prev,
        [tab]: height,
      }));
    },
    [],
  );

  // Handle tab change to ensure proper scrolling (reverted to HEADER_HEIGHT)
  const handleTabChange = useCallback(
    (tab: string) => {
      if (currentScrollPosition > HEADER_HEIGHT) {
        scrollViewRef.current?.scrollTo({
          y: HEADER_HEIGHT,
          animated: true,
        });
      }
    },
    [currentScrollPosition, HEADER_HEIGHT],
  ); // Reverted to HEADER_HEIGHT dependency

  // Handle scroll event to show/hide floating tab bar (reverted to HEADER_HEIGHT logic)
  const handleScroll = useCallback(
    (event: any) => {
      const scrollY = event.nativeEvent.contentOffset.y;
      setCurrentScrollPosition(scrollY);

      // No longer need to check markerPosition_Y === 0

      if (Math.floor(scrollY) % 200 === 0) {
        console.log(
          `[RDP HandleScroll] scrollY=${scrollY.toFixed(0)}, HEADER_HEIGHT=${HEADER_HEIGHT.toFixed(0)}`,
        );
      }

      const tabBarExitPoint = HEADER_HEIGHT; // Reverted to HEADER_HEIGHT

      const deepContentHideOffset = screenHeight * 0.8;
      const contentDeepPoint = HEADER_HEIGHT + deepContentHideOffset; // Relative to HEADER_HEIGHT

      const shouldShow =
        scrollY > tabBarExitPoint && scrollY < contentDeepPoint;

      if (
        shouldShow !== shouldShowFloatingBar &&
        !floatingBarAnimating.current
      ) {
        floatingBarAnimating.current = true;
        logVisibilityChange.current++;
        console.log(
          `[RDP HandleScroll #${logVisibilityChange.current}] Visibility change: shouldShow=${shouldShow}, scrollY=${scrollY.toFixed(0)}, tabBarExitPoint=${tabBarExitPoint.toFixed(0)}, contentDeepPoint=${contentDeepPoint.toFixed(0)}`,
        );
        setShouldShowFloatingBar(shouldShow);
        Animated.timing(floatingTabBarVisible, {
          toValue: shouldShow ? 1 : 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          floatingBarAnimating.current = false;
        });
      }
    },
    [activeTab, shouldShowFloatingBar, floatingTabBarVisible, HEADER_HEIGHT],
  ); // REVERTED dependencies

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case TAB_ROUTES.INGREDIENTS:
        return (
          <View
            key="ingredients-tab"
            onLayout={e => handleTabContentLayout(TAB_ROUTES.INGREDIENTS, e)}>
            <IngredientsTab />
          </View>
        );
      case TAB_ROUTES.STEPS:
        return (
          <View
            key="steps-tab"
            onLayout={e => handleTabContentLayout(TAB_ROUTES.STEPS, e)}>
            <StepsTab steps={recipeDetails?.preparation_steps} />
          </View>
        );
      case TAB_ROUTES.MACROS:
        return (
          <View
            key="macros-tab"
            onLayout={e => handleTabContentLayout(TAB_ROUTES.MACROS, e)}>
            <MacrosTab />
          </View>
        );
      default:
        return (
          <View
            key="ingredients-tab-default"
            onLayout={e => handleTabContentLayout(TAB_ROUTES.INGREDIENTS, e)}>
            <IngredientsTab />
          </View>
        );
    }
  };

  const handleOpenPlannerModal = () => {
    if (!recipeDetails) {
      Alert.alert('Error', 'Recipe details not loaded yet.');
      return;
    }
    setIsPlannerModalVisible(true);
  };

  const handleClosePlannerModal = () => {
    setIsPlannerModalVisible(false);
  };

  const handleAddToMealPlan = async (date: Date, slot: MealSlot) => {
    if (!recipeDetails) {
      Alert.alert('Error', 'Cannot add to plan, recipe details are missing.');
      return;
    }
    const dateString = format(date, 'yyyy-MM-dd'); // Date for the plan entry
    console.log(
      `RecipeDetailScreen: Adding ${recipeDetails.title} (ID: ${recipeDetails.recipe_id}) to meal plan on ${dateString} [${slot}] using V2 hook`,
    );
    try {
      // V2 addRecipeToSlot expects an object
      await addRecipeToSlot({
        planDate: dateString, // Pass the formatted date for the plan
        slot,
        recipeId: recipeDetails.recipe_id, // Corrected: Use recipe_id
        recipeTitle: recipeDetails.title,
        recipeThumbnailUrl: recipeDetails.video_url || undefined, // Corrected: Use video_url as thumbnail_url is not directly on RecipeDetailsData
      });
      Alert.alert(
        'Success',
        `Added ${recipeDetails.title} to your meal plan for ${format(date, 'MMM d, yyyy')} (${slot}).`,
      );
      // Invalidate queries for the meal planner screen to refresh
      queryClient.invalidateQueries({
        queryKey: ['dailyMealPlan', dateString],
      });
    } catch (e: any) {
      Alert.alert(
        'Error',
        e.message || 'An unexpected error occurred while adding to meal plan.',
      );
      console.error('Error adding to meal plan (V2):', e);
    }
    setIsPlannerModalVisible(false); // Close modal on success or failure
    // Modal closes itself - original comment, keeping it but also explicitly closing
  };

  const handleCloseCommentsModal = () => {
    setIsCommentsModalVisible(false);
  };

  // Handle navigation to author's profile
  const handleNavigateToAuthorProfile = () => {
    if (recipeDetails?.user_id) {
      console.log(
        `[RecipeDetailScreen] Navigating to profile for user: ${recipeDetails.user_id}`,
      );
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { userId: recipeDetails.user_id },
      });
    } else {
      console.warn(
        '[RecipeDetailScreen] No user_id available for profile navigation',
      );
    }
  };

  // --- Render Logic ---
  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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
        {(() => {
          // Immediately invoked function expression to allow logging & error display
          if (videoPlayerError) {
            return (
              <View style={[styles.video, styles.videoPlaceholder]}>
                <Ionicons
                  name="alert-circle-outline"
                  size={48}
                  color="#FF9800"
                />
                <Text style={styles.videoErrorText}>{videoPlayerError}</Text>
              </View>
            );
          }

          // Check if this is an AI-generated recipe
          if (recipeDetails?.is_ai_generated) {
            return (
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
            );
          }

          if (recipeDetails?.video_url) {
            return (
              <View style={styles.videoContainer}>
                <Video
                  ref={videoRef}
                  style={styles.videoPlayer}
                  source={{ uri: recipeDetails.video_url }}
                  useNativeControls={false} // Using custom TikTok-level controls
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  onLoad={handleLoad} // Use the updated handleLoad
                  onError={handleError}
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  progressUpdateIntervalMillis={500}
                  isMuted={isMuted} // Bind to isMuted state
                  // shouldPlay // Consider if autoplay is desired immediately on component mount vs. on load
                />
                
                {/* TikTok-Level Video Controls */}
                <TikTokVideoControls
                  videoRef={videoRef}
                  isPlaying={isPlaying}
                  isMuted={isMuted}
                  onToggleMute={toggleMute}
                  onTogglePlay={togglePlay}
                  duration={videoDuration}
                  position={videoPosition}
                />
              </View>
            );
          }
          console.log('RecipeDetailScreen: video_url is not available.');
          return (
            <View style={[styles.video, styles.videoPlaceholder]}>
              <Ionicons name="videocam-off-outline" size={48} color="#ccc" />
              <Text style={{ color: '#ccc' }}>Video not available</Text>
            </View>
          );
        })()}

        {/* Header Overlays (Cart Icon, View Count) - Mute now handled by TikTok Controls */}

        {/* Cart Icon with Badge - Uses groceryList.length */}
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

        {/* View Count added to video area */}
        {recipeDetails && typeof recipeDetails.views_count === 'number' && (
          <View style={styles.videoViewCountContainer}>
            <Ionicons name="eye-outline" style={styles.videoViewCountIcon} />
            <Text style={styles.videoViewCountText}>
              {recipeDetails.views_count} views
            </Text>
          </View>
        )}
      </View>

      {/* Floating Tab Bar - appears when scrolled past original tab bar */}
      <FloatingTabBar
        tabs={Object.values(TAB_ROUTES)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        visible={floatingTabBarVisible}
        offsetTop={HEADER_HEIGHT}
      />

      {/* Scrollable Content Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: 80, // Standard padding for all tabs
          },
        ]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[]} // Remove sticky header behavior
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToOffsets={undefined} // Remove snap behavior that causes sticking
        snapToStart={false}
        bounces
        overScrollMode="always">
        {/* Recipe Info Section */}
        <View style={styles.recipeInfoSection}>
          <Text
            style={styles.recipeTitleText}
            numberOfLines={3}
            ellipsizeMode="tail">
            {recipeDetails.title}
          </Text>

          {/* Author Info Row */}
          {(recipeDetails?.username || recipeDetails?.is_ai_generated) && (
            <TouchableOpacity
              style={styles.authorInfoRow}
              onPress={
                recipeDetails?.is_ai_generated
                  ? undefined
                  : handleNavigateToAuthorProfile
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
            <Ionicons
              name="restaurant-outline"
              style={styles.pantryBadgeIcon}
            />
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

          {/* Divider before action row */}
          <View
            style={[styles.sectionDivider, { marginTop: 16, marginBottom: 10 }]}
          />

          {/* Action Row (Like, Save, Comment, Share) */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                (!user?.id || likeMutation.isPending) &&
                  styles.actionButtonDisabled,
              ]}
              onPress={() => {
                if (!user?.id) {
                  Alert.alert(
                    'Authentication Required',
                    'Please log in to like recipes.',
                  );
                  return;
                }
                likeMutation.mutate(id);
              }}
              disabled={!user?.id || likeMutation.isPending}>
              {likeMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name={
                    recipeDetails?.is_liked_by_user ? 'heart' : 'heart-outline'
                  }
                  size={26}
                  color={
                    recipeDetails?.is_liked_by_user
                      ? COLORS.error
                      : COLORS.primary
                  }
                />
              )}
              {recipeDetails?.likes !== undefined && (
                <Text style={styles.actionCount}>{recipeDetails.likes}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => saveMutation.mutate(id)}
              disabled={saveMutation.isPending}>
              <Ionicons
                name={
                  recipeDetails?.is_saved_by_user
                    ? 'bookmark'
                    : 'bookmark-outline'
                }
                size={26}
                color={
                  recipeDetails?.is_saved_by_user
                    ? COLORS.primary
                    : COLORS.textSecondary
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCommentPress}>
              <Ionicons
                name="chatbubble-outline"
                size={26}
                color={COLORS.primary}
              />
              {recipeDetails.comments_count !== undefined && (
                <Text style={styles.actionCount}>
                  {recipeDetails.comments_count}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons
                name="share-social-outline"
                size={26}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Original Tab Navigator - Not sticky anymore */}
        <View style={styles.tabNavigatorWrapper}>
          <CustomTabNavigator
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={Object.values(TAB_ROUTES)}
            tabContent={renderTabContent()}
            onTabChange={handleTabChange}
          />
        </View>
      </ScrollView>

      <AddToMealPlannerModal
        isVisible={isPlannerModalVisible}
        onClose={handleClosePlannerModal}
        onAddToPlan={handleAddToMealPlan}
        recipeName={recipeDetails?.title}
      />

      <CommentsModal
        visible={isCommentsModalVisible}
        onClose={handleCloseCommentsModal}
        recipeId={id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.white || '#fff',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.error || 'red',
    textAlign: 'center',
  },
  headerContainer: {
    height: HEADER_HEIGHT,
    backgroundColor: COLORS.black || '#000',
    position: 'relative',
    zIndex: 1,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkgray || '#222',
  },
  videoErrorText: {
    color: '#FF9800',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  muteButton: {
    position: 'absolute',
    top: 60,
    left: 15,
    zIndex: 12,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  cartButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 15,
    zIndex: 12,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: COLORS.error || 'red',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    color: COLORS.white || 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  recipeInfoSection: {
    backgroundColor: COLORS.white || '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#eee',
  },
  recipeTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text || '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  authorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  authorAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  authorAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    backgroundColor: COLORS.surface || '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border || '#ddd',
  },
  authorNameText: {
    fontSize: 14,
    color: COLORS.textSecondary || '#555',
    fontWeight: '500',
  },
  pantryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  pantryBadgeIcon: {
    fontSize: 18,
    color: COLORS.primary || '#00796b',
    marginRight: 8,
  },
  pantryBadgeInfoText: {
    fontSize: 15,
    color: COLORS.primary || '#00796b',
    fontWeight: '600',
  },
  viewCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16, // Add some spacing from the pantry info
  },
  viewCountIcon: {
    fontSize: 18,
    color: COLORS.textSecondary || '#555',
    marginRight: 4,
  },
  viewCountText: {
    fontSize: 15,
    color: COLORS.textSecondary || '#555',
    fontWeight: '600',
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
  // Custom Tab Navigator
  tabNavigatorWrapper: {
    backgroundColor: COLORS.white,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  videoPlayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10, // Added vertical margin
    paddingHorizontal: 16, // Match content padding
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#e0e0e0', // Placeholder bg
  },
  authorName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#444',
  },
  plannerButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary, // Use app primary color
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25, // More rounded
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  plannerButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  videoViewCountContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 5,
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
});
