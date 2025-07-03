# Pantry Data Architecture Documentation

## 📋 **Overview**

This document outlines the current pantry match data architecture across the KitchAI app. We maintain **dual data structures** for historical and compatibility reasons.

**Status**: ✅ **STABLE** - Do not modify without extreme caution  
**Last Updated**: June 2025  
**Maintainer**: Development Team

---

## 🏗️ **Current Architecture**

### **Dual Structure Design**
We intentionally maintain two pantry data formats:
1. **Legacy Format** - Used by recipe details and components
2. **Unified Format** - Used by feed and newer components

This dual approach ensures stability while allowing gradual modernization.

---

## 📊 **Data Structures**

### **1. Legacy Pantry Format (Recipe Details)**
```typescript
interface LegacyPantryData {
  matched_ingredients: string[];           // Array of ingredient names
  missing_ingredients: string[];           // Array of missing ingredient names  
  missing_ingredient_names: string[];      // Alias for missing_ingredients
  // Percentage calculated on frontend
}
```

**Used by:**
- `useRecipeDetails.ts`
- `IngredientsTab.tsx`
- `RecipeDetailScreen.tsx`

**RPC Sources:**
- `calculate_pantry_match`
- `match_pantry_ingredients` (fallback)

### **2. Unified Pantry Format (Feed)**
```typescript
interface UnifiedPantryData {
  pantry_match?: {
    match_percentage: number;              // Pre-calculated percentage
    matched_ingredients: string[];         // Array of ingredient names
    missing_ingredients: string[];         // Array of missing ingredient names
  };
}
```

**Used by:**
- `useFeed.ts`
- `RecipeCard.tsx`
- `FeedScreen.tsx`

**RPC Sources:**
- `get_community_feed_pantry_match_v3`

---

## 🔄 **Data Flow Mapping**

### **Feed Screen Flow**
```
get_community_feed_pantry_match_v3 RPC
↓
useFeed.ts (transforms RawFeedItem → FeedItem)
↓
RecipeCard.tsx (displays pantry_match.match_percentage)
↓
User sees "X% match"
```

### **Recipe Detail Flow**
```
calculate_pantry_match RPC
↓
useRecipeDetails.ts (cleans object/string format issues)
↓
IngredientsTab.tsx (uses matched_ingredients, missing_ingredients arrays)
↓
User sees "X/Y ingredients in pantry"
```

---

## ⚠️ **Known Discrepancies & Handling**

### **1. Percentage Calculation Differences**
**Issue**: Feed shows "0% match" while recipe details show "1/5 match"  
**Cause**: Different calculation timing and rounding  
**Solution**: ✅ **AUTO-RESOLVED** - Reverse sync mechanism fixes discrepancies

### **2. Data Format Inconsistencies**
**Issue**: Some RPCs return objects, others return strings  
**Cause**: Backend evolution and multiple RPC versions  
**Solution**: ✅ **HANDLED** - `cleanPantryMatchData()` function normalizes formats

### **3. Field Name Variations**
**Issue**: Different components expect different field names  
**Cause**: Historical development and gradual migration  
**Solution**: ✅ **DOCUMENTED** - Backward compatibility maintained

---

## 🛡️ **Validation & Monitoring**

### **Data Validation Functions**

#### **1. Pantry Match Validator**
```typescript
// Location: src/utils/pantryMatchValidator.ts
export const validatePantryMatch = (data: any, source: string) => {
  // Validates data structure and logs discrepancies
  // Used in both feed and recipe details hooks
};
```

#### **2. Discrepancy Detector**
```typescript
// Location: src/utils/pantryMatchDebug.ts
export const comparePantryMatches = (feedData, recipeData) => {
  // Compares feed vs recipe detail pantry data
  // Logs warnings for investigation
};
```

### **Monitoring Logs**
- ✅ `[cleanPantryMatchData]` - Data cleaning operations
- ✅ `[useFeed] Pantry match discrepancy` - Feed-level issues
- ✅ `[fetchRecipeDetails] Pantry match data` - Recipe detail data
- ✅ `[PantryMatchDebug]` - Cross-screen comparisons

---

## 🧪 **Testing Strategy**

### **Manual Testing Checklist**
- [ ] Feed shows correct pantry percentages
- [ ] Recipe details show correct ingredient counts
- [ ] Discrepancies resolve automatically via sync
- [ ] Empty pantry state handled gracefully
- [ ] Backend RPC failures handled gracefully

### **Test Scenarios**
1. **User with no pantry items** - Should show 0% across all screens
2. **User with partial matches** - Should show consistent percentages
3. **User updates pantry** - Should refresh across all screens
4. **Backend RPC failures** - Should fallback gracefully

---

## 🚫 **DO NOT MODIFY WITHOUT**

### **Required Before Any Changes:**
1. **Full RPC audit** - Test all pantry-related RPCs with real data
2. **Component mapping** - Document every component using pantry data
3. **Backward compatibility plan** - Ensure no breaking changes
4. **Gradual rollout strategy** - Phase changes over multiple releases

### **High-Risk Areas:**
- ⚠️ `useRecipeDetails.ts` - Core recipe data logic
- ⚠️ `useFeed.ts` - Core feed data logic  
- ⚠️ `IngredientsTab.tsx` - Direct array manipulation
- ⚠️ Any TypeScript interface changes

---

## 🔧 **Maintenance Guidelines**

### **When Adding New Pantry Features:**
1. **Use unified format** for new components
2. **Maintain backward compatibility** for existing components
3. **Add validation** for new data sources
4. **Update this documentation**

### **When Debugging Pantry Issues:**
1. **Check logs** for validation warnings
2. **Compare feed vs recipe detail data** using debug utils
3. **Verify RPC responses** match expected format
4. **Test with different user pantry states**

---

## 📈 **Future Considerations**

### **Potential Improvements (Low Priority):**
- Unify data structures (requires major planning)
- Optimize RPC calls to reduce redundancy
- Add real-time pantry sync across tabs
- Improve percentage calculation accuracy

### **Migration Path (If Needed):**
1. Phase 1: Ensure all RPCs return consistent structure
2. Phase 2: Add unified interface alongside legacy
3. Phase 3: Migrate components one by one
4. Phase 4: Remove legacy interfaces

**Note**: Only pursue migration if current system causes major user issues.

---

## 📞 **Support & Contact**

**For Pantry Data Issues:**
- Check logs with tags: `[cleanPantryMatchData]`, `[PantryMatchDebug]`
- Review `src/utils/pantryMatchDebug.ts` for debugging tools
- Test with `src/utils/pantryMatchValidator.ts` for validation

**For Architecture Questions:**
- Review this document first
- Check component data flow diagrams above
- Validate against current RPC responses

---

*This document reflects the current stable architecture. The dual-structure approach is intentional and should be maintained for stability.* 