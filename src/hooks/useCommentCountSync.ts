import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchCommentCount,
  fetchMultipleCommentCounts,
} from './useRecipeComments';

export const useCommentCountSync = () => {
  const queryClient = useQueryClient();

  // Efficiently sync a single recipe's comment count
  const syncSingleRecipe = useCallback(
    async (recipeId: string, userId?: string) => {
      if (!recipeId) return;

      console.log(
        `[useCommentCountSync] 🎯 Syncing comment count for recipe ${recipeId}`,
      );

      try {
        // Get actual comment count from database (lightweight query)
        const actualCount = await fetchCommentCount(recipeId);

        // Update recipe details cache directly (no invalidation needed)
        if (userId) {
          queryClient.setQueryData(
            ['recipeDetails', recipeId, userId],
            (oldData: any) => {
              if (!oldData) return oldData;

              const oldCount = oldData.comments_count || 0;
              if (oldCount !== actualCount) {
                console.log(
                  `[useCommentCountSync] 📊 Recipe ${recipeId} count: ${oldCount} → ${actualCount}`,
                );
                return { ...oldData, comments_count: actualCount };
              }
              return oldData;
            },
          );
        }

        // Update feed cache directly (no invalidation needed)
        queryClient.setQueryData(['feed'], (oldFeedData: any) => {
          if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;

          return oldFeedData.map((item: any) => {
            if (item.id === recipeId || item.recipe_id === recipeId) {
              const oldCount = item.commentsCount || 0;
              if (oldCount !== actualCount) {
                console.log(
                  `[useCommentCountSync] 📊 Feed item ${recipeId} count: ${oldCount} → ${actualCount}`,
                );
                return { ...item, commentsCount: actualCount };
              }
            }
            return item;
          });
        });

        return actualCount;
      } catch (error) {
        console.error(
          `[useCommentCountSync] Error syncing recipe ${recipeId}:`,
          error,
        );
        return 0;
      }
    },
    [queryClient],
  );

  // Efficiently sync multiple recipes' comment counts (batch operation)
  const syncMultipleRecipes = useCallback(
    async (recipeIds: string[], userId?: string) => {
      if (!recipeIds.length) return {};

      console.log(
        `[useCommentCountSync] 🎯 Batch syncing ${recipeIds.length} recipes`,
      );

      try {
        // Get actual comment counts from database (single batch query)
        const actualCounts = await fetchMultipleCommentCounts(recipeIds);

        // Update all caches in a single operation
        const updatedCounts: Record<string, { old: number; new: number }> = {};

        // Update recipe details caches
        if (userId) {
          recipeIds.forEach(recipeId => {
            queryClient.setQueryData(
              ['recipeDetails', recipeId, userId],
              (oldData: any) => {
                if (!oldData) return oldData;

                const oldCount = oldData.comments_count || 0;
                const newCount = actualCounts[recipeId] || 0;

                if (oldCount !== newCount) {
                  updatedCounts[recipeId] = { old: oldCount, new: newCount };
                  return { ...oldData, comments_count: newCount };
                }
                return oldData;
              },
            );
          });
        }

        // Update feed cache in a single operation
        queryClient.setQueryData(['feed'], (oldFeedData: any) => {
          if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;

          return oldFeedData.map((item: any) => {
            const recipeId = item.id || item.recipe_id;
            if (recipeIds.includes(recipeId)) {
              const oldCount = item.commentsCount || 0;
              const newCount = actualCounts[recipeId] || 0;

              if (oldCount !== newCount) {
                if (!updatedCounts[recipeId]) {
                  updatedCounts[recipeId] = { old: oldCount, new: newCount };
                }
                return { ...item, commentsCount: newCount };
              }
            }
            return item;
          });
        });

        // Log only recipes that actually changed
        Object.entries(updatedCounts).forEach(([recipeId, counts]) => {
          console.log(
            `[useCommentCountSync] 📊 Recipe ${recipeId} count: ${counts.old} → ${counts.new}`,
          );
        });

        return actualCounts;
      } catch (error) {
        console.error('[useCommentCountSync] Error batch syncing:', error);
        return {};
      }
    },
    [queryClient],
  );

  // Smart sync that detects discrepancies and only syncs what's needed
  const smartSync = useCallback(
    async (recipeIds: string[], userId?: string) => {
      if (!recipeIds.length) return;

      console.log(
        `[useCommentCountSync] 🧠 Smart syncing ${recipeIds.length} recipes`,
      );

      // Check current cache values first
      const recipesNeedingSync: string[] = [];
      const feedData = queryClient.getQueryData(['feed']) as any[];

      if (feedData && Array.isArray(feedData)) {
        recipeIds.forEach(recipeId => {
          const feedItem = feedData.find(
            (item: any) => item.id === recipeId || item.recipe_id === recipeId,
          );

          if (userId) {
            const recipeDetails = queryClient.getQueryData([
              'recipeDetails',
              recipeId,
              userId,
            ]) as any;

            // Check if feed and recipe details have different counts
            const feedCount = feedItem?.commentsCount || 0;
            const detailsCount = recipeDetails?.comments_count || 0;

            if (feedCount !== detailsCount) {
              console.log(
                `[useCommentCountSync] 🔍 Discrepancy in ${recipeId}: feed=${feedCount}, details=${detailsCount}`,
              );
              recipesNeedingSync.push(recipeId);
            }
          } else if (!feedItem) {
            // If no feed item, we might need to sync
            recipesNeedingSync.push(recipeId);
          }
        });
      } else {
        // No feed data, sync all
        recipesNeedingSync.push(...recipeIds);
      }

      if (recipesNeedingSync.length > 0) {
        console.log(
          `[useCommentCountSync] 🎯 Smart sync identified ${recipesNeedingSync.length} recipes needing sync`,
        );
        return await syncMultipleRecipes(recipesNeedingSync, userId);
      }
      console.log(
        '[useCommentCountSync] ✅ Smart sync: all recipes already in sync',
      );
      return {};
    },
    [queryClient, syncMultipleRecipes],
  );

  return {
    syncSingleRecipe,
    syncMultipleRecipes,
    smartSync,
  };
};
