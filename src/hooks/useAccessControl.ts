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
    usageLimits,
    getEffectiveTier,
    isCreator,
    refreshUsageLimits,
  } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if user can perform pantry scan
  const canPerformScan = useCallback((): boolean => {
    if (isCreator() || getEffectiveTier() === 'PREMIUM') {
      return true;
    }

    return (usageLimits?.scan_count || 0) < FREEMIUM_SCAN_LIMIT;
  }, [isCreator, getEffectiveTier, usageLimits]);

  // Check if user can generate AI recipe
  const canGenerateAIRecipe = useCallback((): boolean => {
    if (isCreator() || getEffectiveTier() === 'PREMIUM') {
      return true;
    }

    return (usageLimits?.ai_recipe_count || 0) < FREEMIUM_AI_RECIPE_LIMIT;
  }, [isCreator, getEffectiveTier, usageLimits]);

  // Perform pantry scan with access control
  const performPantryScan = useCallback(
    async (items: any[], scanStatus: string = 'success') => {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return false;
      }

      if (!canPerformScan()) {
        Alert.alert(
          'Scan Limit Reached',
          'FREEMIUM limit reached: 3 scans per month. Upgrade to PREMIUM for unlimited access.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upgrade Now',
              onPress: () => {
                /* Navigate to upgrade screen */
              },
            },
          ],
        );
        return false;
      }

      setIsProcessing(true);
      try {
        const { error } = await supabase.rpc('log_pantry_scan', {
          p_user_id: user.id,
          p_items_scanned: items,
          p_scan_status: scanStatus,
        });

        if (error) {
          Alert.alert('Error', error.message);
          return false;
        }

        // Refresh usage limits after successful scan
        await refreshUsageLimits(user.id);
        return true;
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to perform scan');
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [user, canPerformScan, refreshUsageLimits],
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
          // If direct JSON parsing fails, try to extract JSON from markdown
          if (rawResponse.includes('```json')) {
            const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
              try {
                data = JSON.parse(jsonMatch[1]);
                console.log(
                  '[useAccessControl] Parsed JSON from markdown in response:',
                  data,
                );
              } catch (innerParseError) {
                console.error(
                  '[useAccessControl] Failed to parse JSON from markdown:',
                  innerParseError,
                );
                Alert.alert('Error', 'Invalid response format from AI service');
                return null;
              }
            } else {
              console.error(
                '[useAccessControl] No valid JSON found in markdown response',
              );
              Alert.alert('Error', 'Invalid response format from AI service');
              return null;
            }
          } else {
            console.error(
              '[useAccessControl] Failed to parse response as JSON:',
              parseError,
            );
            Alert.alert('Error', 'Invalid response from AI service');
            return null;
          }
        }

        if (!response.ok) {
          console.error('[useAccessControl] Edge Function error:', data);

          // Special handling: If the error contains JSON parsing issues with markdown,
          // try to extract the JSON from the error message itself
          if (
            data.error &&
            typeof data.error === 'string' &&
            data.error.includes('```json')
          ) {
            console.log(
              '[useAccessControl] Attempting to extract JSON from error message...',
            );
            try {
              // The error message contains the actual JSON we need
              const jsonMatch = data.error.match(
                /```json\s*([\s\S]*?)(?:\s*```|$)/,
              );
              if (jsonMatch && jsonMatch[1]) {
                const extractedJson = JSON.parse(jsonMatch[1]);
                console.log(
                  '[useAccessControl] Successfully extracted JSON from error message:',
                  extractedJson,
                );

                // Refresh usage limits after successful generation
                await refreshUsageLimits(user.id);

                return extractedJson; // Return the extracted recipes
              }
            } catch (extractError) {
              console.error(
                '[useAccessControl] Failed to extract JSON from error message:',
                extractError,
              );
            }
          }

          // Handle specific error cases
          if (
            data.error?.includes('limit reached') ||
            data.error?.includes('LIMIT_EXCEEDED')
          ) {
            Alert.alert(
              'AI Recipe Limit Reached',
              'FREEMIUM limit reached: 10 AI recipes per month. Upgrade to PREMIUM for unlimited access.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Upgrade Now',
                  onPress: () => {
                    /* Navigate to upgrade screen */
                  },
                },
              ],
            );
          } else {
            Alert.alert('Error', data.error || 'Failed to generate AI recipe');
          }
          return null;
        }

        console.log('[useAccessControl] Edge Function returned recipes:', data);

        // Handle case where AI returns JSON wrapped in markdown code blocks in the data field
        let parsedData = data;
        if (typeof data === 'string' && data.includes('```json')) {
          try {
            // Extract JSON from markdown code blocks
            const jsonMatch = data.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
              parsedData = JSON.parse(jsonMatch[1]);
              console.log(
                '[useAccessControl] Parsed JSON from markdown:',
                parsedData,
              );
            }
          } catch (parseError) {
            console.error(
              '[useAccessControl] Failed to parse JSON from markdown:',
              parseError,
            );
            Alert.alert('Error', 'Invalid response format from AI service');
            return null;
          }
        }

        // Refresh usage limits after successful generation
        await refreshUsageLimits(user.id);

        return parsedData; // Should be array of 3 recipes with recipe_id
      } catch (error: any) {
        console.error('[useAccessControl] AI recipe generation error:', error);
        Alert.alert('Error', error.message || 'Failed to generate AI recipe');
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [user, refreshUsageLimits],
  );

  // Get usage display data
  const getUsageDisplay = useCallback(() => {
    if (isCreator()) {
      return {
        tierDisplay: 'CREATOR (PREMIUM)',
        showUsage: false,
        scanUsage: '',
        aiRecipeUsage: '',
      };
    }

    const effectiveTier = getEffectiveTier();

    if (effectiveTier === 'PREMIUM') {
      return {
        tierDisplay: 'PREMIUM',
        showUsage: false,
        scanUsage: '',
        aiRecipeUsage: '',
      };
    }

    // FREEMIUM user
    return {
      tierDisplay: 'FREEMIUM',
      showUsage: true,
      scanUsage: `${usageLimits?.scan_count || 0}/${FREEMIUM_SCAN_LIMIT}`,
      aiRecipeUsage: `${usageLimits?.ai_recipe_count || 0}/${FREEMIUM_AI_RECIPE_LIMIT}`,
    };
  }, [isCreator, getEffectiveTier, usageLimits]);

  return {
    // Access checks
    canPerformScan,
    canGenerateAIRecipe,

    // Actions with access control
    performPantryScan,
    generateAIRecipe,

    // Display helpers
    getUsageDisplay,

    // State
    isProcessing,

    // Constants
    FREEMIUM_SCAN_LIMIT,
    FREEMIUM_AI_RECIPE_LIMIT,
  };
};
