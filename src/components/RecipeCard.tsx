// RecipeCard component implementation will go here
import React, { useRef, useEffect } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const { height: windowHeight, width: windowWidth } = Dimensions.get('window');

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
  // TODO: Add isVisible prop later for autoplay
}

export default function RecipeCard({ item }: RecipeCardProps) {
  const videoRef = useRef<Video>(null);
  // TODO: Autoplay logic will depend on visibility from FlashList
  // const isPlaying = useSharedValue(false); 

  // useEffect(() => {
  //   isPlaying.value
  //     ? videoRef.current?.playAsync()
  //     : videoRef.current?.pauseAsync();
  // }, [isPlaying.value]);

  // Style to make the card take full window height
  // Note: FlashList optimization might affect exact height calculations,
  // using Dimensions.get('window') might be problematic if status/nav bars change.
  // Consider using onLayout or alternative methods if precision is needed.
  const containerStyle = {
    width: windowWidth,
    height: windowHeight,
    backgroundColor: 'black', // Added background for clarity
  };

  return (
    <View style={containerStyle}>
      <Video
        ref={videoRef}
        source={{ uri: item.video }}
        resizeMode={ResizeMode.COVER}
        style={StyleSheet.absoluteFill}
        isLooping
        shouldPlay={false}
        onError={(error) => console.error('Video Error:', error)}
      />
      {/* Ensure no stray text/whitespace between Video and overlay View */}
      <View style={styles.overlayContainer}>
        <Text style={styles.title}>{item.title}</Text>
        {item.pantryMatchPct !== undefined && (
          <Text style={styles.pantryMatch}>
            {item.pantryMatchPct}% pantry match
          </Text>
        )}
      </View>
      {/* Comment removed as a precaution */}
    </View>
  );
}

// Basic styling for the overlay
const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    bottom: 80, // Adjust as needed (consider tab bar height)
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent background
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