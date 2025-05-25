import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../services/supabase';

interface CacheUpdateParams {
  recipeId: string;
  userId?: string;
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  commentsCount?: number;
}

export const useCacheManager = () => {
  const queryClient = useQueryClient();

  // Update all caches simultaneously to prevent inconsistencies
  const updateAllCaches = useCallback((params: CacheUpdateParams) => {
    const { recipeId, userId, likes, isLiked, isSaved, commentsCount } = params;

    // Update feed cache
    queryClient.setQueryData(['feed'], (oldFeedData: any) => {
      if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;
      
      return oldFeedData.map((item: any) => {
        if (item.id === recipeId || item.recipe_id === recipeId) {
          const updates: any = { ...item };
          
          if (likes !== undefined) updates.likes = likes;
          if (isLiked !== undefined) updates.liked = isLiked;
          if (isSaved !== undefined) updates.saved = isSaved;
          if (commentsCount !== undefined) updates.commentsCount = commentsCount;
          
          return updates;
        }
        return item;
      });
    });

    // Update recipe details cache if userId is provided
    if (userId) {
      queryClient.setQueryData(['recipeDetails', recipeId, userId], (oldData: any) => {
        if (!oldData) return oldData;
        
        const updates: any = { ...oldData };
        
        if (likes !== undefined) updates.likes = likes;
        if (isLiked !== undefined) updates.is_liked_by_user = isLiked;
        if (isSaved !== undefined) updates.is_saved_by_user = isSaved;
        if (commentsCount !== undefined) updates.comments_count = commentsCount;
        
        return updates;
      });
    }

    // Update profile cache for user's uploaded and saved recipes
    queryClient.setQueryData(['profile'], (oldProfile: any) => {
      if (!oldProfile) return oldProfile;
      
      const updateRecipeInArray = (recipes: any[]) => {
        if (!recipes) return recipes;
        return recipes.map((recipe: any) => {
          if (recipe.recipe_id === recipeId || recipe.id === recipeId) {
            const updates: any = { ...recipe };
            
            if (likes !== undefined) updates.likes = likes;
            if (isLiked !== undefined) updates.liked = isLiked;
            if (isSaved !== undefined) updates.saved = isSaved;
            if (commentsCount !== undefined) updates.comments_count = commentsCount;
            
            return updates;
          }
          return recipe;
        });
      };
      
      return {
        ...oldProfile,
        uploaded_videos: updateRecipeInArray(oldProfile.uploaded_videos),
        saved_recipes: updateRecipeInArray(oldProfile.saved_recipes)
      };
    });
  }, [queryClient]);

  // Optimistic like update
  const optimisticLikeUpdate = useCallback((recipeId: string, userId?: string) => {
    // Get current state from any available cache
    const feedData = queryClient.getQueryData(['feed']) as any[];
    const recipeData = userId ? queryClient.getQueryData(['recipeDetails', recipeId, userId]) as any : null;
    
    // Determine current like state from available data
    let currentLiked = false;
    let currentLikes = 0;
    
    if (recipeData) {
      currentLiked = recipeData.is_liked_by_user || false;
      currentLikes = recipeData.likes || 0;
    } else if (feedData) {
      const feedItem = feedData.find((item: any) => item.id === recipeId || item.recipe_id === recipeId);
      if (feedItem) {
        currentLiked = feedItem.liked || false;
        currentLikes = feedItem.likes || 0;
      }
    }
    
    const newLiked = !currentLiked;
    const newLikes = currentLiked ? currentLikes - 1 : currentLikes + 1;
    
    updateAllCaches({
      recipeId,
      userId,
      likes: newLikes,
      isLiked: newLiked
    });
    
    return { newLiked, newLikes };
  }, [queryClient, updateAllCaches]);

  // Optimistic save update
  const optimisticSaveUpdate = useCallback((recipeId: string, userId?: string) => {
    // Get current state from any available cache
    const feedData = queryClient.getQueryData(['feed']) as any[];
    const recipeData = userId ? queryClient.getQueryData(['recipeDetails', recipeId, userId]) as any : null;
    
    // Determine current save state from available data
    let currentSaved = false;
    
    if (recipeData) {
      currentSaved = recipeData.is_saved_by_user || false;
    } else if (feedData) {
      const feedItem = feedData.find((item: any) => item.id === recipeId || item.recipe_id === recipeId);
      if (feedItem) {
        currentSaved = feedItem.saved || false;
      }
    }
    
    const newSaved = !currentSaved;
    
    updateAllCaches({
      recipeId,
      userId,
      isSaved: newSaved
    });
    
    return { newSaved };
  }, [queryClient, updateAllCaches]);

  // Handle server response for likes
  const handleLikeServerResponse = useCallback((recipeId: string, serverResponse: any, userId?: string) => {
    if (serverResponse && typeof serverResponse === 'object' && 'liked' in serverResponse && 'likes_count' in serverResponse) {
      updateAllCaches({
        recipeId,
        userId,
        likes: serverResponse.likes_count,
        isLiked: serverResponse.liked
      });
      return true;
    }
    return false;
  }, [updateAllCaches]);

  // Rollback changes on error
  const rollbackChanges = useCallback((recipeId: string, previousData: any, userId?: string) => {
    if (previousData.previousFeed) {
      queryClient.setQueryData(['feed'], previousData.previousFeed);
    }
    if (previousData.previousRecipeData && userId) {
      queryClient.setQueryData(['recipeDetails', recipeId, userId], previousData.previousRecipeData);
    }
    if (previousData.previousProfile) {
      queryClient.setQueryData(['profile'], previousData.previousProfile);
    }
  }, [queryClient]);

  // Snapshot current cache state
  const snapshotCaches = useCallback((recipeId: string, userId?: string) => {
    return {
      previousFeed: queryClient.getQueryData(['feed']),
      previousRecipeData: userId ? queryClient.getQueryData(['recipeDetails', recipeId, userId]) : null,
      previousProfile: queryClient.getQueryData(['profile'])
    };
  }, [queryClient]);

  // Cancel queries to prevent race conditions
  const cancelQueries = useCallback(async (recipeId: string, userId?: string) => {
    await queryClient.cancelQueries({ queryKey: ['feed'] });
    if (userId) {
      await queryClient.cancelQueries({ queryKey: ['recipeDetails', recipeId, userId] });
    }
    await queryClient.cancelQueries({ queryKey: ['profile'] });
  }, [queryClient]);

  // Invalidate queries for fresh data
  const invalidateQueries = useCallback((recipeId: string, userId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['recipeDetails', recipeId, userId] });
    }
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['recipe-comments', recipeId] });
    queryClient.invalidateQueries({ queryKey: ['recipe-comments-count', recipeId] });
  }, [queryClient]);

  // Fetch and update comment count for a specific recipe
  const updateCommentCount = useCallback(async (recipeId: string, userId?: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_recipe_comments', {
          p_recipe_id: recipeId
        });
      
      if (error) {
        console.error(`[useCacheManager] Error fetching comments for recipe ${recipeId}:`, error);
        return;
      }
      
      const actualCommentCount = (data || []).length;
      console.log(`[useCacheManager] Fetched comment count for recipe ${recipeId}: ${actualCommentCount}`);
      
      // Update all caches with the correct comment count
      updateAllCaches({
        recipeId,
        userId,
        commentsCount: actualCommentCount
      });
      
      return actualCommentCount;
    } catch (error) {
      console.error(`[useCacheManager] Exception fetching comments for recipe ${recipeId}:`, error);
      return 0;
    }
  }, [updateAllCaches]);

  return {
    updateAllCaches,
    optimisticLikeUpdate,
    optimisticSaveUpdate,
    handleLikeServerResponse,
    rollbackChanges,
    snapshotCaches,
    cancelQueries,
    invalidateQueries,
    updateCommentCount,
    queryClient
  };
}; 