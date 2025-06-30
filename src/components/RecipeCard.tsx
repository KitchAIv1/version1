// RecipeCard component implementation will go here
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActionOverlay from './ActionOverlay';
import { RecipeItem } from '../types';
import { MainStackParamList } from '../navigation/types';
import { prefetchRecipeDetails } from '../hooks/useRecipeDetails';
import { useAuth } from '../providers/AuthProvider';
import WhatCanICookButton from './WhatCanICookButton';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import { useVideoPreloader } from '../hooks/useVideoPreloader';

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'black',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  topOverlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  pantryMatchBadge: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pantryMatchBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 12,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    zIndex: 1,
  },
  recipeInfoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 40,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  leftContentContainer: {
    flex: 1,
    marginRight: 8,
  },
  recipeTitleContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  pantryMatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  matchIcon: {},
  pantryMatch: {
    fontSize: 12,
    color: '#DCFCE7',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 6,
  },
  actionOverlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 18,
    justifyContent: 'center',
    zIndex: 3,
    paddingTop: 120,
    paddingBottom: 5,
  },
  movedAvatarContainer: {
    position: 'absolute',
    bottom: 165,
    right: 15,
    zIndex: 4,
    alignItems: 'center',
  },
  movedAvatar: {
    width: 53,
    height: 53,
    borderRadius: 26.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
});

// 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Video quality optimization
const getOptimizedVideoUrl = (baseUrl: string, quality: 'low' | 'medium' | 'high'): string => {
  if (!baseUrl) return baseUrl;
  
  // For Supabase videos, add quality parameters
  if (baseUrl.includes('supabase.co/storage')) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const qualityParams = {
      low: 'w=480&h=720&q=60',
      medium: 'w=720&h=1280&q=75', 
      high: 'w=1080&h=1920&q=85'
    };
    return `${baseUrl}${separator}${qualityParams[quality]}`;
  }
  
  return baseUrl;
};

// 🚀 OPTIMIZED: Removed duplicate video preloader - using main useVideoPreloader.ts hook
// This reduces resource conflicts and improves video loading performance

// Helper function to safely access ingredient counts
function getIngredientCounts(item: RecipeItem): {
  userCount: number;
  totalCount: number;
} {
  try {
    if (
      item._userIngredientsCount !== undefined &&
      item._totalIngredientsCount !== undefined
    ) {
      return {
        userCount: item._userIngredientsCount,
        totalCount: item._totalIngredientsCount,
      };
    }
    return { userCount: 0, totalCount: 0 };
  } catch (error) {
    console.warn('Error accessing ingredient counts:', error);
    return { userCount: 0, totalCount: 0 };
  }
}

interface RecipeCardProps {
  item: RecipeItem & {
    onLike: () => void;
    onSave: () => void;
  };
  isActive: boolean;
  containerHeight: number;
  isScreenFocused: boolean;
  pantryItemCount: number;
  onWhatCanICookPress: () => void;
  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Add preloading props
  nextVideoUrl?: string;
  prevVideoUrl?: string;
}

type RecipeCardNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'RecipeDetail'
>;

