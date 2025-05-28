# Pantry Match Discrepancy Fix

## Issue Description

The user feed was showing "0% match" while the recipe detail screen was showing "1/5 match" for the same recipe. This discrepancy was caused by different calculation methods and data sources between the two screens.

## Root Cause Analysis

### Feed Screen (useFeed.ts)
- Uses `get_community_feed_pantry_match_v3` RPC
- Calculates: `Math.round((userIngredientsCount / totalIngredientsCount) * 100)`
- Shows percentage (e.g., 20% for 1/5 ingredients)
- Issue: When percentage rounds to 0%, it shows "0% match" even if there are matched ingredients

### Recipe Detail Screen (RecipeDetailScreen.tsx)
- Uses `match_pantry_ingredients` RPC
- Shows exact count: `{matchedCount}/{totalCount} Ingredients in pantry`
- More accurate representation of actual matches

## Fixes Implemented

### 1. Enhanced Feed Display Logic
**File:** `src/components/RecipeCard.tsx`
- Modified pantry match badge to show actual counts when percentage is 0% but there are matched ingredients
- Now displays: "1/5 match" instead of "0% match" when appropriate

```typescript
{item.pantryMatchPct > 0 
  ? `${item.pantryMatchPct}% match`
  : item._userIngredientsCount > 0 
    ? `${item._userIngredientsCount}/${item._totalIngredientsCount} match`
    : '0% match'
}
```

### 2. Enhanced Debugging and Logging
**File:** `src/hooks/useFeed.ts`
- Added detailed logging for pantry match calculations
- Detects and logs discrepancies when userIngredientsCount > 0 but pantryMatchPct = 0

### 3. Feed Cache Invalidation
**Files:** 
- `src/hooks/useFeed.ts` - Added `refreshFeedPantryMatches()` function
- `src/screens/pantry/PantryScanningScreen.tsx` - Calls refresh after scanning
- `src/hooks/useStockManager.ts` - Calls refresh after manual pantry updates

This ensures the feed reflects the latest pantry state immediately after changes.

### 4. Debug Utility
**File:** `src/utils/pantryMatchDebug.ts`
- Created comprehensive debugging utilities
- Functions to compare feed vs recipe detail pantry matching
- Automatic discrepancy detection and logging

### 5. Enhanced Recipe Details Debugging
**File:** `src/hooks/useRecipeDetails.ts`
- Added detailed logging for pantry match calculations
- Helps identify when recipe detail and feed data differ

## Testing Recommendations

1. **Add items to pantry** and verify feed updates immediately
2. **Check recipes with low match percentages** (1-2 ingredients out of 5+)
3. **Verify consistency** between feed display and recipe detail display
4. **Monitor console logs** for discrepancy warnings

## Expected Behavior After Fix

- Feed will show "1/5 match" instead of "0% match" when there's 1 matched ingredient out of 5
- Feed data will refresh immediately after pantry changes
- Console logs will help identify any remaining discrepancies
- Both screens will show consistent information about pantry matches

## Backend Considerations

The discrepancy might also be caused by:
1. Different ingredient parsing logic between the two RPCs
2. Caching issues in the database
3. Different user_id handling between RPCs

If the issue persists, consider:
1. Reviewing the `get_community_feed_pantry_match_v3` RPC implementation
2. Ensuring both RPCs use the same ingredient matching logic
3. Adding database-level debugging to compare results 