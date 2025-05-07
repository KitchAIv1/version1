// RecipeCard component implementation will go here
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, DimensionValue } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import ActionOverlay from './ActionOverlay';
// import { RecipeItem } from '../types'; // Remove this import if conflicting

// Define the expected item structure locally if not imported
// Or ensure it's correctly imported from '../types' without conflict
interface RecipeItem { // Assuming this is the definition source
  id: string;
  title: string;
  video: string;
  pantryMatchPct?: number;
  liked?: boolean;
  likes?: number;
  saved?: boolean;
  saves?: number;
  onLike?: () => void;
  onSave?: () => void;
}

// Update props: item should include fields for overlay and handlers
interface RecipeCardProps {
  item: RecipeItem;
  isActive: boolean;
  containerHeight: number;
}

export default function RecipeCard({ item, isActive, containerHeight }: RecipeCardProps) {
  const videoRef = useRef<Video>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    console.log(`RecipeCard ${item.id} - Effect: isActive: ${isActive}, isLoaded: ${isLoaded}`);

    if (!videoElement) {
      console.log(`RecipeCard ${item.id} - Effect: Video element not ready.`);
      return;
    }

    if (isActive) {
      if (isLoaded) {
        console.log(`RecipeCard ${item.id} - Effect: Attempting to PLAY (active and loaded)`);
        videoElement.playAsync().catch(e => console.error(`Play error for ${item.id}: ${e.message}`, e));
      } else {
        console.log(`RecipeCard ${item.id} - Effect: Active but NOT LOADED YET. Will play once loaded.`);
        // Optional: could try to explicitly load if not already, but onLoad should handle this.
        // videoElement.loadAsync({ uri: item.video }).catch(e => console.warn("Explicit load failed", e));
      }
    } else { // Not active
      if (isLoaded) { // Only pause if it was loaded (and possibly playing)
        console.log(`RecipeCard ${item.id} - Effect: Attempting to PAUSE (inactive and loaded)`);
        videoElement.pauseAsync().catch(e => console.error(`Pause error for ${item.id}: ${e.message}`, e));
      } else {
        console.log(`RecipeCard ${item.id} - Effect: Inactive and NOT LOADED. No action needed for pause.`);
      }
    }

    return () => {
      const currentVideoElement = videoRef.current;
      // Check isLoaded as well? Or just pause aggressively on cleanup if element exists?
      // For now, if element exists, attempt pause. The error was on initial pause before load.
      if (currentVideoElement) { 
        console.log(`RecipeCard ${item.id} - Effect Cleanup: PAUSING video element.`);
        currentVideoElement.getStatusAsync().then(status => {
          if (status.isLoaded && status.isPlaying) { // Only pause if actually playing
             currentVideoElement.pauseAsync().catch(e => console.error(`Cleanup pause error for ${item.id}: ${e.message}`,e));
          } else {
            // console.log(`RecipeCard ${item.id} - Effect Cleanup: Video not playing or not loaded, no pause needed.`);
          }
        }).catch(e => console.error(`Cleanup getStatus error for ${item.id}: ${e.message}`, e));
      }
    };
  }, [isActive, isLoaded, item.id]);

  const handleLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      console.log(`RecipeCard ${item.id} - Video loaded successfully via onLoad.`);
      if (!isLoaded) { // Prevent setting state if already true
        setIsLoaded(true);
      }
    } else if (status.error) {
      console.error(`RecipeCard ${item.id}: Video load error from onLoad:`, status.error);
      setIsLoaded(false); // Ensure isLoaded is false on error
    }
  };
  
  const handleError = (error: string) => {
    console.error(`RecipeCard ${item.id}: Video onError event:`, error);
    setIsLoaded(false); // Mark as not loaded on error
  }

  const containerStyle = {
    height: containerHeight,
  };

  const overlayStyle = { // This overlayStyle seems unused in the JSX below
    bottom: 20,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Video
        ref={videoRef}
        source={{ uri: item.video }}
        resizeMode={ResizeMode.COVER}
        style={StyleSheet.absoluteFill}
        isLooping
        onLoad={handleLoad}
        onError={handleError} // Changed from inline to handler
        progressUpdateIntervalMillis={1000} 
      />
      {/* The textOverlayContainer has its own bottom positioning in styles */}
      <View style={styles.textOverlayContainer}>
        <Text style={styles.title}>{item.title}</Text>
        {item.pantryMatchPct !== undefined && (
          <Text style={styles.pantryMatch}>
            {item.pantryMatchPct}% pantry match
          </Text>
        )}
      </View>
      {item.onLike && item.onSave && (
          <ActionOverlay item={item} onLike={item.onLike} onSave={item.onSave} />
      )}
    </View>
  );
}

// Basic styling
const styles = StyleSheet.create({
  container: {
    width: '100%' as DimensionValue, // Moved width: '100%' here and cast for TS
    backgroundColor: 'black', // Restore background color
    overflow: 'hidden', // Can help contain the absolute positioned Video
    // Remove debug border
    // borderBottomWidth: 1,
    // borderBottomColor: 'red',
  },
  textOverlayContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 80, // Adjusted slightly higher to ensure visibility above potential nav or other overlays
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1,
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