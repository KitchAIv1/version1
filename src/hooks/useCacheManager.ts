import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
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

  // Track pending comment count requests to prevent duplicates
  const pendingCommentRequests = useRef<Set<string>>(new Set());
  const commentCountTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Track pending like count requests to prevent duplicates
  const pendingLikeRequests = useRef<Set<string>>(new Set());
  const likeCountTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Update all caches simultaneously to prevent inconsistencies
  const updateAllCaches = useCallback(
    (params: CacheUpdateParams) => {
      const { recipeId, userId, likes, isLiked, isSaved, commentsCount } =
        params;

      // Update feed cache
      queryClient.setQueryData(['feed'], (oldFeedData: any) => {
        if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;

        return oldFeedData.map((item: any) => {
          if (item.id === recipeId || item.recipe_id === recipeId) {
            const updates: any = { ...item };

            if (likes !== undefined) updates.likes = likes;
            if (isLiked !== undefined) updates.liked = isLiked;
            if (isSaved !== undefined) updates.saved = isSaved;
            if (commentsCount !== undefined)
              updates.commentsCount = commentsCount;

            return updates;
          }
          return item;
        });
      });

      // Update recipe details cache if userId is provided
      if (userId) {
        queryClient.setQueryData(
          ['recipeDetails', recipeId, userId],
          (oldData: any) => {
            if (!oldData) return oldData;

            const updates: any = { ...oldData };

            if (likes !== undefined) updates.likes = likes;
            if (isLiked !== undefined) updates.is_liked_by_user = isLiked;
            if (isSaved !== undefined) updates.is_saved_by_user = isSaved;
            if (commentsCount !== undefined)
              updates.comments_count = commentsCount;

            return updates;
          },
        );
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
              if (commentsCount !== undefined)
                updates.comments_count = commentsCount;

              return updates;
            }
            return recipe;
          });
        };

        return {
          ...oldProfile,
          uploaded_videos: updateRecipeInArray(oldProfile.uploaded_videos),
          saved_recipes: updateRecipeInArray(oldProfile.saved_recipes),
        };
      });
    },
    [queryClient],
  );

  // Optimistic like update
  const optimisticLikeUpdate = useCallback(
    (recipeId: string, userId?: string) => {
      // Get current state from any available cache
      const feedData = queryClient.getQueryData(['feed']) as any[];
      const recipeData = userId
        ? (queryClient.getQueryData(['recipeDetails', recipeId, userId]) as any)
        : null;

      // Determine current like state from available data
      let currentLiked = false;
      let currentLikes = 0;

      if (recipeData) {
        currentLiked = recipeData.is_liked_by_user ?? false;
        currentLikes = recipeData.likes ?? 0;
      } else if (feedData) {
        const feedItem = feedData.find(
          (item: any) => item.id === recipeId || item.recipe_id === recipeId,
        );
        if (feedItem) {
          currentLiked = feedItem.liked ?? false;
          currentLikes = feedItem.likes ?? 0;
        }
      }

      const newLiked = !currentLiked;
      const newLikes = currentLiked ? currentLikes - 1 : currentLikes + 1;

      updateAllCaches({
        recipeId,
        userId,
        likes: newLikes,
        isLiked: newLiked,
      });

      return { newLiked, newLikes };
    },
    [queryClient, updateAllCaches],
  );

  // Optimistic save update
  const optimisticSaveUpdate = useCallback(
    (recipeId: string, userId?: string) => {
      // Get current state from any available cache
      const feedData = queryClient.getQueryData(['feed']) as any[];
      const recipeData = userId
        ? (queryClient.getQueryData(['recipeDetails', recipeId, userId]) as any)
        : null;

      // Determine current save state from available data
      let currentSaved = false;

      if (recipeData) {
        currentSaved = recipeData.is_saved_by_user || false;
      } else if (feedData) {
        const feedItem = feedData.find(
          (item: any) => item.id === recipeId || item.recipe_id === recipeId,
        );
        if (feedItem) {
          currentSaved = feedItem.saved || false;
        }
      }

      const newSaved = !currentSaved;

      updateAllCaches({
        recipeId,
        userId,
        isSaved: newSaved,
      });

      return { newSaved };
    },
    [queryClient, updateAllCaches],
  );

  // Handle server response for likes
  const handleLikeServerResponse = useCallback(
    (recipeId: string, serverResponse: any, userId?: string) => {
      if (
        serverResponse &&
        typeof serverResponse === 'object' &&
        ('liked' in serverResponse || 'is_liked' in serverResponse) &&
        'likes_count' in serverResponse
      ) {
        updateAllCaches({
          recipeId,
          userId,
          likes: serverResponse.likes_count,
          isLiked: serverResponse.liked ?? serverResponse.is_liked,
        });
        return true;
      }
      return false;
    },
    [updateAllCaches],
  );

  // Rollback changes on error
  const rollbackChanges = useCallback(
    (recipeId: string, previousData: any, userId?: string) => {
      if (previousData.previousFeed) {
        queryClient.setQueryData(['feed'], previousData.previousFeed);
      }
      if (previousData.previousRecipeData && userId) {
        queryClient.setQueryData(
          ['recipeDetails', recipeId, userId],
          previousData.previousRecipeData,
        );
      }
      if (previousData.previousProfile) {
        queryClient.setQueryData(['profile'], previousData.previousProfile);
      }
    },
    [queryClient],
  );

  // Snapshot current cache state
  const snapshotCaches = useCallback(
    (recipeId: string, userId?: string) => {
      return {
        previousFeed: queryClient.getQueryData(['feed']),
        previousRecipeData: userId
          ? queryClient.getQueryData(['recipeDetails', recipeId, userId])
          : null,
        previousProfile: queryClient.getQueryData(['profile']),
      };
    },
    [queryClient],
  );

  // Cancel queries to prevent race conditions
  const cancelQueries = useCallback(
    async (recipeId: string, userId?: string) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      if (userId) {
        await queryClient.cancelQueries({
          queryKey: ['recipeDetails', recipeId, userId],
        });
      }
      await queryClient.cancelQueries({ queryKey: ['profile'] });
    },
    [queryClient],
  );

  // Invalidate queries for fresh data
  const invalidateQueries = useCallback(
    (recipeId: string, userId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: ['recipeDetails', recipeId, userId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({
        queryKey: ['recipe-comments', recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['recipe-comments-count', recipeId],
      });
    },
    [queryClient],
  );

  // Optimized comment count update with debouncing and duplicate prevention
  const updateCommentCount = useCallback(
    async (recipeId: string, userId?: string) => {
      // Check if request is already pending for this recipe
      if (pendingCommentRequests.current.has(recipeId)) {
        console.log(
          `[useCacheManager] Comment count request already pending for recipe ${recipeId}, skipping`,
        );
        return;
      }

      // Clear any existing timeout for this recipe
      const existingTimeout = commentCountTimeouts.current.get(recipeId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Debounce the request
      const timeoutId = setTimeout(async () => {
        // Mark request as pending
        pendingCommentRequests.current.add(recipeId);

        try {
          // Check if we already have recent comment data in cache
          const existingComments = queryClient.getQueryData([
            'recipe-comments',
            recipeId,
          ]) as any[];
          if (existingComments && Array.isArray(existingComments)) {
            console.log(
              `[useCacheManager] Using cached comment count for recipe ${recipeId}: ${existingComments.length}`,
            );
            updateAllCaches({
              recipeId,
              userId,
              commentsCount: existingComments.length,
            });
            return existingComments.length;
          }

          const { data, error } = await supabase.rpc('get_recipe_comments', {
            p_recipe_id: recipeId,
          });

          if (error) {
            console.error(
              `[useCacheManager] Error fetching comments for recipe ${recipeId}:`,
              error,
            );
            return 0;
          }

          // Handle different possible data structures from the RPC
          let actualCommentCount = 0;
          if (data) {
            if (Array.isArray(data)) {
              actualCommentCount = data.length;
            } else if (typeof data === 'number') {
              actualCommentCount = data;
            } else if (data.length !== undefined) {
              actualCommentCount = data.length;
            } else {
              console.warn(
                `[useCacheManager] Unexpected data structure for comments in recipe ${recipeId}:`,
                data,
              );
              actualCommentCount = 0;
            }
          }

          console.log(
            `[useCacheManager] Fetched comment count for recipe ${recipeId}: ${actualCommentCount}`,
          );

          // Update all caches with the correct comment count
          updateAllCaches({
            recipeId,
            userId,
            commentsCount: actualCommentCount,
          });

          // Cache the comments data to prevent future requests
          queryClient.setQueryData(
            ['recipe-comments', recipeId],
            Array.isArray(data) ? data : [],
          );

          return actualCommentCount;
        } catch (error) {
          console.error(
            `[useCacheManager] Exception fetching comments for recipe ${recipeId}:`,
            error,
          );
          return 0;
        } finally {
          // Remove from pending requests
          pendingCommentRequests.current.delete(recipeId);
          commentCountTimeouts.current.delete(recipeId);
        }
      }, 300); // 300ms debounce

      // Store the timeout
      commentCountTimeouts.current.set(recipeId, timeoutId);
    },
    [updateAllCaches, queryClient],
  );

  // RESTORED: Simple like count update since backend is now fixed
  const updateLikeCount = useCallback(
    async (recipeId: string, userId?: string) => {
      // Check if request is already pending for this recipe
      if (pendingLikeRequests.current.has(recipeId)) {
        console.log(
          `[useCacheManager] Like count request already pending for recipe ${recipeId}, skipping`,
        );
        return;
      }

      // Clear any existing timeout for this recipe
      const existingTimeout = likeCountTimeouts.current.get(recipeId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Debounce the request
      const timeoutId = setTimeout(async () => {
        // Mark request as pending
        pendingLikeRequests.current.add(recipeId);

        try {
          // Fetch accurate like data from recipe details RPC (backend fixed)
          const { data, error } = await supabase.rpc('get_recipe_details', {
            p_user_id: userId,
            p_recipe_id: recipeId,
          });

          if (error) {
            console.error(
              `[useCacheManager] Error fetching recipe details for like data ${recipeId}:`,
              error,
            );
            return;
          }

          if (!data) {
            console.warn(
              `[useCacheManager] No recipe details data for recipe ${recipeId}`,
            );
            return;
          }

          // FIX: Use correct backend field names
          const actualLikeCount = data.recipe_details_likes ?? data.likes ?? 0; // Backend uses recipe_details_likes
          const actualIsLiked =
            data.recipe_details_liked ?? data.is_liked_by_user ?? false; // Backend uses recipe_details_liked

          console.log(
            `[useCacheManager] ✅ FIELD MAPPING FIXED - fetched like data for recipe ${recipeId}:`,
            {
              raw_recipe_details_likes: data.recipe_details_likes,
              raw_recipe_details_liked: data.recipe_details_liked,
              processed_likes: actualLikeCount,
              processed_isLiked: actualIsLiked,
              backend_team_was_right: 'YES!',
            },
          );

          // Update all caches with the correct like count and state
          updateAllCaches({
            recipeId,
            userId,
            likes: actualLikeCount,
            isLiked: actualIsLiked,
          });

          return { likes: actualLikeCount, isLiked: actualIsLiked };
        } catch (error) {
          console.error(
            `[useCacheManager] Exception fetching like data for recipe ${recipeId}:`,
            error,
          );
          return { likes: 0, isLiked: false };
        } finally {
          // Remove from pending requests
          pendingLikeRequests.current.delete(recipeId);
          likeCountTimeouts.current.delete(recipeId);
        }
      }, 300); // 300ms debounce

      // Store the timeout
      likeCountTimeouts.current.set(recipeId, timeoutId);
    },
    [updateAllCaches, queryClient],
  );

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
    updateLikeCount,
    queryClient,
  };
};
