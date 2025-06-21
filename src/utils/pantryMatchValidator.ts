/**
 * Pantry Match Data Validator
 * 
 * Purpose: Validate pantry match data structures and catch discrepancies early
 * Used by: useFeed.ts, useRecipeDetails.ts
 * 
 * This validator helps maintain stability across our dual pantry data architecture
 */

export interface PantryValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  normalizedData?: any;
}

/**
 * Validates unified pantry match format (used by feed)
 */
export const validateUnifiedPantryMatch = (
  data: any,
  recipeId: string,
  source: string = 'unknown'
): PantryValidationResult => {
  const result: PantryValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  if (!data) {
    result.warnings.push(`[${source}] No pantry data provided for recipe ${recipeId}`);
    result.normalizedData = {
      pantry_match: {
        match_percentage: 0,
        matched_ingredients: [],
        missing_ingredients: [],
      }
    };
    return result;
  }

  // Check for unified structure
  if (data.pantry_match) {
    const pantryMatch = data.pantry_match;
    
    // Validate match_percentage
    if (typeof pantryMatch.match_percentage !== 'number') {
      result.warnings.push(`[${source}] Invalid match_percentage type for recipe ${recipeId}: ${typeof pantryMatch.match_percentage}`);
    } else if (pantryMatch.match_percentage < 0 || pantryMatch.match_percentage > 100) {
      result.warnings.push(`[${source}] Match percentage out of range for recipe ${recipeId}: ${pantryMatch.match_percentage}%`);
    }

    // Validate matched_ingredients
    if (!Array.isArray(pantryMatch.matched_ingredients)) {
      result.errors.push(`[${source}] matched_ingredients is not an array for recipe ${recipeId}`);
      result.isValid = false;
    } else {
      // Check for non-string items
      const invalidItems = pantryMatch.matched_ingredients.filter((item: any) => typeof item !== 'string');
      if (invalidItems.length > 0) {
        result.warnings.push(`[${source}] Non-string items in matched_ingredients for recipe ${recipeId}: ${invalidItems.length} items`);
      }
    }

    // Validate missing_ingredients
    if (!Array.isArray(pantryMatch.missing_ingredients)) {
      result.errors.push(`[${source}] missing_ingredients is not an array for recipe ${recipeId}`);
      result.isValid = false;
    } else {
      // Check for non-string items
      const invalidItems = pantryMatch.missing_ingredients.filter((item: any) => typeof item !== 'string');
      if (invalidItems.length > 0) {
        result.warnings.push(`[${source}] Non-string items in missing_ingredients for recipe ${recipeId}: ${invalidItems.length} items`);
      }
    }

    result.normalizedData = data;
  } else {
    result.warnings.push(`[${source}] No pantry_match object found for recipe ${recipeId}, using fallback`);
    result.normalizedData = {
      ...data,
      pantry_match: {
        match_percentage: 0,
        matched_ingredients: [],
        missing_ingredients: [],
      }
    };
  }

  return result;
};

/**
 * Validates legacy pantry match format (used by recipe details)
 */
export const validateLegacyPantryMatch = (
  data: any,
  recipeId: string,
  source: string = 'unknown'
): PantryValidationResult => {
  const result: PantryValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  if (!data) {
    result.warnings.push(`[${source}] No pantry data provided for recipe ${recipeId}`);
    result.normalizedData = {
      matched_ingredients: [],
      missing_ingredients: [],
      missing_ingredient_names: [],
    };
    return result;
  }

  // Validate matched_ingredients
  if (!Array.isArray(data.matched_ingredients)) {
    result.errors.push(`[${source}] matched_ingredients is not an array for recipe ${recipeId}`);
    result.isValid = false;
  } else {
    // Check for object vs string format issues
    const objectItems = data.matched_ingredients.filter((item: any) => typeof item === 'object');
    if (objectItems.length > 0) {
      result.warnings.push(`[${source}] Object items found in matched_ingredients for recipe ${recipeId} (expected strings)`);
      // Normalize by extracting name field
      const normalizedMatched = data.matched_ingredients.map((item: any) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object' && item.name) return item.name.trim();
        return '';
      }).filter((name: string) => name.length > 0);
      
      result.normalizedData = {
        ...data,
        matched_ingredients: normalizedMatched,
      };
    }
  }

  // Validate missing_ingredients
  if (!Array.isArray(data.missing_ingredients)) {
    result.errors.push(`[${source}] missing_ingredients is not an array for recipe ${recipeId}`);
    result.isValid = false;
  } else {
    // Check for object vs string format issues
    const objectItems = data.missing_ingredients.filter((item: any) => typeof item === 'object');
    if (objectItems.length > 0) {
      result.warnings.push(`[${source}] Object items found in missing_ingredients for recipe ${recipeId} (expected strings)`);
      // Normalize by extracting name field
      const normalizedMissing = data.missing_ingredients.map((item: any) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object' && item.name) return item.name.trim();
        return '';
      }).filter((name: string) => name.length > 0);
      
      if (!result.normalizedData) result.normalizedData = { ...data };
      result.normalizedData.missing_ingredients = normalizedMissing;
      result.normalizedData.missing_ingredient_names = normalizedMissing; // Maintain backward compatibility
    }
  }

  if (!result.normalizedData) {
    result.normalizedData = data;
  }

  return result;
};

