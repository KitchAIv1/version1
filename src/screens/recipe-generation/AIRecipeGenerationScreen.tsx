import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AIRecipeGenerationScreenProps } from '../../navigation/types';
import { useAccessControl } from '../../hooks/useAccessControl';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../services/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { parseIngredientString } from '../../utils/ingredientParser';
import { LimitReachedModal } from '../../components/modals/LimitReachedModal';

interface AIRecipeData {
  name: string;
  ingredients: string[];
  original_ingredients?: string[]; // NEW: Preserve original ingredients before validation
  optional_additions?: string[];
  steps: string[];
  estimated_time: number;
  servings: number;
  difficulty: string;
  estimated_cost?: string;
  nutrition_notes?: string;
  ai_confidence_score?: number;
}

export default function AIRecipeGenerationScreen({
  navigation,
  route,
}: AIRecipeGenerationScreenProps) {
  const { selectedIngredients, recipeData } = route.params;
  const { user } = useAuth();

  // Access control integration with proper user tier detection
  const {
    generateAIRecipe,
    canGenerateAIRecipe,
    isProcessing,
    getUsageDisplay,
    FREEMIUM_AI_RECIPE_LIMIT,
  } = useAccessControl();
  const queryClient = useQueryClient();

  // State management - Updated for multiple recipes
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipes, setGeneratedRecipes] = useState<AIRecipeData[]>(
    () => {
      if (recipeData) {
        // Transform old format to new format if needed
        if ('recipe_name' in recipeData) {
          const oldFormat = recipeData as any;
          return [
            {
              name: oldFormat.recipe_name,
              ingredients: oldFormat.ingredients,
              optional_additions: [],
              steps: oldFormat.preparation_steps,
              estimated_time:
                (oldFormat.prep_time_minutes || 0) +
                (oldFormat.cook_time_minutes || 0),
              servings: oldFormat.servings,
              difficulty: oldFormat.difficulty,
              estimated_cost: oldFormat.estimated_cost,
              nutrition_notes: oldFormat.nutrition_notes,
              ai_confidence_score: oldFormat.ai_confidence_score,
            },
          ];
        }
        return [recipeData];
      }
      return [];
    },
  );
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Generation steps for loading animation
  const generationSteps = [
    'Analyzing your ingredients...',
    'Finding perfect flavor combinations...',
    'Creating multiple recipe options...',
    'Ranking recipes by confidence...',
    'Your top 3 recipes are ready!',
  ];

  // Get user tier information for display
  const usageData = getUsageDisplay();
  const isUnlimitedUser = !usageData.showUsage; // PREMIUM/CREATOR users

  // Get current recipe for display
  const currentRecipe = generatedRecipes[currentRecipeIndex];

  // Auto-generate recipe when screen loads (if not already generated)
  useEffect(() => {
    if (generatedRecipes.length === 0 && !isGenerating && !error) {
      handleGenerateRecipe();
    }
  }, []);

  useEffect(() => {
    // Start pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    if (isGenerating) {
      pulseAnimation.start();
    } else {
      pulseAnimation.stop();
      pulseAnim.setValue(1);
    }

    return () => pulseAnimation.stop();
  }, [isGenerating, pulseAnim]);

  useEffect(() => {
    // Fade in animation for generated recipe
    if (currentRecipe && !isGenerating) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [currentRecipe, isGenerating, fadeAnim]);

  useEffect(() => {
    // Cycle through generation steps
    if (isGenerating) {
      const stepInterval = setInterval(() => {
        setGenerationStep(prev => {
          if (prev < generationSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 800);

      return () => clearInterval(stepInterval);
    }
  }, [isGenerating]);

  // Validation function to ensure recipes only use selected ingredients
  const validateRecipeIngredients = useCallback(
    (recipe: AIRecipeData, selectedIngredients: string[]) => {
      const selectedSet = new Set(
        selectedIngredients.map(ing => ing.toLowerCase().trim()),
      );

      console.log('[AIRecipeGeneration] Validating recipe ingredients:', {
        recipeName: recipe.name,
        recipeIngredients: recipe.ingredients,
        selectedIngredients,
        selectedSet: Array.from(selectedSet),
      });

      // Filter out ingredients not in user's selection
      const validIngredients: string[] = [];
      const invalidIngredients: string[] = [];

      // Guard against undefined or null ingredients array
      if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
        console.error('[AIRecipeGeneration] Recipe ingredients is not an array:', recipe.ingredients);
        return {
          ...recipe,
          ingredients: [],
          original_ingredients: recipe.ingredients || [], // Preserve original
          optional_additions: recipe.optional_additions || [],
        };
      }

      recipe.ingredients.forEach(ingredient => {
        const cleanIngredient = ingredient.toLowerCase().trim();
        // Check if any selected ingredient is contained in this recipe ingredient
        const isValid = Array.from(selectedSet).some(selectedIng =>
          cleanIngredient.includes(selectedIng) || selectedIng.includes(cleanIngredient)
        );

        if (isValid) {
          validIngredients.push(ingredient);
        } else {
          invalidIngredients.push(ingredient);
        }
      });

      console.log('[AIRecipeGeneration] Validation results:', {
        recipeName: recipe.name,
        originalCount: recipe.ingredients.length,
        validCount: validIngredients.length,
        validIngredients,
        invalidIngredients,
      });

      // Return recipe with validated ingredients and preserved original
      return {
        ...recipe,
        ingredients: validIngredients,
        original_ingredients: recipe.ingredients, // Preserve original ingredients
        optional_additions: [
          ...(recipe.optional_additions || []),
          ...invalidIngredients.map(ing => `${ing} (not in pantry)`),
        ],
      };
    },
    [],
  );

  const handleGenerateRecipe = async () => {
    // Let the backend handle all limit checking
    setIsGenerating(true);
    setGenerationStep(0);
    setError(null);

    try {
      // Prepare recipe data for AI generation
      const recipeRequestData = {
        selected_ingredients: selectedIngredients,
        user_preferences: {
          difficulty: 'Medium', // Default, could be user-selectable
          servings: 4,
          max_prep_time: 45,
        },
        dietary_restrictions: [], // Could be from user profile
        request_multiple: true, // Request top 3 recipes
      };

      console.log(
        '[AIRecipeGeneration] Generating recipe with ingredients:',
        selectedIngredients,
      );

      // Use the access control's generateAIRecipe function
      // This handles user tier detection and usage tracking automatically
      const result = await generateAIRecipe(recipeRequestData);

      // Check if limit was reached
      if (result && typeof result === 'object' && result.limitReached) {
        console.log('[AIRecipeGeneration] AI recipe limit reached, showing limit modal');
        setIsGenerating(false);
        setShowLimitModal(true);
        return;
      }

      if (result) {
        // Simulate minimum generation time for better UX
        await new Promise(resolve => setTimeout(resolve, 3000));

        let recipes: AIRecipeData[] = [];

        // Handle both single recipe and multiple recipes response
        if (Array.isArray(result)) {
          // Backend returned multiple recipes (top 3)
          recipes = result;
        } else {
          // Backend returned single recipe, create array
          recipes = [result];
        }

        // Validate recipe structure and add default values for missing fields
        recipes = recipes.map(recipe => ({
          name: recipe.name || 'Untitled Recipe',
          ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
          optional_additions: Array.isArray(recipe.optional_additions) ? recipe.optional_additions : [],
          steps: Array.isArray(recipe.steps) ? recipe.steps : [],
          estimated_time: recipe.estimated_time || 30,
          servings: recipe.servings || 4,
          difficulty: recipe.difficulty || 'Medium',
          estimated_cost: recipe.estimated_cost || '',
          nutrition_notes: recipe.nutrition_notes || '',
          ai_confidence_score: recipe.ai_confidence_score || 0.85,
        }));

        // Validate each recipe to ensure it only uses selected ingredients
        const validatedRecipes = recipes.map(recipe =>
          validateRecipeIngredients(recipe, selectedIngredients),
        );

        console.log(
          '[AIRecipeGeneration] Validated recipes:',
          validatedRecipes,
        );

        setGeneratedRecipes(validatedRecipes);
        setCurrentRecipeIndex(0); // Start with first recipe
        setIsGenerating(false);
      } else {
        throw new Error('Failed to generate recipe');
      }
    } catch (error: any) {
      console.error('[AIRecipeGeneration] Generation error:', error);
      setError(error.message || 'Failed to generate recipe');
      setIsGenerating(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!currentRecipe || !user?.id) return;

    try {
      console.log('[AIRecipeGeneration] Saving AI recipe:', currentRecipe);

      // Helper function to parse time strings like "45 minutes" into just the number
      const parseTimeToMinutes = (timeValue: any): number => {
        if (typeof timeValue === 'number') {
          return timeValue; // Already a number
        }
        if (typeof timeValue === 'string') {
          // Extract number from strings like "45 minutes", "1 hour", "30 mins", etc.
          const match = timeValue.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }
        return 0; // Default fallback
      };

      // CRITICAL FIX: Use the ORIGINAL AI-generated ingredients (before validation)
      // These are preserved in the original_ingredients field during validation
      const originalIngredients = currentRecipe.original_ingredients || currentRecipe.ingredients || [];
      
      console.log('[AIRecipeGeneration] Using original ingredients for parsing:', originalIngredients);
      console.log('[AIRecipeGeneration] Current recipe ingredients (after validation):', currentRecipe.ingredients);

      // Prepare recipe data with proper time parsing and ingredient formatting
      const processedRecipeData = {
        ...currentRecipe,
        title: currentRecipe.name, // Map 'name' to 'title' for backend compatibility
        estimated_time: parseTimeToMinutes(currentRecipe.estimated_time),
        // FIXED: Convert the ORIGINAL string array ingredients to object format with proper parsing
        ingredients: (originalIngredients || []).map(ingredient => {
          const parsed = parseIngredientString(ingredient);
          console.log(`[AIRecipeGeneration] Parsed ingredient "${ingredient}" -> quantity: "${parsed.quantity}", unit: "${parsed.unit}", name: "${parsed.ingredient}"`);
          return {
            name: parsed.ingredient, // Use the parsed ingredient name
            quantity: parsed.quantity || null, // Use parsed quantity
            unit: parsed.unit || null, // Use parsed unit
          };
        }),
        // Ensure AI flag is set
        is_ai_generated: true,
        // Add default thumbnail for AI recipes to prevent image loading errors
        thumbnail_url: 'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/porkstirfry.jpeg',
      };

      console.log('[AIRecipeGeneration] Processed recipe data before save:', {
        title: processedRecipeData.title,
        ingredientsFormat: processedRecipeData.ingredients.slice(0, 3),
        ingredientsCount: processedRecipeData.ingredients.length,
        estimated_time: processedRecipeData.estimated_time,
        is_ai_generated: processedRecipeData.is_ai_generated,
        thumbnail_url: processedRecipeData.thumbnail_url,
      });

      // CRITICAL FIX: Transform data to match backend expectations
      const transformedData = {
        ...processedRecipeData,
        // Map ingredientsFormat to ingredients (backend expects 'ingredients' key)
        ingredients: processedRecipeData.ingredients,
        // Ensure preparation_steps is properly mapped
        preparation_steps: currentRecipe.steps || [],
      };

      console.log('[AIRecipeGeneration] Transformed data for backend:', {
        ingredients_count: transformedData.ingredients?.length || 0,
        has_ingredients: !!transformedData.ingredients,
        ingredients_sample: transformedData.ingredients?.slice(0, 2),
        preparation_steps_count: transformedData.preparation_steps?.length || 0,
      });

      // Call the backend RPC to save the AI recipe (2-parameter version)
      const { data, error } = await supabase.rpc('save_ai_generated_recipe', {
        p_user_id: user.id,
        p_recipe_data: transformedData, // ✅ Use transformed data
      });

      if (error) {
        console.error('[AIRecipeGeneration] Save error:', error);
        Alert.alert('Error', 'Failed to save recipe. Please try again.');
        return;
      }

      console.log('[AIRecipeGeneration] Recipe saved successfully:', data);

      // AUTO-SAVE: Automatically save AI recipes to user's saved collection
      if (data?.recipe_id && user?.id) {
        try {
          console.log('[AIRecipeGeneration] Auto-saving AI recipe to saved collection...');
          const { error: saveError } = await supabase.rpc('save_recipe_video', {
            user_id_param: user.id,
            recipe_id_param: data.recipe_id,
          });
          
          if (saveError) {
            console.warn('[AIRecipeGeneration] Failed to auto-save recipe:', saveError);
            // Don't throw error - recipe creation succeeded, auto-save is bonus
          } else {
            console.log('[AIRecipeGeneration] AI recipe auto-saved to user collection');
          }
        } catch (autoSaveError) {
          console.warn('[AIRecipeGeneration] Auto-save error:', autoSaveError);
          // Don't throw error - recipe creation succeeded
        }
      }

      // Invalidate the profile cache to refresh the profile screen with the new recipe
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        console.log('[AIRecipeGeneration] Invalidated profile cache for user:', user.id);
      }

      Alert.alert(
        'Recipe Saved!',
        'Your AI-generated recipe has been saved to your collection.',
        [
          {
            text: 'View Recipe',
            onPress: () => {
              // Navigate to the saved recipe detail
              if (data?.recipe_id) {
                navigation.navigate('RecipeDetail', { id: data.recipe_id });
              }
            },
          },
          {
            text: 'Create Another',
            onPress: () => {
              setGeneratedRecipes([]);
              setCurrentRecipeIndex(0);
              setError(null);
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('[AIRecipeGeneration] Save error:', error);
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    setError(null);
    setGeneratedRecipes([]);
    setCurrentRecipeIndex(0);
    handleGenerateRecipe();
  };

  const handleNextRecipe = () => {
    if (currentRecipeIndex < generatedRecipes.length - 1) {
      setCurrentRecipeIndex(prev => prev + 1);
    }
  };

  const handlePreviousRecipe = () => {
    if (currentRecipeIndex > 0) {
      setCurrentRecipeIndex(prev => prev - 1);
    }
  };

  const handleGenerateMore = () => {
    // Let Edge Function handle validation - no pre-checks needed
    setGeneratedRecipes([]);
    setCurrentRecipeIndex(0);
    setError(null);
    handleGenerateRecipe();
  };

  // Loading state during generation
  if (isGenerating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Chef at Work</Text>
        </View>

        <View style={styles.generationContainer}>
          <Animated.View
            style={[
              styles.aiIconContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}>
            <Feather name="zap" size={48} color="#10b981" />
          </Animated.View>

          <Text style={styles.generationTitle}>Creating Your Recipe</Text>
          <Text style={styles.generationStep}>
            {generationSteps[generationStep]}
          </Text>

          <View style={styles.ingredientsPreview}>
            <Text style={styles.ingredientsTitle}>Using your ingredients:</Text>
            <Text style={styles.ingredientsList}>
              {selectedIngredients.slice(0, 5).join(', ')}
              {selectedIngredients.length > 5 &&
                ` +${selectedIngredients.length - 5} more`}
            </Text>
          </View>

          <ActivityIndicator
            size="large"
            color="#10b981"
            style={styles.loadingIndicator}
          />

          {/* User tier display */}
          <View style={styles.tierInfo}>
            <Text style={styles.tierText}>
              {isUnlimitedUser
                ? `${usageData.tierDisplay} • Unlimited AI Recipes`
                : `${usageData.tierDisplay} • ${usageData.aiRecipeUsage} AI Recipes Used`}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Recipe Generation</Text>
        </View>

        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Generation Failed</Text>
          <Text style={styles.errorMessage}>{error}</Text>

          <View style={styles.errorActions}>
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleGoBack}
              style={styles.backToResultsButton}>
              <Text style={styles.backToResultsText}>Back to Results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Generated recipe display
  if (currentRecipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Your AI Recipe</Text>
            <View style={styles.aiGeneratedBadge}>
              <Feather name="zap" size={12} color="#10b981" />
              <Text style={styles.aiGeneratedText}>AI Generated</Text>
            </View>
          </View>

          {/* Recipe Navigation - Show if multiple recipes */}
          {generatedRecipes.length > 1 && (
            <View style={styles.recipeNavigation}>
              <TouchableOpacity
                onPress={handlePreviousRecipe}
                style={[
                  styles.navButton,
                  currentRecipeIndex === 0 && styles.navButtonDisabled,
                ]}
                disabled={currentRecipeIndex === 0}>
                <Feather
                  name="chevron-left"
                  size={20}
                  color={currentRecipeIndex === 0 ? '#9ca3af' : '#10b981'}
                />
              </TouchableOpacity>

              <View style={styles.recipeIndicator}>
                <Text style={styles.recipeNumber}>
                  Recipe {currentRecipeIndex + 1} of {generatedRecipes.length}
                </Text>
                {currentRecipe.ai_confidence_score && (
                  <View style={styles.confidenceScore}>
                    <Feather name="star" size={12} color="#f59e0b" />
                    <Text style={styles.confidenceText}>
                      {Math.round(currentRecipe.ai_confidence_score * 100)}%
                      confidence
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={handleNextRecipe}
                style={[
                  styles.navButton,
                  currentRecipeIndex === generatedRecipes.length - 1 &&
                    styles.navButtonDisabled,
                ]}
                disabled={currentRecipeIndex === generatedRecipes.length - 1}>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={
                    currentRecipeIndex === generatedRecipes.length - 1
                      ? '#9ca3af'
                      : '#10b981'
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Animated.ScrollView
          style={[styles.content, { opacity: fadeAnim }]}
          showsVerticalScrollIndicator={false}>
          {/* Recipe Header */}
          <View style={styles.recipeHeader}>
            <Text style={styles.recipeTitle}>{currentRecipe.name}</Text>

            <View style={styles.recipeMetrics}>
              <View style={styles.metricItem}>
                <Feather name="clock" size={16} color="#6b7280" />
                <Text style={styles.metricText}>
                  {currentRecipe.estimated_time} min
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Feather name="users" size={16} color="#6b7280" />
                <Text style={styles.metricText}>
                  {currentRecipe.servings} servings
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Feather name="trending-up" size={16} color="#6b7280" />
                <Text style={styles.metricText}>
                  {currentRecipe.difficulty}
                </Text>
              </View>
            </View>
          </View>

          {/* Ingredients Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {(currentRecipe.ingredients || []).map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
                <View style={styles.ingredientBullet} />
                <Text style={styles.ingredientText}>{ingredient}</Text>
              </View>
            ))}
          </View>

          {/* Optional Additions Section */}
          {currentRecipe.optional_additions &&
            currentRecipe.optional_additions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Optional Additions</Text>
                <Text style={styles.sectionSubtitle}>
                  These ingredients can enhance your recipe but aren't required
                </Text>
                {(currentRecipe.optional_additions || []).map((addition, index) => (
                  <View key={index} style={styles.optionalItem}>
                    <View style={styles.optionalBullet} />
                    <Text style={styles.optionalText}>{addition}</Text>
                  </View>
                ))}
              </View>
            )}

          {/* Instructions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {(currentRecipe.steps || []).map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* AI Disclaimer */}
          <View style={styles.disclaimerSection}>
            <View style={styles.disclaimerHeader}>
              <Feather name="info" size={16} color="#f59e0b" />
              <Text style={styles.disclaimerTitle}>AI-Generated Recipe</Text>
            </View>
            <Text style={styles.disclaimerText}>
              This recipe was created by AI based on your selected ingredients.
              Please review ingredients for allergies and adjust cooking times
              as needed.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={handleSaveRecipe}
              style={styles.saveButton}>
              <Feather name="bookmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Recipe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGenerateMore}
              style={styles.generateAnotherButton}>
              <Feather name="refresh-cw" size={20} color="#10b981" />
              <Text style={styles.generateAnotherText}>Generate Another</Text>
            </TouchableOpacity>
          </View>

          {/* User tier info */}
          <View style={styles.tierInfoBottom}>
            <Text style={styles.tierTextBottom}>
              {isUnlimitedUser
                ? `${usageData.tierDisplay} • Unlimited AI Recipes`
                : `${usageData.tierDisplay} • ${usageData.aiRecipeUsage} AI Recipes Used`}
            </Text>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    );
  }

  // This should not be reached since we auto-generate on load
  return (
    <>
      {/* Limit Reached Modal */}
      <LimitReachedModal
        visible={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="ai_recipe"
        onUpgradeSuccess={() => {
          setShowLimitModal(false);
          // Refresh and continue with recipe generation
          handleGenerateRecipe();
        }}
        username={user?.user_metadata?.username || 'Chef'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  aiGeneratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  aiGeneratedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  generationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  aiIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  generationTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  generationStep: {
    fontSize: 16,
    color: '#10b981',
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
  },
  ingredientsPreview: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ingredientsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  ingredientsList: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  loadingIndicator: {
    marginBottom: 24,
  },
  tierInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  tierInfoBottom: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  tierTextBottom: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToResultsButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backToResultsText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  recipeHeader: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 24,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    lineHeight: 36,
  },
  recipeMetrics: {
    flexDirection: 'row',
    gap: 20,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  ingredientText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    flex: 1,
  },
  disclaimerSection: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  generateAnotherButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  generateAnotherText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  recipeNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
  },
  navButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  recipeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recipeNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confidenceScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  optionalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  optionalBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  optionalText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
});
