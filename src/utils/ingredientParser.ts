/**
 * Safe Ingredient Parser Utility for KitchAI Recipe Edit Screen
 * This utility safely parses ingredient data without affecting other components
 */

export interface ParsedIngredient {
  quantity: string;
  unit: string;
  ingredient: string;
  original?: string; // Keep original for fallback
}

/**
 * Safely parse a single ingredient string
 * Returns original data if parsing fails
 */
export const parseIngredientString = (ingredientString: string): ParsedIngredient => {
  const fallback: ParsedIngredient = {
    quantity: '',
    unit: '',
    ingredient: ingredientString || '',
    original: ingredientString
  };

  if (!ingredientString || typeof ingredientString !== 'string') {
    return fallback;
  }

  try {
    const trimmed = ingredientString.trim();

    // Enhanced patterns to match the formats in the screenshot
    const patterns = [
      // "8 oz Spaghetti" -> quantity: 8, unit: oz, ingredient: Spaghetti
      /^(\d+(?:\.\d+)?)\s+(oz|lb|lbs|g|kg|ml|l|cups?|cup|tbsp|tsp|tablespoons?|teaspoons?|tablespoon|teaspoon)\s+(.+)$/i,
      
      // "1/4 cup Olive oil" -> quantity: 1/4, unit: cup, ingredient: Olive oil
      /^(\d+\/\d+)\s+(oz|lb|lbs|g|kg|ml|l|cups?|cup|tbsp|tsp|tablespoons?|teaspoons?|tablespoon|teaspoon)\s+(.+)$/i,
      
      // "2 1/2 cups flour" -> quantity: 2 1/2, unit: cups, ingredient: flour
      /^(\d+\s+\d+\/\d+)\s+(oz|lb|lbs|g|kg|ml|l|cups?|cup|tbsp|tsp|tablespoons?|teaspoons?|tablespoon|teaspoon)\s+(.+)$/i,
      
      // "1/2 tsp Salt" -> quantity: 1/2, unit: tsp, ingredient: Salt
      /^(\d+\/\d+)\s+(tsp|tbsp|tablespoons?|teaspoons?|tablespoon|teaspoon)\s+(.+)$/i,
      
      // "4 cloves Garlic" -> quantity: 4, unit: cloves, ingredient: Garlic
      /^(\d+(?:\.\d+)?)\s+(cloves?|pieces?|slices?|whole|chopped|diced|minced)\s+(.+)$/i,
      
      // "1 large egg" -> quantity: 1, unit: large, ingredient: egg  
      /^(\d+)\s+(large|medium|small|whole|chopped|diced|minced|fresh|dried)\s+(.+)$/i,
      
      // NEW: "4 Chicken thighs" -> quantity: 4, unit: "", ingredient: Chicken thighs (for count-based ingredients)
      /^(\d+(?:\.\d+)?)\s+(chicken|beef|pork|fish|salmon|turkey|duck|lamb|shrimp|scallops?|mussels?|clams?|oysters?)\s+(.+)$/i,
      
      // NEW: "2 apples" -> quantity: 2, unit: "", ingredient: apples (for whole foods by count)
      /^(\d+(?:\.\d+)?)\s+(apples?|oranges?|bananas?|lemons?|limes?|tomatoes?|onions?|potatoes?|carrots?|eggs?|avocados?)\s*$/i,
      
      // Generic number + unit pattern (MOVED AFTER SPECIFIC PATTERNS)
      /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s+([a-zA-Z]+)\s+(.+)$/,
      
      // Just number + ingredient (no unit)
      /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s+(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // Special handling for count-based ingredients (chicken, beef, etc.)
        if (pattern.source.includes('chicken|beef|pork|fish') || pattern.source.includes('apples?|oranges?|bananas?')) {
          if (match.length >= 3) {
            const result = {
              quantity: match[1].trim(),
              unit: '', // Empty unit for count-based ingredients
              ingredient: `${match[2]} ${match[3] || ''}`.trim(), // Combine the meat/food type with description
              original: ingredientString
            };
            return result;
          }
        }
        
        // For patterns with 4 groups (quantity, unit, ingredient)
        if (match.length >= 4) {
          const result = {
            quantity: match[1].trim(),
            unit: match[2].trim(),
            ingredient: match[3].trim(),
            original: ingredientString
          };
          return result;
        }
        
        // For patterns with 3 groups (quantity, ingredient - no unit)
        if (match.length === 3) {
          const result = {
            quantity: match[1].trim(),
            unit: '',
            ingredient: match[2].trim(),
            original: ingredientString
          };
          return result;
        }
      }
    }

    return fallback;
  } catch (error) {
    console.warn('[IngredientParser] Error parsing ingredient:', ingredientString, error);
    return fallback;
  }
};

