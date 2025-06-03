import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { useFollowMutation, useFollowStatus } from '../hooks/useFollowMutation';

interface FollowButtonProps {
  targetUserId: string;
  style?: any;
  disabled?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  targetUserId,
  style,
  disabled = false,
  onFollowChange,
}) => {
  const { user } = useAuth();
  const followMutation = useFollowMutation(user?.id);
  const { data: followStatus, isLoading: statusLoading } = useFollowStatus(
    user?.id,
    targetUserId,
  );

  const isFollowing = followStatus?.isFollowing || false;
  const isOwnProfile = user?.id === targetUserId;

  // Don't show follow button for own profile
  if (isOwnProfile || !user?.id) {
    return null;
  }

  const handleFollow = async () => {
    if (disabled || followMutation.isPending) return;

    try {
      const action = isFollowing ? 'unfollow' : 'follow';
      await followMutation.mutateAsync({
        targetUserId,
        action,
      });

      // Notify parent component of follow status change
      onFollowChange?.(!isFollowing);
    } catch (error) {
      console.error('Follow error:', error);
      // Could add toast notification here
    }
  };

  const isLoading = statusLoading || followMutation.isPending;

  return (
    <TouchableOpacity
      style={[
        styles.followButton,
        isFollowing ? styles.followingButton : styles.notFollowingButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={handleFollow}
      disabled={disabled || isLoading}
      activeOpacity={0.7}>
      {isLoading ? (
        <ActivityIndicator size="small" color={isFollowing ? '#666' : '#fff'} />
      ) : (
        <Text
          style={[
            styles.followButtonText,
            isFollowing ? styles.followingText : styles.notFollowingText,
          ]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  notFollowingButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderColor: '#ccc',
  },
  disabledButton: {
    opacity: 0.6,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notFollowingText: {
    color: '#fff',
  },
  followingText: {
    color: '#666',
  },
});
