// RecipeDetailScreen placeholder
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavigationState } from '@react-navigation/native';
import { format } from 'date-fns';

import { MainStackParamList } from '../../navigation/types';
import useRecipeDetails, { RecipeDetailsData } from '../../hooks/useRecipeDetails';
import { RecipeItem } from '../../types';
import { useAuth } from '../../providers/AuthProvider';
import ActionOverlay from '../../components/ActionOverlay';
import IngredientsTab from '../recipe-detail-tabs/IngredientsTab';
import StepsTab from '../recipe-detail-tabs/StepsTab';
import MacrosTab from '../recipe-detail-tabs/MacrosTab';
import CommentsTab from '../recipe-detail-tabs/CommentsTab';
import { supabase } from '../../services/supabase';
import { useGroceryManager } from '../../hooks/useGroceryManager';
import { COLORS } from '../../constants/theme';
import FloatingTabBar from '../../components/FloatingTabBar';
import { useDailyMealPlan, MealSlot } from '../../hooks/useDailyMealPlan';
import AddToMealPlannerModal from '../../components/modals/AddToMealPlannerModal';

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
  COMMENTS: 'Comments'
};

// Create custom Tab Navigator to handle scroll issues
const CustomTabNavigator = ({ 
  activeTab, 
  setActiveTab, 
  tabs, 
  tabContent,
  onTabChange
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  tabs: string[];
  tabContent: React.ReactNode;
  onTabChange?: (tab: string) => void;
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
    
    // Animate the tab transition
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7
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
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]} 
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
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
              outputRange: [1, 0.8, 1]
            }),
            transform: [{
              scale: animatedValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 0.98, 1]
              })
            }]
          }
        ]}
      >
        {tabContent}
      </Animated.View>
    </View>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const HEADER_HEIGHT = screenHeight * 0.4; // 40% of screen height

