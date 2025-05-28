# 🔍 RPC AUDIT: Pantry Match Discrepancy Analysis

## 📋 Executive Summary

**Issue**: Two different RPC functions are being used for pantry matching, causing discrepancies between Feed Screen and Recipe Detail Screen.

**Impact**: Users see "0% match" in feed but "1/5 match" in recipe details for the same recipe.

**Root Cause**: Different RPC functions with different data structures and calculation methods.

## 🚨 CRITICAL FINDING: DUPLICATE RPC FUNCTIONS DETECTED

**From RPC Reference.md analysis, there are MULTIPLE RPC functions with the SAME NAME:**

```
get_community_feed_pantry_match_v3	user_id_param uuid	TABLE	Feed - v3 (10 rows)
get_community_feed_pantry_match_v3	user_id_param uuid, p_limit int	json	Feed v3 (JSON, variable limit)
```

**This is the root cause!** The frontend is calling `get_community_feed_pantry_match_v3` with parameters `{user_id_param, p_limit}`, but there are TWO different functions:
1. One that returns a TABLE (limited to 10 rows)
2. One that returns JSON (with variable limit)

**The backend team needs to determine which function is actually being called and why they have different implementations.**

### 📋 Complete RPC Function Inventory

**From RPC Reference.md, here are ALL the feed-related RPC functions:**

```
get_community_feed_pantry_match_v3	user_id_param uuid	TABLE	Feed - v3 (10 rows)
get_community_feed_pantry_match_v3	user_id_param uuid, p_limit int	json	Feed v3 (JSON, variable limit)
get_community_feed_pantry_match_v4	user_id_param uuid, p_limit int	json	Feed v4 (JSON, revised joins)
get_community_feed_with_pantry_match	user_id_param uuid, limit_param int, category_filter text = NULL	TABLE	Feed w/ diet filter
getcommunityfeed	p_user_id uuid	TABLE	Legacy simple feed
```

**Questions for Backend:**
1. Why are there 5 different feed RPC functions?
2. Which one should the frontend be using?
3. What's the difference between v3 and v4?
4. Are the older functions deprecated?

---

## 🎯 RPC Functions Identified

### 1. `get_community_feed_pantry_match_v3` (Feed Screen)
**Location**: `src/hooks/useFeed.ts:62`
**Usage**: Main feed data with pantry matching

#### Call Signature:
```typescript
supabase.rpc('get_community_feed_pantry_match_v3', {
  user_id_param: user.id,
  p_limit: 50
})
```

#### Expected Return Structure:
```typescript
interface RawFeedItem {
  output_id: string;
  output_user_id: string;
  output_name: string;
  output_video_url: string;
  output_description: string;
  output_likes: number;
  output_comments: any;
  output_created_at: string;
  output_dietary_category_ids: string[];
  user_name: string;
  output_is_liked: boolean;
  output_is_saved: boolean;
  output_user_ingredients_count: number;    // 🔑 KEY FIELD
  output_total_ingredients_count: number;   // 🔑 KEY FIELD
  output_feed_type: string;
  output_comments_count: number;
  out_creator_avatar_url: string;
}
```

#### Frontend Calculation:
```typescript
const pantryMatchPct = totalIngredientsCount > 0 
  ? Math.round((userIngredientsCount / totalIngredientsCount) * 100)
  : 0;
```

---

### 2. `match_pantry_ingredients` (Recipe Detail Screen)
**Location**: `src/hooks/useRecipeDetails.ts:135`
**Usage**: Detailed pantry matching for individual recipes

#### Call Signature:
```typescript
supabase.rpc('match_pantry_ingredients', {
  p_recipe_id: recipeId,
  p_user_id: userId
})
```

#### Expected Return Structure:
```typescript
interface PantryMatchResult {
  matched_ingredients: string[];      // 🔑 Array of matched ingredient names
  unmatched_ingredients: string[];    // 🔑 Array of missing ingredient names
  // OR
  missing_ingredients: string[];      // 🔑 Alternative field name
}
```

#### Frontend Calculation:
```typescript
const matchedIngredients = pantryData?.matched_ingredients || [];
const missingIngredients = pantryData?.missing_ingredients || [];
const totalIngredients = matchedIngredients.length + missingIngredients.length;
const actualPantryMatchPct = totalIngredients > 0 
  ? Math.round((matchedIngredients.length / totalIngredients) * 100)
  : 0;
```

---

## 🚨 Identified Discrepancies

### 1. **Data Structure Differences**
| Field | Feed RPC | Recipe Detail RPC |
|-------|----------|-------------------|
| Matched Count | `output_user_ingredients_count` (number) | `matched_ingredients.length` (array length) |
| Total Count | `output_total_ingredients_count` (number) | `matched_ingredients.length + missing_ingredients.length` |
| Data Type | Pre-calculated numbers | Arrays requiring calculation |

### 2. **Calculation Method Differences**
- **Feed**: Uses pre-calculated counts from database
- **Recipe Detail**: Calculates from ingredient arrays

### 3. **Potential Issues**
1. **Stale Data**: Feed RPC may return cached/stale pantry match data
2. **Different Logic**: Two RPC functions may use different ingredient matching algorithms
3. **Rounding Issues**: 1/5 = 20%, but if feed shows 0 matched out of 5, it displays 0%
4. **🔥 DUPLICATE FUNCTIONS**: Multiple RPC functions with same name but different signatures

