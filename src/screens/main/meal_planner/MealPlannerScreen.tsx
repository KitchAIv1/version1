import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import useMealPlanner, { MealSlot, MealPlanItem } from '../../../hooks/useMealPlanner'; // Adjusted path
import { startOfWeek, endOfWeek, addDays, format, parseISO, addWeeks, subWeeks } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Using MaterialCommunityIcons for more options
import SelectFromMyRecipesModal, { RecipeForModal } from '../../../components/modals/SelectFromMyRecipesModal'; // Adjusted path
import { useAuth } from '../../../providers/AuthProvider'; // Adjusted path
import { supabase } from '../../../services/supabase'; // Adjusted path
import { useQuery, QueryKey } from '@tanstack/react-query';

// Define types for tabs and days
type WeekTabOption = 'This Week' | 'Next Week'; // Keep this for tab display
const MEAL_SLOTS_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Copied from ProfileScreen for now, ideally this would be a shared type
interface VideoPostData { 
  recipe_id: string;
  recipe_name: string; 
  video_url: string; // Not strictly needed for modal but part of the structure
  thumbnail_url: string | null;
  created_at: string; // Not strictly needed for modal
}

// Simplified ProfileData focusing on what's needed for recipes
interface UserRecipesData {
  videos: VideoPostData[];
}

const fetchUserRecipes = async (userId: string | undefined): Promise<RecipeForModal[]> => {
  if (!userId) return [];
  const { data: rawData, error: rpcError } = await supabase
    .rpc('get_profile_details', { p_user_id: userId });
  
  if (rpcError) {
    console.error('[MealPlannerScreen:fetchUserRecipes] Supabase RPC Error:', rpcError);
    throw rpcError;
  }

  // Use a Map to store recipes by ID, ensuring uniqueness
  const recipesMap = new Map<string, RecipeForModal>();

  const processRecipeList = (list: any[], type: string) => {
    if (Array.isArray(list)) {
      list.forEach((recipe: any) => {
        if (recipe && recipe.recipe_id) { // Ensure recipe and recipe_id exist
          const recipeForModal: RecipeForModal = {
            recipe_id: recipe.recipe_id,
            recipe_name: recipe.title, // Map title to recipe_name
            thumbnail_url: recipe.thumbnail_url,
          };
          // If not already added, add it to the map. This handles duplicates.
          if (!recipesMap.has(recipe.recipe_id)) {
            recipesMap.set(recipe.recipe_id, recipeForModal);
          }
        } else {
          console.warn(`[MealPlannerScreen:fetchUserRecipes] Invalid recipe object in ${type} list:`, recipe);
        }
      });
    } else {
      console.warn(`[MealPlannerScreen:fetchUserRecipes] ${type} list is not an array or is missing.`);
    }
  };

  if (rawData) {
    processRecipeList(rawData.recipes, 'uploaded recipes'); // User's own uploaded recipes
    processRecipeList(rawData.saved_recipes, 'saved recipes'); // User's saved recipes
  } else {
    console.warn('[MealPlannerScreen:fetchUserRecipes] No data received from RPC.');
    return [];
  }
  
  const combinedRecipes = Array.from(recipesMap.values());
  console.log(`[MealPlannerScreen:fetchUserRecipes] Combined ${combinedRecipes.length} unique recipes for modal.`);
  return combinedRecipes;
};