/**
 * Compares pantry data between feed and recipe details for discrepancy detection
 */
export const comparePantryData = (
  feedData: any,
  recipeData: any,
  recipeId: string
): PantryValidationResult => {
  const result: PantryValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  if (!feedData || !recipeData) {
    result.warnings.push(`[PantryComparison] Missing data for recipe ${recipeId}`);
    return result;
  }

  // Extract comparable data
  const feedPercentage = feedData.pantry_match?.match_percentage || 0;
  const feedMatchedCount = feedData.pantry_match?.matched_ingredients?.length || 0;
  const feedMissingCount = feedData.pantry_match?.missing_ingredients?.length || 0;

  const recipeMatchedCount = recipeData.matched_ingredients?.length || 0;
  const recipeMissingCount = recipeData.missing_ingredients?.length || 0;
  const recipeTotalCount = recipeMatchedCount + recipeMissingCount;
  const recipePercentage = recipeTotalCount > 0 ? Math.round((recipeMatchedCount / recipeTotalCount) * 100) : 0;

  // Compare percentages
  const percentageDiff = Math.abs(feedPercentage - recipePercentage);
  if (percentageDiff > 5) { // Allow 5% tolerance for rounding
    result.warnings.push(
      `[PantryComparison] Significant percentage difference for recipe ${recipeId}: ` +
      `feed=${feedPercentage}%, recipe=${recipePercentage}% (diff=${percentageDiff}%)`
    );
  }

  // Compare counts
  if (feedMatchedCount !== recipeMatchedCount) {
    result.warnings.push(
      `[PantryComparison] Matched count mismatch for recipe ${recipeId}: ` +
      `feed=${feedMatchedCount}, recipe=${recipeMatchedCount}`
    );
  }

  if (feedMissingCount !== recipeMissingCount) {
    result.warnings.push(
      `[PantryComparison] Missing count mismatch for recipe ${recipeId}: ` +
      `feed=${feedMissingCount}, recipe=${recipeMissingCount}`
    );
  }

  // Special case: Feed shows 0% but recipe shows matches
  if (feedPercentage === 0 && recipeMatchedCount > 0) {
    result.warnings.push(
      `[PantryComparison] CRITICAL: Feed shows 0% but recipe has ${recipeMatchedCount} matches for recipe ${recipeId}`
    );
  }

  return result;
};

/**
 * Helper function to log validation results consistently
 */
export const logValidationResult = (result: PantryValidationResult, context: string = '') => {
  if (result.errors.length > 0) {
    console.error(`[PantryValidator${context}] Validation errors:`, result.errors);
  }
  
  if (result.warnings.length > 0) {
    console.warn(`[PantryValidator${context}] Validation warnings:`, result.warnings);
  }
  
  if (result.isValid && result.warnings.length === 0) {
    console.log(`[PantryValidator${context}] ✅ Validation passed`);
  }
};

/**
 * Quick validator for feed data transformation
 */
export const validateFeedPantryData = (item: any, index: number) => {
  const recipeId = item.output_id || `unknown-${index}`;
  const result = validateUnifiedPantryMatch(item, recipeId, 'useFeed');
  
  if (!result.isValid || result.warnings.length > 0) {
    logValidationResult(result, ` Feed Item ${index}`);
  }
  
  return result.normalizedData || item;
};

/**
 * Quick validator for recipe details data
 */
export const validateRecipeDetailsPantryData = (data: any, recipeId: string) => {
  const result = validateLegacyPantryMatch(data, recipeId, 'useRecipeDetails');
  
  if (!result.isValid || result.warnings.length > 0) {
    logValidationResult(result, ` Recipe Details`);
  }
  
  return result.normalizedData || data;
}; 