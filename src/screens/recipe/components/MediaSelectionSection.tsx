import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BRAND_PRIMARY = '#10B981';

interface MediaSelectionSectionProps {
  videoUri?: string;
  thumbnailUri?: string;
  onSelectVideo: () => void;
  onSelectThumbnail: () => void;
}

// Optimized Video Preview Component
const OptimizedVideoPreview = React.memo<{
  videoUri?: string;
  onSelectVideo: () => void;
}>(({ videoUri, onSelectVideo }) => {
  const buttonStyle = useMemo(() => 
    videoUri ? styles.buttonOutline : styles.button, [videoUri]);
  
  const buttonTextStyle = useMemo(() => 
    videoUri ? styles.buttonOutlineText : styles.buttonText, [videoUri]);

  return (
    <View style={styles.mediaPreviewWrapper}>
      {videoUri ? (
        <Video
          source={{ uri: videoUri }}
          style={styles.videoPreview}
          useNativeControls
          resizeMode={ResizeMode.COVER}
          isLooping
        />
      ) : (
        <View style={[styles.videoPreview, styles.mediaPlaceholder]}>
          <Feather name="video" size={40} color="#ccc" />
          <Text style={styles.mediaPlaceholderText}>
            Showcase your recipe in action
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={buttonStyle}
        onPress={onSelectVideo}
        activeOpacity={0.8}>
        <Feather
          name={videoUri ? 'refresh-cw' : 'video'}
          size={18}
          color={videoUri ? BRAND_PRIMARY : '#fff'}
          style={styles.buttonIcon}
        />
        <Text style={buttonTextStyle}>
          {videoUri ? 'Change Video' : 'Select Video'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
OptimizedVideoPreview.displayName = 'OptimizedVideoPreview';

// Optimized Thumbnail Preview Component
const OptimizedThumbnailPreview = React.memo<{
  thumbnailUri?: string;
  onSelectThumbnail: () => void;
}>(({ thumbnailUri, onSelectThumbnail }) => {
  const buttonStyle = useMemo(() => 
    thumbnailUri ? styles.buttonOutline : styles.button, [thumbnailUri]);
  
  const buttonTextStyle = useMemo(() => 
    thumbnailUri ? styles.buttonOutlineText : styles.buttonText, [thumbnailUri]);

  return (
    <View style={styles.mediaPreviewWrapper}>
      {thumbnailUri ? (
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnailPreview}
          />
          <View style={styles.thumbnailOverlay}>
            <Text style={styles.thumbnailOverlayText}>Cover Image</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.thumbnailPreview, styles.mediaPlaceholder]}>
          <Feather name="image" size={40} color="#ccc" />
          <Text style={styles.mediaPlaceholderText}>
            Add an appetizing cover image
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={buttonStyle}
        onPress={onSelectThumbnail}
        activeOpacity={0.8}>
        <Feather
          name={thumbnailUri ? 'refresh-cw' : 'image'}
          size={18}
          color={thumbnailUri ? BRAND_PRIMARY : '#fff'}
          style={styles.buttonIcon}
        />
        <Text style={buttonTextStyle}>
          {thumbnailUri ? 'Change Thumbnail' : 'Select Thumbnail'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
OptimizedThumbnailPreview.displayName = 'OptimizedThumbnailPreview';

// Main MediaSelectionSection Component
export const MediaSelectionSection = React.memo<MediaSelectionSectionProps>(({
  videoUri,
  thumbnailUri,
  onSelectVideo,
  onSelectThumbnail,
}) => {
  return (
    <View style={styles.mediaSelectionContainer}>
      <OptimizedVideoPreview
        videoUri={videoUri}
        onSelectVideo={onSelectVideo}
      />
      <OptimizedThumbnailPreview
        thumbnailUri={thumbnailUri}
        onSelectThumbnail={onSelectThumbnail}
      />
    </View>
  );
});

MediaSelectionSection.displayName = 'MediaSelectionSection';

const styles = StyleSheet.create({
  mediaSelectionContainer: {
    marginVertical: 16,
  },
  mediaPreviewWrapper: {
    marginBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  videoPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  thumbnailContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  thumbnailOverlayText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  thumbnailPreview: {
    width: SCREEN_WIDTH * 0.6,
    height: (SCREEN_WIDTH * 0.6) / (16 / 9),
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mediaPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  mediaPlaceholderText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '80%',
  },
  button: {
    backgroundColor: BRAND_PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonOutline: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND_PRIMARY,
    backgroundColor: 'transparent',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonOutlineText: {
    color: BRAND_PRIMARY,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default MediaSelectionSection; 