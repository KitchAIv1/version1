import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

/**
 * Comprehensive cache clearing utility for KitchAI app
 * Handles React Query cache, AsyncStorage, and custom cache manager clearing
 */
export class CacheManager {
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Clear all React Query cache
   */
  async clearReactQueryCache(): Promise<void> {
    try {
      console.log('[CacheManager] Clearing React Query cache...');
      
      // Clear all cached queries
      this.queryClient.clear();
      
      // Invalidate all queries to force refetch
      await this.queryClient.invalidateQueries();
      
      console.log('[CacheManager] React Query cache cleared successfully');
    } catch (error) {
      console.error('[CacheManager] Error clearing React Query cache:', error);
      throw error;
    }
  }

  /**
   * Clear AsyncStorage (local storage)
   */
  async clearAsyncStorage(): Promise<void> {
    try {
      console.log('[CacheManager] Clearing AsyncStorage...');
      
      // Get all keys first to see what we're clearing
      const keys = await AsyncStorage.getAllKeys();
      console.log('[CacheManager] AsyncStorage keys to clear:', keys);
      
      // Clear all AsyncStorage
      await AsyncStorage.clear();
      
      console.log('[CacheManager] AsyncStorage cleared successfully');
    } catch (error) {
      console.error('[CacheManager] Error clearing AsyncStorage:', error);
      throw error;
    }
  }

  /**
   * Clear specific profile-related cache keys
   */
  async clearProfileCache(): Promise<void> {
    try {
      console.log('[CacheManager] Clearing profile-related cache...');
      
      // Clear profile-specific queries
      await this.queryClient.invalidateQueries({ queryKey: ['profile'] });
      await this.queryClient.invalidateQueries({ queryKey: ['user'] });
      await this.queryClient.invalidateQueries({ queryKey: ['auth'] });
      
      // Remove cached profile data
      this.queryClient.removeQueries({ queryKey: ['profile'] });
      this.queryClient.removeQueries({ queryKey: ['user'] });
      this.queryClient.removeQueries({ queryKey: ['auth'] });
      
      console.log('[CacheManager] Profile cache cleared successfully');
    } catch (error) {
      console.error('[CacheManager] Error clearing profile cache:', error);
      throw error;
    }
  }

  /**
   * Clear feed-related cache
   */
  async clearFeedCache(): Promise<void> {
    try {
      console.log('[CacheManager] Clearing feed-related cache...');
      
      // Clear feed-specific queries
      await this.queryClient.invalidateQueries({ queryKey: ['feed'] });
      await this.queryClient.invalidateQueries({ queryKey: ['recipe'] });
      await this.queryClient.invalidateQueries({ queryKey: ['recipeDetails'] });
      
      // Remove cached feed data
      this.queryClient.removeQueries({ queryKey: ['feed'] });
      this.queryClient.removeQueries({ queryKey: ['recipe'] });
      this.queryClient.removeQueries({ queryKey: ['recipeDetails'] });
      
      console.log('[CacheManager] Feed cache cleared successfully');
    } catch (error) {
      console.error('[CacheManager] Error clearing feed cache:', error);
      throw error;
    }
  }

  /**
   * Clear pantry-related cache
   */
  async clearPantryCache(): Promise<void> {
    try {
      console.log('[CacheManager] Clearing pantry-related cache...');
      
      // Clear pantry-specific queries
      await this.queryClient.invalidateQueries({ queryKey: ['pantry'] });
      await this.queryClient.invalidateQueries({ queryKey: ['stock'] });
      
      // Remove cached pantry data
      this.queryClient.removeQueries({ queryKey: ['pantry'] });
      this.queryClient.removeQueries({ queryKey: ['stock'] });
      
      console.log('[CacheManager] Pantry cache cleared successfully');
    } catch (error) {
      console.error('[CacheManager] Error clearing pantry cache:', error);
      throw error;
    }
  }

