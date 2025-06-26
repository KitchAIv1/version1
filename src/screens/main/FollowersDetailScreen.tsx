import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { FollowButton } from '../../components/FollowButton';
import { useAuth } from '../../providers/AuthProvider';
import { MainStackParamList } from '../../navigation/types';

// Types
interface FollowersDetailParams {
  userId: string;
  username: string;
  initialTab?: 'followers' | 'following';
}

interface UserListItem {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
}

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// RPC function calls - UPDATED: Simple approach without joins
const fetchFollowers = async (userId: string): Promise<UserListItem[]> => {
  console.log('[FollowersDetailScreen] Fetching followers for user:', userId);
  
  // First, get the follower IDs from user_follows
  const { data: followData, error: followError } = await supabase
    .from('user_follows')
    .select('follower_id, created_at')
    .eq('followed_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (followError) {
    console.error('[FollowersDetailScreen] Error fetching follow relationships:', followError);
    throw followError;
  }

  console.log('[FollowersDetailScreen] Raw follow data:', followData);

  if (!followData || followData.length === 0) {
    console.log('[FollowersDetailScreen] No followers found');
    return [];
  }

  // Get the follower user IDs
  const followerIds = followData.map(item => item.follower_id);

  // Now fetch the profile information for these users
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, username, bio, avatar_url')
    .in('user_id', followerIds);

  if (profileError) {
    console.error('[FollowersDetailScreen] Error fetching profile data:', profileError);
    throw profileError;
  }

  console.log('[FollowersDetailScreen] Profile data:', profileData);

  // Combine the data
  const followers: UserListItem[] = followData.map(followItem => {
    const profile = profileData?.find(p => p.user_id === followItem.follower_id);
    return {
      user_id: followItem.follower_id,
      username: profile?.username || 'Anonymous',
      avatar_url: profile?.avatar_url || null,
      bio: profile?.bio || null,
    };
  });

  console.log('[FollowersDetailScreen] Processed followers:', followers);
  return followers;
};

const fetchFollowing = async (userId: string): Promise<UserListItem[]> => {
  console.log('[FollowersDetailScreen] Fetching following for user:', userId);
  
  // First, get the followed IDs from user_follows
  const { data: followData, error: followError } = await supabase
    .from('user_follows')
    .select('followed_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (followError) {
    console.error('[FollowersDetailScreen] Error fetching follow relationships:', followError);
    throw followError;
  }

  console.log('[FollowersDetailScreen] Raw follow data:', followData);

  if (!followData || followData.length === 0) {
    console.log('[FollowersDetailScreen] No following found');
    return [];
  }

  // Get the followed user IDs
  const followedIds = followData.map(item => item.followed_id);

  // Now fetch the profile information for these users
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, username, bio, avatar_url')
    .in('user_id', followedIds);

  if (profileError) {
    console.error('[FollowersDetailScreen] Error fetching profile data:', profileError);
    throw profileError;
  }

  console.log('[FollowersDetailScreen] Profile data:', profileData);

  // Combine the data
  const following: UserListItem[] = followData.map(followItem => {
    const profile = profileData?.find(p => p.user_id === followItem.followed_id);
    return {
      user_id: followItem.followed_id,
      username: profile?.username || 'Anonymous',
      avatar_url: profile?.avatar_url || null,
      bio: profile?.bio || null,
    };
  });

  console.log('[FollowersDetailScreen] Processed following:', following);
  return following;
};

// User List Item Component
const UserListItem: React.FC<{
  user: UserListItem;
  onUserPress: (userId: string) => void;
}> = React.memo(({ user, onUserPress }) => {
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser?.id === user.user_id;

  return (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => onUserPress(user.user_id)}
      activeOpacity={0.7}>
      <View style={styles.userInfo}>
        {/* Avatar */}
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={24} color="#a3a3a3" />
          </View>
        )}

        {/* User Details */}
        <View style={styles.userDetails}>
          <Text style={styles.username}>{user.username}</Text>
          {user.bio && <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text>}
        </View>
      </View>

      {/* Follow Button (only show for other users) */}
      {!isOwnProfile && (
        <FollowButton
          targetUserId={user.user_id}
          style={styles.followButton}
        />
      )}
    </TouchableOpacity>
  );
});

