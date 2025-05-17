import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import WeekNavigator from './components/WeekNavigator';
import { useDailyMealPlan, PlannedRecipe } from '../../../hooks/useDailyMealPlan';
import { useUserRecipes } from '../../../hooks/useUserRecipes';
import SelectFromMyRecipesModal, { RecipeForModal } from '../../../components/modals/SelectFromMyRecipesModal';
import { RecipeItem } from '../../../types';
import { format } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Helper function to get the start of the week (Monday)
const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Helper function to generate an array of 7 dates for a week
const getWeekDates = (startDate: Date): Date[] => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + i);
    dates.push(nextDate);
  }
  return dates;
};

// Helper function to format date for display (e.g., "Mon")
const formatShortDay = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Helper function to format a week range string
const formatWeekRangeText = (startDate: Date): string => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const monthDayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  
  return `${monthDayFormat.format(startDate)} - ${monthDayFormat.format(endDate)}`;
};

// This helper should be available or imported if used like this
function getWeekStartDateHelper(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

const MealPlannerV2Screen = () => {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekIndicatorText, setWeekIndicatorText] = useState(() => 
    formatWeekRangeText(getWeekStartDateHelper(new Date()))
  );
  const [isRecipeModalVisible, setIsRecipeModalVisible] = useState(false);
  const [currentSelectedSlot, setCurrentSelectedSlot] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);

  // Format selectedDate for the hook
  const formattedDateForHook = format(selectedDate, 'yyyy-MM-dd');
  console.log(`[[MEAL_PLANNER_V2_SCREEN]] Requesting data for date: ${formattedDateForHook}`);

  const {
    dailyMealPlan,
    isLoadingDailyMealPlan,
    dailyMealPlanError,
    addRecipeToSlot,
    removeRecipeFromSlot,
    isAddingRecipe,
    isRemovingRecipe,
  } = useDailyMealPlan(formattedDateForHook);

  console.log(
    `[[MEAL_PLANNER_V2_SCREEN]] Received for date ${formattedDateForHook}:`,
    'isLoading:', isLoadingDailyMealPlan,
    'plan:', JSON.stringify(dailyMealPlan, null, 2)
  );

  // Fetch user's recipes for the modal
  const { 
    data: userRecipesData, 
    isLoading: isLoadingUserRecipes, 
    error: userRecipesError 
  } = useUserRecipes();

  // Map RecipeItem[] to RecipeForModal[] for the modal
  const recipesForModal: RecipeForModal[] = useMemo(() => {
    if (!userRecipesData) return [];
    // console.log('[[MEAL_PLANNER_V2_SCREEN]] Mapping userRecipesData to recipesForModal. Input userRecipesData:', JSON.stringify(userRecipesData, null, 2));
    const mapped = userRecipesData.map(recipe => ({
      recipe_id: recipe.recipe_id, // Use recipe.recipe_id from input
      recipe_name: recipe.title,   // Use recipe.title from input
      // Use recipe.thumbnail_url as primary, fallback to recipe.video_url if needed, then null
      thumbnail_url: recipe.thumbnail_url || recipe.video_url || null, 
    }));
    // console.log('[[MEAL_PLANNER_V2_SCREEN]] Output recipesForModal:', JSON.stringify(mapped, null, 2));
    return mapped;
  }, [userRecipesData]);

  const longDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedDayInfoText = `Displaying for: ${longDateFormat.format(selectedDate)}`;

  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    setWeekIndicatorText(formatWeekRangeText(getWeekStartDateHelper(date)));
  }, []);

  const handleTargetWeekChange = useCallback((newTargetWeekStart: Date) => {
    setWeekIndicatorText(formatWeekRangeText(newTargetWeekStart));
    setSelectedDate(new Date(newTargetWeekStart)); // Also update selectedDate to the first day of the target week
  }, []);

  const handleOpenRecipeSelectionModal = (slot: 'breakfast' | 'lunch' | 'dinner') => {
    setCurrentSelectedSlot(slot);
    setIsRecipeModalVisible(true);
  };

  const handleRemoveRecipe = (slot: 'breakfast' | 'lunch' | 'dinner') => {
    const recipeTitle = dailyMealPlan?.[slot]?.recipe_title || 'this recipe';
    Alert.alert(
      'Confirm Removal',
      `Are you sure you want to remove ${recipeTitle} from ${slot} for ${formattedDateForHook}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeRecipeFromSlot({ slot });
              Alert.alert('Success', `${recipeTitle} removed from ${slot}.`);
            } catch (e: any) {
              Alert.alert('Error', `Failed to remove recipe: ${e.message}`);
            }
          },
        },
      ]
    );
  };

  // Handler for when a recipe is selected from the modal
  const handleRecipeSelectedFromModal = async (recipe: RecipeForModal) => {
    if (currentSelectedSlot) {
      try {
        await addRecipeToSlot({ 
          slot: currentSelectedSlot, 
          recipeId: recipe.recipe_id,
          recipeTitle: recipe.recipe_name,
          recipeThumbnailUrl: recipe.thumbnail_url || undefined,
        });
        Alert.alert('Success', `${recipe.recipe_name} added to ${currentSelectedSlot} for ${formattedDateForHook}`);
      } catch (e: any) {
        Alert.alert('Error', `Failed to add recipe: ${e.message}`);
        console.error('Failed to add recipe to slot from modal:', e);
      }
    }
    setIsRecipeModalVisible(false);
    setCurrentSelectedSlot(null);
  };

  const handleCookRecipe = (recipeId: string) => {
    if (!recipeId) {
      console.warn('Attempted to navigate to recipe detail without a recipeId.');
      return;
    }
    // Use the correct screen name from MainStack.tsx which is "RecipeDetail"
    // Pass "id" as the parameter name, with the value of recipeId
    // @ts-ignore 
    navigation.navigate('RecipeDetail', { id: recipeId });
  };

  // Show main loading spinner if adding a recipe (covers interaction)
  if (isAddingRecipe) {
    return (
        <View style={[styles.container, styles.centeredFeedback, styles.loadingOverlay]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={[styles.feedbackText, { color: '#FFFFFF'}]}>
              Saving meal...
            </Text>
        </View>
    );
  }

  if (isLoadingDailyMealPlan && !dailyMealPlan) { // Show initial load only if no data yet
    return (
      <View style={[styles.container, styles.centeredFeedback]}>
        <ActivityIndicator size="large" color="#00796b" />
        <Text style={styles.feedbackText}>Loading meal plan...</Text>
      </View>
    );
  }

  if (dailyMealPlanError) {
    return (
      <View style={[styles.container, styles.centeredFeedback]}>
        <Text style={styles.errorText}>Error loading meal plan: {dailyMealPlanError.message}</Text>
      </View>
    );
  }

  if (userRecipesError) {
    return (
      <View style={styles.centeredFeedback}>
        <Text style={styles.errorText}>Error loading your recipes: {userRecipesError.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}> 
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>Meal Plan This Week</Text>
        <Text style={styles.weekIndicator}>{weekIndicatorText}</Text>
      </View>

      <WeekNavigator 
        selectedDate={selectedDate} 
        onDateSelect={handleDayPress} 
        onTargetWeekChange={handleTargetWeekChange}
      />

      <View style={styles.selectedDayInfoContainer}>
        <Text style={styles.selectedDayInfoText}>{selectedDayInfoText}</Text> 
      </View>

      <View style={styles.mealSlotsContainer}>
        <TouchableOpacity 
          style={[styles.mealSlotCard, styles.breakfastCard]}
          onPress={() => {
            if (dailyMealPlan?.breakfast?.recipe_id) {
              handleCookRecipe(dailyMealPlan.breakfast.recipe_id);
            } else {
              handleOpenRecipeSelectionModal('breakfast');
            }
          }}
        >
          <Text style={styles.mealSlotTitle}>Breakfast</Text>
          {dailyMealPlan?.breakfast ? (
            <View style={styles.recipeInfoContainer}>
              {dailyMealPlan.breakfast.recipe_thumbnail_url && (
                <Image 
                  source={{ uri: dailyMealPlan.breakfast.recipe_thumbnail_url }} 
                  style={styles.recipeImage} 
                />
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {dailyMealPlan.breakfast.recipe_title || 'Recipe Title Missing'}
              </Text>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleRemoveRecipe('breakfast'); }} style={styles.removeButton}>
                <Icon name="close-circle-outline" size={24} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.placeholderText}>+ Add Recipe</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.mealSlotCard, styles.lunchCard]}
          onPress={() => {
            if (dailyMealPlan?.lunch?.recipe_id) {
              handleCookRecipe(dailyMealPlan.lunch.recipe_id);
            } else {
              handleOpenRecipeSelectionModal('lunch');
            }
          }}
        >
          <Text style={styles.mealSlotTitle}>Lunch</Text>
          {dailyMealPlan?.lunch ? (
            <View style={styles.recipeInfoContainer}>
              {dailyMealPlan.lunch.recipe_thumbnail_url && (
                <Image 
                  source={{ uri: dailyMealPlan.lunch.recipe_thumbnail_url }} 
                  style={styles.recipeImage} 
                />
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {dailyMealPlan.lunch.recipe_title || 'Recipe Title Missing'}
              </Text>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleRemoveRecipe('lunch'); }} style={styles.removeButton}>
                <Icon name="close-circle-outline" size={24} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.placeholderText}>+ Add Recipe</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.mealSlotCard, styles.dinnerCard]}
          onPress={() => {
            if (dailyMealPlan?.dinner?.recipe_id) {
              handleCookRecipe(dailyMealPlan.dinner.recipe_id);
            } else {
              handleOpenRecipeSelectionModal('dinner');
            }
          }}
        >
          <Text style={styles.mealSlotTitle}>Dinner</Text>
          {dailyMealPlan?.dinner ? (
            <View style={styles.recipeInfoContainer}>
              {dailyMealPlan.dinner.recipe_thumbnail_url && (
                <Image 
                  source={{ uri: dailyMealPlan.dinner.recipe_thumbnail_url }} 
                  style={styles.recipeImage} 
                />
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {dailyMealPlan.dinner.recipe_title || 'Recipe Title Missing'}
              </Text>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleRemoveRecipe('dinner'); }} style={styles.removeButton}>
                <Icon name="close-circle-outline" size={24} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.placeholderText}>+ Add Recipe</Text>
          )}
        </TouchableOpacity>
      </View>

      <SelectFromMyRecipesModal
        isVisible={isRecipeModalVisible}
        onClose={() => setIsRecipeModalVisible(false)}
        onRecipeSelect={handleRecipeSelectedFromModal}
        recipes={recipesForModal}
        isLoading={isLoadingUserRecipes}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4f7f6',
    flex: 1, // Ensure container takes full height if content is less
  },
  titleContainer: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  weekIndicator: {
    fontSize: 14,
    color: '#555',
  },
  selectedDayInfoContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    backgroundColor: '#F0F8FF', // Light blue, consider using COLORS.surface or similar from theme
  },
  selectedDayInfoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A4A4A', // Dark gray, consider using COLORS.text or similar
  },
  mealSlotsContainer: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mealSlotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10, // Reduced padding slightly
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 180, // Increased minHeight to accommodate image and text
    width: '31%',
    justifyContent: 'flex-start', // Align title to top
  },
  breakfastCard: {
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  lunchCard: {
    borderColor: '#90EE90',
    borderWidth: 1,
  },
  dinnerCard: {
    borderColor: '#ADD8E6',
    borderWidth: 1,
  },
  mealSlotTitle: {
    fontSize: 16, // Slightly reduced title
    fontWeight: '600',
    color: '#333',
    marginBottom: 8, // Reduced margin
  },
  recipeInfoContainer: {
    alignItems: 'center',
    width: '100%',
  },
  recipeImage: {
    width: 80, // Fixed size for the image
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#e0e0e0', // Placeholder background for image
  },
  recipeTitle: {
    fontSize: 13, // Smaller font for recipe title
    color: '#444',
    textAlign: 'center',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#007bff', // Changed to a more actionable blue
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 20, // Add some margin to center it if no recipe
  },
  centeredFeedback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, // Added padding for centered text
  },
  feedbackText: {
    marginTop: 10,
    fontSize: 16,
    color: '#00796b', // Consider using COLORS.primary
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#D32F2F', 
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10, // Ensure it's on top
  }
});

export default MealPlannerV2Screen; 