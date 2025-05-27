# 🎨 Frontend Quick Start: Followers & Following Feature

## 📋 **Immediate Action Items for Frontend Team**

This guide provides step-by-step implementation for the Followers & Following feature frontend components.

---

## 🚀 **Phase 1: Core Hooks & Mutations**

### **Step 1: Create Follow Mutation Hook**

Create `src/hooks/useFollowMutation.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

interface FollowMutationParams {
  followerId: string;
  followedId: string;
  currentlyFollowing: boolean;
}

interface FollowResponse {
  success: boolean;
  following: boolean;
  followers_count: number;
  following_count: number;
}

export const useFollowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<FollowResponse, Error, FollowMutationParams>({
    mutationFn: async ({ followerId, followedId, currentlyFollowing }: FollowMutationParams) => {
      console.log(`[useFollowMutation] ${currentlyFollowing ? 'Unfollowing' : 'Following'} user:`, {
        followerId,
        followedId,
        currentlyFollowing
      });

      const rpcFunction = currentlyFollowing ? 'unfollow_user' : 'follow_user';
      
      const { data, error } = await supabase.rpc(rpcFunction, {
        p_follower_id: followerId,
        p_followed_id: followedId
      });

      if (error) {
        console.error(`[useFollowMutation] ${rpcFunction} error:`, error);
        throw error;
      }

      console.log(`[useFollowMutation] ${rpcFunction} success:`, data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('[useFollowMutation] Success, invalidating queries');
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['profile', variables.followedId] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.followerId] });
      queryClient.invalidateQueries({ queryKey: ['followers', variables.followedId] });
      queryClient.invalidateQueries({ queryKey: ['following', variables.followerId] });
      queryClient.invalidateQueries({ queryKey: ['userActivityFeed'] });
    },
    onError: (error, variables) => {
      console.error('[useFollowMutation] Error:', error);
      // You can add toast notifications here
    }
  });
};
```

### **Step 2: Create Follow Lists Hooks**

Create `src/hooks/useFollowLists.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

export interface FollowUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_following: boolean;
  followed_at: string;
}

interface FollowersResponse {
  followers: FollowUser[];
  total_count: number;
}

interface FollowingResponse {
  following: FollowUser[];
  total_count: number;
}

export const useFollowers = (userId: string, requestingUserId?: string) => {
  return useQuery<FollowersResponse>({
    queryKey: ['followers', userId, requestingUserId],
    queryFn: async () => {
      console.log(`[useFollowers] Fetching followers for user: ${userId}`);
      
      const { data, error } = await supabase.rpc('get_user_followers', {
        p_user_id: userId,
        p_requesting_user_id: requestingUserId,
        p_limit: 100,
        p_offset: 0
      });

      if (error) {
        console.error('[useFollowers] Error:', error);
        throw error;
      }

      console.log(`[useFollowers] Success: ${data?.followers?.length || 0} followers`);
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useFollowing = (userId: string, requestingUserId?: string) => {
  return useQuery<FollowingResponse>({
    queryKey: ['following', userId, requestingUserId],
    queryFn: async () => {
      console.log(`[useFollowing] Fetching following for user: ${userId}`);
      
      const { data, error } = await supabase.rpc('get_user_following', {
        p_user_id: userId,
        p_requesting_user_id: requestingUserId,
        p_limit: 100,
        p_offset: 0
      });

      if (error) {
        console.error('[useFollowing] Error:', error);
        throw error;
      }

      console.log(`[useFollowing] Success: ${data?.following?.length || 0} following`);
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

---

## 🎯 **Phase 2: Follow Button Component**

### **Step 3: Create Follow Button**

Create `src/components/FollowButton.tsx`:

```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFollowMutation } from '../hooks/useFollowMutation';

