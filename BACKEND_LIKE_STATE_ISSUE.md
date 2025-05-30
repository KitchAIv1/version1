# 🚨 URGENT: Like State Inconsistency Issue

## Current Status: Like Counts Work, Like States Don't

The `toggle_recipe_like` RPC is working correctly and updating like counts, but the boolean like state fields are not being returned properly, causing UX issues.

---

## 🔴 **Core Issue: Missing Like State Fields**

### What's Working:
- ✅ `toggle_recipe_like` RPC executes without errors
- ✅ Like counts increase in database  
- ✅ Like counts display in recipe details

### What's Broken:
- ❌ **`output_is_liked` in feed** - not reflecting user's like status
- ❌ **`is_liked_by_user` in recipe details** - not reflecting user's like status
- ❌ **State persistence** - like button doesn't stay "pressed" after liking

### Current Behavior:
```javascript
// User likes recipe → count increases but state doesn't update
// Recipe shows: likes: 1, is_liked_by_user: false ❌ (should be true)
// Feed shows: likes: 1, liked: false ❌ (should be true)
// User can like same recipe multiple times because it doesn't show as liked
```

---

## 🧪 **Required Backend Investigation**

### Test Like State in Feed RPC:
```sql
-- Test feed RPC after user likes a recipe
SELECT 
  output_id,
  output_name,
  output_likes,
  output_is_liked  -- ← This field probably returning false always
FROM get_community_feed_pantry_match_v3('9b84ff89-f9e5-4ddb-9de8-9797d272da59', 50, 0)
WHERE output_id = 'test-recipe-id';
```

### Test Like State in Recipe Details RPC:
```sql
-- Test recipe details RPC after user likes a recipe  
SELECT 
  recipe_id,
  likes,
  is_liked_by_user  -- ← This field probably returning false always
FROM get_recipe_details('test-recipe-id', '9b84ff89-f9e5-4ddb-9de8-9797d272da59');
```

### Verify Database State:
```sql
-- Check if like was actually saved
SELECT * FROM recipe_likes 
WHERE recipe_id = 'test-recipe-id' AND user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59';
```

---

## 🔧 **Required Fixes**

### Fix 1: Feed RPC Like State
Update `get_community_feed_pantry_match_v3` to include:
```sql
-- Add proper like state calculation:
(SELECT EXISTS(
  SELECT 1 FROM recipe_likes 
  WHERE recipe_id = r.recipe_id AND user_id = user_id_param
)) as output_is_liked
```

### Fix 2: Recipe Details RPC Like State  
Update `get_recipe_details` to include:
```sql
-- Add proper like state calculation:
(SELECT EXISTS(
  SELECT 1 FROM recipe_likes 
  WHERE recipe_id = r.recipe_id AND user_id = p_user_id
)) as is_liked_by_user
```

### Fix 3: Verify Toggle Function
Ensure `toggle_recipe_like` properly:
1. **Adds like** when user hasn't liked recipe
2. **Removes like** when user has already liked recipe  
3. **Returns updated state** in response

---

## 📱 **Expected User Experience After Fix**

### Current (Broken) Flow:
1. User clicks like → count increases
2. Like button still appears "unliked" 
3. User can click again → count increases again
4. Double-liking possible

### Expected (Fixed) Flow:
1. User clicks like → count increases  
2. Like button appears "liked" (pressed state)
3. User clicks again → count decreases
4. Like button appears "unliked"
5. Proper toggle behavior

---

## 🎯 **Test Scenario**

### Step-by-Step Test:
1. **User starts unlikes** - `output_is_liked: false`, `likes: 0`
2. **User clicks like** - should become `output_is_liked: true`, `likes: 1`  
3. **User navigates away and back** - should still show `output_is_liked: true`
4. **User clicks like again** - should become `output_is_liked: false`, `likes: 0`

### Expected RPC Responses:
```sql
-- After first like:
output_likes: 1, output_is_liked: true

-- After unlike: 
output_likes: 0, output_is_liked: false
```

---

## 🚨 **Priority: HIGH**

This issue prevents proper like functionality and allows users to like the same recipe multiple times, which could skew analytics and create poor user experience.

**The core issue: Like counts are calculated correctly, but like state booleans are not being returned properly from the RPCs.** 