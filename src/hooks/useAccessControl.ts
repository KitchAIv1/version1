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
    async (recipeData: any, retryCount = 0) => {
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

        // Call the Edge Function with proper user authentication
        const supabaseUrl = 'https://btpmaqffdmxhugvybgfn.supabase.co';
        
        // 🔧 CRITICAL FIX: Use user's JWT token, not anon key
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.error('[useAccessControl] No user session found');
          Alert.alert('Error', 'Authentication required');
          return null;
        }

        console.log('[useAccessControl] Using user JWT token for Edge Function authentication');

        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-recipe`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
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

        // 🔧 ENHANCED ERROR HANDLING: Better OpenAI error diagnosis
        let data;
        try {
          data = JSON.parse(rawResponse);
        } catch (parseError) {
          console.error('[useAccessControl] 🚨 JSON Parse Error Details:');
          console.error('[useAccessControl] ❌ Parse Error:', parseError);
          console.error('[useAccessControl] 📄 Raw Response Length:', rawResponse.length);
          console.error('[useAccessControl] 📄 Raw Response Preview (first 500 chars):', rawResponse.substring(0, 500));
          console.error('[useAccessControl] 📄 Raw Response End (last 200 chars):', rawResponse.substring(Math.max(0, rawResponse.length - 200)));
          
          // 🔧 SMART FALLBACK: Try to extract JSON from markdown or partial response
          console.log('[useAccessControl] 🔧 Attempting smart JSON extraction...');
          
          // Try to extract JSON from markdown blocks
          const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              data = JSON.parse(jsonMatch[1].trim());
              console.log('[useAccessControl] ✅ Successfully extracted JSON from markdown block');
            } catch (markdownError) {
              console.error('[useAccessControl] ❌ Markdown JSON extraction failed:', markdownError);
            }
          }
          
          // Try to fix common JSON truncation issues
          if (!data && rawResponse.includes('{')) {
            try {
              // Find the last complete JSON object
              const lastBraceIndex = rawResponse.lastIndexOf('}');
              if (lastBraceIndex > 0) {
                const truncatedJson = rawResponse.substring(0, lastBraceIndex + 1);
                data = JSON.parse(truncatedJson);
                console.log('[useAccessControl] ✅ Successfully parsed truncated JSON');
              }
            } catch (truncationError) {
              console.error('[useAccessControl] ❌ Truncated JSON parsing failed:', truncationError);
            }
          }
          
          // If all parsing attempts fail, provide detailed error
          if (!data) {
            console.error('[useAccessControl] 💥 All JSON parsing attempts failed');
            
            // 🔧 FALLBACK: Return structured error for user feedback
            Alert.alert(
              'AI Service Temporarily Unavailable',
              'The AI recipe service is experiencing issues. Please try again in a moment.',
              [
                { text: 'Retry', onPress: () => {} },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
            return null;
          }
        }

        if (!response.ok) {
          console.error('[useAccessControl] Edge Function error:', data);

          // 🔧 ENHANCED ERROR CATEGORIZATION
          const errorMessage = data.error || 'Unknown error';
          console.error('[useAccessControl] 📊 Error Analysis:');
          console.error('[useAccessControl] - Status Code:', response.status);
          console.error('[useAccessControl] - Response Size:', rawResponse.length, 'bytes');
          console.error('[useAccessControl] - Error Type:', typeof data.error);
          console.error('[useAccessControl] - Error Contains OpenAI:', errorMessage.includes('OpenAI'));
          console.error('[useAccessControl] - Error Contains JSON:', errorMessage.includes('JSON'));
          console.error('[useAccessControl] - Error Contains Token:', errorMessage.includes('token'));

          // 🔧 SPECIFIC HANDLING FOR 500 ERRORS (Edge Function Internal Errors)
          if (response.status === 500) {
            console.error('[useAccessControl] 🚨 Edge Function Internal Server Error (500)');
            console.error('[useAccessControl] 🚨 This indicates an issue with the OpenAI service or Edge Function itself');
            
            // 🔧 SMART RETRY LOGIC for 500 errors
            const maxRetries = 2;
            if (retryCount < maxRetries) {
              const delayMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
              console.log(`[useAccessControl] 🔄 Retrying in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
              
              setIsProcessing(false); // Allow UI to update
              await new Promise(resolve => setTimeout(resolve, delayMs));
              setIsProcessing(true);
              
              return generateAIRecipe(recipeData, retryCount + 1);
            }
            
            // Max retries reached, show user-friendly error
            Alert.alert(
              'AI Service Temporarily Down',
              'The AI recipe generator is experiencing technical difficulties. This is usually temporary and resolves within a few minutes.',
              [
                { 
                  text: 'Try Again Later', 
                  onPress: () => {},
                  style: 'default'
                },
                { 
                  text: 'Cancel', 
                  style: 'cancel' 
                }
              ]
            );
            return null;
          }

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
          } 
          
          // 🔧 OPENAI-SPECIFIC ERROR HANDLING
          else if (errorMessage.includes('OpenAI') || errorMessage.includes('JSON')) {
            console.error('[useAccessControl] 🤖 OpenAI Service Error Detected');
            Alert.alert(
              'AI Service Issue',
              'The AI recipe generator encountered a temporary issue. This is usually resolved by trying again.',
              [
                { text: 'Try Again', onPress: () => {} },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
            return null;
          } 
          
          // Generic error handling
          else {
            Alert.alert('Error', data.error || 'Failed to generate AI recipe');
            return null;
          }
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

        // ✅ SUCCESS: AI recipe generated successfully, now track usage
        console.log('[useAccessControl] 🎯 AI recipe generation successful - proceeding with usage tracking');
        
        // CRITICAL FIX: The Edge Function does NOT handle usage tracking, we need to call it here
        // Update usage tracking to work with backend's table structure
        try {
          console.log('[useAccessControl] Logging AI recipe generation usage...');
          console.log('[useAccessControl] User ID:', user.id);
          
          // 🔧 BACKEND FIX: Work with actual table structure
          // First, get current usage to calculate new value
          const { data: currentUsage, error: fetchError } = await supabase
            .from('user_usage_limits')
            .select('used_value, ai_recipe_count')
            .eq('user_id', user.id)
            .eq('limit_type', 'ai_recipe')
            .single();

          console.log('[useAccessControl] Current usage fetch result:', { 
            data: currentUsage, 
            error: fetchError?.message,
            hasData: !!currentUsage 
          });

          let newUsedValue = 1;
          let newAiRecipeCount = 1;

          if (!fetchError && currentUsage) {
            newUsedValue = (currentUsage.used_value || 0) + 1;
            newAiRecipeCount = (currentUsage.ai_recipe_count || 0) + 1;
            console.log('[useAccessControl] Incrementing existing usage:', {
              oldUsed: currentUsage.used_value,
              oldCount: currentUsage.ai_recipe_count,
              newUsed: newUsedValue,
              newCount: newAiRecipeCount,
            });
          } else {
            console.log('[useAccessControl] Creating new usage record (no existing data found)');
          }

          // Backend uses separate rows for each limit_type
          const upsertData = {
            user_id: user.id,
            limit_type: 'ai_recipe',
            limit_value: FREEMIUM_AI_RECIPE_LIMIT,
            used_value: newUsedValue,
            ai_recipe_count: newAiRecipeCount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          console.log('[useAccessControl] Upserting usage data:', upsertData);

          const { data: upsertResult, error: usageError } = await supabase
            .from('user_usage_limits')
            .upsert(upsertData, {
              onConflict: 'user_id,limit_type',
              ignoreDuplicates: false,
            })
            .select();
          
          if (usageError) {
            console.error('[useAccessControl] ❌ Error logging AI recipe usage:', usageError);
            console.error('[useAccessControl] ❌ Error details:', {
              message: usageError.message,
              details: usageError.details,
              hint: usageError.hint,
              code: usageError.code,
            });
          } else {
            console.log('[useAccessControl] ✅ AI recipe usage logged successfully!');
            console.log('[useAccessControl] ✅ Upsert result:', upsertResult);
            console.log('[useAccessControl] ✅ New usage stats:', {
              used_value: newUsedValue,
              ai_recipe_count: newAiRecipeCount,
              remaining: FREEMIUM_AI_RECIPE_LIMIT - newUsedValue,
            });
          }
        } catch (usageTrackingError: any) {
          console.error('[useAccessControl] ❌ Usage tracking exception:', usageTrackingError);
          console.error('[useAccessControl] ❌ Exception details:', {
            name: usageTrackingError?.name,
            message: usageTrackingError?.message,
            stack: usageTrackingError?.stack,
          });
          // Don't fail the generation - usage tracking is secondary
        }

        return recipesData; // Should be array of 3 recipes with recipe_id
      } catch (error: any) {
        console.error('[useAccessControl] AI recipe generation error:', error);
        
        // 🔧 NETWORK ERROR HANDLING
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          Alert.alert(
            'Connection Error',
            'Unable to connect to AI service. Please check your internet connection and try again.',
            [
              { text: 'Retry', onPress: () => {} },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to generate AI recipe');
        }
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
      // 🔧 CRITICAL FIX: Work with actual backend table structure
      // Backend uses separate rows for each limit_type, not a single row
      const { data, error } = await supabase
        .from('user_usage_limits')
        .select('limit_type, limit_value, used_value, scan_count, ai_recipe_count')
        .eq('user_id', user.id);

      if (error) {
        console.error('[useAccessControl] Error fetching usage status:', error);
        return null;
      }

      console.log('[useAccessControl] Raw usage data from backend:', data);

      if (!data || data.length === 0) {
        // No usage data found, return defaults for FREEMIUM user
        return {
          tier: 'FREEMIUM',
          unlimited_access: false,
          scan_count: 0,
          ai_recipe_count: 0,
          scan_limit: FREEMIUM_SCAN_LIMIT,
          ai_recipe_limit: FREEMIUM_AI_RECIPE_LIMIT,
          scans_remaining: FREEMIUM_SCAN_LIMIT,
          ai_recipes_remaining: FREEMIUM_AI_RECIPE_LIMIT,
        };
      }

      // Parse the backend data structure
      let scanUsage = 0;
      let aiRecipeUsage = 0;
      let scanLimit = FREEMIUM_SCAN_LIMIT;
      let aiRecipeLimit = FREEMIUM_AI_RECIPE_LIMIT;

      // Process each row (one for each limit_type)
      data.forEach(row => {
        if (row.limit_type === 'scan') {
          scanUsage = row.used_value || row.scan_count || 0;
          scanLimit = row.limit_value || FREEMIUM_SCAN_LIMIT;
        } else if (row.limit_type === 'ai_recipe') {
          aiRecipeUsage = row.used_value || row.ai_recipe_count || 0;
          aiRecipeLimit = row.limit_value || FREEMIUM_AI_RECIPE_LIMIT;
        }
      });

      const result = {
        tier: 'FREEMIUM',
        unlimited_access: false,
        scan_count: scanUsage,
        ai_recipe_count: aiRecipeUsage,
        scan_limit: scanLimit,
        ai_recipe_limit: aiRecipeLimit,
        scans_remaining: Math.max(0, scanLimit - scanUsage),
        ai_recipes_remaining: Math.max(0, aiRecipeLimit - aiRecipeUsage),
      };

      console.log('[useAccessControl] Processed usage status:', result);
      return result;

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
