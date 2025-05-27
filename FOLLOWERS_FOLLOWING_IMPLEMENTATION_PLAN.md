# 🚀 Followers & Following Feature - Implementation Plan

## 📋 **Project Overview**
**Feature**: Social Followers & Following System for KitchAI  
**Objective**: Enable users to follow creators and other users to build social connections and curate personalized feeds  
**Scope**: MVP implementation with public relationships, activity tracking, and feed integration

---

## 🏗️ **Backend Implementation (Supabase)**

### **1. Database Schema**

#### **New Table: `follows`**
```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(follower_id, followed_id),
  CHECK(follower_id != followed_id) -- Prevent self-following
);

-- Indexes for performance
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_followed_id ON follows(followed_id);
CREATE INDEX idx_follows_created_at ON follows(created_at DESC);
```

#### **Update Existing Tables**
```sql
-- Add follower/following counts to profiles (optional - can be calculated)
ALTER TABLE profiles ADD COLUMN followers_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN following_count INTEGER DEFAULT 0;
```

### **2. RPC Functions**

#### **Core Follow Operations**
```sql
-- Follow a user
CREATE OR REPLACE FUNCTION follow_user(
  p_follower_id UUID,
  p_followed_id UUID
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Validation
  IF p_follower_id = p_followed_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  
  -- Insert follow relationship (ON CONFLICT DO NOTHING for idempotency)
  INSERT INTO follows (follower_id, followed_id)
  VALUES (p_follower_id, p_followed_id)
  ON CONFLICT (follower_id, followed_id) DO NOTHING;
  
  -- Return success with counts
  SELECT json_build_object(
    'success', true,
    'following', true,
    'followers_count', (SELECT COUNT(*) FROM follows WHERE followed_id = p_followed_id),
    'following_count', (SELECT COUNT(*) FROM follows WHERE follower_id = p_follower_id)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unfollow a user
CREATE OR REPLACE FUNCTION unfollow_user(
  p_follower_id UUID,
  p_followed_id UUID
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Remove follow relationship
  DELETE FROM follows 
  WHERE follower_id = p_follower_id AND followed_id = p_followed_id;
  
  -- Return success with updated counts
  SELECT json_build_object(
    'success', true,
    'following', false,
    'followers_count', (SELECT COUNT(*) FROM follows WHERE followed_id = p_followed_id),
    'following_count', (SELECT COUNT(*) FROM follows WHERE follower_id = p_follower_id)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get follow status between two users
CREATE OR REPLACE FUNCTION get_follow_status(
  p_follower_id UUID,
  p_followed_id UUID
) RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'is_following', EXISTS(
      SELECT 1 FROM follows 
      WHERE follower_id = p_follower_id AND followed_id = p_followed_id
    ),
    'is_followed_by', EXISTS(
      SELECT 1 FROM follows 
      WHERE follower_id = p_followed_id AND followed_id = p_follower_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **List Functions**
```sql
-- Get user's followers
CREATE OR REPLACE FUNCTION get_user_followers(
  p_user_id UUID,
  p_requesting_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'followers', json_agg(
        json_build_object(
          'user_id', p.id,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'bio', p.bio,
          'is_following', CASE 
            WHEN p_requesting_user_id IS NULL THEN false
            ELSE EXISTS(
              SELECT 1 FROM follows 
              WHERE follower_id = p_requesting_user_id AND followed_id = p.id
            )
          END,
          'followed_at', f.created_at
        ) ORDER BY f.created_at DESC
      ),
      'total_count', COUNT(*) OVER()
    )
    FROM follows f
    JOIN profiles p ON f.follower_id = p.id
    WHERE f.followed_id = p_user_id
    LIMIT p_limit OFFSET p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get users that a user is following
CREATE OR REPLACE FUNCTION get_user_following(
  p_user_id UUID,
  p_requesting_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'following', json_agg(
        json_build_object(
          'user_id', p.id,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'bio', p.bio,
          'is_following', CASE 
            WHEN p_requesting_user_id IS NULL THEN false
            ELSE EXISTS(
              SELECT 1 FROM follows 
              WHERE follower_id = p_requesting_user_id AND followed_id = p.id
            )
          END,
          'followed_at', f.created_at
        ) ORDER BY f.created_at DESC
      ),
      'total_count', COUNT(*) OVER()
    )
    FROM follows f
    JOIN profiles p ON f.followed_id = p.id
    WHERE f.follower_id = p_user_id
    LIMIT p_limit OFFSET p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **Enhanced Profile Function**
