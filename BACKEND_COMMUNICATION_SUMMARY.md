# 🚨 URGENT: Backend RPC Issue Summary

## The Problem
Users see **"0% match"** in the feed but **"1/5 match"** in recipe details for the same recipe.

## Root Cause Found
**There are DUPLICATE RPC functions with the SAME NAME:**

```sql
-- TWO DIFFERENT FUNCTIONS WITH SAME NAME:
get_community_feed_pantry_match_v3(user_id_param uuid) → TABLE
get_community_feed_pantry_match_v3(user_id_param uuid, p_limit int) → JSON
```

## Frontend Usage
The frontend calls:
```typescript
supabase.rpc('get_community_feed_pantry_match_v3', {
  user_id_param: user.id,
  p_limit: 50
})
```

**Question**: Which function is actually being executed?

## The Discrepancy
- **Feed RPC** returns: `output_user_ingredients_count: 0, output_total_ingredients_count: 5`
- **Recipe Detail RPC** returns: `matched_ingredients: ["parmesan cheese"], missing_ingredients: [4 items]`
- **Result**: Feed shows 0% match, Recipe Detail shows 1/5 match

## Immediate Actions Needed

### 1. Investigate Duplicate Functions
```sql
SELECT proname, pronargs, proargtypes, prosrc 
FROM pg_proc 
WHERE proname LIKE '%get_community_feed_pantry_match%';
```

### 2. Test Data Consistency
```sql
-- Test with same user/recipe
SELECT * FROM get_community_feed_pantry_match_v3('user-id', 10);
SELECT * FROM match_pantry_ingredients('recipe-id', 'user-id');
```

### 3. Determine Source of Truth
- Should we use v3 or v4?
- Should we consolidate duplicate functions?
- Which pantry matching logic is correct?

## All Feed RPC Functions Found
```
get_community_feed_pantry_match_v3 (2 versions!)
get_community_feed_pantry_match_v4
get_community_feed_with_pantry_match
getcommunityfeed (legacy)
```

## Priority
🔴 **CRITICAL** - This affects core user experience and recipe discovery.

---

**Full technical details in**: `RPC_AUDIT_PANTRY_MATCH.md` 