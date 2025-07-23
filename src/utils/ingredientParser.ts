/**
 * Ingredient Parser Utilities
 * Parses various ingredient string formats into structured objects
 */

export interface ParsedIngredient {
  quantity: string;
  unit: string;
  ingredient: string;
}

/**
 * Parses an ingredient string into quantity, unit, and ingredient name
 * Handles various formats like "2 cups flour", "1 lb chicken", "salt", etc.
 */
export function parseIngredientString(ingredientStr: string): ParsedIngredient {
  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return {
      quantity: '',
      unit: '',
      ingredient: ingredientStr || '',
    };
  }

  const cleaned = ingredientStr.trim();
  
  // Pattern 1: "1/2 cup flour" or "2.5 cups sugar"
  const fractionOrDecimalPattern = /^(\d+(?:[\/\.]\d+)?)\s+(cup|cups|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|kilograms?|ml|milliliters?|l|liters?|pint|pints|quart|quarts|gallon|gallons)\s+(.+)$/i;
  
  // Pattern 2: "2 large eggs" or "3 medium onions"
  const countWithSizePattern = /^(\d+)\s+(small|medium|large|extra-large|jumbo|tiny|huge)\s+(.+)$/i;
  
  // Pattern 3: "6 chicken breasts" or "4 carrots"
  const simpleCountPattern = /^(\d+)\s+(.+)$/;
  
  // Pattern 4: Just a number without unit "2 eggs" -> treat as count
  const numberOnlyPattern = /^(\d+(?:[\/\.]\d+)?)\s+(.+)$/;

  // Try fraction/decimal with unit pattern first
  let match = cleaned.match(fractionOrDecimalPattern);
  if (match && match[1] && match[2] && match[3]) {
    return {
      quantity: match[1].trim(),
      unit: match[2].trim(),
      ingredient: match[3].trim(),
    };
  }

  // Try count with size pattern
  match = cleaned.match(countWithSizePattern);
  if (match && match[1] && match[2] && match[3]) {
    return {
      quantity: match[1].trim(),
      unit: match[2].trim(),
      ingredient: match[3].trim(),
    };
  }

  // Generic number + unit pattern (MOVED AFTER SPECIFIC PATTERNS)
  const genericUnitPattern = /^(\d+(?:[\/\.]\d+)?)\s+([a-zA-Z]+)\s+(.+)$/;
  match = cleaned.match(genericUnitPattern);
  if (match && match[1] && match[2] && match[3]) {
    return {
      quantity: match[1].trim(),
      unit: match[2].trim(),
      ingredient: match[3].trim(),
    };
  }

  // Special handling for count-based ingredients (chicken, beef, etc.)
  const countBasedIngredients = [
    'chicken', 'egg', 'onion', 'carrot', 'potato', 'apple', 'banana', 
    'tomato', 'lemon', 'lime', 'orange', 'garlic clove', 'bell pepper'
  ];
  
  match = cleaned.match(simpleCountPattern);
  if (match && match[1] && match[2]) {
    const potentialIngredient = match[2].trim().toLowerCase();
    const isCountBased = countBasedIngredients.some(ingredient => 
      potentialIngredient.includes(ingredient)
    );
    
    if (isCountBased) {
      return {
        quantity: match[1].trim(),
        unit: 'units',
        ingredient: match[2].trim(),
      };
    }
  }

  // Try simple number pattern as fallback
  match = cleaned.match(numberOnlyPattern);
  if (match && match[1] && match[2]) {
    return {
      quantity: match[1].trim(),
      unit: 'units',
      ingredient: match[2].trim(),
    };
  }

  // If no pattern matches, return the original string as ingredient
  return {
    quantity: '',
    unit: '',
    ingredient: cleaned,
  };
}

/**
 * Safely parse ingredient data from various formats
 * Handles backward compatibility with existing data structures
 */
export const parseIngredientsData = (
  rawIngredients: any,
): ParsedIngredient[] => {
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
            if (
              ingredient.name &&
              typeof ingredient.name === 'string' &&
              ingredient.name.trim()
            ) {
              // Parse the name field which contains the full ingredient string
              const parsed = parseIngredientString(ingredient.name);
              return parsed;
            }

            // Check if it's already in the correct format (DATABASE FORMAT)
            if (
              ingredient.quantity !== undefined ||
              ingredient.unit !== undefined ||
              ingredient.ingredient !== undefined
            ) {
              const result = {
                quantity: String(ingredient.quantity || ''),
                unit: String(ingredient.unit || ''),
                ingredient: String(
                  ingredient.ingredient || ingredient.name || '',
                ),
              };
              return result;
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
          };
        } catch (error) {
          console.warn(
            `[IngredientParser] Error parsing ingredient at index ${index}:`,
            ingredient,
            error,
          );
          return {
            quantity: '',
            unit: '',
            ingredient: String(ingredient || ''),
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
      if (
        rawIngredients.name &&
        typeof rawIngredients.name === 'string' &&
        rawIngredients.name.trim()
      ) {
        return [parseIngredientString(rawIngredients.name)];
      }

              return [
          {
            quantity: String(
              rawIngredients.quantity || rawIngredients.amount || '',
            ),
            unit: String(rawIngredients.unit || ''),
            ingredient: String(
              rawIngredients.ingredient || rawIngredients.name || '',
            ),
          },
        ];
    }

    console.warn(
      '[IngredientParser] Unexpected ingredient data format:',
      rawIngredients,
    );
    return [];
  } catch (error) {
    console.error(
      '[IngredientParser] Critical error parsing ingredients:',
      error,
    );
    return [];
  }
};

/**
 * Convert parsed ingredients back to the format expected by the backend
 * Maintains compatibility with existing save functionality
 */
export const serializeIngredientsForSave = (
  parsedIngredients: ParsedIngredient[],
): any[] => {
  try {
    return parsedIngredients.map(ingredient => {
      // Return in the format expected by the backend
      return {
        quantity: ingredient.quantity || '',
        unit: ingredient.unit || '',
        ingredient: ingredient.ingredient || '',
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