interface FollowButtonProps {
  followerId: string;
  followedId: string;
  isFollowing: boolean;
  style?: any;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  followerId,
  followedId,
  isFollowing,
  style,
  size = 'medium',
  disabled = false
}) => {
  const followMutation = useFollowMutation();

  const handlePress = () => {
    if (disabled || followMutation.isPending) return;
    
    console.log('[FollowButton] Button pressed:', {
      followerId,
      followedId,
      isFollowing
    });

    followMutation.mutate({
      followerId,
      followedId,
      currentlyFollowing: isFollowing
    });
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: 12, paddingVertical: 6, minWidth: 60 };
      case 'large':
        return { paddingHorizontal: 24, paddingVertical: 12, minWidth: 100 };
      default:
        return { paddingHorizontal: 20, paddingVertical: 8, minWidth: 80 };
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'large':
        return 16;
      default:
        return 14;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getSizeStyles(),
        isFollowing ? styles.followingButton : styles.followButton,
        (disabled || followMutation.isPending) && styles.disabledButton,
        style
      ]}
      onPress={handlePress}
      disabled={disabled || followMutation.isPending}
      activeOpacity={0.7}
    >
      {followMutation.isPending ? (
        <ActivityIndicator 
          size="small" 
          color={isFollowing ? "#374151" : "#fff"} 
        />
      ) : (
        <Text style={[
          styles.buttonText,
          { fontSize: getTextSize() },
          isFollowing ? styles.followingText : styles.followText
        ]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    backgroundColor: '#10b981',
  },
  followingButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '600',
  },
  followText: {
    color: '#fff',
  },
  followingText: {
    color: '#374151',
  },
});
```

---

## 📱 **Phase 3: Update Profile Screen**

### **Step 4: Update ProfileScreen.tsx**

Add these updates to your existing `src/screens/main/ProfileScreen.tsx`:

```typescript
// Add these imports at the top
import { FollowButton } from '../../components/FollowButton';

// Update the ProfileData interface to include follow data
interface ProfileData { 
  username: string;
  avatar_url?: string | null;
  followers: number;
  following: number;
  bio?: string | null;
  videos: VideoPostData[];
  saved_recipes: VideoPostData[];
  // Add new follow-related fields
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
  is_followed_by?: boolean;
}

// Update the Stat component to be clickable
const Stat: React.FC<{ 
  label: string; 
  value: number; 
  onPress?: () => void;
}> = React.memo(({ label, value, onPress }) => {
  const content = (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
});

// Update AvatarRow component
const AvatarRow: React.FC<{ 
  profile: ProfileData; 
  postsCount: number;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  isOwnProfile?: boolean;
  currentUserId?: string;
}> = React.memo(({ 
  profile, 
  postsCount, 
  onFollowersPress, 
  onFollowingPress,
  isOwnProfile = true,
  currentUserId
}) => {
  return (
    <View style={styles.avatarRow}>
      {profile.avatar_url ? (
        <Image 
          source={{ uri: profile.avatar_url }} 
          style={styles.avatar} 
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Icon name="person" size={36} color="#a3a3a3" />
        </View>
      )}
      <View style={styles.statsRow}>
        <Stat label="Posts" value={postsCount} />
        <Stat 
          label="Followers" 
          value={profile.followers_count ?? profile.followers ?? 0} 
          onPress={onFollowersPress}
        />
        <Stat 
          label="Following" 
          value={profile.following_count ?? profile.following ?? 0} 
          onPress={onFollowingPress}
        />
      </View>
      
      {/* Add Follow Button for other users' profiles */}
      {!isOwnProfile && currentUserId && (
        <View style={styles.followButtonContainer}>
          <FollowButton
            followerId={currentUserId}
            followedId={profile.id || ''} // You'll need to add profile.id
            isFollowing={profile.is_following || false}
            size="medium"
          />
        </View>
      )}
    </View>
  );
});

// Add navigation handlers in your main component
const handleFollowersPress = () => {
  if (!user?.id || !profile?.username) return;
  
  navigation.navigate('FollowersList', { 
    userId: user.id,
    username: profile.username 
  });
};

const handleFollowingPress = () => {
  if (!user?.id || !profile?.username) return;
  
  navigation.navigate('FollowingList', { 
    userId: user.id,
    username: profile.username 
  });
};

// Update the AvatarRow usage in renderProfileInfo
<AvatarRow 
  profile={profile} 
  postsCount={profile.videos?.length || 0}
  onFollowersPress={handleFollowersPress}
  onFollowingPress={handleFollowingPress}
  isOwnProfile={true} // Set to false when viewing other users
  currentUserId={user?.id}
/>
```

Add these styles to your StyleSheet:

```typescript
const styles = StyleSheet.create({
  // ... existing styles ...
  
  followButtonContainer: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  
  // Make stats clickable with visual feedback
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#262626',
  },
  statLabel: {
    fontSize: 13,
    color: '#737373',
    marginTop: 2,
    fontWeight: '500',
  },
});
```

---

## 🧪 **Phase 4: Testing & Validation**

### **Step 5: Test the Implementation**

Create a simple test component to validate the hooks:

```typescript
// src/components/FollowTestComponent.tsx (temporary for testing)
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useFollowMutation } from '../hooks/useFollowMutation';
import { useFollowers, useFollowing } from '../hooks/useFollowLists';
import { useAuth } from '../providers/AuthProvider';