```sql
-- Update get_profile_details to include follow counts and status
CREATE OR REPLACE FUNCTION get_profile_details(
  p_user_id UUID,
  p_requesting_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  profile_data JSON;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'role', p.role,
    'tier', p.tier,
    'followers_count', (SELECT COUNT(*) FROM follows WHERE followed_id = p.id),
    'following_count', (SELECT COUNT(*) FROM follows WHERE follower_id = p.id),
    'is_following', CASE 
      WHEN p_requesting_user_id IS NULL OR p_requesting_user_id = p.id THEN false
      ELSE EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = p_requesting_user_id AND followed_id = p.id
      )
    END,
    'is_followed_by', CASE 
      WHEN p_requesting_user_id IS NULL OR p_requesting_user_id = p.id THEN false
      ELSE EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = p.id AND followed_id = p_requesting_user_id
      )
    END,
    'recipes', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'recipe_id', r.id,
          'title', r.title,
          'video_url', r.video_url,
          'thumbnail_url', r.thumbnail_url,
          'created_at', r.created_at,
          'creator_user_id', r.user_id
        ) ORDER BY r.created_at DESC
      ), '[]'::json)
      FROM recipes r WHERE r.user_id = p.id AND r.is_public = true
    ),
    'saved_recipes', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'recipe_id', r.id,
          'title', r.title,
          'video_url', r.video_url,
          'thumbnail_url', r.thumbnail_url,
          'created_at', sr.created_at,
          'creator_user_id', r.user_id
        ) ORDER BY sr.created_at DESC
      ), '[]'::json)
      FROM saved_recipes sr
      JOIN recipes r ON sr.recipe_id = r.id
      WHERE sr.user_id = p.id AND r.is_public = true
    )
  ) INTO profile_data
  FROM profiles p
  WHERE p.id = p_user_id;
  
  RETURN profile_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **3. Row Level Security (RLS)**
```sql
-- Enable RLS on follows table
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all follow relationships (public)
CREATE POLICY "Follow relationships are public" ON follows
  FOR SELECT USING (true);

-- Policy: Users can only create follows for themselves
CREATE POLICY "Users can follow others" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Policy: Users can only delete their own follows
CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (auth.uid() = follower_id);
```

### **4. Activity Tracking Integration**
```sql
-- Add follow activity to user_activity table
INSERT INTO user_activity (user_id, activity_type, metadata)
VALUES (
  p_follower_id,
  'followed_user',
  json_build_object(
    'followed_user_id', p_followed_id,
    'followed_username', (SELECT username FROM profiles WHERE id = p_followed_id)
  )
);
```

---

## 🎨 **Frontend Implementation**

### **1. New Hooks**

#### **useFollowMutation Hook**
```typescript
// src/hooks/useFollowMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

interface FollowMutationParams {
  followerId: string;
  followedId: string;
  currentlyFollowing: boolean;
}

export const useFollowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ followerId, followedId, currentlyFollowing }: FollowMutationParams) => {
      const rpcFunction = currentlyFollowing ? 'unfollow_user' : 'follow_user';
      
      const { data, error } = await supabase.rpc(rpcFunction, {
        p_follower_id: followerId,
        p_followed_id: followedId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['profile', variables.followedId] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.followerId] });
      queryClient.invalidateQueries({ queryKey: ['followers', variables.followedId] });
      queryClient.invalidateQueries({ queryKey: ['following', variables.followerId] });
      queryClient.invalidateQueries({ queryKey: ['userActivityFeed'] });
    },
    onError: (error) => {
      console.error('Follow mutation error:', error);
    }
  });
};
```

#### **useFollowers & useFollowing Hooks**
```typescript
// src/hooks/useFollowLists.ts
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

