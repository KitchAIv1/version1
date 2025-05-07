// RecipeDetailScreen placeholder
import React, { useState, useRef, useEffect } from 'react';
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
import { useRoute, RouteProp } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useQueryClient, useMutation } from '@tanstack/react-query';

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

  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Log IDs being used
  console.log(`RecipeDetailScreen: recipeId = ${recipeId}, userId = ${user?.id}`);

  // Fetch data
  const {
    data: recipeDetails,
    isLoading,
    error,
    status, // Add status for more detail
  } = useRecipeDetails(recipeId, user?.id);

  // Log hook status
  console.log(`RecipeDetailScreen: useRecipeDetails status = ${status}, isLoading = ${isLoading}, error = ${error ? error.message : 'null'}, hasData = ${!!recipeDetails}`);
  if (status === 'success' && recipeDetails) {
    console.log('RecipeDetailScreen: Received recipeDetails keys:', Object.keys(recipeDetails).join(', ')); // Log keys instead of full object
  }

  // --- Optimistic updates for like/save --- 
  interface MutationContext {
    previousDetails?: RecipeDetailsData;
  }
  const likeMut = useMutation<void, Error, void, MutationContext>({ mutationFn: async () => { if (!recipeId) throw new Error('Recipe ID missing'); const { error } = await supabase.rpc('like_recipe', { recipe_id: recipeId }); if (error) throw error; }, onMutate: async () => { await queryClient.cancelQueries({ queryKey: ['recipe', recipeId] }); const previousDetails = queryClient.getQueryData<RecipeDetailsData>(['recipe', recipeId]); queryClient.setQueryData<RecipeDetailsData | undefined>(['recipe', recipeId], (oldData) => oldData ? { ...oldData, output_is_liked: !oldData.output_is_liked, output_likes: oldData.output_is_liked ? oldData.output_likes - 1 : oldData.output_likes + 1, } : undefined ); return { previousDetails }; }, onError: (_err, _vars, context) => { queryClient.setQueryData(['recipe', recipeId], context?.previousDetails); }, onSettled: () => { queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] }); queryClient.invalidateQueries({ queryKey: ['feed'] }); }, });
  const saveMut = useMutation<void, Error, void, MutationContext>({ mutationFn: async () => { if (!recipeId) throw new Error('Recipe ID missing'); const { error } = await supabase.rpc('save_recipe', { recipe_id: recipeId }); if (error) throw error; }, onMutate: async () => { await queryClient.cancelQueries({ queryKey: ['recipe', recipeId] }); const previousDetails = queryClient.getQueryData<RecipeDetailsData>(['recipe', recipeId]); queryClient.setQueryData<RecipeDetailsData | undefined>(['recipe', recipeId], (oldData) => oldData ? { ...oldData, output_is_saved: !oldData.output_is_saved } : undefined ); return { previousDetails }; }, onError: (_err, _vars, context) => { queryClient.setQueryData(['recipe', recipeId], context?.previousDetails); }, onSettled: () => { queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] }); queryClient.invalidateQueries({ queryKey: ['feed'] }); }, });
  // --- End Optimistic Updates ---

  // --- Share Functionality ---
  const handleShare = async () => { const shareUrl = recipeDetails?.output_video_url || 'https://yourapp.com'; try { const available = await Sharing.isAvailableAsync(); if (available) { await Sharing.shareAsync(shareUrl, { dialogTitle: `Check out this recipe: ${recipeDetails?.output_name || 'Recipe'}`, }); } else { Alert.alert('Sharing not available on this device'); } } catch (shareError: any) { console.error('Error sharing:', shareError); Alert.alert('Error', 'Could not share recipe.'); } };
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
      .then(() => console.log('setIsMutedAsync successful'))
      .catch(e => console.error('setIsMutedAsync error:', e));
    setIsMuted(prevMuted => {
      console.log('Updating isMuted state from', prevMuted, 'to', !prevMuted); // Log 3: State update
      return !prevMuted;
    });
  };
  const handleError = (error: string) => { console.error(`RecipeDetailScreen ${recipeId}: Video onError event:`, error); setIsLoaded(false); }
  // --- End Video Player ---

  // --- Render Logic ---
  if (isLoading) {
    console.log('RecipeDetailScreen: Rendering Loading state');
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !recipeDetails) {
    console.log(`RecipeDetailScreen: Rendering Error/NoData state (error: ${error ? error.message : 'null'}, !recipeDetails: ${!recipeDetails})`);
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>
          {error ? error.message : 'Could not load recipe details.'}
        </Text>
      </View>
    );
  }

  console.log('RecipeDetailScreen: Rendering main content');
  // Prepare item prop for ActionOverlay - ensure it conforms to RecipeItem where needed
  const actionOverlayItemProps: RecipeItem & { likes?: number; saves?: number; liked?: boolean; saved?: boolean } = { id: recipeDetails.output_id, liked: recipeDetails.output_is_liked, likes: recipeDetails.output_likes, saved: recipeDetails.output_is_saved, title: recipeDetails.output_name, video: recipeDetails.output_video_url, };

  return (
    // Using stickyHeaderIndices to attempt to keep tabs below header when scrolling
    // Note: This might require specific styling or structure depending on exact behavior needed.
    <ScrollView style={styles.screenContainer} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        {recipeDetails.output_video_url ? (
          <Video
            ref={videoRef}
            source={{ uri: recipeDetails.output_video_url }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            isMuted={isMuted}
            shouldPlay // Autoplay
            onLoad={handleLoad}
            onError={handleError} // Use the defined handler
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
        
        {recipeDetails.output_user_ingredients_count !== undefined && 
         recipeDetails.output_total_ingredients_count !== undefined && (
           <View style={styles.pantryBadge}>
              <Text style={styles.pantryText}>
                {recipeDetails.output_user_ingredients_count}/{recipeDetails.output_total_ingredients_count} pantry match
              </Text>
           </View>
        )}
        
        {/* Position ActionOverlay within header */}
        <View style={styles.actionOverlayPositioner}>
          <ActionOverlay 
            item={actionOverlayItemProps} // Pass the correctly typed object
            onLike={likeMut.mutate}
            onSave={saveMut.mutate} 
            onMorePress={handleShare}
          />
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
  screenContainer: { flex: 1, backgroundColor: '#fff', },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
  errorText: { color: 'red', textAlign: 'center', },
  headerContainer: { height: HEADER_HEIGHT, backgroundColor: '#000', position: 'relative', zIndex: 1, },
  video: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  videoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#222', },
  muteButton: { position: 'absolute', top: 60, left: 15, zIndex: 12, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, },
  pantryBadge: { position: 'absolute', bottom: 15, left: 15, zIndex: 11, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, },
  pantryText: { color: 'white', fontSize: 12, fontWeight: 'bold', },
  actionOverlayPositioner: { position: 'absolute', bottom: 15, right: 0, zIndex: 11, },
  // Adjusted tabContainerWrapper: Removed flex: 1, using minHeight to ensure content area
  tabContainerWrapper: {
    // flex: 1, // Remove flex: 1 when inside ScrollView
    minHeight: screenHeight, // Set minHeight to ensure space, adjust as needed
  },
}); 