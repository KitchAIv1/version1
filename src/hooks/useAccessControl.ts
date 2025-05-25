import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../services/supabase';

// Constants for limits
const FREEMIUM_SCAN_LIMIT = 3;
const FREEMIUM_AI_RECIPE_LIMIT = 10;

export const useAccessControl = () => {
  const { user, profile, usageLimits, getEffectiveTier, isCreator, refreshUsageLimits } = useAuth();
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
  const performPantryScan = useCallback(async (items: any[], scanStatus: string = 'success') => {
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
          { text: 'Upgrade Now', onPress: () => {/* Navigate to upgrade screen */} }
        ]
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
  }, [user, canPerformScan, refreshUsageLimits]);

  // Generate AI recipe with access control
  const generateAIRecipe = useCallback(async (recipeData: any) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return null;
    }

    if (!canGenerateAIRecipe()) {
      Alert.alert(
        'AI Recipe Limit Reached',
        'FREEMIUM limit reached: 10 AI recipes per month. Upgrade to PREMIUM for unlimited access.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade Now', onPress: () => {/* Navigate to upgrade screen */} }
        ]
      );
      return null;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('generate_ai_recipe', {
        p_user_id: user.id,
        p_recipe_data: recipeData,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return null;
      }

      // Refresh usage limits after successful generation
      await refreshUsageLimits(user.id);
      return data;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate AI recipe');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [user, canGenerateAIRecipe, refreshUsageLimits]);

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