const MealPlannerScreen = () => {
  const { user } = useAuth();
  const {
    mealPlan,
    loading: mealPlanLoading,
    error: mealPlanError,
    fetchMealPlanForDateRange,
    addRecipeToSlot,
    removeRecipeFromSlot, // Keep for future use (e.g., clearing a slot)
  } = useMealPlanner();

  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 })); // Monday as start of week
  const [activeDisplayWeek, setActiveDisplayWeek] = useState<'current' | 'next'>('current');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{ date: Date; slot: MealSlot } | null>(null);

  // Fetch user's recipes for the modal
  const { data: userRecipes, isLoading: userRecipesLoading } = useQuery<RecipeForModal[], Error, RecipeForModal[], QueryKey>({
    queryKey: ['userRecipesForPlanner', user?.id], // Query key includes user ID
    queryFn: () => fetchUserRecipes(user?.id),
    enabled: !!user, // Only run if user is available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const weekDays = useMemo(() => {
    const start = activeDisplayWeek === 'current' ? currentWeekStart : addWeeks(currentWeekStart, 1);
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [currentWeekStart, activeDisplayWeek]);

  useEffect(() => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    console.log(`[MealPlannerScreen] Fetching for ${format(firstDay, 'yyyy-MM-dd')} to ${format(lastDay, 'yyyy-MM-dd')}`);
    fetchMealPlanForDateRange(firstDay, lastDay);
  }, [weekDays, fetchMealPlanForDateRange]);

  const handleOpenModal = (date: Date, slot: MealSlot) => {
    setSelectedSlotInfo({ date, slot });
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedSlotInfo(null);
  };

  const handleRecipeSelectedFromModal = async (selectedRecipe: { recipe_id: string; recipe_name: string; thumbnail_url: string | null }) => {
    if (selectedSlotInfo) {
      const { date, slot } = selectedSlotInfo;
      const dateString = format(date, 'yyyy-MM-dd');
      console.log(`[MealPlannerScreen] Adding ${selectedRecipe.recipe_name} to ${dateString} [${slot}]`);
      await addRecipeToSlot(dateString, slot, selectedRecipe.recipe_id, selectedRecipe.recipe_name, selectedRecipe.thumbnail_url || undefined);
      // Modal will close itself, no need to call handleCloseModal here if modal does it on selection
    }
  };

  const handleClearSlot = async (item: MealPlanItem) => {
    console.log(`[MealPlannerScreen] Clearing slot for item ID: ${item.id}`);
    await removeRecipeFromSlot(item.id);
  };
  
  const renderMealSlot = (date: Date, slot: MealSlot) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const mealItem = mealPlan[dateKey]?.[slot];

    return (
      <TouchableOpacity 
        key={slot}
        style={styles.mealSlot}
        onPress={() => handleOpenModal(date, slot)} // Open modal on press
        // onLongPress={() => mealItem && handleClearSlot(mealItem)} // Optional: long press to clear
      >
        <View style={styles.slotHeader}>
            <Text style={styles.mealSlotTitle}>{slot.charAt(0).toUpperCase() + slot.slice(1)}</Text>
            {mealItem && (
                <TouchableOpacity onPress={() => handleClearSlot(mealItem)} style={styles.clearButton}>
                    <Icon name="close-circle-outline" size={18} color="#ff6b6b" />
                </TouchableOpacity>
            )}
        </View>
        
        {mealItem && mealItem.recipe_thumbnail_url ? (
          <Image source={{ uri: mealItem.recipe_thumbnail_url }} style={styles.thumbnail} />
        ) : mealItem && mealItem.recipe_name ? (
          // Placeholder for recipe name when no thumbnail
          <View style={styles.placeholderThumbnail}><Icon name="food-croissant" size={24} color="#adb5bd" /></View>
        ) : (
          // Placeholder for empty slot
          <View style={styles.placeholderThumbnail}><Icon name="plus-circle-outline" size={30} color="#22c55e" /></View>
        )}
        {mealItem && mealItem.recipe_name ? (
          <Text style={styles.recipeNameText} numberOfLines={2}>{mealItem.recipe_name}</Text>
        ) : (
          <Text style={styles.emptySlotText}>Add Recipe</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderDayColumn = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return (
      <View key={dateKey} style={styles.dayColumn}>
        <Text style={styles.dayLabel}>{format(date, 'EEE')}</Text>
        <Text style={styles.dateLabel}>{format(date, 'd MMM')}</Text>
        {MEAL_SLOTS_ORDER.map(slot => renderMealSlot(date, slot))}
      </View>
    );
  };

  if (mealPlanError) {
    return <View style={styles.centerMessage}><Text>Error loading meal plan: {mealPlanError.message}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => setCurrentWeekStart(prev => subWeeks(prev, 1))} style={styles.navButton}>
          <Icon name="chevron-left" size={30} color="#22c55e" />
        </TouchableOpacity>
        <View style={styles.weekDisplay}>
            <TouchableOpacity onPress={() => setActiveDisplayWeek('current')} style={[styles.weekToggleButton, activeDisplayWeek === 'current' && styles.activeWeekToggle]}>
                <Text style={[styles.weekToggleText, activeDisplayWeek === 'current' && styles.activeWeekToggleText]}>
                    This Week ({format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'd')})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveDisplayWeek('next')} style={[styles.weekToggleButton, activeDisplayWeek === 'next' && styles.activeWeekToggle]}>
                <Text style={[styles.weekToggleText, activeDisplayWeek === 'next' && styles.activeWeekToggleText]}>
                    Next Week ({format(addWeeks(currentWeekStart, 1), 'MMM d')} - {format(addDays(addWeeks(currentWeekStart, 1), 6), 'd')})
                </Text>
            </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setCurrentWeekStart(prev => addWeeks(prev, 1))} style={styles.navButton}>
          <Icon name="chevron-right" size={30} color="#22c55e" />
        </TouchableOpacity>
      </View>

      {(mealPlanLoading && (!mealPlan || Object.keys(mealPlan).length === 0)) ? (
        <View style={styles.centerMessage}><ActivityIndicator size="large" color="#22c55e" /></View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScrollViewContainer}>
          {weekDays.map(day => renderDayColumn(day))}
        </ScrollView>
      )}

      <SelectFromMyRecipesModal
        isVisible={isModalVisible}
        onClose={handleCloseModal}
        onRecipeSelect={handleRecipeSelectedFromModal}
        recipes={userRecipes || []}
        isLoading={userRecipesLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  navButton: {
    padding: 8,
  },
  weekDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
 weekToggleButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    marginHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#22c55e',
  },
  activeWeekToggle: {
    backgroundColor: '#22c55e',
  },
  weekToggleText: {
    fontSize: 12.5, 
    fontWeight: '600',
    color: '#22c55e',
  },
  activeWeekToggleText: {
    color: '#fff',
  },
  gridScrollViewContainer: {
    paddingVertical: 10,
    paddingHorizontal: 5, // Add padding for the first/last day columns from edge
  },
  dayColumn: {
    width: 140, 
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingBottom: 8, // Ensure clear button doesn't get cut if recipe name is short
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#343a40',
  },
  dateLabel: {
    fontSize: 13,
    color: '#868e96',
    marginBottom: 12,
  },
  mealSlot: {
    width: '90%',
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    paddingVertical: 8, // Reduced vertical padding a bit
    paddingHorizontal: 6,
    marginBottom: 10,
    alignItems: 'center',
    minHeight: 100, // Adjusted min height
    justifyContent: 'flex-start', // Align items to top to make space for name
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 5,
  },
  mealSlotTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#495057',
    flex: 1, // Allow title to take space
  },
  clearButton: {
    padding: 2, // Small touch area
  },
  thumbnail: {
    width: 60, // Slightly larger thumbnail
    height: 60,
    borderRadius: 6,
    marginBottom: 6,
  },
  placeholderThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  recipeNameText: {
    fontSize: 12.5,
    color: '#212529',
    textAlign: 'center',
    marginTop: 'auto', // Push to bottom if there is space
  },
  emptySlotText: {
    fontSize: 12,
    color: '#868e96',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 'auto', // Push to bottom
  },
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MealPlannerScreen; 