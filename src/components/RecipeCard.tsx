// RecipeCard component implementation will go here
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, DimensionValue, Image, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import ActionOverlay from './ActionOverlay';
import { RecipeItem } from '../types'; // Import from central types
import { MainStackParamList } from '../navigation/types'; // Import MainStackParamList
import { prefetchRecipeDetails } from '../hooks/useRecipeDetails';
import { useAuth } from '../providers/AuthProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

// Remove local interface definition
// interface RecipeItem { ... }

interface RecipeCardProps {
  item: RecipeItem;
  isActive: boolean;
  containerHeight: number;
}

// Define the specific navigation prop type for this screen's context
type RecipeCardNavigationProp = NativeStackNavigationProp<MainStackParamList, 'RecipeDetail'>;

export default function RecipeCard({ item, isActive, containerHeight }: RecipeCardProps) {
  const videoRef = useRef<Video>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPrefetched, setIsPrefetched] = useState(false);
  const navigation = useNavigation<RecipeCardNavigationProp>(); // Get navigation object
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const videoElement = videoRef.current;
    // console.log(`RecipeCard ${item.id} - Effect: isActive: ${isActive}, isLoaded: ${isLoaded}`); // Reduced logging

    if (!videoElement) {
      return;
    }
    if (isActive) {
      if (isLoaded) {
        videoElement.playAsync().catch(e => console.error(`Play error for ${item.id}: ${e.message}`, e));
        
        // Prefetch data when video becomes active and visible
        if (!isPrefetched && item.id) {
          prefetchRecipeDetails(queryClient, item.id, user?.id)
            .then(() => setIsPrefetched(true))
            .catch(e => console.error(`Prefetch error for ${item.id}:`, e));
        }
      } 
    } else { 
      if (isLoaded) { 
        videoElement.pauseAsync().catch(e => console.error(`Pause error for ${item.id}: ${e.message}`, e));
      }
    }
    return () => {
      const currentVideoElement = videoRef.current;
      if (currentVideoElement) {
        currentVideoElement.getStatusAsync().then(status => {
          if (status.isLoaded && status.isPlaying) {
             currentVideoElement.pauseAsync().catch(e => console.error(`Cleanup pause error for ${item.id}: ${e.message}`,e));
          }
        }).catch(e => console.error(`Cleanup getStatus error for ${item.id}: ${e.message}`, e));
      }
    };
  }, [isActive, isLoaded, item.id, isPrefetched, queryClient, user?.id]);

  useFocusEffect(
    useCallback(() => {
      const managePlayback = async () => {
        if (isActive && isLoaded && videoRef.current) {
          try {
            await videoRef.current.playAsync();
          } catch (e) {
            console.error(`RecipeCard ${item.id}: Error in focus effect (play/fade)`, e);
          }
        }
      };

      managePlayback();

      return () => {
        // Screen blurred
        const pauseOnBlur = async () => {
          if (isActive && isLoaded && videoRef.current) {
            // console.log(`RecipeCard ${item.id} (useFocusEffect - blur): Active & Loaded - Pausing`);
            try {
              await videoRef.current.pauseAsync();
            } catch (e) {
              console.error(`RecipeCard ${item.id}: Error in focus effect (pause)`, e);
            }
          }
        };
        pauseOnBlur();
      };
    }, [isActive, isLoaded, item.id]) // Dependencies for useCallback
  );

  const handleLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (!isLoaded) { setIsLoaded(true); }
    } else if (status.error) {
      console.error(`RecipeCard ${item.id}: Video load error from onLoad:`, status.error);
      setIsLoaded(false); 
    }
  };
  
  const handleError = (error: string) => {
    console.error(`RecipeCard ${item.id}: Video onError event:`, error);
    setIsLoaded(false);
  }

  // Handler for touch events to trigger prefetching
  const handlePressIn = useCallback(() => {
    if (item.id && !isPrefetched) {
      prefetchRecipeDetails(queryClient, item.id, user?.id)
        .then(() => setIsPrefetched(true))
        .catch(e => console.error(`Prefetch error for ${item.id}:`, e));
    }
  }, [item.id, isPrefetched, queryClient, user?.id]);

  // Handler for navigating to detail screen
  const handleNavigateToDetail = async () => {
    console.log(`Navigating to RecipeDetail for ID: ${item.id}`);
    let seekTime = 0;
    try {
      const status = await videoRef.current?.getStatusAsync();
      if (status && status.isLoaded) {
        seekTime = status.positionMillis;
      }
    } catch (error) {
      console.warn(`RecipeCard ${item.id}: Could not get video status for seek time`, error);
    }
    navigation.navigate('RecipeDetail', { 
      id: item.id,
      initialSeekTime: seekTime
    });
  };

  // New handler for navigating to RecipeDetail with Comments tab active
  const handleNavigateToComments = async () => {
    console.log(`Navigating to RecipeDetail (Comments) for ID: ${item.id}`);
    let seekTime = 0;
    try {
      const status = await videoRef.current?.getStatusAsync();
      if (status && status.isLoaded) {
        seekTime = status.positionMillis;
      }
    } catch (error) {
      console.warn(`RecipeCard ${item.id}: Could not get video status for seek time`, error);
    }
    // Navigate to RecipeDetail, specifying the 'Comments' tab
    // Assuming 'Comments' is the string value used by RecipeDetailScreen's TAB_ROUTES.COMMENTS
    navigation.navigate('RecipeDetail', { 
      id: item.id,
      initialSeekTime: seekTime,
      initialTab: 'Comments' // Pass the target tab name
    });
  };

  const containerStyle = {
    height: containerHeight,
  };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn}>
      <View style={[styles.container, containerStyle]}>
        <Video
          ref={videoRef}
          source={{ uri: item.video }}
          resizeMode={ResizeMode.COVER}
          style={StyleSheet.absoluteFill}
          isLooping
          isMuted={false}
          onLoad={handleLoad}
          onError={handleError}
          progressUpdateIntervalMillis={1000} 
        />
        
        {/* Gradient overlay to make text more readable */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />
        
        {/* Recipe info at bottom */}
        <View style={styles.recipeInfoContainer}>
          {/* New container for left-side content */}
          <View style={styles.leftContentContainer}>
            <TouchableOpacity 
              style={styles.recipeTitleContainer} 
              onPress={handleNavigateToDetail}
              activeOpacity={0.9}
            >
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              
              {item.pantryMatchPct !== undefined && (
                <View style={styles.pantryMatchContainer}>
                  <Feather name="check-circle" size={14} color="#22c55e" style={styles.matchIcon} />
                  <Text style={styles.pantryMatch}>
                    {item.pantryMatchPct}% pantry match
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* MOVED User info here, inside leftContentContainer */}
            <View style={styles.userInfoContainer}>
              <TouchableOpacity 
                style={styles.userTouchable}
                // Removing navigation to Profile since it's not properly defined in the navigation types
                // We'll leave the touchable for UI consistency
              >
                {item.creatorAvatarUrl ? (
                  <Image 
                    source={{ uri: item.creatorAvatarUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Feather name="user" size={16} color="#ffffff" />
                  </View>
                )}
                <Text style={styles.usernameText} numberOfLines={1}>
                  {item.userName || 'Unknown User'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Action overlay (now a sibling to leftContentContainer) */}
          {item.onLike && item.onSave && (
            <View style={styles.actionOverlayContainer}>
              <ActionOverlay 
                item={item} 
                onLike={item.onLike} 
                onSave={item.onSave} 
                onCommentPress={handleNavigateToComments}
                onMorePress={handleNavigateToDetail}
              />
            </View>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

// Updated styling
const styles = StyleSheet.create({
  container: {
    width: '100%' as DimensionValue,
    backgroundColor: 'black',
    overflow: 'hidden',
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    zIndex: 1,
  },
  userInfoContainer: {
    zIndex: 2,
    marginTop: 8,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(100,100,100,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  recipeInfoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 2,
    flexDirection: 'row', // Added for side-by-side layout
    justifyContent: 'space-between', // Added
    alignItems: 'flex-end', // Align items (left block and actions) to the bottom of this container
  },
  leftContentContainer: { // New style for the left block
    flex: 1, // Take available space
    marginRight: 8, // Space between left content and actions
  },
  recipeTitleContainer: {
    marginBottom: 8,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pantryMatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  matchIcon: {
    marginRight: 4,
  },
  pantryMatch: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  actionOverlayContainer: {
    // alignItems: 'center', // Removed or adjust: actions are now in a row
    // justifyContent: 'flex-end', // Removed or adjust
    // marginBottom: 8, // Removed or adjust, alignment handled by recipeInfoContainer
    // Add specific alignment for items within action overlay if needed
    // For example, to keep icons vertically centered if their container is taller:
    // justifyContent: 'center', 
  },
}); 