export default function RecipeDetailScreen() {
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const id = route.params?.id;
  const initialSeekTime = route.params?.initialSeekTime ?? 0;
  const initialTabFromParams = route.params?.initialTab; // Read the initialTab param
  const videoRef = useRef<Video>(null);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { groceryList, fetchGroceryList } = useGroceryManager();
  const scrollViewRef = useRef<ScrollView>(null);
  const isScreenFocused = useIsFocused(); // Added
  
  // Meal Planner integration (V2)
  const { addRecipeToSlot } = useDailyMealPlan(format(new Date(), 'yyyy-MM-dd')); // Pass default date
  const [isPlannerModalVisible, setIsPlannerModalVisible] = useState(false);
  
  // Track original tab bar measurements
  const tabBarRef = useRef<View>(null);
  const [tabBarPosition, setTabBarPosition] = useState(0);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  
  // State for floating tab bar control with debouncing
  const [shouldShowFloatingBar, setShouldShowFloatingBar] = useState(false);
  const floatingTabBarVisible = useRef(new Animated.Value(0)).current;
  const floatingBarAnimating = useRef(false);
  
  // Track tab content heights
  const [tabContentHeights, setTabContentHeights] = useState<Record<string, number>>({
    [TAB_ROUTES.INGREDIENTS]: 0,
    [TAB_ROUTES.STEPS]: 0,
    [TAB_ROUTES.MACROS]: 0,
    [TAB_ROUTES.COMMENTS]: 0,
  });
  
  const [currentScrollPosition, setCurrentScrollPosition] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  // Set initial activeTab based on route param or default to Ingredients
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTabFromParams && Object.values(TAB_ROUTES).includes(initialTabFromParams as (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES])) {
      return initialTabFromParams as (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES];
    }
    return TAB_ROUTES.INGREDIENTS;
  });
  const [videoPlayerError, setVideoPlayerError] = useState<string | null>(null);

  // Debug logging helper for visibility changes
  const logVisibilityChange = useRef(0);

  // Use useFocusEffect to refresh grocery list when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('RecipeDetailScreen focused, fetching grocery list...');
        fetchGroceryList(user.id); 
      }
    }, [user?.id, fetchGroceryList]) // Dependencies
  );

  // Fetch recipe details
  const {
    data: recipeDetails,
    isLoading,
    error,
  } = useRecipeDetails(id, user?.id);
  
  // Effect to reset video error when video_url changes
  useEffect(() => {
    setVideoPlayerError(null); // Clear previous errors when new video data comes in
    setIsLoaded(false); // Reset loaded state for the new video
  }, [recipeDetails?.video_url]);

  // --- Video Player Logic ---
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && isLoaded) { // Ensure video is loaded
      if (isScreenFocused) {
        console.log(`RecipeDetailScreen: Screen focused and video loaded, playing video for ID: ${id}`);
        videoElement.playAsync().catch(e => console.error(`RecipeDetailScreen ${id}: Focus play error:`, e));
      } else {
        console.log(`RecipeDetailScreen: Screen NOT focused, pausing video for ID: ${id}`);
        videoElement.pauseAsync().catch(e => console.error(`RecipeDetailScreen ${id}: Focus pause error:`, e));
      }
    }
  }, [isLoaded, isScreenFocused, id, videoRef]); // Dependencies for focus-aware playback

  const handleLoad = async (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      console.log(`RecipeDetailScreen ${id}: Video loaded. Initial seek: ${initialSeekTime}ms. IsMuted: ${isMuted}`);
      if (videoRef.current) {
        if (initialSeekTime > 0) {
          // Set position but don't auto-play here; useEffect will handle it based on focus.
          await videoRef.current.setPositionAsync(initialSeekTime, { toleranceMillisBefore: 100, toleranceMillisAfter: 100 });
        }
        // Ensure video respects the current isMuted state upon loading
        await videoRef.current.setIsMutedAsync(isMuted);
      }
      setIsLoaded(true); // This will trigger the focus-aware useEffect to potentially play the video
    } else if (status.error) { 
      console.error('Detail screen video load error from handleLoad:', status.error); 
      // Consider calling handleError if status.error is a string message, or adapt handleError
      // For now, just logging as original code did.
    } 
  };
  
  const toggleMute = () => { 
    if (!videoRef.current) {
      console.error('toggleMute: videoRef.current is null or undefined');
      return; // Exit if no video ref
    }
    videoRef.current.setIsMutedAsync(!isMuted)
      .catch(e => console.error('setIsMutedAsync error:', e));
    setIsMuted(prevMuted => !prevMuted);
  };
  
  const handleError = (error: string) => { 
    console.error(`RecipeDetailScreen ${id}: Video onError event:`, error); 
    setVideoPlayerError("Video playback failed. Please check your connection or try again later."); // Set user-friendly error
    setIsLoaded(false); 
  };
  // --- End Video Player ---

  // Measure tab bar position after render and when recipe details change
  useLayoutEffect(() => {
    if (!isLoading && recipeDetails) {
      const measureTabBar = () => {
        if (tabBarRef.current) {
          tabBarRef.current.measure((x, y, width, height, pageX, pageY) => {
            if (pageY > 0) {
              setTabBarPosition(pageY);
              setTabBarHeight(height);
              console.log('Tab bar measured:', { position: pageY, height });
            }
          });
        }
      };
      
      // Measure after a delay to ensure layout is complete
      const initialTimer = setTimeout(measureTabBar, 300);
      
      // Measure again after a longer delay as a backup
      const backupTimer = setTimeout(measureTabBar, 1000);
      
      return () => {
        clearTimeout(initialTimer);
        clearTimeout(backupTimer);
      };
    }
  }, [isLoading, recipeDetails]);

  // --- Optimistic updates for like/save --- 
  const likeMut = useMutation<void, Error, void, any>({
    mutationFn: async () => { 
      if (!id) throw new Error('Recipe ID missing'); 
      // Assuming 'toggle_like_recipe' RPC and it handles user internally
      const { error: likeError } = await supabase.rpc('toggle_like_recipe', { p_recipe_id: id }); 
      if (likeError) throw likeError; 
    },
    onSuccess: () => {
      // Optimistically update UI or simply refetch for consistency
      queryClient.invalidateQueries({ queryKey: ['recipeDetails', id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile'] }); // If likes affect profile display
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    // onError: (err, _vars, context) => {
    //   queryClient.setQueryData(['recipeDetails', id, user?.id], context?.previousDetails);
    // },
  });

  // Updated saveMut for the new 'save_recipe_video' RPC
  const saveRecipeVideoMut = useMutation<void, Error, void, any>({
    mutationFn: async () => { 
      const userId = user?.id;
      if (!id || !userId) { 
        throw new Error('Recipe ID or User ID missing for save action'); 
      }
      // Call the new RPC, passing both recipe_id and user_id
      const { error: saveError } = await supabase.rpc('save_recipe_video', { 
        p_recipe_id: id, 
        p_user_id: userId // Pass user ID
      }); 
      if (saveError) {
        console.error('Error saving recipe video:', saveError);
        throw saveError; 
      }
    },
    onSuccess: () => {
      console.log('Recipe save/unsave successful, invalidating queries...');
      // Invalidate recipe details to refetch and get updated is_saved_by_user status
      queryClient.invalidateQueries({ queryKey: ['recipeDetails', id, user?.id] });
      // Invalidate profile data as the saved list will change
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      // Optionally, invalidate feed if saved status affects feed items
      queryClient.invalidateQueries({ queryKey: ['feed'] }); 
      // Invalidate the user recipes list for the meal planner modal
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['userRecipesForPlanner', user.id] });
      }
    },
    onError: (saveError) => {
      console.error('Mutation error for save_recipe_video:', saveError);
      Alert.alert('Error', 'Could not update save status. Please try again.');
    }
  });

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
  
  const matchedSet = React.useMemo(() => 
    new Set((recipeDetails?.matched_ingredients || []).map(name => name.trim().toLowerCase())), 
    [recipeDetails]);
    
  const matchedCount = React.useMemo(() => 
    ingredients.filter((ing: any) => matchedSet.has(ing.name?.trim().toLowerCase())).length, 
    [ingredients, matchedSet]);
    
  const totalCount = ingredients.length;

  // Prepare time information
  const prepTime = recipeDetails?.prep_time_minutes;
  const cookTime = recipeDetails?.cook_time_minutes;
  const totalTime = (prepTime || 0) + (cookTime || 0);

  // Comment button handler
  const handleCommentPress = () => {
    setActiveTab(TAB_ROUTES.COMMENTS);
    
    // Scroll down to show comments
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: HEADER_HEIGHT + 250, animated: true });
    }, 100);
  };
  
  // Handle tab content layout changes to measure their heights
  const handleTabContentLayout = useCallback((tab: string, event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setTabContentHeights(prev => ({
      ...prev,
      [tab]: height
    }));
  }, []);

  // Handle tab change to ensure proper scrolling
  const handleTabChange = useCallback((tab: string) => {
    // If we're already scrolled past the tab bar, adjust scroll position
    if (currentScrollPosition > HEADER_HEIGHT + 250) {
      scrollViewRef.current?.scrollTo({ 
        y: HEADER_HEIGHT + 250, 
        animated: true 
      });
    }
  }, [currentScrollPosition]);
  
  // Handle scroll event to show/hide floating tab bar
  const handleScroll = useCallback((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    setCurrentScrollPosition(scrollY);
    
    // Log every 20th scroll position for debugging deep scrolling
    if (Math.floor(scrollY) % 200 === 0) {
      console.log(`Deep scroll check: scrollY=${scrollY.toFixed(0)}`);
    }
    
    if (tabBarPosition > 0 && tabBarHeight > 0) {
      // Original tab bar disappears from view calculation
      // Account for device height to determine when tab bar is no longer visible
      const windowHeight = Dimensions.get('window').height;
      
      // Calculate the bottom edge of the tab bar
      const tabBarBottomPosition = tabBarPosition + tabBarHeight;
      
      // The point where the original tab bar's BOTTOM edge starts to exit the viewport
      // We subtract a small buffer (20px) to show floating bar slightly before original disappears
      const tabBarExitPoint = tabBarBottomPosition - windowHeight + 20;
      
      // Hide floating bar when very deep in content (user reading comments, etc.)
      // Use a smaller threshold for the Comments tab specifically
      const contentDeepPoint = tabBarBottomPosition + (activeTab === TAB_ROUTES.COMMENTS ? 150 : 600);
      
      // Show floating bar in the "middle zone" - after original tab bar exits viewport but before deep in content
      const shouldShow = (scrollY > tabBarExitPoint) && (scrollY < contentDeepPoint);
      
      // Special handling for Comments tab - always hide when deep scrolling
      if (activeTab === TAB_ROUTES.COMMENTS && scrollY > contentDeepPoint) {
        if (shouldShowFloatingBar) {
          setShouldShowFloatingBar(false);
          console.log(`COMMENTS TAB OVERRIDE: Force hiding floating bar at scrollY=${scrollY.toFixed(0)}`);
          Animated.timing(floatingTabBarVisible, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true
          }).start();
          return;
        }
      }
      
      // Force hide at deep scroll positions regardless of other conditions
      if (scrollY > contentDeepPoint) {
        // Ensure we hide the floating bar when scrolled deep
        if (shouldShowFloatingBar) {
          setShouldShowFloatingBar(false);
          console.log(`FORCE HIDING at deep scroll: ${scrollY.toFixed(0)} > ${contentDeepPoint}`);
          
          // Immediately hide for deep scrolls
          Animated.timing(floatingTabBarVisible, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true
          }).start();
        }
        return; // Skip other logic when in deep scroll
      }
      
      // Only animate if visibility state is changing
      if (shouldShow !== shouldShowFloatingBar) {
        setShouldShowFloatingBar(shouldShow);
        console.log(`Visibility change: ${shouldShowFloatingBar} -> ${shouldShow}`);
        console.log(`Scroll metrics: scrollY=${scrollY.toFixed(0)}, tabExit=${tabBarExitPoint.toFixed(0)}, contentDeep=${contentDeepPoint.toFixed(0)}`);
        
        // Use spring animation for more natural feel
        if (shouldShow) {
          // Show animation
          floatingBarAnimating.current = true;
          Animated.spring(floatingTabBarVisible, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true
          }).start(() => {
            floatingBarAnimating.current = false;
          });
        } else {
          // Hide animation - use timing for more predictable hiding
          floatingBarAnimating.current = true;
          Animated.timing(floatingTabBarVisible, {
            toValue: 0,
            duration: 150, 
            useNativeDriver: true
          }).start(() => {
            floatingBarAnimating.current = false;
          });
        }
      }
    }
  }, [shouldShowFloatingBar, floatingTabBarVisible, tabBarPosition, tabBarHeight, activeTab]);

  // Render the active tab content
  const renderTabContent = () => {
    switch(activeTab) {
      case TAB_ROUTES.INGREDIENTS:
        return (
          <View 
            key="ingredients-tab"
            onLayout={(e) => handleTabContentLayout(TAB_ROUTES.INGREDIENTS, e)}
          >
            <IngredientsTab />
          </View>
        );
      case TAB_ROUTES.STEPS:
        return (
          <View 
            key="steps-tab"
            onLayout={(e) => handleTabContentLayout(TAB_ROUTES.STEPS, e)}
          >
            <StepsTab steps={recipeDetails?.preparation_steps} />
          </View>
        );
      case TAB_ROUTES.MACROS:
        return (
          <View 
            key="macros-tab"
            onLayout={(e) => handleTabContentLayout(TAB_ROUTES.MACROS, e)}
          >
            <MacrosTab />
          </View>
        );
      case TAB_ROUTES.COMMENTS:
        return (
          <View 
            key="comments-tab"
            onLayout={(e) => handleTabContentLayout(TAB_ROUTES.COMMENTS, e)}
          >
            <CommentsTab />
          </View>
        );
      default:
        return (
          <View 
            key="ingredients-tab-default"
            onLayout={(e) => handleTabContentLayout(TAB_ROUTES.INGREDIENTS, e)}
          >
            <IngredientsTab />
          </View>
        );
    }
  };

  const handleOpenPlannerModal = () => {
    if (!recipeDetails) {
      Alert.alert("Error", "Recipe details not loaded yet.");
      return;
    }
    setIsPlannerModalVisible(true);
  };

  const handleClosePlannerModal = () => {
    setIsPlannerModalVisible(false);
  };

  const handleAddToMealPlan = async (date: Date, slot: MealSlot) => {
    if (!recipeDetails) {
      Alert.alert("Error", "Cannot add to plan, recipe details are missing.");
      return;
    }
    const dateString = format(date, 'yyyy-MM-dd'); // Date for the plan entry
    console.log(`RecipeDetailScreen: Adding ${recipeDetails.title} (ID: ${recipeDetails.recipe_id}) to meal plan on ${dateString} [${slot}] using V2 hook`);
    try {
      // V2 addRecipeToSlot expects an object
      await addRecipeToSlot({
        planDate: dateString, // Pass the formatted date for the plan
        slot: slot, 
        recipeId: recipeDetails.recipe_id, // Corrected: Use recipe_id
        recipeTitle: recipeDetails.title,
        recipeThumbnailUrl: recipeDetails.video_url || undefined, // Corrected: Use video_url as thumbnail_url is not directly on RecipeDetailsData
      });
      Alert.alert("Success", `Added ${recipeDetails.title} to your meal plan for ${format(date, 'MMM d, yyyy')} (${slot}).`);
      // Invalidate queries for the meal planner screen to refresh
      queryClient.invalidateQueries({ queryKey: ['dailyMealPlan', dateString] });
    } catch (e: any) {
      Alert.alert("Error", e.message || "An unexpected error occurred while adding to meal plan.");
      console.error("Error adding to meal plan (V2):", e);
    }
    setIsPlannerModalVisible(false); // Close modal on success or failure
    // Modal closes itself - original comment, keeping it but also explicitly closing
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
          {error ? error : 'Could not load recipe details.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle={currentScrollPosition > 50 ? "dark-content" : "light-content"} />
      
      {/* Fixed Video header */}
      <View style={styles.headerContainer}>
        {(() => { // Immediately invoked function expression to allow logging & error display
          if (videoPlayerError) {
            return (
              <View style={[styles.video, styles.videoPlaceholder]}>
                <Ionicons name="alert-circle-outline" size={48} color="#FF9800" />
                <Text style={styles.videoErrorText}>{videoPlayerError}</Text>
              </View>
            );
          }
          if (recipeDetails?.video_url) {
            console.log("RecipeDetailScreen: Attempting to play video_url:", recipeDetails.video_url); 
            return (
              <View style={styles.videoContainer}>
                <Video
                  ref={videoRef}
                  style={styles.videoPlayer}
                  source={{ uri: recipeDetails.video_url }}
                  useNativeControls={false} // Using custom controls
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  onLoad={handleLoad} // Use the updated handleLoad
                  onError={handleError}
                  progressUpdateIntervalMillis={500}
                  isMuted={isMuted} // Bind to isMuted state
                  // shouldPlay // Consider if autoplay is desired immediately on component mount vs. on load
                />
              </View>
            );
          } else {
            console.log("RecipeDetailScreen: video_url is not available."); 
            return (
              <View style={[styles.video, styles.videoPlaceholder]}>
                <Ionicons name="videocam-off-outline" size={48} color="#ccc" />
                <Text style={{ color: '#ccc' }}>Video not available</Text>
              </View>
            );
          }
        })()}

        {/* Header Overlays (Mute button, Pantry Match, Actions) */}
        <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
          <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="white" />
        </TouchableOpacity>

        {/* Cart Icon with Badge - Uses groceryList.length */}
        <TouchableOpacity 
          style={styles.cartButtonContainer} 
          onPress={() => navigation.navigate('MainTabs', { screen: 'GroceryList' })}
        > 
          <Ionicons name="cart-outline" size={28} color={COLORS.white || '#FFF'} />
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
            <Text style={styles.videoViewCountText}>{recipeDetails.views_count} views</Text>
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
            paddingBottom: activeTab === TAB_ROUTES.COMMENTS ? 0 : 80, // No extra padding for Comments tab
          }
        ]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[]} // Remove sticky header behavior
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToOffsets={undefined} // Remove snap behavior that causes sticking
        snapToStart={false}
        bounces={true}
        overScrollMode="always"
      >
        {/* Recipe Info Section */}
        <View style={styles.recipeInfoSection}>
          <Text style={styles.recipeTitleText} numberOfLines={3} ellipsizeMode="tail">
            {recipeDetails.title}
          </Text>

          {/* Author Info Row */}
          {recipeDetails?.username && (
            <View style={styles.authorInfoRow}>
              {recipeDetails.avatar_url ? (
                <Image 
                  source={{ uri: recipeDetails.avatar_url }} 
                  style={styles.authorAvatarImage}
                />
              ) : (
                <View style={styles.authorAvatarPlaceholder}>
                  <Ionicons name="person-outline" size={18} color={COLORS.primary || '#00796b'} />
                </View>
              )}
              <Text style={styles.authorNameText}>
                {recipeDetails.username || 'Unknown Author'}
              </Text>
            </View>
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
            {prepTime !== null && <Text style={styles.timeDetailText}>Prep: {prepTime} min</Text>}
            {cookTime !== null && <Text style={styles.timeDetailText}>Cook: {cookTime} min</Text>}
            {totalTime > 0 && <Text style={styles.timeDetailText}>Total: {totalTime} min</Text>}
          </View>

          {/* Divider before action row */}
          <View style={[styles.sectionDivider, { marginTop: 16, marginBottom: 10 }]} />

          {/* Action Row (Like, Save, Comment, Share) */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => likeMut.mutate()}
              disabled={likeMut.isPending}
            >
              <Ionicons 
                name={recipeDetails?.is_liked_by_user ? "heart" : "heart-outline"} 
                size={26} 
                color={recipeDetails?.is_liked_by_user ? COLORS.error : COLORS.primary} 
              />
              {recipeDetails?.likes !== undefined && (
                <Text style={styles.actionCount}>{recipeDetails.likes}</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => saveRecipeVideoMut.mutate()}
              disabled={saveRecipeVideoMut.isPending}
            >
              <Ionicons 
                name={recipeDetails?.is_saved_by_user ? "bookmark" : "bookmark-outline"}
                size={26} 
                color={recipeDetails?.is_saved_by_user ? COLORS.primary : COLORS.textSecondary}
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleCommentPress}
            >
              <Ionicons 
                name="chatbubble-outline" 
                size={26} 
                color={COLORS.primary}
              />
              {recipeDetails.comments_count !== undefined && (
                <Text style={styles.actionCount}>{recipeDetails.comments_count}</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleShare}
            >
              <Ionicons 
                name="share-social-outline" 
                size={26} 
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Original Tab Navigator - Not sticky anymore */}
        <View ref={tabBarRef} style={styles.tabNavigatorWrapper}>
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
}); 