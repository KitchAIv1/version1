# 🚀 Backend Quick Start: Followers & Following Feature

## 📋 **Immediate Action Items for Backend Team**

This guide provides ready-to-run SQL scripts to implement the Followers & Following feature in Supabase.

---

## 🗄️ **Step 1: Create Database Schema**

### **Create the `follows` table**
```sql
-- Create follows table
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(follower_id, followed_id),
  CHECK(follower_id != followed_id)
);

-- Create indexes for performance
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_followed_id ON follows(followed_id);
CREATE INDEX idx_follows_created_at ON follows(created_at DESC);

-- Enable Row Level Security
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
```

### **Create RLS Policies**
```sql
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

---

## ⚙️ **Step 2: Create RPC Functions**

### **Core Follow Operations**
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
  
  -- Log activity
  INSERT INTO user_activity (user_id, activity_type, metadata)
  VALUES (
    p_follower_id,
    'followed_user',
    json_build_object(
      'followed_user_id', p_followed_id,
      'followed_username', (SELECT username FROM profiles WHERE id = p_followed_id)
    )
  );
  
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

### **List Functions**
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
      'followers', COALESCE(json_agg(
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
      ), '[]'::json),
      'total_count', COUNT(*)
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
      'following', COALESCE(json_agg(
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
      ), '[]'::json),
      'total_count', COUNT(*)
    )
    FROM follows f
    JOIN profiles p ON f.followed_id = p.id
    WHERE f.follower_id = p_user_id
    LIMIT p_limit OFFSET p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔄 **Step 3: Update Existing Functions**

### **Enhanced Profile Function**
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
    'onboarded', p.onboarded,
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

### **Update Activity Feed Function**
```sql
-- Update get_user_activity_feed to include follow activities
-- Add this to the existing function's activity type handling:

-- In the activity type CASE statement, add:
WHEN 'followed_user' THEN 
  json_build_object(
    'type', 'followed_user',
    'timestamp', ua.created_at,
    'metadata', ua.metadata
  )
```

---

## 🧪 **Step 4: Test the Implementation**

### **Test Scripts**
```sql
-- Test 1: Create a follow relationship
SELECT follow_user(
  'user1-uuid-here'::uuid,
  'user2-uuid-here'::uuid
);

-- Test 2: Check follow status
SELECT get_follow_status(
  'user1-uuid-here'::uuid,
  'user2-uuid-here'::uuid
);

-- Test 3: Get followers list
SELECT get_user_followers(
  'user2-uuid-here'::uuid,
  'requesting-user-uuid'::uuid
);

-- Test 4: Get following list
SELECT get_user_following(
  'user1-uuid-here'::uuid,
  'requesting-user-uuid'::uuid
);

-- Test 5: Unfollow
SELECT unfollow_user(
  'user1-uuid-here'::uuid,
  'user2-uuid-here'::uuid
);

-- Test 6: Check updated profile with follow counts
SELECT get_profile_details(
  'user-uuid-here'::uuid,
  'requesting-user-uuid'::uuid
);
```

---

## 🔍 **Step 5: Verification Queries**

### **Check Data Integrity**
```sql
-- Verify no self-follows exist
SELECT COUNT(*) as self_follows 
FROM follows 
WHERE follower_id = followed_id;
-- Should return 0

-- Check for duplicate follows
SELECT follower_id, followed_id, COUNT(*) 
FROM follows 
GROUP BY follower_id, followed_id 
HAVING COUNT(*) > 1;
-- Should return no rows

-- Verify indexes are created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'follows';
-- Should show the 3 indexes we created

-- Check RLS policies
SELECT policyname, tablename, permissive 
FROM pg_policies 
WHERE tablename = 'follows';
-- Should show our 3 policies
```

---

## 📊 **Step 6: Performance Monitoring**

### **Monitor Query Performance**
```sql
-- Check query performance for followers list
EXPLAIN ANALYZE 
SELECT * FROM get_user_followers('some-uuid'::uuid, 'requesting-uuid'::uuid);

-- Check query performance for following list
EXPLAIN ANALYZE 
SELECT * FROM get_user_following('some-uuid'::uuid, 'requesting-uuid'::uuid);

-- Monitor follow operations
EXPLAIN ANALYZE 
SELECT follow_user('follower-uuid'::uuid, 'followed-uuid'::uuid);
```

---

## ✅ **Deployment Checklist**

- [ ] `follows` table created with proper constraints
- [ ] Indexes created for performance
- [ ] RLS policies implemented and tested
- [ ] Core RPC functions (`follow_user`, `unfollow_user`) working
- [ ] List functions (`get_user_followers`, `get_user_following`) working
- [ ] `get_profile_details` updated with follow data
- [ ] Activity tracking for follows implemented
- [ ] Test scripts run successfully
- [ ] Performance verified with EXPLAIN ANALYZE
- [ ] Data integrity checks passed

---

## 🚨 **Important Notes**

1. **Replace UUIDs**: In test scripts, replace placeholder UUIDs with actual user IDs from your database
2. **Activity Table**: Ensure your `user_activity` table supports the `followed_user` activity type
3. **Profiles Table**: Verify the `profiles` table structure matches the function expectations
4. **Performance**: Monitor query performance with real data volumes
5. **Security**: Test RLS policies thoroughly with different user contexts

---

## 🔗 **Next Steps for Frontend Integration**

Once backend is deployed, frontend team can:
1. Test RPC functions via Supabase client
2. Implement the hooks and components from the main implementation plan
3. Begin with basic follow/unfollow functionality
4. Add the list screens and enhanced profile features

This backend implementation provides a solid foundation for the Followers & Following feature! 🚀 