export const useFollowers = (userId: string, requestingUserId?: string) => {
  return useQuery({
    queryKey: ['followers', userId, requestingUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_followers', {
        p_user_id: userId,
        p_requesting_user_id: requestingUserId,
        p_limit: 100
      });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useFollowing = (userId: string, requestingUserId?: string) => {
  return useQuery({
    queryKey: ['following', userId, requestingUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_following', {
        p_user_id: userId,
        p_requesting_user_id: requestingUserId,
        p_limit: 100
      });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
```

### **2. Enhanced Profile Components**

#### **Updated ProfileScreen.tsx**
```typescript
// Add to existing ProfileScreen.tsx

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
      <TouchableOpacity onPress={onPress}>
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
  onFollowersPress: () => void;
  onFollowingPress: () => void;
}> = React.memo(({ profile, postsCount, onFollowersPress, onFollowingPress }) => {
  return (
    <View style={styles.avatarRow}>
      {/* Avatar code remains the same */}
      <View style={styles.statsRow}>
        <Stat label="Posts" value={postsCount} />
        <Stat 
          label="Followers" 
          value={profile.followers ?? 0} 
          onPress={onFollowersPress}
        />
        <Stat 
          label="Following" 
          value={profile.following ?? 0} 
          onPress={onFollowingPress}
        />
      </View>
    </View>
  );
});

// Add navigation handlers
const handleFollowersPress = () => {
  navigation.navigate('FollowersList', { 
    userId: user?.id,
    username: profile?.username 
  });
};

const handleFollowingPress = () => {
  navigation.navigate('FollowingList', { 
    userId: user?.id,
    username: profile?.username 
  });
};
```

#### **Follow Button Component**
```typescript
// src/components/FollowButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFollowMutation } from '../hooks/useFollowMutation';

interface FollowButtonProps {
  followerId: string;
  followedId: string;
  isFollowing: boolean;
  style?: any;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  followerId,
  followedId,
  isFollowing,
  style
}) => {
  const followMutation = useFollowMutation();

  const handlePress = () => {
    followMutation.mutate({
      followerId,
      followedId,
      currentlyFollowing: isFollowing
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isFollowing ? styles.followingButton : styles.followButton,
        style
      ]}
      onPress={handlePress}
      disabled={followMutation.isPending}
    >
      {followMutation.isPending ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={[
          styles.buttonText,
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
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#10b981',
  },
  followingButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonText: {
    fontSize: 14,
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

### **3. New Screens**

#### **FollowersList Screen**
```typescript
// src/screens/social/FollowersListScreen.tsx
import React from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useFollowers } from '../../hooks/useFollowLists';
import { useAuth } from '../../providers/AuthProvider';
import { UserListItem } from '../../components/UserListItem';

type FollowersListRouteProp = RouteProp<MainStackParamList, 'FollowersList'>;

export const FollowersListScreen: React.FC = () => {
  const route = useRoute<FollowersListRouteProp>();
  const { userId, username } = route.params;
  const { user } = useAuth();
  
  const { data, isLoading, error } = useFollowers(userId, user?.id);

  const renderUser = ({ item }: { item: FollowUser }) => (
    <UserListItem
      user={item}
      currentUserId={user?.id}
      showFollowButton={item.user_id !== user?.id}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.followers || []}
        renderItem={renderUser}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};
```

#### **UserListItem Component**
```typescript
// src/components/UserListItem.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FollowButton } from './FollowButton';
import { FollowUser } from '../hooks/useFollowLists';

interface UserListItemProps {
  user: FollowUser;
  currentUserId?: string;
  showFollowButton?: boolean;
}

export const UserListItem: React.FC<UserListItemProps> = ({
  user,
  currentUserId,
  showFollowButton = true
}) => {
  const navigation = useNavigation();

  const handleUserPress = () => {
    navigation.navigate('UserProfile', { userId: user.user_id });
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handleUserPress}>
      <Image
        source={{ uri: user.avatar_url || 'default-avatar-url' }}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.username}>{user.username}</Text>
        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
      </View>
      {showFollowButton && currentUserId && (
        <FollowButton
          followerId={currentUserId}
          followedId={user.user_id}
          isFollowing={user.is_following}
          style={styles.followButton}
        />
      )}
    </TouchableOpacity>
  );
};
```

### **4. Enhanced Activity Feed**

#### **Update ActivityFeed.tsx**
```typescript
// Add to existing activity types
export type ActivityType = 
  | 'saved_recipe' 
  | 'planned_meal' 
  | 'generated_recipe' 
  | 'added_to_grocery' 
  | 'cooked_recipe' 
  | 'manual_pantry_add' 
  | 'successful_scan' 
  | 'pantry_update'
  | 'followed_user'; // New activity type

// Add to getActivityIcon function
case 'followed_user':
  return 'person-add';

// Add to getActivityDescription function
case 'followed_user':
  return `You followed ${metadata?.followed_username || 'a user'}`;
```

### **5. Navigation Updates**

#### **Update Navigation Types**
```typescript
// src/navigation/types.ts
export type MainStackParamList = {
  // ... existing routes
  FollowersList: { userId: string; username: string };
  FollowingList: { userId: string; username: string };
  UserProfile: { userId: string };
};
```

---

## 🔄 **Feed Integration**

### **Following Feed Filter**
```typescript
// src/hooks/useFollowingFeed.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

export const useFollowingFeed = (userId: string) => {
  return useQuery({
    queryKey: ['followingFeed', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_following_feed', {
        p_user_id: userId,
        p_limit: 50
      });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
};
```

### **Feed Screen Enhancement**
```typescript
// Add tab switching in FeedScreen
const [feedType, setFeedType] = useState<'forYou' | 'following'>('forYou');

// Add tab bar
<View style={styles.feedTabs}>
  <TouchableOpacity 
    style={[styles.tab, feedType === 'forYou' && styles.activeTab]}
    onPress={() => setFeedType('forYou')}
  >
    <Text style={[styles.tabText, feedType === 'forYou' && styles.activeTabText]}>
      For You
    </Text>
  </TouchableOpacity>
  <TouchableOpacity 
    style={[styles.tab, feedType === 'following' && styles.activeTab]}
    onPress={() => setFeedType('following')}
  >
    <Text style={[styles.tabText, feedType === 'following' && styles.activeTabText]}>
      Following
    </Text>
  </TouchableOpacity>
</View>
```

---

## 🧪 **Testing Strategy**

### **Backend Testing**
1. **RPC Function Tests**: Test all follow/unfollow operations
2. **Edge Cases**: Self-follow prevention, duplicate follows
3. **Performance**: Test with large follower counts
4. **Security**: Verify RLS policies work correctly

### **Frontend Testing**
1. **Follow/Unfollow Flow**: Test button states and optimistic updates
2. **List Screens**: Test followers/following lists with pagination
3. **Profile Integration**: Verify counts update correctly
4. **Activity Feed**: Test follow activities appear correctly

---

## 📈 **Success Metrics**

### **User Engagement**
- Follow/unfollow actions per user
- Time spent on followers/following lists
- Profile visits from follow lists

### **Social Growth**
- Average followers per creator
- Follow-back rate
- Activity feed engagement from followed users

---

## 🚀 **Deployment Plan**

### **Phase 1: Backend Foundation**
1. Create follows table and RPC functions
2. Update profile RPC with follow data
3. Add activity tracking for follows

### **Phase 2: Core Frontend**
1. Implement follow hooks and mutations
2. Add follow button component
3. Update profile screen with clickable stats

### **Phase 3: List Screens**
1. Create followers/following list screens
2. Implement user list components
3. Add navigation integration

### **Phase 4: Feed Integration**
1. Add following feed functionality
2. Implement feed type switching
3. Enhance activity feed with follow activities

### **Phase 5: Polish & Testing**
1. Comprehensive testing
2. Performance optimization
3. UI/UX refinements

---

## 🎯 **Next Steps**

1. **Backend Team**: Start with database schema and RPC functions
2. **Frontend Team**: Begin with follow hooks and basic components
3. **Coordination**: Regular sync meetings to ensure API compatibility
4. **Testing**: Set up test users and scenarios for validation

This implementation plan provides a solid foundation for the Followers & Following feature while leveraging the existing social infrastructure in KitchAI! 🚀 