import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../services/supabase';

// Constants for limits
const FREEMIUM_SCAN_LIMIT = 3;
const FREEMIUM_AI_RECIPE_LIMIT = 10;

export const useAccessControl = () => {
  const {
    user,
    profile,
    getEffectiveTier,
    isCreator,
  } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // Legacy synchronous function - kept for backward compatibility
  const canPerformScan = useCallback((): boolean => {
    const isCreatorResult = isCreator();
    const effectiveTier = getEffectiveTier();
    
    // PREMIUM/CREATOR users always have access
    if (isCreatorResult || effectiveTier === 'PREMIUM') {
      return true;
    }
    
    // For FREEMIUM users, this is just a fallback - use checkScanAvailability for real checks
    return true; 
  }, [isCreator, getEffectiveTier]);

  const canGenerateAIRecipe = useCallback((): boolean => {
    const isCreatorResult = isCreator();
    const effectiveTier = getEffectiveTier();
    
    // Always allow attempt for PREMIUM/CREATOR - backend will handle FREEMIUM limits
    return true;
  }, [isCreator, getEffectiveTier]);

  // Simple usage display - now returns static values, use getScanUsageDisplay for real data
  const getUsageDisplay = useCallback(() => {
    const isCreatorResult = isCreator();
    const effectiveTier = getEffectiveTier();

    if (isCreatorResult) {
      return {
        tierDisplay: 'CREATOR (PREMIUM)',
        showUsage: false,
        scanUsage: 'Unlimited',
        aiRecipeUsage: 'Unlimited',
      };
    }

    if (effectiveTier === 'PREMIUM') {
      return {
        tierDisplay: 'PREMIUM',
        showUsage: false,
        scanUsage: 'Unlimited',
        aiRecipeUsage: 'Unlimited',
      };
    }

    // FREEMIUM user - use dedicated functions for real data
    return {
      tierDisplay: 'FREEMIUM',
      showUsage: true,
      scanUsage: 'Check limits',
      aiRecipeUsage: 'Check limits',
    };
  }, [isCreator, getEffectiveTier]);

  // Perform pantry scan with access control using backend RPC
  const performPantryScan = useCallback(
    async (items: any[], scanStatus: string = 'completed'): Promise<boolean> => {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return false;
      }

      setIsProcessing(true);
      try {
        // Call backend RPC to log scan and check limits
        const { error } = await supabase.rpc('log_pantry_scan', {
          p_user_id: user.id,
          p_items_scanned: items.length,
          p_scan_status: scanStatus,
        });

        if (error) {
          console.error('[useAccessControl] Error logging pantry scan:', error);
          
          // Check if it's a limit exceeded error
          if (error.message.includes('limit exceeded') || error.message.includes('limit reached')) {
            // Return special object to trigger limit modal
            return { limitReached: true, limitType: 'scan' } as any;
          }
          
          Alert.alert('Error', error.message || 'Failed to perform scan');
          return false;
        }

        console.log('[useAccessControl] Pantry scan logged successfully');
        return true;
      } catch (error: any) {
        console.error('[useAccessControl] Error logging pantry scan:', error);
        Alert.alert('Error', error.message || 'Failed to perform scan');
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [user],
  );

  // Generate AI recipe with access control
  const generateAIRecipe = useCallback(
    async (recipeData: any) => {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return null;
      }

      setIsProcessing(true);
      try {
        console.log(
          '[useAccessControl] Calling Edge Function directly with data:',
          recipeData,
        );

        // Call the Edge Function directly as instructed by backend team
        const supabaseUrl = 'https://btpmaqffdmxhugvybgfn.supabase.co';
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-recipe`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              user_id: user.id,
              ingredients: recipeData.selected_ingredients || [],
              dietary_preferences: recipeData.dietary_restrictions || {},
              cuisine_style: recipeData.user_preferences?.cuisine_style,
              difficulty: recipeData.user_preferences?.difficulty || 'Medium',
              prep_time: recipeData.user_preferences?.max_prep_time || 45,
              servings: recipeData.user_preferences?.servings || 4,
            }),
          },
        );

        const rawResponse = await response.text();
        console.log(
          '[useAccessControl] Raw Edge Function response:',
          rawResponse,
        );

        let data;
        try {
          data = JSON.parse(rawResponse);
        } catch (parseError) {
          console.error('[useAccessControl] Failed to parse response as JSON:', parseError);
          Alert.alert('Error', 'Invalid response from AI service');
          return null;
        }

        if (!response.ok) {
          console.error('[useAccessControl] Edge Function error:', data);

          // Handle specific error cases for limits
          if (
            data.error?.includes('limit reached') ||
            data.error?.includes('limit exceeded') ||
            data.error?.includes('LIMIT_EXCEEDED') ||
            data.error_code === 'LIMIT_EXCEEDED'
          ) {
            console.log('[useAccessControl] AI recipe limit reached - returning limitReached object');
            
            // Return a special error object that the calling component can handle
            return {
              limitReached: true,
              limitType: 'ai_recipe',
              error: 'LIMIT_EXCEEDED',
              message: data.error || 'AI recipe generation limit reached',
              usageInfo: data.usage_info,
            };
          } else {
            Alert.alert('Error', data.error || 'Failed to generate AI recipe');
          }
          return null;
        }

        console.log('[useAccessControl] Edge Function returned recipes:', data);

        // Extract the recipe data from the response
        let recipesData;
        if (data.success && data.data) {
          recipesData = data.data; // Extract the actual recipes array
        } else if (Array.isArray(data)) {
          recipesData = data; // Direct array response
        } else {
          console.error('[useAccessControl] Unexpected response format:', data);
          Alert.alert('Error', 'Unexpected response format from AI service');
          return null;
        }

        console.log('[useAccessControl] Extracted recipes data:', recipesData);

        // CRITICAL FIX: The Edge Function does NOT handle usage tracking, we need to call it here
        // Call the usage tracking RPC function for FREEMIUM users
        try {
          console.log('[useAccessControl] Logging AI recipe generation usage...');
          const { error: usageError } = await supabase.rpc('log_ai_recipe_generation', {
            p_user_id: user.id,
          });
          
          if (usageError) {
            console.error('[useAccessControl] Error logging AI recipe usage:', usageError);
            // Don't fail the generation - usage tracking is secondary
          } else {
            console.log('[useAccessControl] ✅ AI recipe usage logged successfully');
          }
        } catch (usageTrackingError) {
          console.error('[useAccessControl] Usage tracking error:', usageTrackingError);
          // Don't fail the generation - usage tracking is secondary
        }

        return recipesData; // Should be array of 3 recipes with recipe_id
      } catch (error: any) {
        console.error('[useAccessControl] AI recipe generation error:', error);
        Alert.alert('Error', error.message || 'Failed to generate AI recipe');
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [user],
  );

  // Get usage status from backend RPC
  const getUserUsageStatus = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase.rpc('get_user_usage_status', {
        p_user_id: user.id,
      });

      if (error) {
        console.error('[useAccessControl] Error fetching usage status:', error);
        return null;
      }

      console.log('[useAccessControl] Usage status from backend:', data);
      return data;
    } catch (error) {
      console.error('[useAccessControl] Error in getUserUsageStatus:', error);
      return null;
    }
  }, [user]);

  // Check if user can generate AI recipes (for UI gating)
  const checkAIRecipeAvailability = useCallback(async () => {
    const isCreatorResult = isCreator();
    const effectiveTier = getEffectiveTier();

    // PREMIUM/CREATOR users always have access
    if (isCreatorResult || effectiveTier === 'PREMIUM') {
      return {
        canGenerate: true,
        isLimitReached: false,
        usage: null,
        reason: null,
      };
    }

    // FREEMIUM users - check backend limits
    if (!user?.id) {
      return {
        canGenerate: false,
        isLimitReached: false,
        usage: null,
        reason: 'User not authenticated',
      };
    }

    try {
      const usageStatus = await getUserUsageStatus();
      
      if (!usageStatus) {
        // If we can't get usage status, allow attempt (backend will handle)
        return {
          canGenerate: true,
          isLimitReached: false,
          usage: null,
          reason: null,
        };
      }

      // Backend returns usage status as an object, not array
      console.log('[useAccessControl] Raw usage status:', usageStatus);
      
      if (!usageStatus.ai_recipe_count && usageStatus.ai_recipe_count !== 0) {
        // No AI recipe usage data found, allow attempt
        return {
          canGenerate: true,
          isLimitReached: false,
          usage: null,
          reason: null,
        };
      }

      const currentUsage = usageStatus.ai_recipe_count || 0;
      const limit = usageStatus.ai_recipe_limit || FREEMIUM_AI_RECIPE_LIMIT;
      const remaining = usageStatus.ai_recipes_remaining || 0;
      const isLimitReached = remaining <= 0;

      console.log('[useAccessControl] AI Recipe Usage Check:', {
        currentUsage,
        limit,
        remaining,
        isLimitReached,
      });

      return {
        canGenerate: !isLimitReached,
        isLimitReached,
        usage: {
          current: currentUsage,
          limit: limit,
          remaining: remaining,
        },
        reason: isLimitReached ? 'AI recipe generation limit reached' : null,
      };

    } catch (error) {
      console.error('[useAccessControl] Error checking AI recipe availability:', error);
      // On error, allow attempt (backend will handle)
      return {
        canGenerate: true,
        isLimitReached: false,
        usage: null,
        reason: null,
      };
    }
  }, [user, isCreator, getEffectiveTier, getUserUsageStatus]);

  // Check scan availability and get usage data (for UI display)
  const getScanUsageDisplay = useCallback(async () => {
    console.log('[useAccessControl] getScanUsageDisplay called');
    
    const isCreatorResult = isCreator();
    const effectiveTier = getEffectiveTier();

    console.log('[useAccessControl] User tier check:', { isCreatorResult, effectiveTier });

    // PREMIUM/CREATOR users always have unlimited access
    if (isCreatorResult || effectiveTier === 'PREMIUM') {
      console.log('[useAccessControl] Premium/Creator user - returning Unlimited');
      return 'Unlimited';
    }

    // FREEMIUM users - check backend limits
    if (!user?.id) {
      console.log('[useAccessControl] No user ID - returning Loading');
      return 'Loading...';
    }

    try {
      console.log('[useAccessControl] Fetching usage status for scan display...');
      const usageStatus = await getUserUsageStatus();
      
      console.log('[useAccessControl] Raw usage status for scan display:', usageStatus);
      
      if (!usageStatus) {
        console.log('[useAccessControl] No usage status received - returning Loading');
        return 'Loading...';
      }

      // Backend returns usage status as an object
      const currentUsage = usageStatus.scan_count || 0;
      const limit = usageStatus.scan_limit || FREEMIUM_SCAN_LIMIT;
      const remaining = usageStatus.scans_remaining || 0;

      console.log('[useAccessControl] Scan Usage Check:', {
        currentUsage,
        limit,
        remaining,
        fullUsageStatus: usageStatus,
      });

      const displayText = `${remaining}/${limit} left`;
      console.log('[useAccessControl] Returning scan display text:', displayText);
      return displayText;

    } catch (error) {
      console.error('[useAccessControl] Error getting scan usage:', error);
      return 'Loading...';
    }
  }, [user, isCreator, getEffectiveTier, getUserUsageStatus]);

  // Check if user can perform scan (async check for accurate limits)
  const checkScanAvailability = useCallback(async () => {
    const isCreatorResult = isCreator();
    const effectiveTier = getEffectiveTier();
    
    // PREMIUM/CREATOR users always have access
    if (isCreatorResult || effectiveTier === 'PREMIUM') {
      return { canScan: true, limitReached: false };
    }
    
    // FREEMIUM users - check backend limits
    if (!user?.id) {
      return { canScan: false, limitReached: false };
    }

    try {
      const usageStatus = await getUserUsageStatus();
      
      if (!usageStatus) {
        // If we can't get usage status, allow attempt (backend will handle)
        return { canScan: true, limitReached: false };
      }

      const remaining = usageStatus.scans_remaining || 0;
      const limitReached = remaining <= 0;

      return { 
        canScan: !limitReached, 
        limitReached,
        usage: {
          current: usageStatus.scan_count || 0,
          limit: usageStatus.scan_limit || FREEMIUM_SCAN_LIMIT,
          remaining: remaining,
        }
      };

    } catch (error) {
      console.error('[useAccessControl] Error checking scan availability:', error);
      // On error, allow attempt (backend will handle)
      return { canScan: true, limitReached: false };
    }
  }, [isCreator, getEffectiveTier, user, getUserUsageStatus]);

  // Get AI recipe usage display (for UI display)
  const getAIRecipeUsageDisplay = useCallback(async () => {
    const isCreatorResult = isCreator();
    const effectiveTier = getEffectiveTier();

    // PREMIUM/CREATOR users always have unlimited access
    if (isCreatorResult || effectiveTier === 'PREMIUM') {
      return 'Unlimited';
    }

    // FREEMIUM users - check backend limits
    if (!user?.id) {
      return 'Loading...';
    }

    try {
      const usageStatus = await getUserUsageStatus();
      
      if (!usageStatus) {
        return 'Loading...';
      }

      // Backend returns usage status as an object
      const currentUsage = usageStatus.ai_recipe_count || 0;
      const limit = usageStatus.ai_recipe_limit || FREEMIUM_AI_RECIPE_LIMIT;
      const remaining = usageStatus.ai_recipes_remaining || 0;

      console.log('[useAccessControl] AI Recipe Usage Check:', {
        currentUsage,
        limit,
        remaining,
      });

      return `${remaining}/${limit} left`;

    } catch (error) {
      console.error('[useAccessControl] Error getting AI recipe usage:', error);
      return 'Loading...';
    }
  }, [user, isCreator, getEffectiveTier, getUserUsageStatus]);

  return {
    // Access checks
    canPerformScan,
    canGenerateAIRecipe,
    checkAIRecipeAvailability,
    checkScanAvailability,

    // Actions with access control
    performPantryScan,
    generateAIRecipe,

    // Usage tracking
    getUserUsageStatus,

    // Display helpers
    getUsageDisplay,
    getScanUsageDisplay,
    getAIRecipeUsageDisplay,

    // State
    isProcessing,

    // Constants
    FREEMIUM_SCAN_LIMIT,
    FREEMIUM_AI_RECIPE_LIMIT,
  };
};
