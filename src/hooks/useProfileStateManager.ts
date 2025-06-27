import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';

/**
 * 🎯 ROBUST PROFILE STATE MANAGER
 * 
 * This hook provides a centralized, robust solution for managing profile state
 * that eliminates the UI freezing issue by:
 * 
 * 1. Proper state isolation
 * 2. Debounced updates to prevent race conditions
 * 3. Smart cache invalidation
 * 4. Error recovery mechanisms
 */
export const useProfileStateManager = () => {
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);

  /**
   * 🔒 ROBUST UPDATE HANDLER
   * Handles profile updates with proper debouncing and error recovery
   */
  const handleProfileUpdate = useCallback(async (userId: string) => {
    // Prevent multiple simultaneous updates
    if (isUpdatingRef.current) {
      console.log('[ProfileStateManager] Update already in progress, skipping...');
      return;
    }

    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set update flag
    isUpdatingRef.current = true;

    try {
      console.log('[ProfileStateManager] 🔄 Starting robust profile update sequence...');

      // 1. Refresh AuthProvider data first (source of truth)
      if (refreshProfile) {
        await refreshProfile(userId);
        console.log('[ProfileStateManager] ✅ AuthProvider refreshed');
      }

      // 2. Smart cache invalidation with proper timing
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay for state propagation

      // 3. Invalidate relevant caches in sequence (not parallel)
      queryClient.invalidateQueries({ 
        queryKey: ['profile', userId],
        exact: true 
      });
      
      console.log('[ProfileStateManager] ✅ Profile cache invalidated');

      // 4. Wait for cache to settle
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('[ProfileStateManager] ✅ Profile update sequence completed successfully');

    } catch (error) {
      console.error('[ProfileStateManager] ❌ Error during profile update:', error);
      
      // Recovery: Force cache refresh on error
      queryClient.refetchQueries({ 
        queryKey: ['profile', userId] 
      });
    } finally {
      // Always clear the update flag
      isUpdatingRef.current = false;
    }
  }, [refreshProfile, queryClient]);

  /**
   * 🎯 DEBOUNCED UPDATE TRIGGER
   * Triggers profile update with debouncing to prevent rapid successive calls
   */
  const triggerProfileUpdate = useCallback((userId: string, delay: number = 500) => {
    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Schedule debounced update
    updateTimeoutRef.current = setTimeout(() => {
      handleProfileUpdate(userId);
    }, delay);

    console.log(`[ProfileStateManager] 📅 Profile update scheduled for ${delay}ms`);
  }, [handleProfileUpdate]);

  /**
   * 🧹 CLEANUP FUNCTION
   * Cleans up any pending operations
   */
  const cleanup = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    isUpdatingRef.current = false;
    console.log('[ProfileStateManager] 🧹 Cleanup completed');
  }, []);

  /**
   * 🔍 STATUS CHECKER
   * Returns current update status
   */
  const getUpdateStatus = useCallback(() => ({
    isUpdating: isUpdatingRef.current,
    hasPendingUpdate: updateTimeoutRef.current !== null,
  }), []);

  /**
   * 🚀 IMMEDIATE UPDATE (for critical updates)
   * Bypasses debouncing for immediate updates when needed
   */
  const immediateUpdate = useCallback(async (userId: string) => {
    // Clear any pending debounced update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    // Execute immediate update
    await handleProfileUpdate(userId);
  }, [handleProfileUpdate]);

  return {
    triggerProfileUpdate,
    immediateUpdate,
    cleanup,
    getUpdateStatus,
  };
}; 