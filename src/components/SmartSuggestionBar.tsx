import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DuplicateGroup } from '../services/DuplicateDetectionService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SmartSuggestionBarProps {
  isVisible: boolean;
  duplicateGroup: DuplicateGroup | null;
  onMerge: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onKeepBoth: () => void;
  onReview: () => void;
  onDismiss: () => void;
}

const SmartSuggestionBar: React.FC<SmartSuggestionBarProps> = ({
  isVisible,
  duplicateGroup,
  onMerge,
  onEdit,
  onDelete,
  onKeepBoth,
  onReview,
  onDismiss,
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;

  console.log('[SmartSuggestionBar] 🎭 Render with props:', {
    isVisible,
    duplicateGroup: duplicateGroup ? {
      itemName: duplicateGroup.itemName,
      totalCount: duplicateGroup.totalCount,
      suggestedAction: duplicateGroup.suggestedAction
    } : null
  });

  useEffect(() => {
    if (isVisible && duplicateGroup) {
      // Slide down animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 7 seconds
      console.log('[SmartSuggestionBar] ⏰ Starting auto-dismiss timer');
      const timer = setTimeout(() => {
        console.log('[SmartSuggestionBar] ⏰ Auto-dismissing after 7 seconds');
        onDismiss();
      }, 7000);

      return () => {
        console.log('[SmartSuggestionBar] ⏰ Clearing auto-dismiss timer');
        clearTimeout(timer);
      };
    } else {
      // Slide up animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -100,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, duplicateGroup, slideAnim, opacityAnim, onDismiss]);

  if (!duplicateGroup) return null;

  const getMessage = () => {
    const count = duplicateGroup.totalCount;
    const itemName = duplicateGroup.itemName;
    
    if (count === 2) {
      return `You already have another entry for "${itemName}".`;
    }
    return `You have ${count} entries for "${itemName}".`;
  };

  const getActionButtons = () => {
    const { suggestedAction, items } = duplicateGroup;
    
    if (suggestedAction === 'merge' && items.length === 2) {
      // Show merge option for 2 compatible items
      const locations = [...new Set(items.map(item => item.storage_location))];
      const primaryLocation = locations[0];
      
      return (
        <>
          <TouchableOpacity style={styles.primaryButton} onPress={onMerge}>
            <Ionicons name="git-merge" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>
              Merge & Use {primaryLocation}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onEdit}>
            <Ionicons name="pencil" size={14} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onDelete}>
            <Ionicons name="trash" size={14} color="#666" />
          </TouchableOpacity>
        </>
      );
    }
    
    // Default actions for review cases
    return (
      <>
        <TouchableOpacity style={styles.primaryButton} onPress={onReview}>
          <Ionicons name="eye" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Review Duplicates</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onEdit}>
          <Ionicons name="pencil" size={14} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onDelete}>
          <Ionicons name="trash" size={14} color="#666" />
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Message */}
          <View style={styles.messageContainer}>
            <Ionicons name="information-circle" size={20} color="#2563eb" />
            <Text style={styles.message}>{getMessage()}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {getActionButtons()}
            
            {/* Keep Both Button */}
            <TouchableOpacity style={styles.tertiaryButton} onPress={onKeepBoth}>
              <Text style={styles.tertiaryButtonText}>Keep Both</Text>
            </TouchableOpacity>

            {/* Dismiss Button */}
            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
              <Ionicons name="close" size={16} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  safeArea: {
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 6,
    marginRight: 6,
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 6,
  },
  tertiaryButtonText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  dismissButton: {
    padding: 4,
  },
});

export default SmartSuggestionBar; 