  /**
   * Clear only Supabase auth-related storage while preserving other data
   */
  async clearAuthStorageOnly(): Promise<void> {
    try {
      console.log('[CacheManager] Clearing Supabase auth storage only...');
      
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter for Supabase auth-related keys
      const supabaseKeys = keys.filter(key => 
        key.includes('supabase') || 
        key.includes('auth') || 
        key.includes('session') ||
        key.includes('token')
      );
      
      console.log('[CacheManager] Supabase auth keys to clear:', supabaseKeys);
      
      // Remove only auth-related keys
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
      }
      
      console.log('[CacheManager] Supabase auth storage cleared successfully');
    } catch (error) {
      console.error('[CacheManager] Error clearing Supabase auth storage:', error);
      throw error;
    }
  }

  /**
   * Comprehensive cache clear - clears everything
   */
  async clearAllCaches(): Promise<void> {
    try {
      console.log('[CacheManager] Starting comprehensive cache clear...');
      
      // Clear all caches in sequence
      await this.clearReactQueryCache();
      await this.clearAsyncStorage();
      
      console.log('[CacheManager] All caches cleared successfully');
    } catch (error) {
      console.error('[CacheManager] Error during comprehensive cache clear:', error);
      throw error;
    }
  }

  /**
   * Selective cache clear - preserves auth but clears data caches
   */
  async clearDataCachesOnly(): Promise<void> {
    try {
      console.log('[CacheManager] Starting selective cache clear (preserving auth)...');
      
      // Clear React Query cache
      await this.clearReactQueryCache();
      
      // Clear only non-auth AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();
      const nonAuthKeys = keys.filter(key => 
        !key.includes('supabase') && 
        !key.includes('auth') && 
        !key.includes('session') &&
        !key.includes('token')
      );
      
      if (nonAuthKeys.length > 0) {
        console.log('[CacheManager] Non-auth keys to clear:', nonAuthKeys);
        await AsyncStorage.multiRemove(nonAuthKeys);
      }
      
      console.log('[CacheManager] Data caches cleared successfully (auth preserved)');
    } catch (error) {
      console.error('[CacheManager] Error during selective cache clear:', error);
      throw error;
    }
  }

  /**
   * Show user-friendly cache clear dialog
   */
  showCacheClearDialog(): void {
    Alert.alert(
      "Clear App Cache",
      "This will clear all cached data and may improve app performance. You may need to log in again. Continue?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear Data Only",
          onPress: async () => {
            try {
              await this.clearDataCachesOnly();
              Alert.alert("Success", "App data cache cleared successfully!");
            } catch (error) {
              Alert.alert("Error", "Failed to clear cache. Please try again.");
            }
          }
        },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: async () => {
            try {
              await this.clearAllCaches();
              Alert.alert("Success", "All app cache cleared successfully! Please restart the app.");
            } catch (error) {
              Alert.alert("Error", "Failed to clear cache. Please try again.");
            }
          }
        }
      ]
    );
  }

  /**
   * Force refresh of all active queries
   */
  async forceRefreshAllQueries(): Promise<void> {
    try {
      console.log('[CacheManager] Force refreshing all queries...');
      
      // Invalidate all queries to trigger refetch
      await this.queryClient.invalidateQueries();
      
      // Force refetch all active queries
      await this.queryClient.refetchQueries();
      
      console.log('[CacheManager] All queries refreshed successfully');
    } catch (error) {
      console.error('[CacheManager] Error force refreshing queries:', error);
      throw error;
    }
  }
}

/**
 * Create singleton cache manager instance
 */
let cacheManagerInstance: CacheManager | null = null;

export const createCacheManager = (queryClient: QueryClient): CacheManager => {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(queryClient);
  }
  return cacheManagerInstance;
};

export const getCacheManager = (): CacheManager | null => {
  return cacheManagerInstance;
};

/**
 * Quick utility functions for common cache operations
 */
export const clearAllCaches = async (queryClient: QueryClient): Promise<void> => {
  const manager = createCacheManager(queryClient);
  await manager.clearAllCaches();
};

export const clearDataCachesOnly = async (queryClient: QueryClient): Promise<void> => {
  const manager = createCacheManager(queryClient);
  await manager.clearDataCachesOnly();
};

export const forceRefreshApp = async (queryClient: QueryClient): Promise<void> => {
  const manager = createCacheManager(queryClient);
  await manager.forceRefreshAllQueries();
}; 