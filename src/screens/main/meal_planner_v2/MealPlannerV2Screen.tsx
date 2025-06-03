import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { format } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialIcons';
import WeekNavigator from './components/WeekNavigator';
import {
  useDailyMealPlan,
  PlannedRecipe,
} from '../../../hooks/useDailyMealPlan';
import { useUserRecipes } from '../../../hooks/useUserRecipes';
import SelectFromMyRecipesModal, {
  RecipeForModal,
} from '../../../components/modals/SelectFromMyRecipesModal';
import { RecipeItem } from '../../../types';

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
  const monthDayFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `${monthDayFormat.format(startDate)} - ${monthDayFormat.format(endDate)}`;
};

// This helper should be available or imported if used like this
function getWeekStartDateHelper(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

const MealPlannerV2Screen = React.memo(() => {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekIndicatorText, setWeekIndicatorText] = useState(() =>
    formatWeekRangeText(getWeekStartDateHelper(new Date())),
  );
  const [isRecipeModalVisible, setIsRecipeModalVisible] = useState(false);
  const [currentSelectedSlot, setCurrentSelectedSlot] = useState<
    'breakfast' | 'lunch' | 'dinner' | null
  >(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [displayedMealPlan, setDisplayedMealPlan] = useState<any>(null);

  // Format selectedDate for the hook - memoized to prevent unnecessary recalculations
  const formattedDateForHook = useMemo(
    () => format(selectedDate, 'yyyy-MM-dd'),
    [selectedDate],
  );
  console.log(
    `[[MEAL_PLANNER_V2_SCREEN]] Requesting data for date: ${formattedDateForHook}`,
  );

  const {
    dailyMealPlan,
    isLoadingDailyMealPlan,
    dailyMealPlanError,
    addRecipeToSlot,
    removeRecipeFromSlot,
    isAddingRecipe,
    isRemovingRecipe,
  } = useDailyMealPlan(formattedDateForHook);

  // Track when we've initially loaded to prevent full-screen loading on date changes
  useEffect(() => {
    if (!isLoadingDailyMealPlan && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [isLoadingDailyMealPlan, hasInitiallyLoaded]);

  // Update displayed meal plan when new data arrives, but preserve during loading
  useEffect(() => {
    if (!isLoadingDailyMealPlan && dailyMealPlan !== undefined) {
      setDisplayedMealPlan(dailyMealPlan);
    }
  }, [dailyMealPlan, isLoadingDailyMealPlan]);

  console.log(
    `[[MEAL_PLANNER_V2_SCREEN]] Received for date ${formattedDateForHook}:`,
    'isLoading:',
    isLoadingDailyMealPlan,
    'plan:',
    JSON.stringify(dailyMealPlan, null, 2),
  );

  // Fetch user's recipes for the modal
  const {
    data: userRecipesData,
    isLoading: isLoadingUserRecipes,
    error: userRecipesError,
  } = useUserRecipes();

  // Map RecipeItem[] to RecipeForModal[] for the modal - memoized for performance
  const recipesForModal: RecipeForModal[] = useMemo(() => {
    if (!userRecipesData) return [];
    // console.log('[[MEAL_PLANNER_V2_SCREEN]] Mapping userRecipesData to recipesForModal. Input userRecipesData:', JSON.stringify(userRecipesData, null, 2));
    const mapped = userRecipesData.map(recipe => ({
      recipe_id: recipe.recipe_id, // Use recipe.recipe_id from input
      recipe_name: recipe.title, // Use recipe.title from input
      // Use recipe.thumbnail_url as primary, fallback to recipe.video_url if needed, then null
      thumbnail_url: recipe.thumbnail_url || recipe.video_url || null,
    }));
    // console.log('[[MEAL_PLANNER_V2_SCREEN]] Output recipesForModal:', JSON.stringify(mapped, null, 2));
    return mapped;
  }, [userRecipesData]);

  // Memoized date formatting to prevent recalculation
  const selectedDayInfoText = useMemo(() => {
    const longDateFormat = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    return `Displaying for: ${longDateFormat.format(selectedDate)}`;
  }, [selectedDate]);

  const handleDayPress = useCallback(
    (date: Date) => {
      // Prevent unnecessary updates if selecting the same date
      if (isSameDay(date, selectedDate)) {
        return;
      }

      // Batch state updates to prevent blinking
      const newWeekIndicatorText = formatWeekRangeText(
        getWeekStartDateHelper(date),
      );

      // Use immediate state update for better responsiveness
      setSelectedDate(date);
      setWeekIndicatorText(newWeekIndicatorText);
    },
    [selectedDate],
  );

  const handleTargetWeekChange = useCallback((newTargetWeekStart: Date) => {
    // Only update week indicator text, don't change selected date to prevent blinking
    const newWeekIndicatorText = formatWeekRangeText(newTargetWeekStart);
    setWeekIndicatorText(newWeekIndicatorText);
  }, []);

  const handleOpenRecipeSelectionModal = useCallback(
    (slot: 'breakfast' | 'lunch' | 'dinner') => {
      setCurrentSelectedSlot(slot);
      setIsRecipeModalVisible(true);
    },
    [],
  );

  const handleRemoveRecipe = useCallback(
    (slot: 'breakfast' | 'lunch' | 'dinner') => {
      // Use current dailyMealPlan for alert, but displayedMealPlan for UI consistency
      const recipeTitle =
        (dailyMealPlan || displayedMealPlan)?.[slot]?.recipe_title ||
        'this recipe';
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
        ],
      );
    },
    [
      dailyMealPlan,
      displayedMealPlan,
      formattedDateForHook,
      removeRecipeFromSlot,
    ],
  );

  // Handler for when a recipe is selected from the modal
  const handleRecipeSelectedFromModal = useCallback(
    async (recipe: RecipeForModal) => {
      if (currentSelectedSlot) {
        try {
          await addRecipeToSlot({
            slot: currentSelectedSlot,
            recipeId: recipe.recipe_id,
            recipeTitle: recipe.recipe_name,
            recipeThumbnailUrl: recipe.thumbnail_url || undefined,
            planDate: formattedDateForHook,
          });
          Alert.alert(
            'Success',
            `${recipe.recipe_name} added to ${currentSelectedSlot} for ${formattedDateForHook}`,
          );
        } catch (e: any) {
          Alert.alert('Error', `Failed to add recipe: ${e.message}`);
          console.error('Failed to add recipe to slot from modal:', e);
        }
      }
      setIsRecipeModalVisible(false);
      setCurrentSelectedSlot(null);
    },
    [currentSelectedSlot, addRecipeToSlot, formattedDateForHook],
  );

  const handleCookRecipe = useCallback(
    (recipeId: string) => {
      if (!recipeId) {
        console.warn(
          'Attempted to navigate to recipe detail without a recipeId.',
        );
        return;
      }
      // Use the correct screen name from MainStack.tsx which is "RecipeDetail"
      // Pass "id" as the parameter name, with the value of recipeId
      // @ts-ignore
      navigation.navigate('RecipeDetail', { id: recipeId });
    },
    [navigation],
  );

  // Show main loading spinner if adding a recipe (covers interaction)
  if (isAddingRecipe) {
    return (
      <View
        style={[
          styles.container,
          styles.centeredFeedback,
          styles.loadingOverlay,
        ]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={[styles.feedbackText, { color: '#FFFFFF' }]}>
          Saving meal...
        </Text>
      </View>
    );
  }

  // Only show full-screen loading on initial load, not when switching dates
  if (isLoadingDailyMealPlan && !hasInitiallyLoaded) {
    return (
      <View style={[styles.container, styles.centeredFeedback]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.feedbackText}>Loading meal plan...</Text>
      </View>
    );
  }

  if (dailyMealPlanError) {
    return (
      <View style={[styles.container, styles.centeredFeedback]}>
        <Text style={styles.errorText}>
          Error loading meal plan: {dailyMealPlanError.message}
        </Text>
      </View>
    );
  }

  if (userRecipesError) {
    return (
      <View style={styles.centeredFeedback}>
        <Text style={styles.errorText}>
          Error loading your recipes: {userRecipesError.message}
        </Text>
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
          style={[styles.mealSlotCard]}
          onPress={() => {
            if (displayedMealPlan?.breakfast?.recipe_id) {
              handleCookRecipe(displayedMealPlan.breakfast.recipe_id);
            } else {
              handleOpenRecipeSelectionModal('breakfast');
            }
          }}
          activeOpacity={0.7}>
          <View style={styles.mealSlotHeader}>
            <Icon name="coffee" size={18} color="#10b981" />
            <Text style={styles.mealSlotTitle} numberOfLines={1}>
              Breakfast
            </Text>
          </View>
          {displayedMealPlan?.breakfast ? (
            <View style={styles.recipeInfoContainer}>
              {displayedMealPlan.breakfast.recipe_thumbnail_url && (
                <Image
                  source={{
                    uri: displayedMealPlan.breakfast.recipe_thumbnail_url,
                  }}
                  style={styles.recipeImage}
                />
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {displayedMealPlan.breakfast.recipe_title ||
                  'Recipe Title Missing'}
              </Text>
              <TouchableOpacity
                onPress={e => {
                  e.stopPropagation();
                  handleRemoveRecipe('breakfast');
                }}
                style={styles.removeButton}>
                <Icon name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Icon name="add" size={32} color="#10b981" />
              <Text style={styles.placeholderText}>Add Recipe</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mealSlotCard]}
          onPress={() => {
            if (displayedMealPlan?.lunch?.recipe_id) {
              handleCookRecipe(displayedMealPlan.lunch.recipe_id);
            } else {
              handleOpenRecipeSelectionModal('lunch');
            }
          }}
          activeOpacity={0.7}>
          <View style={styles.mealSlotHeader}>
            <Icon name="fastfood" size={18} color="#10b981" />
            <Text style={styles.mealSlotTitle} numberOfLines={1}>
              Lunch
            </Text>
          </View>
          {displayedMealPlan?.lunch ? (
            <View style={styles.recipeInfoContainer}>
              {displayedMealPlan.lunch.recipe_thumbnail_url && (
                <Image
                  source={{ uri: displayedMealPlan.lunch.recipe_thumbnail_url }}
                  style={styles.recipeImage}
                />
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {displayedMealPlan.lunch.recipe_title || 'Recipe Title Missing'}
              </Text>
              <TouchableOpacity
                onPress={e => {
                  e.stopPropagation();
                  handleRemoveRecipe('lunch');
                }}
                style={styles.removeButton}>
                <Icon name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Icon name="add" size={32} color="#10b981" />
              <Text style={styles.placeholderText}>Add Recipe</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mealSlotCard]}
          onPress={() => {
            if (displayedMealPlan?.dinner?.recipe_id) {
              handleCookRecipe(displayedMealPlan.dinner.recipe_id);
            } else {
              handleOpenRecipeSelectionModal('dinner');
            }
          }}
          activeOpacity={0.7}>
          <View style={styles.mealSlotHeader}>
            <Icon name="restaurant" size={18} color="#10b981" />
            <Text style={styles.mealSlotTitle} numberOfLines={1}>
              Dinner
            </Text>
          </View>
          {displayedMealPlan?.dinner ? (
            <View style={styles.recipeInfoContainer}>
              {displayedMealPlan.dinner.recipe_thumbnail_url && (
                <Image
                  source={{
                    uri: displayedMealPlan.dinner.recipe_thumbnail_url,
                  }}
                  style={styles.recipeImage}
                />
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {displayedMealPlan.dinner.recipe_title ||
                  'Recipe Title Missing'}
              </Text>
              <TouchableOpacity
                onPress={e => {
                  e.stopPropagation();
                  handleRemoveRecipe('dinner');
                }}
                style={styles.removeButton}>
                <Icon name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Icon name="add" size={32} color="#10b981" />
              <Text style={styles.placeholderText}>Add Recipe</Text>
            </View>
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
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    flex: 1, // Ensure container takes full height if content is less
  },
  titleContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  weekIndicator: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  selectedDayInfoContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#10b981',
  },
  selectedDayInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  mealSlotsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'stretch',
  },
  mealSlotCard: {
    borderRadius: 16,
    padding: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 200,
    width: '31%',
    justifyContent: 'flex-start',
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  mealSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  mealSlotTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 4,
    flex: 1,
  },
  recipeInfoContainer: {
    alignItems: 'center',
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  recipeImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#e5e7eb',
  },
  recipeTitle: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 16,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  placeholderText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  centeredFeedback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  feedbackText: {
    marginTop: 12,
    fontSize: 16,
    color: '#10b981',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
});

export default MealPlannerV2Screen;
