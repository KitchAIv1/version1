# 🚨 URGENT: Backend RPC Issues Summary

## Current Status: Multiple RPC Functions Broken

The app is currently experiencing failures due to backend RPC issues. Here's the complete list of problems that need immediate attention:

---

## 🔴 **CRITICAL Issue #1: `get_community_feed_pantry_match_v3` RPC**

### Error:
```
ERROR [useFeed] RPC Error: {"code": "42703", "details": null, "hint": null, "message": "column r.likes does not exist"}
```

### Problem:
- The feed RPC is trying to access `r.likes` column which doesn't exist in the recipes table
- This is breaking the entire feed screen - users cannot see any recipes

### Required Fix:
**Option A**: Add `likes` column to recipes table
```sql
ALTER TABLE recipes ADD COLUMN likes INTEGER DEFAULT 0;
```

**Option B** (Recommended): Calculate likes from `recipe_likes` table
```sql
-- Replace r.likes with:
(SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.recipe_id) as output_likes
```

### Impact: 🔴 **CRITICAL** - Feed screen completely broken

---

## 🟡 **Issue #2: `calculate_pantry_match` RPC Data Format**

### Problem:
- RPC returning ingredient objects instead of string arrays
- Frontend expects string arrays but receives objects
- Causes crashes on recipe detail screens

### Current Return Format (WRONG):
```json
{
  "matched_ingredients": [{"name": "salt"}, {"name": "pepper"}],
  "missing_ingredients": [{"name": "chicken"}, null, undefined]
}
```

### Expected Return Format (CORRECT):
```json
{
  "matched_ingredients": ["salt", "pepper"],
  "missing_ingredients": ["chicken", "onion"]
}
```

### Required Fix:
Update `calculate_pantry_match` RPC to:
1. Return string arrays instead of object arrays
2. Filter out null/undefined values
3. Extract just the ingredient names

### Impact: 🟡 **HIGH** - Recipe detail screens crashing

---

## 🟢 **Issue #3: Missing Like Fields in `get_recipe_details`**

### Problem:
- `get_recipe_details` RPC doesn't return like-related fields
- Causes inconsistent like state between feed and recipe detail screens

### Missing Fields:
```sql
-- Add these to get_recipe_details RPC:
is_liked_by_user BOOLEAN,  -- Whether current user liked this recipe
likes INTEGER              -- Total likes count
```

### Impact: 🟢 **MEDIUM** - Like state inconsistency

---

## 📋 **Frontend Workarounds Implemented**

### For Issue #1 (Feed RPC):
- Added error handling to show user-friendly message
- Added graceful fallbacks for missing fields

### For Issue #2 (Pantry Match):
- Added null/undefined filtering
- Added error boundaries for missing data

### For Issue #3 (Like Fields):
- Using feed data as fallback for like state

---

## 🔧 **Recommended Backend Actions**

### Priority 1 (URGENT):
1. **Fix `get_community_feed_pantry_match_v3`** - Replace `r.likes` with proper likes calculation
2. **Fix `calculate_pantry_match`** - Return string arrays instead of objects

### Priority 2 (High):
3. **Update `get_recipe_details`** - Add like fields for consistency

### Priority 3 (Testing):
4. **Test all RPC functions** - Ensure no other columns are missing
5. **Verify data types** - Ensure all fields return expected data types

---

## 🧪 **Testing Commands**

### Test Feed RPC:
```sql
SELECT * FROM get_community_feed_pantry_match_v3('user-id-here', 10, 0);
```

### Test Pantry Match RPC:
```sql
SELECT * FROM calculate_pantry_match('user-id-here', 'recipe-id-here');
```

### Test Recipe Details RPC:
```sql
SELECT * FROM get_recipe_details('recipe-id-here', 'user-id-here');
```

---

## 📱 **User Impact**

### Current State:
- ❌ Feed screen: **BROKEN** (cannot load any recipes)
- ⚠️ Recipe detail screen: **PARTIALLY BROKEN** (crashes on pantry data)
- ⚠️ Like functionality: **INCONSISTENT** (different states in different screens)

### After Fixes:
- ✅ Feed screen: **WORKING** (all recipes load properly)
- ✅ Recipe detail screen: **WORKING** (pantry data displays correctly)
- ✅ Like functionality: **CONSISTENT** (same state everywhere)

---

## 📞 **Next Steps**

1. **Backend team**: Fix the three RPC issues above
2. **Frontend team**: Test fixes and remove workarounds
3. **QA**: Verify all social features (likes, saves, comments) still work
4. **Monitoring**: Add logging to catch similar issues early

**ETA Needed**: When can these fixes be deployed? 