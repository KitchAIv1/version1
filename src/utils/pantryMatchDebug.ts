/**
 * Utility functions to debug pantry match discrepancies
 * between feed screen and recipe detail screen
 */

export interface PantryMatchDebugInfo {
  recipeId: string;
  recipeTitle: string;
  feedData?: {
    userIngredientsCount: number;
    totalIngredientsCount: number;
    pantryMatchPct: number;
  };
  recipeDetailData?: {
    matchedIngredients: string[];
    totalIngredients: number;
    matchedCount: number;
  };
  discrepancy?: {
    feedShowsZero: boolean;
    recipeDetailShowsMatch: boolean;
    possibleCause: string;
  };
}

/**
 * Compare pantry match data between feed and recipe detail
 */
export const comparePantryMatches = (
  recipeId: string,
  recipeTitle: string,
  feedUserCount: number,
  feedTotalCount: number,
  recipeMatchedIngredients: string[],
  recipeTotalIngredients: number,
): PantryMatchDebugInfo => {
  const feedPct =
    feedTotalCount > 0 ? Math.round((feedUserCount / feedTotalCount) * 100) : 0;
  const recipeMatchedCount = recipeMatchedIngredients.length;

  const debugInfo: PantryMatchDebugInfo = {
    recipeId,
    recipeTitle,
    feedData: {
      userIngredientsCount: feedUserCount,
      totalIngredientsCount: feedTotalCount,
      pantryMatchPct: feedPct,
    },
    recipeDetailData: {
      matchedIngredients: recipeMatchedIngredients,
      totalIngredients: recipeTotalIngredients,
      matchedCount: recipeMatchedCount,
    },
  };

  // Detect discrepancy
  const feedShowsZero = feedPct === 0;
  const recipeDetailShowsMatch = recipeMatchedCount > 0;

  if (feedShowsZero && recipeDetailShowsMatch) {
    let possibleCause = 'Unknown';

    if (feedTotalCount !== recipeTotalIngredients) {
      possibleCause =
        'Different ingredient counts between feed and recipe detail';
    } else if (feedUserCount === 0 && recipeMatchedCount > 0) {
      possibleCause =
        'Feed RPC not detecting matched ingredients that recipe detail RPC finds';
    } else if (feedUserCount > 0 && feedPct === 0) {
      possibleCause =
        'Rounding issue: feed has matches but percentage rounds to 0';
    }

    debugInfo.discrepancy = {
      feedShowsZero,
      recipeDetailShowsMatch,
      possibleCause,
    };
  }

  return debugInfo;
};

/**
 * Log pantry match discrepancy for debugging
 */
export const logPantryMatchDiscrepancy = (debugInfo: PantryMatchDebugInfo) => {
  if (debugInfo.discrepancy) {
    console.warn(
      `[PantryMatchDebug] Discrepancy detected for recipe ${debugInfo.recipeId}:`,
      {
        title: debugInfo.recipeTitle,
        feed: debugInfo.feedData,
        recipeDetail: debugInfo.recipeDetailData,
        issue: debugInfo.discrepancy.possibleCause,
      },
    );
  }
};

/**
 * Force refresh pantry match data for a specific recipe
 */
export const refreshRecipePantryMatch = async (
  queryClient: any,
  recipeId: string,
  userId: string,
) => {
  console.log(
    `[PantryMatchDebug] Force refreshing pantry match for recipe ${recipeId}`,
  );

  // Invalidate specific queries
  await queryClient.invalidateQueries({
    queryKey: ['pantryMatch', recipeId, userId],
  });
  await queryClient.invalidateQueries({
    queryKey: ['recipeDetails', recipeId, userId],
  });
  await queryClient.invalidateQueries({ queryKey: ['feed'] });

  // Refetch the data
  await queryClient.refetchQueries({
    queryKey: ['pantryMatch', recipeId, userId],
  });
  await queryClient.refetchQueries({ queryKey: ['feed'] });
};
