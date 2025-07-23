# ✅ RESOLVED: White Screen Regression - Frontend Race Condition Fixed

## 🎉 **RESOLUTION SUMMARY**

**ISSUE RESOLVED:** The white screen issue was **NOT** a backend/database problem. It was a **frontend authentication race condition** in `AuthProvider.tsx`.

**ROOT CAUSE:** `setLoading(false)` was called before `fetchProfileWithRPC()` completed, causing AppNavigator to briefly render with session but no profile.

**FIX APPLIED:** Synchronized loading states in the auth state change handler to prevent the race condition.

**RESULT:** ✅ White screen eliminated - smooth authentication flow restored

---

# CRITICAL: White Screen Regression - Backend Instructions

## ✅ **ISSUE RESOLVED - FRONTEND RACE CONDITION FIXED**

**Problem:** Brief white screen after app restart due to authentication loading state race condition
**User Affected:** `6f4c749f-eafe-4ce1-86bf-b6d49472757e` (and potentially others)
**Status:** ✅ FIXED - Authentication race condition resolved

## 🔍 **ROOT CAUSE ANALYSIS**

### **What Happened:**
1. **Previous Fix:** Migration `20250126000005_fix_get_profile_details_new_user_issue.sql` correctly used `user_id` field
2. **Regression:** An older/conflicting migration is overriding the correct function
3. **Current Issue:** Function is using wrong field `profiles.id = p_user_id` instead of `profiles.user_id = p_user_id`

### **Evidence from Logs:**
```
LOG  AuthProvider: Fetching profile via RPC get_profile_details for user 6f4c749f-eafe-4ce1-86bf-b6d49472757e
```
Then white screen occurs because `data.profile` returns null.

## 🛠️ **IMMEDIATE BACKEND ACTION REQUIRED**

### **Step 1: Verify Current Function State**
Execute in Supabase SQL Editor:
```sql
-- Check current function definition
SELECT prosrc FROM pg_proc 
WHERE proname = 'get_profile_details' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Look for these CRITICAL differences:**
- ❌ **BROKEN:** `WHERE id = p_user_id` or `LEFT JOIN profiles p ON u.id = p.id`
- ✅ **CORRECT:** `WHERE user_id = p_user_id` or `LEFT JOIN profiles p ON p.user_id = u.id`

### **Step 2: Apply Emergency Fix**
```sql
-- 🚨 EMERGENCY: Drop conflicting function and recreate with correct schema
DROP FUNCTION IF EXISTS public.get_profile_details(uuid);

