// RecipeDetailScreen placeholder
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Share,
  Alert,
  ScrollView,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MainStackParamList } from '../../navigation/types';
import { useRecipeDetails, RecipeDetailsData } from '../../hooks/useRecipeDetails';
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

// Define route prop type
type RecipeDetailScreenRouteProp = RouteProp<
  MainStackParamList,
  'RecipeDetail'
>;

// Create Tab Navigator
const Tab = createMaterialTopTabNavigator();

const { height: screenHeight } = Dimensions.get('window');
const HEADER_HEIGHT = screenHeight * 0.4; // 40% of screen height

export default function RecipeDetailScreen() {
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recipeId = route.params?.id;
  const initialSeekTime = route.params?.initialSeekTime ?? 0; // Get initialSeekTime
  const videoRef = useRef<Video>(null);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { groceryList } = useGroceryManager();

  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Log IDs being used
  // console.log(`RecipeDetailScreen: recipeId = ${recipeId}, userId = ${user?.id}`); // Reverted this line for now

  // Fetch data
  const {
    data: recipeDetails,
    isLoading,
    error,
  } = useRecipeDetails(recipeId, user?.id);

  // Log hook status
  // console.log(`RecipeDetailScreen: useRecipeDetails status = ${status}, isLoading = ${isLoading}, error = ${error ? error.message : 'null'}, hasData = ${!!recipeDetails}`); // Reverted this line
  // if (status === 'success' && recipeDetails) { // Reverted this line
  //   console.log('RecipeDetailScreen: Received recipeDetails keys:', Object.keys(recipeDetails).join(', ')); // Reverted this line
  // }

  // --- Optimistic updates for like/save --- 
  interface MutationContext {
    previousDetails?: RecipeDetailsData;
  }
  const likeMut = useMutation<void, Error, void, MutationContext>({ 
    mutationFn: async () => { 
      if (!recipeId) throw new Error('Recipe ID missing'); 
      const { error } = await supabase.rpc('like_recipe', { recipe_id: recipeId }); 
      if (error) throw error; 
    },
    // Optimistic update removed: backend does not provide per-user like state
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['recipe', recipeId] });
      const previousDetails = queryClient.getQueryData<RecipeDetailsData>(['recipe', recipeId]);
      // If backend adds per-user like state, optimistic update logic can be added here
      return { previousDetails };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['recipe', recipeId], context?.previousDetails);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
  const saveMut = useMutation<void, Error, void, MutationContext>({ 
    mutationFn: async () => { 
      if (!recipeId) throw new Error('Recipe ID missing'); 
      const { error } = await supabase.rpc('save_recipe', { recipe_id: recipeId }); 
      if (error) throw error; 
    },
    // Optimistic update removed: backend does not provide per-user save state
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['recipe', recipeId] });
      const previousDetails = queryClient.getQueryData<RecipeDetailsData>(['recipe', recipeId]);
      // If backend adds per-user save state, optimistic update logic can be added here
      return { previousDetails };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['recipe', recipeId], context?.previousDetails);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
  // --- End Optimistic Updates ---

  // --- Share Functionality ---
  const handleShare = async () => { const shareUrl = recipeDetails?.video_url || 'https://yourapp.com'; try { const available = await Sharing.isAvailableAsync(); if (available) { await Sharing.shareAsync(shareUrl, { dialogTitle: `Check out this recipe: ${recipeDetails?.title || 'Recipe'}`, }); } else { Alert.alert('Sharing not available on this device'); } } catch (shareError: any) { console.error('Error sharing:', shareError); Alert.alert('Error', 'Could not share recipe.'); } };
  // --- End Share ---

  // --- Video Player Logic ---
  useEffect(() => { 
    const videoElement = videoRef.current; 
    if (videoElement && isLoaded) { 
      videoElement.playAsync().catch(e => console.error('Initial play error:', e)); 
    }
  }, [isLoaded]); // Keep isLoaded dependency for play

  const handleLoad = async (status: AVPlaybackStatus) => { // Make handleLoad async
    if (status.isLoaded) {
      if (videoRef.current && initialSeekTime > 0) {
        try {
          console.log(`RecipeDetailScreen: Attempting to seek to ${initialSeekTime}ms`);
          await videoRef.current.setPositionAsync(initialSeekTime);
        } catch (e) {
          console.error(`RecipeDetailScreen: Error setting position to ${initialSeekTime}ms`, e);
        }
      }
      setIsLoaded(true); // Set isLoaded after attempting to seek
    } else if (status.error) { 
      console.error('Detail screen video load error:', status.error); 
    } 
  };
  const toggleMute = () => { 
    console.log('toggleMute called'); // Log 1: Function called
    console.log('current isMuted state:', isMuted); // Log 2: Current state
    if (!videoRef.current) {
      console.error('toggleMute: videoRef.current is null or undefined');
      return; // Exit if no video ref
    }
    videoRef.current.setIsMutedAsync(!isMuted)
      .catch(e => console.error('setIsMutedAsync error:', e));
    setIsMuted(prevMuted => {
      console.log('Updating isMuted state from', prevMuted, 'to', !prevMuted); // Log 3: State update
      return !prevMuted;
    });
  };
  const handleError = (error: string) => { console.error(`RecipeDetailScreen ${recipeId}: Video onError event:`, error); setIsLoaded(false); }
  // --- End Video Player ---

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
  const matchedSet = React.useMemo(() => new Set((recipeDetails?.matched_ingredients || []).map(name => name.trim().toLowerCase())), [recipeDetails]);
  const matchedCount = React.useMemo(() => ingredients.filter((ing: any) => matchedSet.has(ing.name?.trim().toLowerCase())).length, [ingredients, matchedSet]);
  const totalCount = ingredients.length;

  // Prepare time information
  const prepTime = recipeDetails?.prep_time_minutes;
  const cookTime = recipeDetails?.cook_time_minutes;
  const totalTime = (prepTime || 0) + (cookTime || 0);

  // --- Render Logic ---
  if (isLoading) {
    // console.log('RecipeDetailScreen: Rendering Loading state'); // Reverted this line
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !recipeDetails) {
    // console.log(`RecipeDetailScreen: Rendering Error/NoData state (error: ${error ? error.message : 'null'}, !recipeDetails: ${!recipeDetails})`); // Reverted this line
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>
          {error ? error : 'Could not load recipe details.'}
        </Text>
      </View>
    );
  }

  // console.log('RecipeDetailScreen: Rendering main content'); // Reverted this line
  // Prepare item prop for ActionOverlay - ensure it conforms to RecipeItem where needed
  const actionOverlayItemProps: RecipeItem & { likes?: number; saves?: number; liked?: boolean; saved?: boolean } = {
    id: recipeDetails.recipe_id,
    title: recipeDetails.title,
    video: recipeDetails.video_url ?? '',
    likes: recipeDetails.likes,
    // No output_is_liked, output_is_saved, output_likes, etc.
  };

  const shareUrl = recipeDetails.video_url || 'https://yourapp.com';

  return (
    // Using stickyHeaderIndices to attempt to keep tabs below header when scrolling
    // Note: This might require specific styling or structure depending on exact behavior needed.
    <ScrollView style={styles.screenContainer} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        {recipeDetails.video_url ? (
          <Video
            ref={videoRef}
            source={{ uri: recipeDetails.video_url }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            isMuted={isMuted}
            shouldPlay // Autoplay
            onLoad={handleLoad}
            onError={handleError}
            pointerEvents="none"
          />
        ) : (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <Text style={{ color: '#ccc' }}>Video not available</Text>
          </View>
        )}

        {/* Header Overlays (Mute button, Pantry Match, Actions) */}
        <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
          <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="white" />
        </TouchableOpacity>

        {/* Cart Icon with Badge - Placed top right */}
        <TouchableOpacity style={styles.cartButtonContainer} onPress={() => navigation.navigate('MainTabs', { screen: 'GroceryList' })}> 
          <Ionicons name="cart-outline" size={28} color={COLORS.white || '#FFF'} />
          {groceryList.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{groceryList.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Position ActionOverlay within header */}
      <View style={styles.actionOverlayPositioner}>
        <ActionOverlay 
          item={actionOverlayItemProps} // Pass the correctly typed object
          onLike={likeMut.mutate}
          onSave={saveMut.mutate} 
          onMorePress={handleShare}
        />
      </View>

      {/* NEW: Recipe Info Section (Title, Badge, Times) - Below video, above tabs */}
      <View style={styles.recipeInfoSection}>
        <Text style={styles.recipeTitleText} numberOfLines={3} ellipsizeMode="tail">
          {recipeDetails.title}
        </Text>
        <View style={styles.pantryBadgeRow}>
          <Ionicons name="restaurant-outline" style={styles.pantryBadgeIcon} />
          <Text style={styles.pantryBadgeInfoText}>
            {matchedCount}/{totalCount} Ingredients at pantry
          </Text>
        </View>
        <View style={styles.timeInfoRow}>
          {prepTime !== null && <Text style={styles.timeDetailText}>Prep: {prepTime} min</Text>}
          {cookTime !== null && <Text style={styles.timeDetailText}>Cook: {cookTime} min</Text>}
          {totalTime > 0 && <Text style={styles.timeDetailText}>Total: {totalTime} min</Text>}
        </View>
      </View>

      {/* Tab Section - Wrapped in a View for sticky headers */}
      {/* This View MUST NOT have flex: 1 if inside a ScrollView meant to scroll */}
      <View style={styles.tabContainerWrapper}>
        <Tab.Navigator
          screenOptions={{
            tabBarLabelStyle: { fontSize: 12, textTransform: 'capitalize' },
            tabBarIndicatorStyle: { backgroundColor: '#000' }, 
          }}
        >
          <Tab.Screen 
            name="Ingredients"
            component={IngredientsTab} 
            initialParams={{ id: recipeId }}
          />
          <Tab.Screen 
            name="Steps" 
            component={StepsTab} 
            initialParams={{ id: recipeId }}
          />
          <Tab.Screen 
            name="Macros" 
            component={MacrosTab} 
            initialParams={{ id: recipeId }}
          />
          <Tab.Screen 
            name="Comments" 
            component={CommentsTab} 
            initialParams={{ id: recipeId }}
          />
        </Tab.Navigator>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: COLORS.white || '#fff' },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: COLORS.error || 'red', textAlign: 'center' },
  headerContainer: { height: HEADER_HEIGHT, backgroundColor: COLORS.black || '#000', position: 'relative', zIndex: 1 },
  video: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  videoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.darkgray || '#222' },
  muteButton: { position: 'absolute', top: 60, left: 15, zIndex: 12, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cartButtonContainer: { position: 'absolute', top: 60, right: 15, zIndex: 12, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: COLORS.error || 'red',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: { color: COLORS.white || 'white', fontSize: 10, fontWeight: 'bold' },
  actionOverlayPositioner: { position: 'absolute', bottom: 15, right: 0, zIndex: 11 },
  recipeInfoSection: {
    backgroundColor: COLORS.white || '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#eee',
  },
  recipeTitleText: {
    fontSize: 24, // Larger title
    fontWeight: 'bold',
    color: COLORS.text || '#333',
    marginBottom: 12, // More space below title
    textAlign: 'center', // Centered title
  },
  pantryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center badge items
    marginBottom: 10, // Space below badge row
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
  timeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Space out time details
    alignItems: 'center',
  },
  timeDetailText: {
    color: COLORS.textSecondary || '#555',
    fontSize: 13,
    fontWeight: '500',
  },
  tabContainerWrapper: {
    minHeight: screenHeight, 
  },
}); 