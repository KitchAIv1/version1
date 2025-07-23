import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  parseIngredientsData,
  serializeIngredientsForSave,
  validateIngredientParsing,
  ParsedIngredient,
} from '../utils/ingredientParser';
import { useCacheDebug } from './useCacheDebug';

/**
 * Safe Recipe Edit Hook
 * Handles ingredient parsing without affecting other components
 */
export const useSafeRecipeEdit = (recipeId: string, userId?: string) => {
  const queryClient = useQueryClient();
  const { syncAfterRecipeOperation } = useCacheDebug(userId);

  const [originalRecipeData, setOriginalRecipeData] = useState<any>(null);
  const [parsedIngredients, setParsedIngredients] = useState<
    ParsedIngredient[]
  >([]);
  const [isParsingValid, setIsParsingValid] = useState(true);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Safely fetch and parse recipe data
   */
  const fetchAndParseRecipe = useCallback(async () => {
    if (!recipeId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Try multiple cache key patterns - INCLUDING editableRecipeDetails!
      const possibleKeys = [
        ['editableRecipeDetails', recipeId, userId],
        ['editableRecipeDetails', recipeId],
        ['recipeDetails', recipeId, userId],
        ['recipeDetails', recipeId],
        ['recipe', recipeId],
      ];

      let recipeData = null;
      for (const key of possibleKeys) {
        const data = queryClient.getQueryData(key);
        if (data) {
          recipeData = data;
          break;
        }
      }

      if (!recipeData) {
        // Try to refetch with the most likely keys
        try {
          await queryClient.refetchQueries({
            queryKey: ['editableRecipeDetails', recipeId],
            exact: false,
          });

          await queryClient.refetchQueries({
            queryKey: ['recipeDetails', recipeId],
            exact: false,
          });

          // Try again after refetch
          for (const key of possibleKeys) {
            const data = queryClient.getQueryData(key);
            if (data) {
              recipeData = data;
              break;
            }
          }
        } catch (fetchError) {
          console.error('[useSafeRecipeEdit] Error refetching:', fetchError);
        }
      }

      if (!recipeData) {
        throw new Error('Recipe data not found after fetch attempts');
      }

      setOriginalRecipeData(recipeData);

      // Type-safe access to ingredients property
      const ingredients = (recipeData as any)?.ingredients;

      // Handle empty or null ingredients
      if (!ingredients) {
        setParsedIngredients([]);
        setIsParsingValid(true);
        setParsingError(null);
        setIsLoading(false);
        return;
      }

      // CRITICAL FIX: For editing existing recipes, don't parse ingredients through 
      // the ingredient parser as it strips quantities/units. Use database format directly.
      
      // PERFORMANCE & ACCURACY FIX: Detect database vs text format
      const isDatabaseFormat = Array.isArray(ingredients) && 
        ingredients.length > 0 && 
        ingredients[0] && 
        typeof ingredients[0] === 'object' &&
        ('ingredient' in ingredients[0] || 'name' in ingredients[0]);

      if (isDatabaseFormat) {
        // Database format: preserve exactly to prevent corruption
        const parsed = ingredients.map((ing: any) => ({
          ingredient: String(ing.ingredient || ing.name || ''),
          quantity: String(ing.quantity || ''),
          unit: String(ing.unit || ''),
        }));
        
        setParsedIngredients(parsed);
        setIsParsingValid(true);
        setParsingError(null);
      } else {
        // Text format: use parser for string data only
        const isValid = validateIngredientParsing(ingredients);
        setIsParsingValid(isValid);
        
        const parsed = parseIngredientsData(ingredients);
        setParsedIngredients(parsed);
        setParsingError(isValid ? null : 'Ingredient parsing may be incomplete');
      }

      setIsLoading(false);
    } catch (error) {
      console.error(
        '[useSafeRecipeEdit] Error fetching/parsing recipe:',
        error,
      );
      setParsingError(
        `Error loading recipe: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      setIsParsingValid(false);
      setIsLoading(false);
    }
  }, [recipeId, userId, queryClient]);

  /**
   * Safely update ingredients state
   */
  const updateIngredients = useCallback(
    (newIngredients: ParsedIngredient[]) => {
      try {
        setParsedIngredients(newIngredients);
      } catch (error) {
        console.error('[useSafeRecipeEdit] Error updating ingredients:', error);
      }
    },
    [],
  );

  /**
   * Add a new ingredient
   */
  const addIngredient = useCallback(() => {
    const newIngredient: ParsedIngredient = {
      quantity: '',
      unit: '',
      ingredient: '',
    };

    setParsedIngredients(prev => [...prev, newIngredient]);
  }, []);

  /**
   * Remove an ingredient
   */
  const removeIngredient = useCallback((index: number) => {
    setParsedIngredients(prev => {
      const newIngredients = [...prev];
      newIngredients.splice(index, 1);
      return newIngredients;
    });
  }, []);

  /**
   * Safely serialize ingredients for save
   */
  const getIngredientsForSave = useCallback((): any[] => {
    try {
      // DEBUG: Log current state for troubleshooting
      if (__DEV__) {
        console.log('[useSafeRecipeEdit] getIngredientsForSave called:');
        console.log('  - parsedIngredients length:', parsedIngredients.length);
        console.log('  - parsedIngredients:', JSON.stringify(parsedIngredients, null, 2));
      }

      // SAFETY CHECK: Ensure we have valid parsed ingredients
      if (!parsedIngredients || parsedIngredients.length === 0) {
        console.warn('[useSafeRecipeEdit] No parsed ingredients available for save');
        return [];
      }

      // Filter out completely empty ingredients
      const validIngredients = parsedIngredients.filter(ing => 
        ing && (ing.ingredient?.trim() || ing.quantity?.trim() || ing.unit?.trim())
      );

      if (validIngredients.length === 0) {
        console.warn('[useSafeRecipeEdit] No valid ingredients found after filtering');
        return [];
      }

      const serialized = serializeIngredientsForSave(validIngredients);
      
      // DEBUG: Log serialization result
      if (__DEV__) {
        console.log('[useSafeRecipeEdit] Serialization result:');
        console.log('  - Valid ingredients count:', validIngredients.length);
        console.log('  - Serialized:', JSON.stringify(serialized, null, 2));
      }

      return serialized;
    } catch (error) {
      console.error(
        '[useSafeRecipeEdit] Error serializing ingredients:',
        error,
      );
      console.error('  - parsedIngredients at error:', parsedIngredients);
      return [];
    }
  }, [parsedIngredients]);

  /**
   * Clear relevant caches after successful save using enhanced sync
   */
  const clearCachesAfterSave = useCallback(async () => {
    try {
      await syncAfterRecipeOperation(recipeId);
    } catch (error) {
      console.error('[useSafeRecipeEdit] Error clearing caches:', error);
    }
  }, [recipeId, syncAfterRecipeOperation]);

  /**
   * Reset to original data (undo changes)
   */
  const resetToOriginal = useCallback(() => {
    if (originalRecipeData) {
      const ingredients = (originalRecipeData as any)?.ingredients;
      const parsed = parseIngredientsData(ingredients);
      setParsedIngredients(parsed);
      setParsingError(null);
    }
  }, [originalRecipeData]);

  /**
   * Check if data has been modified
   */
  const hasUnsavedChanges = useCallback((): boolean => {
    if (!originalRecipeData) return false;

    try {
      const ingredients = (originalRecipeData as any)?.ingredients;
      const originalParsed = parseIngredientsData(ingredients);
      return (
        JSON.stringify(originalParsed) !== JSON.stringify(parsedIngredients)
      );
    } catch (error) {
      console.error('[useSafeRecipeEdit] Error checking for changes:', error);
      return false;
    }
  }, [originalRecipeData, parsedIngredients]);

  /**
   * Force refresh recipe data
   */
  const forceRefresh = useCallback(async () => {
    queryClient.removeQueries({ queryKey: ['recipeDetails', recipeId] });
    queryClient.removeQueries({ queryKey: ['recipe', recipeId] });

    await fetchAndParseRecipe();
  }, [recipeId, queryClient, fetchAndParseRecipe]);

  /**
   * Ensure display ingredients are properly synchronized with parsed ingredients
   * This is a helper for Edit Recipe screens to maintain consistency
   */
  const ensureIngredientSync = useCallback((displayIngredients: any[]) => {
    try {
      // If display ingredients exist but parsed ingredients don't, sync them
      if (displayIngredients && displayIngredients.length > 0 && parsedIngredients.length === 0) {
        console.log('[useSafeRecipeEdit] Syncing display ingredients to parsed ingredients');
        
        const syncedParsed = displayIngredients.map(ing => ({
          quantity: String(ing.quantity || ''),
          unit: String(ing.unit || ''),
          ingredient: String(ing.name || ing.ingredient || ''),
        }));
        
        setParsedIngredients(syncedParsed);
        return syncedParsed;
      }

      // If parsed ingredients exist but are shorter than display, extend them
      if (displayIngredients && displayIngredients.length > parsedIngredients.length) {
        console.log('[useSafeRecipeEdit] Extending parsed ingredients to match display length');
        
        const extendedParsed = [...parsedIngredients];
        for (let i = parsedIngredients.length; i < displayIngredients.length; i++) {
          const displayIng = displayIngredients[i];
          extendedParsed.push({
            quantity: String(displayIng.quantity || ''),
            unit: String(displayIng.unit || ''),
            ingredient: String(displayIng.name || displayIng.ingredient || ''),
          });
        }
        
        setParsedIngredients(extendedParsed);
        return extendedParsed;
      }

      return parsedIngredients;
    } catch (error) {
      console.error('[useSafeRecipeEdit] Error in ensureIngredientSync:', error);
      return parsedIngredients;
    }
  }, [parsedIngredients]);

  // Initialize data on mount or when recipeId changes
  useEffect(() => {
    if (recipeId) {
      fetchAndParseRecipe();
    }
  }, [recipeId, fetchAndParseRecipe]);

  return {
    // Data
    originalRecipeData,
    parsedIngredients,
    isParsingValid,
    parsingError,
    isLoading,

    // Actions
    updateIngredients,
    addIngredient,
    removeIngredient,
    getIngredientsForSave,
    clearCachesAfterSave,
    resetToOriginal,
    refetchRecipe: fetchAndParseRecipe,
    forceRefresh,
    ensureIngredientSync,

    // Status
    hasUnsavedChanges: hasUnsavedChanges(),
  };
};