export const FollowTestComponent: React.FC = () => {
  const { user } = useAuth();
  const followMutation = useFollowMutation();
  
  // Test with a known user ID (replace with actual user ID from your database)
  const testUserId = 'test-user-id-here';
  
  const { data: followers, isLoading: followersLoading } = useFollowers(testUserId, user?.id);
  const { data: following, isLoading: followingLoading } = useFollowing(testUserId, user?.id);

  const handleTestFollow = () => {
    if (!user?.id) return;
    
    followMutation.mutate({
      followerId: user.id,
      followedId: testUserId,
      currentlyFollowing: false
    });
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Follow System Test</Text>
      
      <Button title="Test Follow" onPress={handleTestFollow} />
      
      <Text>Followers: {followersLoading ? 'Loading...' : followers?.total_count || 0}</Text>
      <Text>Following: {followingLoading ? 'Loading...' : following?.total_count || 0}</Text>
      
      {followMutation.isPending && <Text>Processing...</Text>}
      {followMutation.error && <Text>Error: {followMutation.error.message}</Text>}
    </View>
  );
};
```

---

## 🔧 **Phase 5: Navigation Setup**

### **Step 6: Update Navigation Types**

Update `src/navigation/types.ts`:

```typescript
export type MainStackParamList = {
  // ... existing routes ...
  FollowersList: { userId: string; username: string };
  FollowingList: { userId: string; username: string };
  UserProfile: { userId: string };
};
```

---

## ✅ **Testing Checklist**

Before proceeding to the next phase, verify:

- [ ] `useFollowMutation` hook works without errors
- [ ] `useFollowers` and `useFollowing` hooks fetch data correctly
- [ ] `FollowButton` component renders and handles clicks
- [ ] Profile screen shows clickable follower/following stats
- [ ] Console logs show successful RPC calls
- [ ] No TypeScript errors in the implementation
- [ ] Follow/unfollow operations update the UI optimistically

---

## 🚨 **Important Notes**

1. **Backend Dependency**: Ensure backend team has deployed the RPC functions before testing
2. **User IDs**: Replace test user IDs with actual UUIDs from your database
3. **Error Handling**: Add proper error handling and user feedback (toasts/alerts)
4. **Performance**: Monitor query performance with real data
5. **Caching**: The hooks use React Query caching - verify cache invalidation works

---

## 🔗 **Next Steps**

Once Phase 1-5 are complete and tested:

1. **Create List Screens**: Build FollowersListScreen and FollowingListScreen
2. **User Profile Screen**: Create a separate screen for viewing other users' profiles
3. **Feed Integration**: Add "Following" tab to the main feed
4. **Activity Feed**: Update activity feed to show follow activities
5. **Polish & UX**: Add loading states, error handling, and smooth animations

This foundation provides the core functionality for the Followers & Following feature! 🚀 