/**
 * Safely parse ingredient data from various formats
 * Handles backward compatibility with existing data structures
 */
export const parseIngredientsData = (rawIngredients: any): ParsedIngredient[] => {
  if (!rawIngredients) {
    return [];
  }

  try {
    // Handle array format
    if (Array.isArray(rawIngredients)) {
      const results = rawIngredients.map((ingredient, index) => {
        try {
          // Handle object format (already structured)
          if (typeof ingredient === 'object' && ingredient !== null) {
            // NEW: Check if it has a 'name' field with the full ingredient string (EditRecipe format)
            if (ingredient.name && typeof ingredient.name === 'string' && ingredient.name.trim()) {
              // Parse the name field which contains the full ingredient string
              const parsed = parseIngredientString(ingredient.name);
              return parsed;
            }
            
            // Check if it's already in the correct format
            if (ingredient.quantity !== undefined || ingredient.unit !== undefined || ingredient.ingredient !== undefined) {
              return {
                quantity: String(ingredient.quantity || ''),
                unit: String(ingredient.unit || ''),
                ingredient: String(ingredient.ingredient || ingredient.name || ''),
                original: JSON.stringify(ingredient)
              };
            }
            
            // If it's an object but not in our format, convert to string and parse
            const stringified = JSON.stringify(ingredient);
            return parseIngredientString(stringified);
          }
          
          // Handle string format (needs parsing)
          if (typeof ingredient === 'string') {
            return parseIngredientString(ingredient);
          }

          // Handle unexpected format
          return {
            quantity: '',
            unit: '',
            ingredient: String(ingredient || ''),
            original: String(ingredient)
          };
        } catch (error) {
          console.warn(`[IngredientParser] Error parsing ingredient at index ${index}:`, ingredient, error);
          return {
            quantity: '',
            unit: '',
            ingredient: String(ingredient || ''),
            original: String(ingredient)
          };
        }
      });
      
      return results;
    }

    // Handle single ingredient (convert to array)
    if (typeof rawIngredients === 'string') {
      return [parseIngredientString(rawIngredients)];
    }

    // Handle object format (single ingredient)
    if (typeof rawIngredients === 'object') {
      // NEW: Check for 'name' field format
      if (rawIngredients.name && typeof rawIngredients.name === 'string' && rawIngredients.name.trim()) {
        return [parseIngredientString(rawIngredients.name)];
      }
      
      return [{
        quantity: String(rawIngredients.quantity || rawIngredients.amount || ''),
        unit: String(rawIngredients.unit || ''),
        ingredient: String(rawIngredients.ingredient || rawIngredients.name || ''),
        original: JSON.stringify(rawIngredients)
      }];
    }

    console.warn('[IngredientParser] Unexpected ingredient data format:', rawIngredients);
    return [];
  } catch (error) {
    console.error('[IngredientParser] Critical error parsing ingredients:', error);
    return [];
  }
};

/**
 * Convert parsed ingredients back to the format expected by the backend
 * Maintains compatibility with existing save functionality
 */
export const serializeIngredientsForSave = (parsedIngredients: ParsedIngredient[]): any[] => {
  try {
    return parsedIngredients.map(ingredient => {
      // Return in the format expected by the backend
      return {
        quantity: ingredient.quantity || '',
        unit: ingredient.unit || '',
        ingredient: ingredient.ingredient || ''
      };
    });
  } catch (error) {
    console.error('[IngredientParser] Error serializing ingredients:', error);
    return [];
  }
};

/**
 * Validate that ingredient parsing is working correctly
 * For development/debugging only
 */
export const validateIngredientParsing = (rawData: any): boolean => {
  if (!__DEV__) return true;

  try {
    const parsed = parseIngredientsData(rawData);
    const serialized = serializeIngredientsForSave(parsed);
    
    return parsed.length > 0;
  } catch (error) {
    console.error('[IngredientParser] Validation failed:', error);
    return false;
  }
}; 