---

## 📊 Real-World Example from Logs

### Feed Data (get_community_feed_pantry_match_v3):
```
Recipe: "Chicken Caesar Salad"
output_user_ingredients_count: 0
output_total_ingredients_count: 5
Calculated: 0/5 = 0% match
```

### Recipe Detail Data (match_pantry_ingredients):
```
Recipe: "Chicken Caesar Salad"
matched_ingredients: ["parmesan cheese"]
missing_ingredients: ["chicken breast", "romaine lettuce", "croutons", "caesar dressing"]
Calculated: 1/5 = 20% match
```

**Result**: Feed shows "0% match", Recipe Detail shows "1/5 match"

---

## 🔧 Backend Investigation Required

### Questions for Backend Team:

1. **🔥 CRITICAL: Are there actually TWO different RPC functions with the same name?**
   - `get_community_feed_pantry_match_v3(user_id_param uuid)` → TABLE
   - `get_community_feed_pantry_match_v3(user_id_param uuid, p_limit int)` → JSON
   - **Which one is the frontend actually calling?**
   - **Why do they have different implementations?**

2. **Data Freshness**:
   - Does `get_community_feed_pantry_match_v3` use cached pantry match data?
   - Does `match_pantry_ingredients` calculate in real-time?

3. **Ingredient Matching Logic**:
   - Do both RPCs use the same ingredient normalization/matching algorithm?
   - Are there differences in how ingredient names are processed?

4. **User Context**:
   - Do both RPCs properly handle the same user_id parameter?
   - Are there any RLS (Row Level Security) differences?

---

## 📋 Recommended Backend Actions

### 1. **Immediate Investigation**
```sql
-- Check for duplicate RPC function names
SELECT 
  proname, 
  pronargs, 
  proargtypes, 
  prosrc 
FROM pg_proc 
WHERE proname LIKE '%get_community_feed_pantry_match%';

-- Check for duplicate match_pantry_ingredients
SELECT 
  proname, 
  pronargs, 
  proargtypes, 
  prosrc 
FROM pg_proc 
WHERE proname = 'match_pantry_ingredients';
```

### 2. **Data Consistency Check**
```sql
-- Test both RPCs with same parameters
SELECT 'feed_rpc' as source, * FROM get_community_feed_pantry_match_v3('user-id-here', 10);

SELECT 'match_rpc' as source, * FROM match_pantry_ingredients('recipe-id-here', 'user-id-here');
```

### 3. **Recommended Solution**
- **Option A**: Update `get_community_feed_pantry_match_v3` to use real-time pantry matching
- **Option B**: Deprecate one RPC and standardize on a single pantry matching function
- **Option C**: Ensure both RPCs use identical ingredient matching logic
- **🔥 Option D**: Remove duplicate RPC functions and consolidate into one consistent implementation

---

## 🎯 Frontend Workaround (Current)

The frontend currently implements a display fix:
```typescript
// Show actual counts when percentage is 0 but ingredients are matched
{item.pantryMatchPct > 0 
  ? `${item.pantryMatchPct}% match`
  : (item._userIngredientsCount || 0) > 0 
    ? `${item._userIngredientsCount}/${item._totalIngredientsCount} match`
    : '0% match'
}
```

---

## 📞 Next Steps

1. **🔥 Backend Team**: Investigate duplicate RPC functions with same name
2. **Backend Team**: Compare ingredient matching logic between RPCs
3. **Backend Team**: Determine which RPC should be the "source of truth"
4. **Backend Team**: Consolidate duplicate functions
5. **Frontend Team**: Implement unified pantry matching once backend is standardized

---

## 📝 Test Cases for Backend

### Test Recipe: "Chicken Caesar Salad"
- **Ingredients**: chicken breast, romaine lettuce, parmesan cheese, croutons, caesar dressing
- **User Pantry**: parmesan cheese
- **Expected Result**: 1/5 match (20%)

### Test Scenarios:
1. User with empty pantry → Both RPCs should return 0/X match
2. User with all ingredients → Both RPCs should return X/X match (100%)
3. User with partial ingredients → Both RPCs should return same matched count
4. User adds/removes pantry item → Both RPCs should reflect change immediately

---

**Priority**: 🔴 **CRITICAL** - This affects core user experience and recipe discovery functionality.

---

## 🛡️ SAFETY ASSURANCE: Social Features Protected

### ✅ **CONFIRMED SAFE** - Our recommendations will NOT affect:

- **Likes System**: Uses separate `toggle_like_recipe` RPC and `recipe_likes` table
- **Saves System**: Uses separate `save_recipe_video` RPC and `saved_recipes` table  
- **Comments System**: Uses separate comment insertion and `recipe_comments` table
- **User Authentication**: Completely separate from pantry logic
- **Feed Ordering/Pagination**: Not related to pantry matching

### 🎯 **What Changes**: Only pantry match accuracy
- **Before**: Feed shows "0% match", Recipe Detail shows "1/5 match"
- **After**: Both screens show consistent "1/5 match" or "20% match"

### 🔒 **What Stays the Same**: Everything else
- Like counts and like status
- Save status  
- Comment counts
- Recipe metadata (title, description, video, etc.)
- User profiles and avatars
- Feed loading and scrolling

**See `SAFETY_AUDIT_SOCIAL_FEATURES.md` for detailed analysis.** 