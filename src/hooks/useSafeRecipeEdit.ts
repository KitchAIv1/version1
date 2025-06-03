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

      // Validate and parse ingredients safely
      const isValid = validateIngredientParsing(ingredients);
      setIsParsingValid(isValid);

      if (isValid) {
        const parsed = parseIngredientsData(ingredients);
        setParsedIngredients(parsed);
        setParsingError(null);
      } else {
        // Even if validation fails, try to parse anyway
        const parsed = parseIngredientsData(ingredients);
        setParsedIngredients(parsed);
        setParsingError('Ingredient parsing may be incomplete');
        console.warn(
          '[useSafeRecipeEdit] Ingredient parsing validation failed but proceeding:',
          parsed,
        );
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
      original: '',
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
      const serialized = serializeIngredientsForSave(parsedIngredients);
      return serialized;
    } catch (error) {
      console.error(
        '[useSafeRecipeEdit] Error serializing ingredients:',
        error,
      );
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

    // Status
    hasUnsavedChanges: hasUnsavedChanges(),
  };
};