UserListItem.displayName = 'UserListItem';

// Tab Button Component
const TabButton: React.FC<{
  title: string;
  isActive: boolean;
  count: number;
  onPress: () => void;
}> = React.memo(({ title, isActive, count, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.activeTabButton]}
    onPress={onPress}
    activeOpacity={0.7}>
    <Text style={[styles.tabButtonText, isActive && styles.activeTabButtonText]}>
      {title}
    </Text>
    <Text style={[styles.tabCount, isActive && styles.activeTabCount]}>
      {count}
    </Text>
  </TouchableOpacity>
));

TabButton.displayName = 'TabButton';

// Main Component
export const FollowersDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { user: currentUser } = useAuth();

  // Get route parameters
  const params = route.params as FollowersDetailParams;
  const { userId, username, initialTab = 'followers' } = params;

  // State
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);

  // Queries
  const {
    data: followers = [],
    isLoading: followersLoading,
    error: followersError,
  } = useQuery<UserListItem[]>({
    queryKey: ['followers', userId],
    queryFn: () => fetchFollowers(userId),
    enabled: !!userId,
  });

  const {
    data: following = [],
    isLoading: followingLoading,
    error: followingError,
  } = useQuery<UserListItem[]>({
    queryKey: ['following', userId],
    queryFn: () => fetchFollowing(userId),
    enabled: !!userId,
  });

  // Debug logging
  React.useEffect(() => {
    if (followers) {
      console.log('[FollowersDetailScreen] Followers data updated:', {
        userId,
        followersCount: followers.length,
        followersData: followers
      });
    }
  }, [followers, userId]);

  React.useEffect(() => {
    if (following) {
      console.log('[FollowersDetailScreen] Following data updated:', {
        userId,
        followingCount: following.length,
        followingData: following
      });
    }
  }, [following, userId]);

  // Computed values
  const currentData = useMemo(() => {
    return activeTab === 'followers' ? followers : following;
  }, [activeTab, followers, following]);

  const isLoading = useMemo(() => {
    return activeTab === 'followers' ? followersLoading : followingLoading;
  }, [activeTab, followersLoading, followingLoading]);

  const error = useMemo(() => {
    return activeTab === 'followers' ? followersError : followingError;
  }, [activeTab, followersError, followingError]);

  // Handlers
  const handleUserPress = useCallback((selectedUserId: string) => {
    if (selectedUserId === currentUser?.id) {
      // Navigate to own profile (MainTabs -> Profile)
      navigation.navigate('MainTabs', { 
        screen: 'Profile',
        params: {}
      });
    } else {
      // Navigate to other user's profile
      navigation.navigate('MainTabs', { 
        screen: 'Profile', 
        params: { userId: selectedUserId } 
      });
    }
  }, [navigation, currentUser?.id]);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Render functions
  const renderUserItem = useCallback(({ item }: { item: UserListItem }) => (
    <UserListItem user={item} onUserPress={handleUserPress} />
  ), [handleUserPress]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Icon 
        name={activeTab === 'followers' ? 'people-outline' : 'person-add'} 
        size={48} 
        color="#9ca3af" 
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'followers' 
          ? 'When people follow this user, they\'ll appear here.'
          : 'When this user follows people, they\'ll appear here.'
        }
      </Text>
    </View>
  ), [activeTab]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSubtitle}>
            Failed to load {activeTab}. Please try again.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={currentData}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>{username}</Text>
        
        {/* Spacer for centering */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TabButton
          title="Followers"
          isActive={activeTab === 'followers'}
          count={followers.length}
          onPress={() => setActiveTab('followers')}
        />
        <TabButton
          title="Following"
          isActive={activeTab === 'following'}
          count={following.length}
          onPress={() => setActiveTab('following')}
        />
      </View>

      {/* Content */}
      {renderContent()}
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#10b981',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  activeTabButtonText: {
    color: '#10b981',
  },
  tabCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  activeTabCount: {
    color: '#10b981',
  },
  listContainer: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  bio: {
    fontSize: 14,
    color: '#6b7280',
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default FollowersDetailScreen; 