export default React.memo(function RecipeCard({
  item,
  isActive,
  containerHeight,
  isScreenFocused,
  pantryItemCount,
  onWhatCanICookPress,
  nextVideoUrl,
  prevVideoUrl,
}: RecipeCardProps) {
  const navigation = useNavigation<RecipeCardNavigationProp>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const networkQuality = useNetworkQuality();
  const { preloadVideo } = useVideoPreloader();

  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Adaptive video quality based on network
  const videoQuality = useMemo(() => {
    if (!networkQuality.isConnected) return 'low';
    if (networkQuality.speed < 30) return 'low';
    if (networkQuality.speed < 100) return 'medium';
    return 'high';
  }, [networkQuality]);

  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Get optimized video URL
  const videoUrl = useMemo(() => {
    const rawUrl = item.video || item.video_url || '';
    return rawUrl ? getOptimizedVideoUrl(rawUrl, videoQuality) : '';
  }, [item.video, item.video_url, videoQuality]);

  const hasValidVideoUrl = videoUrl && videoUrl.trim() !== '';

  // 🚀 OPTIMIZED: Reduced adjacent video preloading for performance - only preload next video
  useEffect(() => {
    if (isActive && isScreenFocused && nextVideoUrl) {
      // Only preload next video to reduce resource competition
      setTimeout(() => preloadVideo(nextVideoUrl, 'high', videoQuality), 200);
    }
  }, [isActive, isScreenFocused, nextVideoUrl, preloadVideo, videoQuality]);
  
  // Simple cleanup on unmount only
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(() => {
          // Ignore cleanup errors on unmount
        });
      }
    };
  }, []);

  // Prefetch recipe details when active
  useEffect(() => {
    if (isActive && isScreenFocused && !hasError && item.id) {
      prefetchRecipeDetails(queryClient, item.id, user?.id)
        .then(() => {
          // No need to set isPrefetched here, as we're using hasError to track prefetch status
        })
        .catch(e => {
          console.error(`Prefetch error for ${item.id}:`, e);
          setHasError(true);
        });
    }
  }, [
    isActive,
    isScreenFocused,
    hasError,
    item.id,
    queryClient,
    user?.id,
  ]);

  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Faster load handling with reduced state updates
  const handleLoad = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsBuffering(false);
      setHasError(false);
    } else {
      setIsBuffering(false);
      setHasError(true);
    }
  }, []);

  const handleError = useCallback((error: string) => {
    console.error(`RecipeCard ${item.id}: Video error:`, error);
    setIsBuffering(false);
    setHasError(true);
  }, [item.id]);

  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Optimized playback status with less frequent updates
  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (isActive && isScreenFocused) {
        setIsBuffering(true);
      }
      return;
    }
    
    setIsBuffering(false);
    if (isActive && isScreenFocused && status.isBuffering) {
      setIsBuffering(true);
    }
  }, [isActive, isScreenFocused]);

  const handlePressIn = useCallback(() => {
    if (item.id && !hasError) {
      prefetchRecipeDetails(queryClient, item.id, user?.id)
        .then(() => {
          // No need to set isPrefetched here, as we're using hasError to track prefetch status
        })
        .catch(e => {
          console.error(`Prefetch error for ${item.id}:`, e);
          setHasError(true);
        });
    }
  }, [item.id, hasError, queryClient, user?.id]);

  const handleNavigateToDetail = async () => {
    console.log(`Navigating to RecipeDetail for ID: ${item.id}`);
    let seekTime = 0;
    try {
      const status = await videoRef.current?.getStatusAsync();
      if (status && status.isLoaded) {
        seekTime = status.positionMillis;
      }
    } catch (error) {
      console.warn(
        `RecipeCard ${item.id}: Could not get video status for seek time`,
        error,
      );
    }
    navigation.navigate('RecipeDetail', {
      id: item.id,
      initialSeekTime: seekTime,
    });
  };

  const handleNavigateToComments = async () => {
    console.log(`Navigating to RecipeDetail (Comments) for ID: ${item.id}`);
    let seekTime = 0;
    try {
      const status = await videoRef.current?.getStatusAsync();
      if (status && status.isLoaded) {
        seekTime = status.positionMillis;
      }
    } catch (error) {
      console.warn(
        `RecipeCard ${item.id}: Could not get video status for seek time`,
        error,
      );
    }
    navigation.navigate('RecipeDetail', {
      id: item.id,
      initialSeekTime: seekTime,
      initialTab: 'Comments',
    });
  };

  // Handle navigation to creator's profile
  const handleNavigateToProfile = () => {
    if (item.creator_user_id) {
      console.log(
        `[RecipeCard] Navigating to profile for user: ${item.creator_user_id}`,
      );
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { userId: item.creator_user_id },
      });
    } else {
      console.warn(
        '[RecipeCard] No creator_user_id available for profile navigation',
      );
    }
  };

  // Helper function to get pantry match text
  const getPantryMatchText = () => {
    if (item.pantryMatchPct && item.pantryMatchPct > 0) {
      return `${item.pantryMatchPct}% match`;
    }
    // Use the safe accessor function
    const { userCount, totalCount } = getIngredientCounts(item);
    if (userCount > 0) {
      return `${userCount}/${totalCount} match`;
    }
    return '0% match';
  };

  const containerStyle = {
    height: containerHeight,
  };

  // Dynamic style for topOverlayContainer based on insets
  const topOverlayContainerStyle = {
    ...styles.topOverlayContainer,
    top: insets.top + 16, // Adjust top position based on safe area
  };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn}>
      <View style={[styles.container, containerStyle]}>
        {/* 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Enhanced Video Player with adaptive quality */}
        {hasValidVideoUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            resizeMode={ResizeMode.COVER}
            style={StyleSheet.absoluteFill}
            isLooping
            isMuted={false}
            shouldPlay={isActive && isScreenFocused}
            onLoad={handleLoad}
            onError={handleError}
            progressUpdateIntervalMillis={1500} // Further reduced to 1.5s for video loading performance
            onPlaybackStatusUpdate={
              isActive && isScreenFocused ? onPlaybackStatusUpdate : undefined
            }
            // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Add video optimization props
            useNativeControls={false}
            positionMillis={0}
            volume={1.0}
          />
        ) : (
          // Fallback for recipes without videos - show thumbnail
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
            {item.thumbnail_url ? (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                defaultSource={{
                  uri: 'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/porkstirfry.jpeg',
                }}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                <Feather name="image" size={48} color="#666" />
                <Text style={{ color: '#666', marginTop: 8 }}>No Video Available</Text>
              </View>
            )}
          </View>
        )}

        <View style={topOverlayContainerStyle}>
          {item.pantryMatchPct !== undefined ? (
            <View style={styles.pantryMatchBadge}>
              <Feather
                name="check-circle"
                size={16}
                color="white"
                style={{ marginRight: 5 }}
              />
              <Text style={styles.pantryMatchBadgeText}>
                {getPantryMatchText()}
              </Text>
            </View>
          ) : (
            <View />
          )}

          {/* Visual divider */}
          <View style={styles.divider} />

          {/* "What Can I Cook?" Button - Moved from floating position */}
          <WhatCanICookButton
            pantryItemCount={pantryItemCount}
            onPress={onWhatCanICookPress}
            variant="text"
          />
        </View>

        {/* 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Optimized buffering indicator */}
        {isActive && isScreenFocused && isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />

        <View style={styles.recipeInfoContainer}>
          <View style={styles.leftContentContainer}>
            <TouchableOpacity
              style={styles.recipeTitleContainer}
              onPress={handleNavigateToDetail}
              activeOpacity={0.9}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title || ''}
              </Text>
            </TouchableOpacity>

            <View style={styles.userInfoContainer}>
              <TouchableOpacity
                style={styles.userTouchable}
                onPress={handleNavigateToProfile}>
                <Text style={styles.usernameText} numberOfLines={1}>
                  By {item.userName || 'Unknown User'}
                </Text>
              </TouchableOpacity>
            </View>

            {item.description && (
              <Text style={styles.descriptionText} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
        </View>

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

        <View style={styles.movedAvatarContainer}>
          <TouchableOpacity onPress={handleNavigateToProfile}>
            {item.creatorAvatarUrl ? (
              <Image
                source={{ uri: item.creatorAvatarUrl }}
                style={styles.movedAvatar}
              />
            ) : (
              <View style={[styles.movedAvatar, styles.avatarPlaceholder]}>
                <Feather name="user" size={24} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
});
