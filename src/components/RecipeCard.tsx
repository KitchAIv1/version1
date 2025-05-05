// RecipeCard component implementation will go here
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

// Define the expected item structure
interface RecipeItem {
  id: string;
  title: string;
  video: string;
  pantryMatchPct?: number;
}

// Define props for the component
interface RecipeCardProps {
  item: RecipeItem;
  isActive: boolean;
  containerHeight: number;
}

export default function RecipeCard({ item, isActive, containerHeight }: RecipeCardProps) {
  const videoRef = useRef<Video>(null);

  // State to track if video is loaded and ready
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }
    // Restore original play/pause logic
    if (isActive && isLoaded) {
      console.log(`RecipeCard ${item.id}: isActive & Loaded, attempting to play...`);
      videoElement.playAsync().catch(e => console.error(`Play error for ${item.id}:`, e));
    } else {
      console.log(`RecipeCard ${item.id}: isActive=${isActive}, isLoaded=${isLoaded}. Pausing.`);
      videoElement.pauseAsync().catch(e => console.error(`Pause error for ${item.id}:`, e));
    }
    return () => {
      const currentVideoElement = videoRef.current;
      if (currentVideoElement) {
        currentVideoElement.pauseAsync().catch(e => console.error(`Cleanup pause error for ${item.id}:`, e));
      }
    };
  }, [isActive, isLoaded, item.id]);

  const handleLoad = (status: AVPlaybackStatus) => {
    // Restore original load handling
    if (status.isLoaded) {
        setIsLoaded(true);
        if (isActive) {
            videoRef.current?.playAsync().catch(e => console.error(`Play error on load for ${item.id}:`, e));
        }
    } else if (status.error) {
        console.error(`RecipeCard ${item.id}: Video load error:`, status.error);
    }
  };

  // Use passed prop for height
  const containerStyle = {
    height: containerHeight,
    // backgroundColor: 'blue', // Remove debug background
  };

  // Overlay positioned relative to container bottom
  const overlayStyle = {
    bottom: 20,
  };

  return (
    <View
      style={[styles.container, containerStyle]}
    >
      {/* Restore Video and Overlay */}
      <Video
        ref={videoRef}
        source={{ uri: item.video }}
        resizeMode={ResizeMode.COVER}
        style={StyleSheet.absoluteFill}
        isLooping
        onLoad={handleLoad}
        onError={(error) => console.error('Video Error:', error)}
      />
      <View style={[styles.overlayContainer, overlayStyle]}>
        <Text style={styles.title}>{item.title}</Text>
        {item.pantryMatchPct !== undefined && (
          <Text style={styles.pantryMatch}>
            {item.pantryMatchPct}% pantry match
          </Text>
        )}
      </View>
    </View>
  );
}

// Basic styling
const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'black', // Restore background color
    // Remove debug border
    // borderBottomWidth: 1,
    // borderBottomColor: 'red',
  },
  overlayContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pantryMatch: {
    color: 'white',
    fontSize: 14,
  },
}); 