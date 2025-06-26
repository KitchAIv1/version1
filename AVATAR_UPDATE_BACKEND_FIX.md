# Avatar Update Backend Fix - Critical Issue Resolution

## Problem Summary
After editing profile and updating avatar in EditProfileScreen, the new avatar URL is not reflected in ProfileScreen. The avatar appears unchanged even though the update operation reports success.

## Root Cause Analysis

### Issue Identified
The `get_profile_details` RPC function reads `avatar_url` from `auth.users.raw_user_meta_data`, but the `update_profile` function writes to `profiles.avatar_url`. This creates a **data consistency mismatch**.

### Evidence from Logs
```
LOG [EDIT_PROFILE] Profile update payload: {"p_avatar_url": "...1750932516537.jpg", ...}
LOG AuthProvider: Raw RPC response: {"profile": {"avatar_url": "...1746719306169.png", ...}}
```

**Two different avatar URLs**: 
- ✅ **Saved**: `1750932516537.jpg` (new)
- ❌ **Retrieved**: `1746719306169.png` (old)

## Required Backend Fixes

### 1. Fix `get_profile_details` Function ⚠️ **CRITICAL**

**File**: `supabase/migrations/20250126000005_fix_get_profile_details_new_user_issue.sql`

**Current Problem Code**:
```sql
'avatar_url', COALESCE(u.raw_user_meta_data ->> 'avatar_url', ''),  -- ❌ WRONG SOURCE
```

**Required Fix**:
```sql
'avatar_url', COALESCE(p.avatar_url, ''),  -- ✅ CORRECT SOURCE
```

**Apply this change in TWO places**:

#### Location 1: Existing Users (Line ~84)
```sql
-- Fetch profile data with all required fields for existing users
SELECT jsonb_build_object(
  'user_id', u.id,
  'username', COALESCE(p.username, 'Anonymous'),
  'avatar_url', COALESCE(p.avatar_url, ''),  -- 🔧 FIX: Read from profiles table
  'bio', COALESCE(p.bio, ''),
  -- ... rest of fields
) INTO profile_data
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.user_id = p_user_id;
```

#### Location 2: New Users (Line ~54)
```sql
IF NOT profile_exists THEN
  -- Return default structure for new users without profiles
  SELECT jsonb_build_object(
    'user_id', u.id,
    'username', null,
    'avatar_url', '',  -- 🔧 FIX: Empty for new users since no profile exists yet
    'bio', '',
    -- ... rest of fields
  ) INTO profile_data
  FROM auth.users u
  WHERE u.id = p_user_id;
```

### 2. Verify `update_profile` Function ✅ **ALREADY CORRECT**

The `update_profile` function correctly writes to `profiles.avatar_url`:

```sql
UPDATE profiles 
SET 
  avatar_url = CASE 
    WHEN p_avatar_url IS NOT NULL THEN p_avatar_url 
    ELSE avatar_url 
  END,
  -- ... other fields
WHERE user_id = p_user_id;
```

**Status**: ✅ No changes needed here.

### 3. Optional: Remove Redundant auth.users Update

**Current Code** (can be removed):
```sql
-- Update auth.users.raw_user_meta_data for avatar_url
IF p_avatar_url IS NOT NULL THEN
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('avatar_url', p_avatar_url)
  WHERE id = p_user_id;
END IF;
```

**Recommendation**: Remove this since we're reading from `profiles` table only.

## Implementation Steps

### Step 1: Apply Database Migration
```bash
cd /Users/willis/Projects/kitchai-v2
npx supabase db push
```

### Step 2: Verify Fix
1. Edit profile and change avatar
2. Save profile
3. Navigate back to ProfileScreen
4. **Expected Result**: New avatar should display immediately

### Step 3: Test Edge Cases
- Test with new user profiles (no existing avatar)
- Test multiple rapid avatar changes
- Verify avatar persistence after app restart

## Expected Behavior After Fix

### Before Fix ❌
- EditProfile saves: `new-avatar-123.jpg`
- ProfileScreen shows: `old-avatar-456.png`
- **UI shows stale avatar**

### After Fix ✅
- EditProfile saves: `new-avatar-123.jpg`
- ProfileScreen shows: `new-avatar-123.jpg`
- **UI shows updated avatar immediately**

## Priority Level
🚨 **HIGH PRIORITY** - This affects core user experience for profile management.

## Testing Checklist
- [ ] Avatar updates immediately after edit
- [ ] Multiple avatar changes work correctly
- [ ] New users can set avatars
- [ ] No Reanimated warnings or performance issues
- [ ] ProfileScreen loads without freezing

## Related Files
- `supabase/migrations/20250126000005_fix_get_profile_details_new_user_issue.sql`
- `fix-update-profile-lockout.sql`
- `src/screens/EditProfileScreen.tsx`
- `src/screens/main/ProfileScreen.tsx`

---

**Status**: 🔧 **Ready for Implementation**  
**Estimated Fix Time**: 5 minutes  
**Impact**: Resolves avatar update functionality completely 