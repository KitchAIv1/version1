import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TikTokVideoControlsProps {
  videoRef: React.RefObject<Video | null>;
  isPlaying?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onTogglePlay?: () => void;
  duration?: number;
  position?: number;
  style?: any;
}

export const TikTokVideoControls: React.FC<TikTokVideoControlsProps> = ({
  videoRef,
  isPlaying = true,
  isMuted = false,
  onToggleMute,
  onTogglePlay,
  duration = 0,
  position = 0,
  style,
}) => {
  const [showControls, setShowControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tempPosition, setTempPosition] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    };
  }, []);

  // Show controls and auto-hide after 3 seconds
  const showControlsHandler = () => {
    if (!showControls) {
      setShowControls(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    
    // Clear existing timeout and set new one
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
    }
    hideTimeout.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    }, 3000);
  };

  // Handle tap to show/hide controls
  const handleTap = () => {
    if (showControls) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    } else {
      showControlsHandler();
    }
  };

  // Handle double tap to play/pause
  const lastTap = useRef<number>(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onTogglePlay?.();
      showControlsHandler();
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (Date.now() - lastTap.current >= 300) {
          handleTap();
        }
      }, 300);
    }
  };

  // Seek forward/backward
  const handleSeek = async (seconds: number) => {
    if (!videoRef.current) return;
    
    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded) {
        const newPosition = Math.max(0, Math.min(duration * 1000, (position * 1000) + (seconds * 1000)));
        await videoRef.current.setPositionAsync(newPosition);
      }
    } catch (error) {
      console.error('Seek error:', error);
    }
  };

  // Progress bar gesture handler
  const handleProgressGesture = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.BEGAN) {
      setIsDragging(true);
    } else if (nativeEvent.state === State.ACTIVE) {
      const progress = Math.max(0, Math.min(1, nativeEvent.x / (SCREEN_WIDTH - 40)));
      setTempPosition(progress * duration);
    } else if (nativeEvent.state === State.END) {
      const progress = Math.max(0, Math.min(1, nativeEvent.x / (SCREEN_WIDTH - 40)));
      const newPosition = progress * duration * 1000;
      
      videoRef.current?.setPositionAsync(newPosition);
      setIsDragging(false);
      showControlsHandler();
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentPosition = isDragging ? tempPosition : position;
  const progressPercent = duration > 0 ? (currentPosition / duration) * 100 : 0;

  return (
    <View style={[styles.container, style]}>
      {/* Tap area for showing controls */}
      <TouchableOpacity 
        style={styles.tapArea}
        onPress={handleDoubleTap}
        activeOpacity={1}
      />

      {/* Controls overlay */}
      {showControls && (
        <Animated.View style={[styles.controlsOverlay, { opacity: fadeAnim }]}>
          
          {/* Center play/pause button */}
          <TouchableOpacity 
            style={styles.centerPlayButton}
            onPress={onTogglePlay}>
            <View style={styles.centerPlayIcon}>
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={48} 
                color="white" 
              />
            </View>
          </TouchableOpacity>

          {/* Side controls */}
          <View style={styles.sideControls}>
            
            {/* Seek backward */}
            <TouchableOpacity 
              style={styles.seekButton}
              onPress={() => handleSeek(-10)}>
              <Ionicons name="play-skip-back" size={32} color="white" />
              <Text style={styles.seekText}>10s</Text>
            </TouchableOpacity>

            {/* Seek forward */}
            <TouchableOpacity 
              style={styles.seekButton}
              onPress={() => handleSeek(10)}>
              <Ionicons name="play-skip-forward" size={32} color="white" />
              <Text style={styles.seekText}>10s</Text>
            </TouchableOpacity>

            {/* Mute button */}
            <TouchableOpacity 
              style={styles.muteButton}
              onPress={onToggleMute}>
              <Ionicons 
                name={isMuted ? 'volume-mute' : 'volume-high'} 
                size={28} 
                color="white" 
              />
            </TouchableOpacity>
          </View>

          {/* Bottom progress bar */}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>
              {formatTime(currentPosition)}
            </Text>
            
            <View style={styles.progressBarContainer}>
              <PanGestureHandler onHandlerStateChange={handleProgressGesture}>
                <View style={styles.progressBarWrapper}>
                  <View style={styles.progressBarBackground} />
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${progressPercent}%` }
                    ]} 
                  />
                  <View 
                    style={[
                      styles.progressThumb, 
                      { left: `${Math.max(0, Math.min(96, progressPercent))}%` }
                    ]} 
                  />
                </View>
              </PanGestureHandler>
            </View>
            
            <Text style={styles.timeText}>
              {formatTime(duration)}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  tapArea: {
    flex: 1,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayButton: {
    position: 'absolute',
    zIndex: 15,
  },
  centerPlayIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  sideControls: {
    position: 'absolute',
    right: 20,
    top: '30%',
    alignItems: 'center',
    gap: 24,
  },
  seekButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    padding: 12,
  },
  seekText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  muteButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    padding: 12,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  progressBarContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  progressBarWrapper: {
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressBarFill: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#10b981',
    borderRadius: 2,
    marginHorizontal: 10,
  },
  progressThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#10b981',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
    marginLeft: 2,
    marginTop: -6,
  },
}); 