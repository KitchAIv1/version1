# 🚨 BACKEND PARTIAL FIXES - Critical Issues Remain

## Current Status: Like/Comment Counts Still Broken

While the backend team fixed the RPC function existence issues, the actual data being returned is still incorrect. Here's the detailed breakdown of what's working vs. what's still broken:

---

## 🔴 **Issue #1: Feed RPC Returns Zero Counts**

### Problem:
```javascript
// Feed data shows:
"feed_likes": 0,        // ❌ Should show actual like count
"feed_comments": 0,     // ❌ Should show actual comment count
```

### Current Behavior:
- **ALL recipes in feed show 0 likes and 0 comments**
- Even recipes with known likes/comments show 0
- This affects the entire feed display

### Required Fix:
The `get_community_feed_pantry_match_v3` RPC needs to properly calculate:
```sql
-- Fix the likes calculation in feed RPC:
(SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.recipe_id) as output_likes,

-- Fix the comments calculation in feed RPC:
(SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.recipe_id) as output_comments_count
```

---

## 🟡 **Issue #2: Recipe Details Shows Mixed Results**

### Current Behavior:
```javascript
// Recipe details shows:
"recipe_details_likes": 0,      // ❌ Still showing 0 for likes
"recipe_details_comments": 5,   // ✅ Shows actual comment count
```

### Problem:
- **Comments work correctly** in recipe details
- **Likes still show 0** even for recipes that should have likes
- `get_recipe_details` RPC partially working

### Required Fix:
Add proper like calculation to `get_recipe_details` RPC:
```sql
-- Add to get_recipe_details RPC:
(SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.recipe_id) as likes,
(SELECT EXISTS(SELECT 1 FROM recipe_likes WHERE recipe_id = r.recipe_id AND user_id = p_user_id)) as is_liked_by_user
```

---

## 🔵 **Issue #3: Cache Sync Problems**

### Current Behavior:
- User exits recipe detail screen
- Comment count **briefly updates** in feed
- Feed **immediately refreshes to top** and counts reset to 0

### Problem:
- Frontend cache synchronization working correctly
- Backend feed RPC immediately overwrites with 0 counts
- Creates flickering effect where correct data appears then disappears

### Required Fix:
- Feed RPC must return correct counts to prevent overwriting cache

---

## 📊 **Specific Test Cases**

### Test Recipe: `eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01` (Spaghetti Bolognese)

**Expected:**
```javascript
// Feed should show:
"feed_likes": 1,
"feed_comments": 5

// Recipe details should show:
"recipe_details_likes": 1,
"recipe_details_comments": 5
```

**Currently Showing:**
```javascript
// Feed shows:
"feed_likes": 0,        // ❌ Wrong
"feed_comments": 0      // ❌ Wrong

// Recipe details shows:
"recipe_details_likes": 0,    // ❌ Wrong  
"recipe_details_comments": 5  // ✅ Correct
```

---

## 🧪 **Required Backend Testing**

### Test Feed RPC Directly:
```sql
-- Test the feed RPC for specific recipe
SELECT 
  output_id,
  output_name,
  output_likes,
  output_comments_count
FROM get_community_feed_pantry_match_v3('9b84ff89-f9e5-4ddb-9de8-9797d272da59', 50, 0)
WHERE output_id = 'eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01';
```

### Test Recipe Details RPC:
```sql
-- Test recipe details RPC
SELECT 
  recipe_id,
  likes,
  is_liked_by_user,
  comments_count
FROM get_recipe_details('eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01', '9b84ff89-f9e5-4ddb-9de8-9797d272da59');
```

### Verify Database Data:
```sql
-- Check actual likes in database
SELECT COUNT(*) as actual_likes 
FROM recipe_likes 
WHERE recipe_id = 'eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01';

-- Check actual comments in database  
SELECT COUNT(*) as actual_comments
FROM recipe_comments 
WHERE recipe_id = 'eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01';
```

---

## 🎯 **Immediate Action Required**

### Priority 1: Fix Feed RPC Counts
1. **Update `get_community_feed_pantry_match_v3`** to include proper like/comment calculations
2. **Test output** shows non-zero counts for recipes with likes/comments
3. **Verify consistency** with database actual counts

### Priority 2: Fix Recipe Details Like Count
1. **Update `get_recipe_details`** to include proper like calculation
2. **Add `is_liked_by_user`** field for user-specific like status
3. **Test consistency** between feed and recipe details

### Priority 3: Verify Like Button
1. **Test `toggle_recipe_like`** actually creates/removes database entries
2. **Verify like persistence** after toggle operations
3. **Confirm count updates** reflect immediately in both RPCs

---

## 📱 **Current User Impact**

### What Users See:
- ❌ **All recipes show 0 likes** (even popular ones)
- ❌ **All recipes show 0 comments** in feed (even recipes with comments)
- ⚠️ **Comment counts work in recipe details** but not in feed
- ⚠️ **Like button may work** but counts don't update visually
- ⚠️ **Flickering updates** when navigating between screens

### Expected After Fix:
- ✅ **Accurate like counts** in both feed and recipe details
- ✅ **Accurate comment counts** in both screens
- ✅ **Consistent data** across all screens
- ✅ **Immediate updates** when liking/commenting
- ✅ **No cache synchronization issues**

---

## 🔧 **Backend Code References**

### Feed RPC Issues:
The `get_community_feed_pantry_match_v3` function likely has:
```sql
-- Current (broken):
0 as output_likes,  -- Hard-coded 0
0 as output_comments_count  -- Hard-coded 0

-- Should be:
(SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.recipe_id) as output_likes,
(SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.recipe_id) as output_comments_count
```

### Recipe Details Issues:
The `get_recipe_details` function likely missing:
```sql
-- Add these fields:
(SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.recipe_id) as likes,
(SELECT EXISTS(SELECT 1 FROM recipe_likes WHERE recipe_id = r.recipe_id AND user_id = p_user_id)) as is_liked_by_user
```

**The core issue: RPCs are returning hard-coded 0 values instead of calculating actual counts from the database.** 