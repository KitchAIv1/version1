import React, { useState, useCallback, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { useFollowMutation, useFollowStatus } from '../hooks/useFollowMutation';

// 🎯 INDUSTRY BEST PRACTICES FOLLOW BUTTON
// Implements: Optimistic updates, skeleton states, immediate feedback

interface FollowButtonOptimizedProps {
  targetUserId: string;
  style?: any;
  disabled?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  showSkeleton?: boolean; // For initial loading states
  size?: 'small' | 'medium' | 'large';
}

export const FollowButtonOptimized: React.FC<FollowButtonOptimizedProps> = ({
  targetUserId,
  style,
  disabled = false,
  onFollowChange,
  showSkeleton = false,
  size = 'medium',
}) => {
  const { user } = useAuth();
  const followMutation = useFollowMutation(user?.id);
  const { data: followStatus, isLoading: statusLoading, isError } = useFollowStatus(
    user?.id,
    targetUserId,
  );

  // 🎯 OPTIMISTIC STATE MANAGEMENT
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false);

  // Determine current follow state (optimistic > real data)
  const isFollowing = optimisticFollowing !== null 
    ? optimisticFollowing 
    : (followStatus?.isFollowing || false);

  const isOwnProfile = user?.id === targetUserId;

  // 🎯 OPTIMISTIC UPDATE HANDLER (Instant feedback) - MUST BE BEFORE ANY RETURNS
  const handleOptimisticFollow = useCallback(async () => {
    if (disabled || followMutation.isPending) return;

    const newFollowingState = !isFollowing;
    
    // 1. INSTANT UI UPDATE (Instagram/Twitter pattern)
    setOptimisticFollowing(newFollowingState);
    setIsOptimisticUpdate(true);
    
    // 2. Notify parent immediately for UI consistency
    onFollowChange?.(newFollowingState);

    try {
      // 3. Background API call
      const action = isFollowing ? 'unfollow' : 'follow';
      await followMutation.mutateAsync({
        targetUserId,
        action,
      });

      // 4. Success: Keep optimistic state (will be cleared by useEffect)
      console.log(`[FollowButtonOptimized] Successfully ${action}ed user ${targetUserId}`);
      
    } catch (error) {
      console.error('[FollowButtonOptimized] Follow error:', error);
      
      // 5. ERROR RECOVERY: Revert optimistic state
      setOptimisticFollowing(!newFollowingState);
      setIsOptimisticUpdate(false);
      onFollowChange?.(!newFollowingState);
      
      // Optional: Show error toast
      // showErrorToast(`Failed to ${action} user`);
    }
  }, [disabled, followMutation, isFollowing, targetUserId, onFollowChange]);

  // Reset optimistic state when real data arrives
  useEffect(() => {
    if (!statusLoading && followStatus && optimisticFollowing !== null) {
      // If real data matches optimistic, clear optimistic state
      if (followStatus.isFollowing === optimisticFollowing) {
        setOptimisticFollowing(null);
        setIsOptimisticUpdate(false);
      }
    }
  }, [statusLoading, followStatus, optimisticFollowing]);

  // Don't show follow button for own profile
  if (isOwnProfile || !user?.id) {
    return null;
  }

  // 🎯 SKELETON STATE (Instagram/Twitter pattern)
  if (showSkeleton || (statusLoading && optimisticFollowing === null)) {
    return (
      <View style={[styles.followButton, sizeStyles[size], styles.skeletonButton, style]}>
        <View style={styles.skeletonText} />
      </View>
    );
  }

  // 🎯 ERROR STATE (Graceful degradation)
  if (isError) {
    return (
      <TouchableOpacity
        style={[styles.followButton, sizeStyles[size], styles.errorButton, style]}
        onPress={() => {}} // Could trigger retry
        disabled
        activeOpacity={0.7}>
        <Text style={[styles.followButtonText, sizeStyles[`${size}Text`], styles.errorText]}>
          Error
        </Text>
      </TouchableOpacity>
    );
  }

  // 🎯 LOADING STATE: Only show during mutation (very brief)
  const showLoadingSpinner = followMutation.isPending && !isOptimisticUpdate;

  return (
    <TouchableOpacity
      style={[
        styles.followButton,
        sizeStyles[size],
        isFollowing ? styles.followingButton : styles.notFollowingButton,
        disabled && styles.disabledButton,
        isOptimisticUpdate && styles.optimisticButton,
        style,
      ]}
      onPress={handleOptimisticFollow}
      disabled={disabled}
      activeOpacity={0.7}>
      
      {showLoadingSpinner ? (
        <ActivityIndicator 
          size={size === 'small' ? 'small' : 'small'} 
          color={isFollowing ? '#666' : '#fff'} 
        />
      ) : (
        <Text
          style={[
            styles.followButtonText,
            sizeStyles[`${size}Text`],
            isFollowing ? styles.followingText : styles.notFollowingText,
          ]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
      
      {/* Subtle indicator for optimistic updates */}
      {isOptimisticUpdate && (
        <View style={styles.optimisticIndicator} />
      )}
    </TouchableOpacity>
  );
};

// 🎯 RESPONSIVE SIZING (Different contexts need different sizes)
const sizeStyles = StyleSheet.create({
  small: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 60,
    borderRadius: 12,
  },
  medium: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 80,
    borderRadius: 20,
  },
  large: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    minWidth: 100,
    borderRadius: 24,
  },
  smallText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mediumText: {
    fontSize: 14,
    fontWeight: '600',
  },
  largeText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  followButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  notFollowingButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderColor: '#ccc',
  },
  optimisticButton: {
    // Subtle visual feedback for optimistic updates
    transform: [{ scale: 0.98 }],
  },
  skeletonButton: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e0e0e0',
  },
  errorButton: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  disabledButton: {
    opacity: 0.6,
  },
  followButtonText: {
    textAlign: 'center',
  },
  notFollowingText: {
    color: '#fff',
  },
  followingText: {
    color: '#666',
  },
  errorText: {
    color: '#dc2626',
  },
  skeletonText: {
    height: 14,
    width: 50,
    backgroundColor: '#d1d5db',
    borderRadius: 7,
  },
  optimisticIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    opacity: 0.8,
  },
});

// 🎯 BULK FOLLOW STATUS HOOK (For multiple buttons)
export const useBulkFollowStatus = (userIds: string[]) => {
  const { user } = useAuth();
  
  // This would ideally use a bulk API endpoint
  // For now, we'll batch the individual calls
  return {
    // Implementation would batch follow status requests
    // to reduce API calls when showing multiple follow buttons
  };
};

export default FollowButtonOptimized; 