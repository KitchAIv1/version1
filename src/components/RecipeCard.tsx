// RecipeCard component implementation will go here
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, DimensionValue, Image, TouchableWithoutFeedback, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useNavigation /*, useFocusEffect */ } from '@react-navigation/native'; // Commented out useFocusEffect
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import ActionOverlay from './ActionOverlay';
import { RecipeItem } from '../types'; // Import from central types
import { MainStackParamList } from '../navigation/types'; // Import MainStackParamList
import { prefetchRecipeDetails } from '../hooks/useRecipeDetails';
import { useAuth } from '../providers/AuthProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Added

// Remove local interface definition
// interface RecipeItem { ... }

interface RecipeCardProps {
  item: RecipeItem;
  isActive: boolean;
  containerHeight: number;
  isScreenFocused: boolean;
}

// Define the specific navigation prop type for this screen's context
type RecipeCardNavigationProp = NativeStackNavigationProp<MainStackParamList, 'RecipeDetail' | 'SearchScreen'>;

export default function RecipeCard({ item, isActive, containerHeight, isScreenFocused }: RecipeCardProps) {
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
  }, [isActive, isScreenFocused, isLoaded, isPrefetched, item.id, queryClient, user?.id]);


  const handleLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (!isLoaded) { setIsLoaded(true); }
      setIsBuffering(false);
    } else if (status.error) {
      console.error(`RecipeCard ${item.id}: Video load error from onLoad:`, status.error);
      setIsLoaded(false);
      setIsBuffering(false);
    }
  };
  
  const handleError = (error: string) => {
    console.error(`RecipeCard ${item.id}: Video onError event:`, error);
    setIsLoaded(false);
    setIsBuffering(false);
  }

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
      console.warn(`RecipeCard ${item.id}: Could not get video status for seek time`, error);
    }
    navigation.navigate('RecipeDetail', { 
      id: item.id,
      initialSeekTime: seekTime
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
      console.warn(`RecipeCard ${item.id}: Could not get video status for seek time`, error);
    }
    navigation.navigate('RecipeDetail', { 
      id: item.id,
      initialSeekTime: seekTime,
      initialTab: 'Comments'
    });
  };

  const handleNavigateToSearch = () => {
    navigation.navigate('SearchScreen');
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
          source={{ uri: item.video }}
          resizeMode={ResizeMode.COVER}
          style={StyleSheet.absoluteFill}
          isLooping
          isMuted={false}
          shouldPlay={isActive && isScreenFocused}
          onLoad={handleLoad}
          onError={handleError}
          progressUpdateIntervalMillis={500}
          onPlaybackStatusUpdate={isActive && isScreenFocused ? onPlaybackStatusUpdate : undefined}
        />

        <View style={topOverlayContainerStyle}> 
          {item.pantryMatchPct !== undefined ? (
            <View style={styles.pantryMatchBadge}>
              <Feather name="check-circle" size={16} color="white" style={{ marginRight: 5 }} />
              <Text style={styles.pantryMatchBadgeText}>
                {`${item.pantryMatchPct || 0}`}% match
              </Text>
            </View>
          ) : <View />}

          <TouchableOpacity 
            style={styles.filterButton} 
            onPress={() => console.log('Filter pressed')}
            activeOpacity={0.7}
          >
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={handleNavigateToSearch}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={24} color="white" />
          </TouchableOpacity>
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
              activeOpacity={0.9}
            >
              <Text style={styles.title} numberOfLines={2}>{item.title || ''}</Text>
            </TouchableOpacity>

            <View style={styles.userInfoContainer}>
              <TouchableOpacity style={styles.userTouchable}>
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
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

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
  pantryMatchBadge: { // No longer absolute position within this container
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
  filterButton: { // No longer absolute position within this container
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginHorizontal: 12,
  },
  filterButtonText: {
    color: 'white',
    fontSize: 16,
  },
  searchButton: { // No longer absolute position within this container
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 6,
    borderRadius: 20, 
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
  matchIcon: { 
  },
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