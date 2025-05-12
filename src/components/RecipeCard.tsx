// RecipeCard component implementation will go here
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, DimensionValue, Image, TouchableWithoutFeedback } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import ActionOverlay from './ActionOverlay';
import { RecipeItem } from '../types'; // Import from central types
import { MainStackParamList } from '../navigation/types'; // Import MainStackParamList
import { prefetchRecipeDetails } from '../hooks/useRecipeDetails';
import { useAuth } from '../providers/AuthProvider';

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
          // Screen focused
          // console.log(`RecipeCard ${item.id} (useFocusEffect - focus): Active & Loaded - Playing with fade attempt`);
          try {
            await videoRef.current.setIsMutedAsync(true);
            await videoRef.current.playAsync();
            await videoRef.current.setIsMutedAsync(false);
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
          onLoad={handleLoad}
          onError={handleError}
          progressUpdateIntervalMillis={1000} 
        />
        
        {/* New Combined Overlay Wrapper */}
        <View style={styles.overlayWrapper}>
          {/* Left Side: Text Info */}
          <View style={styles.textInfoContainer}>
            <View style={styles.creatorInfoContainer}>
              {item.creatorAvatarUrl ? (
                <Image 
                  source={{ uri: item.creatorAvatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <Text style={styles.usernameText} numberOfLines={1}>{item.userName || 'Unknown User'}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            {item.pantryMatchPct !== undefined && (
              <Text style={styles.pantryMatch}>
                {item.pantryMatchPct}% pantry match
              </Text>
            )}
          </View>

          {/* Right Side: Action Buttons */}
          {item.onLike && item.onSave && (
            // ActionOverlay is now positioned by flexbox (justifyContent: space-between)
            <ActionOverlay 
              item={item} 
              onLike={item.onLike} 
              onSave={item.onSave} 
              onMorePress={handleNavigateToDetail}
            />
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

// Basic styling
const styles = StyleSheet.create({
  container: {
    width: '100%' as DimensionValue,
    backgroundColor: 'black',
    overflow: 'hidden',
  },
  overlayWrapper: { // New wrapper for all overlay content
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',       // Arrange text and actions horizontally
    justifyContent: 'space-between', // Push text left, actions right
    alignItems: 'flex-end',     // Align items to the bottom of the wrapper
    backgroundColor: 'rgba(0,0,0,0.6)', // Slightly darker background
    padding: 12, 
    borderRadius: 10, 
  },
  textInfoContainer: { // Container for left-side text elements
    flexShrink: 1, // Allow text container to shrink if needed, prevent pushing actions off-screen
    marginRight: 8, // Add some space between text and actions
  },
  creatorInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#555',
  },
  avatarPlaceholder: {
    backgroundColor: '#444',
  },
  usernameText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    flexShrink: 1, // Allow username to shrink/wrap if long
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pantryMatch: {
    color: 'white',
    fontSize: 14,
  },
}); 