import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCacheManager } from '../utils/cacheUtils';

/**
 * Hook for cache debugging and clearing operations
 * Provides convenient methods for clearing different types of cache
 */
export const useCacheDebug = (userId?: string) => {
  const queryClient = useQueryClient();
  const cacheManager = createCacheManager(queryClient);

  /**
   * Show a user-friendly dialog to clear caches
   */
  const showCacheClearDialog = () => {
    cacheManager.showCacheClearDialog();
  };

  /**
   * Clear all caches (React Query + AsyncStorage)
   * Use with caution - will require user to log in again
   */
  const clearAllCaches = async () => {
    try {
      await cacheManager.clearAllCaches();
      Alert.alert('Success', 'All caches cleared successfully!');
      return true;
    } catch (error) {
      console.error('[useCacheDebug] Error clearing all caches:', error);
      Alert.alert('Error', 'Failed to clear all caches');
      return false;
    }
  };

  /**
   * Clear data caches only (preserves authentication)
   * Safer option that doesn't require re-login
   */
  const clearDataCachesOnly = async () => {
    try {
      await cacheManager.clearDataCachesOnly();
      Alert.alert('Success', 'Data caches cleared successfully!');
      return true;
    } catch (error) {
      console.error('[useCacheDebug] Error clearing data caches:', error);
      Alert.alert('Error', 'Failed to clear data caches');
      return false;
    }
  };

  /**
   * Clear profile-specific cache (saved recipes, my recipes, etc.)
   */
  const clearProfileCache = useCallback(async () => {
    try {
      console.log('[CacheDebug] Clearing profile cache...');

      // Clear all profile-related queries
      const profileKeys = [
        'user_recipes',
        'saved_recipes',
        'profile_recipes',
        'my_recipes',
        'user_saved_recipes',
        'userRecipes',
        'savedRecipes',
        'profileData',
      ];

      for (const key of profileKeys) {
        await queryClient.invalidateQueries({ queryKey: [key] });
        queryClient.removeQueries({ queryKey: [key] });
      }

      // Also clear any user-specific recipe queries if userId provided
      if (userId) {
        const userSpecificKeys = [
          ['user_recipes', userId],
          ['saved_recipes', userId],
          ['profile_recipes', userId],
          ['my_recipes', userId],
          ['userRecipes', userId],
          ['savedRecipes', userId],
        ];

        for (const key of userSpecificKeys) {
          await queryClient.invalidateQueries({ queryKey: key });
          queryClient.removeQueries({ queryKey: key });
        }
      }

      // Clear profile-related async storage
      const profileStorageKeys = await AsyncStorage.getAllKeys();
      const profileCacheKeys = profileStorageKeys.filter(
        key =>
          key.includes('profile') ||
          key.includes('saved') ||
          key.includes('my_recipes') ||
          key.includes('user_recipes'),
      );

      if (profileCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(profileCacheKeys);
        console.log(
          `[CacheDebug] Removed ${profileCacheKeys.length} profile cache keys from storage`,
        );
      }

      console.log('[CacheDebug] Profile cache cleared successfully');
      return { success: true, message: 'Profile cache cleared' };
    } catch (error) {
      console.error('[CacheDebug] Failed to clear profile cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [queryClient, userId]);

  /**
   * Clear feed-related cache
   * Useful when feed shows stale data
   */
  const clearFeedCache = async () => {
    try {
      await cacheManager.clearFeedCache();
      console.log('[useCacheDebug] Feed cache cleared');
      return true;
    } catch (error) {
      console.error('[useCacheDebug] Error clearing feed cache:', error);
      return false;
    }
  };

  /**
   * Clear pantry-related cache
   * Useful when pantry data is inconsistent
   */
  const clearPantryCache = async () => {
    try {
      await cacheManager.clearPantryCache();
      console.log('[useCacheDebug] Pantry cache cleared');
      return true;
    } catch (error) {
      console.error('[useCacheDebug] Error clearing pantry cache:', error);
      return false;
    }
  };

  /**
   * Force refresh all queries without clearing cache
   * Lighter option that just refetches data
   */
  const forceRefreshAllQueries = async () => {
    try {
      await cacheManager.forceRefreshAllQueries();
      console.log('[useCacheDebug] All queries refreshed');
      return true;
    } catch (error) {
      console.error('[useCacheDebug] Error refreshing queries:', error);
      return false;
    }
  };

  /**
   * Enhanced recipe-specific cache clear
   */
  const clearRecipeSpecificCache = useCallback(
    async (recipeId: string) => {
      try {
        console.log(`[CacheDebug] Clearing cache for recipe: ${recipeId}`);

        // All possible recipe cache keys
        const recipeKeys = [
          ['recipeDetails', recipeId],
          ['recipe', recipeId],
        ];

        // Add user-specific keys if userId provided
        if (userId) {
          recipeKeys.push(
            ['recipeDetails', recipeId, userId],
            ['recipe', recipeId, userId],
          );
        }

        for (const key of recipeKeys) {
          await queryClient.invalidateQueries({ queryKey: key });
          queryClient.removeQueries({ queryKey: key });
          console.log(`[CacheDebug] Cleared recipe cache key:`, key);
        }

        return { success: true, message: `Recipe ${recipeId} cache cleared` };
      } catch (error) {
        console.error('[CacheDebug] Failed to clear recipe cache:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [queryClient, userId],
  );

  /**
   * Complete sync after recipe operations (save, delete, etc.)
   */
  const syncAfterRecipeOperation = useCallback(
    async (recipeId?: string) => {
      try {
        console.log(
          '[CacheDebug] Starting complete sync after recipe operation...',
        );

        // 1. Clear feed cache
        await clearFeedCache();

        // 2. Clear profile cache (My Recipes, Saved Recipes)
        await clearProfileCache();

        // 3. Clear specific recipe cache if provided
        if (recipeId) {
          await clearRecipeSpecificCache(recipeId);
        }

        // 4. Force refresh all related queries
        await queryClient.refetchQueries({
          predicate: query => {
            const key = query.queryKey[0] as string;
            return (
              key.includes('recipe') ||
              key.includes('feed') ||
              key.includes('saved') ||
              key.includes('profile') ||
              key.includes('my_recipes') ||
              key.includes('user_recipes')
            );
          },
        });

        console.log('[CacheDebug] Complete sync completed successfully');
        return { success: true, message: 'Complete sync completed' };
      } catch (error) {
        console.error('[CacheDebug] Failed to complete sync:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [clearFeedCache, clearProfileCache, clearRecipeSpecificCache, queryClient],
  );

  /**
   * Get cache statistics for debugging
   */
  const getCacheStats = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.state.status === 'success').length,
      pendingQueries: queries.filter(q => q.state.status === 'pending').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      queryKeys: queries.map(q => q.queryKey),
    };
  };

  /**
   * Log current cache state for debugging
   */
  const logCacheState = () => {
    const stats = getCacheStats();
    console.log('[useCacheDebug] Cache Statistics:', stats);
    return stats;
  };

  return {
    // Main cache clearing functions
    showCacheClearDialog,
    clearAllCaches,
    clearDataCachesOnly,

    // Specific cache clearing
    clearProfileCache,
    clearFeedCache,
    clearPantryCache,

    // Refresh functions
    forceRefreshAllQueries,

    // Debug utilities
    getCacheStats,
    logCacheState,

    // Direct access to cache manager
    cacheManager,

    // New functions
    clearRecipeSpecificCache,
    syncAfterRecipeOperation,
  };
};
