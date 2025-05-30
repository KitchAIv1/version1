import { useMutation } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useCacheManager } from './useCacheManager';
import { Alert } from 'react-native';

interface MutationContext {
  previousData: any;
}

export const useLikeMutation = (userId?: string) => {
  const cacheManager = useCacheManager();

  return useMutation<any, Error, string, MutationContext>({
    mutationFn: async (recipeId: string) => {
      if (!userId) throw new Error('User not authenticated. Please log in to like recipes.');
      
      console.log('[useLikeMutation] Attempting to toggle like for recipe:', recipeId, 'by user:', userId);
      
      // Use the toggle_recipe_like RPC function (confirmed working by backend team)
      const { data: rpcData, error } = await supabase.rpc('toggle_recipe_like', {
        user_id_param: userId,
        recipe_id_param: recipeId
      });
      
      if (error) {
        console.error('[useLikeMutation] Like toggle error:', error);
        throw new Error(`Failed to toggle like: ${error.message}`);
      }
      
      console.log('[useLikeMutation] Like toggle successful for recipe:', recipeId);
      console.log('[useLikeMutation] RPC response data:', rpcData);
      
      return { recipeId, rpcData };
    },
    onMutate: async (recipeId) => {
      // Cancel queries to prevent race conditions
      await cacheManager.cancelQueries(recipeId, userId);
      
      // Snapshot current state for rollback
      const previousData = cacheManager.snapshotCaches(recipeId, userId);
      
      // Perform optimistic update
      const { newLiked, newLikes } = cacheManager.optimisticLikeUpdate(recipeId, userId);
      
      console.log(`[useLikeMutation] Optimistic update for recipe ${recipeId}:`, {
        newLiked,
        newLikes,
        userId
      });
      
      return { previousData };
    },
    onSuccess: (result, recipeId, context) => {
      console.log('[useLikeMutation] Like mutation successful, result:', result);
      
      // Update caches with actual server response
      const serverResponseApplied = cacheManager.handleLikeServerResponse(recipeId, result?.rpcData, userId);
      
      if (serverResponseApplied) {
        console.log(`[useLikeMutation] Applied server response for recipe ${recipeId}`);
      } else {
        console.warn(`[useLikeMutation] Invalid server response for recipe ${recipeId}:`, result);
      }
    },
    onError: (error, recipeId, context) => {
      console.error('[useLikeMutation] Like mutation failed:', error);
      
      // Rollback optimistic updates
      if (context?.previousData) {
        cacheManager.rollbackChanges(recipeId, context.previousData, userId);
      }
      
      Alert.alert('Error', error.message || 'Could not update like status. Please try again.');
    },
  });
};

export const useSaveMutation = (userId?: string) => {
  const cacheManager = useCacheManager();

  return useMutation<any, Error, string, MutationContext>({
    mutationFn: async (recipeId: string) => {
      if (!userId) throw new Error('User not authenticated. Please log in to save recipes.');
      
      console.log('[useSaveMutation] Attempting to toggle save for recipe:', recipeId, 'by user:', userId);
      
      // Use the existing save_recipe_video RPC function
      const { data: rpcData, error } = await supabase.rpc('save_recipe_video', { 
        p_recipe_id: recipeId,
        p_user_id: userId
      });
      
      if (error) {
        console.error('[useSaveMutation] Save toggle error:', error);
        throw new Error(`Failed to toggle save: ${error.message}`);
      }
      
      console.log('[useSaveMutation] Save toggle successful for recipe:', recipeId);
      console.log('[useSaveMutation] RPC response data:', rpcData);
      
      return { recipeId, rpcData };
    },
    onMutate: async (recipeId) => {
      // Cancel queries to prevent race conditions
      await cacheManager.cancelQueries(recipeId, userId);
      
      // Snapshot current state for rollback
      const previousData = cacheManager.snapshotCaches(recipeId, userId);
      
      // Perform optimistic update
      const { newSaved } = cacheManager.optimisticSaveUpdate(recipeId, userId);
      
      console.log(`[useSaveMutation] Optimistic save update for recipe ${recipeId}:`, {
        newSaved,
        userId
      });
      
      return { previousData };
    },
    onSuccess: (result, recipeId, context) => {
      console.log('[useSaveMutation] Save mutation successful, result:', result);
      
      // For save mutations, the RPC just succeeds or fails
      // The optimistic updates are sufficient
      console.log(`[useSaveMutation] Save toggle completed for recipe ${recipeId}`);
    },
    onError: (error, recipeId, context) => {
      console.error('[useSaveMutation] Save mutation failed:', error);
      
      // Rollback optimistic updates
      if (context?.previousData) {
        cacheManager.rollbackChanges(recipeId, context.previousData, userId);
      }
      
      Alert.alert('Error', error.message || 'Could not update save status. Please try again.');
    },
  });
};

export const useCommentMutation = (recipeId: string, userId?: string) => {
  const cacheManager = useCacheManager();

  return useMutation<any, Error, string, MutationContext>({
    mutationFn: async (commentText: string) => {
      if (!userId || !recipeId) throw new Error('User or recipe ID missing');
      
      console.log('[useCommentMutation] Posting comment for recipe:', recipeId, 'by user:', userId);
      
      // Use the existing recipe_comments table insert
      const { error } = await supabase
        .from('recipe_comments')
        .insert({
          recipe_id: recipeId,
          user_id: userId,
          comment_text: commentText
        });
      
      if (error) {
        console.error('[useCommentMutation] Comment post error:', error);
        throw new Error(`Failed to post comment: ${error.message}`);
      }
      
      console.log('[useCommentMutation] Comment posted successfully for recipe:', recipeId);
      
      return { recipeId, commentText };
    },
    onMutate: async (commentText) => {
      // Cancel queries to prevent race conditions
      await cacheManager.cancelQueries(recipeId, userId);
      
      // Snapshot current state for rollback
      const previousData = cacheManager.snapshotCaches(recipeId, userId);
      
      // Get current comment count and increment it optimistically
      const feedData = cacheManager.queryClient?.getQueryData(['feed']) as any[];
      const recipeData = userId ? cacheManager.queryClient?.getQueryData(['recipeDetails', recipeId, userId]) as any : null;
      
      let currentCommentsCount = 0;
      if (recipeData) {
        currentCommentsCount = recipeData.comments_count || 0;
      } else if (feedData) {
        const feedItem = feedData.find((item: any) => item.id === recipeId || item.recipe_id === recipeId);
        if (feedItem) {
          currentCommentsCount = feedItem.commentsCount || 0;
        }
      }
      
      const newCommentsCount = currentCommentsCount + 1;
      
      // Update all caches with new comment count
      cacheManager.updateAllCaches({
        recipeId,
        userId,
        commentsCount: newCommentsCount
      });
      
      console.log(`[useCommentMutation] Optimistic comment count update for recipe ${recipeId}:`, {
        oldCount: currentCommentsCount,
        newCount: newCommentsCount,
        userId
      });
      
      return { previousData };
    },
    onSuccess: (result, commentText, context) => {
      console.log('[useCommentMutation] Comment mutation successful');
      
      // Invalidate comment-related queries to get fresh data
      cacheManager.invalidateQueries(recipeId, userId);
    },
    onError: (error, commentText, context) => {
      console.error('[useCommentMutation] Comment mutation failed:', error);
      
      // Rollback optimistic updates
      if (context?.previousData) {
        cacheManager.rollbackChanges(recipeId, context.previousData, userId);
      }
      
      Alert.alert('Error', error.message || 'Could not post comment. Please try again.');
    },
  });
}; 