CREATE OR REPLACE FUNCTION public.get_profile_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_exists BOOLEAN;
  user_exists BOOLEAN;
  profile_data JSONB;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE NOTICE 'No user found in auth.users for user_id: %', p_user_id;
    -- Return safe default to prevent white screen
    RETURN jsonb_build_object(
      'profile', jsonb_build_object(
        'user_id', p_user_id,
        'username', null,
        'avatar_url', '',
        'bio', '',
        'role', null,
        'onboarded', false,
        'tier', 'FREEMIUM',
        'followers', 0,
        'following', 0
      ),
      'recipes', '[]'::jsonb,
      'saved_recipes', '[]'::jsonb
    );
  END IF;

  -- 🚨 CRITICAL FIX: Use user_id field (NOT id field)
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = p_user_id) INTO profile_exists;
  
  RAISE NOTICE 'Profile exists check for user_id %: %', p_user_id, profile_exists;

  IF NOT profile_exists THEN
    RAISE NOTICE 'No profile found for user_id: %, returning default structure', p_user_id;
    -- Return safe default for users without profiles
    SELECT jsonb_build_object(
      'user_id', u.id,
      'username', null,
      'avatar_url', '',
      'bio', '',
      'role', null,
      'onboarded', false,
      'tier', 'FREEMIUM',
      'followers', 0,
      'following', 0
    ) INTO profile_data
    FROM auth.users u
    WHERE u.id = p_user_id;

    RETURN jsonb_build_object(
      'profile', profile_data,
      'recipes', '[]'::jsonb,
      'saved_recipes', '[]'::jsonb
    );
  END IF;

  -- Profile exists - fetch complete data
  RETURN (
    SELECT jsonb_build_object(
      'profile', jsonb_build_object(
        'user_id', u.id,
        'username', COALESCE(p.username, 'Anonymous'),
        'avatar_url', COALESCE(p.avatar_url, ''),
        'bio', COALESCE(p.bio, ''),
        'role', CASE 
          WHEN p.role IS NULL OR p.role = '' THEN NULL 
          ELSE p.role 
        END,
        'tier', COALESCE(p.tier, 
          CASE 
            WHEN p.role = 'creator' THEN 'PREMIUM'
            ELSE 'FREEMIUM'
          END
        ),
        'onboarded', COALESCE(p.onboarded, false),
        'followers', COALESCE((
          SELECT COUNT(*) FROM user_follows WHERE followed_id = p_user_id
        ), 0),
        'following', COALESCE((
          SELECT COUNT(*) FROM user_follows WHERE follower_id = p_user_id
        ), 0)
      ),
      'recipes', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'recipe_id', r.id,
            'title', r.title,
            'video_url', COALESCE(r.video_url, ''),
            'thumbnail_url', COALESCE(r.thumbnail_url, ''),
            'created_at', r.created_at,
            'creator_user_id', r.user_id,
            'is_ai_generated', COALESCE(r.is_ai_generated, false)
          ) ORDER BY r.created_at DESC
        )
        FROM recipe_uploads r
        WHERE r.user_id = p_user_id
      ), '[]'::jsonb),
      'saved_recipes', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'recipe_id', r.id,
            'title', r.title,
            'video_url', COALESCE(r.video_url, ''),
            'thumbnail_url', COALESCE(r.thumbnail_url, ''),
            'created_at', r.created_at,
            'saved_at', s.saved_at,
            'creator_user_id', r.user_id,
            'is_ai_generated', COALESCE(r.is_ai_generated, false)
          ) ORDER BY s.saved_at DESC
        )
        FROM recipe_uploads r
        JOIN saved_recipe_videos s ON r.id = s.recipe_id
        WHERE s.user_id = p_user_id
      ), '[]'::jsonb)
    )
    FROM auth.users u
    -- 🚨 CRITICAL: Use user_id field in JOIN (not id)
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = p_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_profile_details for user_id %: %', p_user_id, SQLERRM;
  -- Always return safe default on error to prevent white screen
  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', p_user_id,
      'username', null,
      'avatar_url', '',
      'bio', '',
      'role', null,
      'onboarded', false,
      'tier', 'FREEMIUM',
      'followers', 0,
      'following', 0
    ),
    'recipes', '[]'::jsonb,
    'saved_recipes', '[]'::jsonb
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_profile_details(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profile_details(UUID) FROM anon, PUBLIC;
```

### **Step 3: Verify Fix**
```sql
-- Test the function with the affected user
SELECT get_profile_details('6f4c749f-eafe-4ce1-86bf-b6d49472757e');

-- Should return profile data structure, not null
```

## 🔍 **WHY THE REGRESSION HAPPENED**

### **Migration Conflict Analysis:**

1. **✅ GOOD Migration:** `20250126000005_fix_get_profile_details_new_user_issue.sql`
   - Uses correct `WHERE user_id = p_user_id`
   - Has comprehensive error handling

2. **❌ PROBLEM Migration:** `20241226000001_fix_get_profile_details_role.sql`
   - Uses wrong `WHERE id = p_user_id` 
   - Wrong JOIN: `LEFT JOIN profiles p ON u.id = p.id`

3. **🚨 CONFLICT:** The migrations have conflicting `DROP FUNCTION` and `CREATE FUNCTION` statements

### **Database Schema Reality Check:**
```sql
-- Verify profiles table structure
\d profiles

-- Expected: profiles.user_id -> auth.users.id
-- NOT: profiles.id -> auth.users.id
```

## 🛡️ **PREVENTION FOR FUTURE**

### **Migration Order Issue:**
The problem is that migrations with conflicting function definitions can override each other. Need to ensure:

1. **Only ONE authoritative `get_profile_details` migration**
2. **All subsequent migrations reference the correct schema**
3. **Function versioning** to prevent conflicts

### **Recommended Approach:**
1. Create a new migration: `20250128000004_final_get_profile_details_fix.sql`
2. Include comprehensive comments about the correct schema
3. Add function version comment to prevent future overwrites

## 📋 **VERIFICATION CHECKLIST**

After applying the fix:

- [ ] Function uses `WHERE user_id = p_user_id` (not `id`)
- [ ] JOIN uses `LEFT JOIN profiles p ON p.user_id = u.id` (not `ON u.id = p.id`)
- [ ] Test with affected user ID: `6f4c749f-eafe-4ce1-86bf-b6d49472757e`
- [ ] Returns profile data structure (not null)
- [ ] White screen issue resolved on app restart
- [ ] Logs show successful profile fetching

## 🚀 **EXPECTED OUTCOME**

After applying this fix:
1. **User `6f4c749f...` can restart app without white screen**
2. **Profile loading works correctly**
3. **Comprehensive error handling prevents future white screens**
4. **Debug logs help track any future issues**

---

**Timeline:** Apply immediately - this is blocking user access to the app. 