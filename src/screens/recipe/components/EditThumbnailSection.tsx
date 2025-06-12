import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { OptimizedCollapsibleCard } from './OptimizedCollapsibleCard';

interface EditThumbnailSectionProps {
  currentThumbnailUrl: string | null;
  newLocalThumbnailUri: string | null;
  compressionInfo: string;
  onSelectThumbnail: () => void;
}

export const EditThumbnailSection: React.FC<EditThumbnailSectionProps> = React.memo(({
  currentThumbnailUrl,
  newLocalThumbnailUri,
  compressionInfo,
  onSelectThumbnail,
}) => {
  const displayUri = newLocalThumbnailUri || currentThumbnailUrl;

  return (
    <OptimizedCollapsibleCard title="Thumbnail" icon="image">
      <View style={styles.thumbnailContainer}>
        {displayUri ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: displayUri }}
              style={styles.thumbnailPreview}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay}>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={onSelectThumbnail}
                activeOpacity={0.8}>
                <Feather name="camera" size={16} color="#fff" />
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Feather name="image" size={48} color="#9ca3af" />
            <Text style={styles.placeholderText}>No thumbnail selected</Text>
          </View>
        )}
        
        <TouchableOpacity
          style={styles.selectButton}
          onPress={onSelectThumbnail}
          activeOpacity={0.8}>
          <Feather
            name={displayUri ? "edit-2" : "plus"}
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.selectButtonText}>
            {displayUri ? 'Change Thumbnail' : 'Select Thumbnail'}
          </Text>
        </TouchableOpacity>
        
        {compressionInfo && (
          <View style={styles.compressionInfoContainer}>
            <Feather name="check-circle" size={14} color="#10B981" />
            <Text style={styles.compressionInfo}>{compressionInfo}</Text>
          </View>
        )}
        
        <Text style={styles.helpText}>
          Recommended: 16:9 aspect ratio, max 5MB
        </Text>
      </View>
    </OptimizedCollapsibleCard>
  );
});

EditThumbnailSection.displayName = 'EditThumbnailSection';

const styles = StyleSheet.create({
  thumbnailContainer: {
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  thumbnailPreview: {
    width: 280,
    height: 157.5, // 16:9 aspect ratio
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  thumbnailPlaceholder: {
    width: 280,
    height: 157.5, // 16:9 aspect ratio
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  compressionInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compressionInfo: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default EditThumbnailSection; 