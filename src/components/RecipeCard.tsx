// RecipeCard component implementation will go here
import React, { useRef, useEffect, useState, useCallback } from 'react';
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

interface RecipeCardProps {
  item: RecipeItem;
  isActive: boolean;
  containerHeight: number;
  isScreenFocused: boolean;
  pantryItemCount: number;
  onWhatCanICookPress: () => void;
}

// Define the specific navigation prop type for this screen's context
type RecipeCardNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'RecipeDetail' | 'SearchScreen'
>;

export default function RecipeCard({
  item,
  isActive,
  containerHeight,
  isScreenFocused,
  pantryItemCount,
  onWhatCanICookPress,
}: RecipeCardProps) {
  // Log the item prop to debug potential string rendering issues
  // console.log(`[RecipeCard DEBUG] Rendering item: ${item.id}, title: ${item.title}`);
  // console.log(JSON.stringify(item, null, 2)); // UNCOMMENTED to debug error

  const videoRef = useRef<Video>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPrefetched, setIsPrefetched] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const navigation = useNavigation<RecipeCardNavigationProp>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets(); // Added

  // Removed useEffect and useFocusEffect for play/pause logic
  // The shouldPlay prop on the Video component will now manage this.

  useEffect(() => {
    if (isActive && isScreenFocused && isLoaded && !isPrefetched && item.id) {
      prefetchRecipeDetails(queryClient, item.id, user?.id)
        .then(() => setIsPrefetched(true))
        .catch(e => console.error(`Prefetch error for ${item.id}:`, e));
    }
  }, [
    isActive,
    isScreenFocused,
    isLoaded,
    isPrefetched,
    item.id,
    queryClient,
    user?.id,
  ]);

  const handleLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (!isLoaded) {
        setIsLoaded(true);
      }
      setIsBuffering(false);
    } else if (status.error) {
      console.error(
        `RecipeCard ${item.id}: Video load error from onLoad:`,
        status.error,
      );
      setIsLoaded(false);
      setIsBuffering(false);
    }
  };

  const handleError = (error: string) => {
    console.error(`RecipeCard ${item.id}: Video onError event:`, error);
    setIsLoaded(false);
    setIsBuffering(false);
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (isActive && isScreenFocused) {
        setIsBuffering(true);
      }
      setIsLoaded(false);
      return;
    }
    setIsLoaded(true);
    if (isActive && isScreenFocused) {
      if (status.isBuffering) {
        setIsBuffering(true);
      } else {
        setIsBuffering(false);
      }
      if (status.isPlaying && status.isBuffering) {
        setIsBuffering(true);
      }
    } else {
      setIsBuffering(false);
    }
  };

  const handlePressIn = useCallback(() => {
    if (item.id && !isPrefetched) {
      prefetchRecipeDetails(queryClient, item.id, user?.id)
        .then(() => setIsPrefetched(true))
        .catch(e => console.error(`Prefetch error for ${item.id}:`, e));
    }
  }, [item.id, isPrefetched, queryClient, user?.id]);

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
    if ((item._userIngredientsCount || 0) > 0) {
      return `${item._userIngredientsCount || 0}/${item._totalIngredientsCount || 0} match`;
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
        <Video
          ref={videoRef}
          source={{ uri: item.video || item.video_url || '' }}
          resizeMode={ResizeMode.COVER}
          style={StyleSheet.absoluteFill}
          isLooping
          isMuted={false}
          shouldPlay={isActive && isScreenFocused}
          onLoad={handleLoad}
          onError={handleError}
          progressUpdateIntervalMillis={500}
          onPlaybackStatusUpdate={
            isActive && isScreenFocused ? onPlaybackStatusUpdate : undefined
          }
        />

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
}
