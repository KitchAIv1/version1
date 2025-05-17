import React, { useState, useCallback } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator, Button, Alert, StyleSheet, LayoutAnimation, UIManager, Platform, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useGroceryManager, GroceryItem } from '../../hooks/useGroceryManager';
import { COLORS, FONTS, SIZES } from '../../constants/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import { getIngredientsForMealPlanRange, AggregatedIngredient } from '../../hooks/useMealPlanAggregatedIngredients';
import { useAuth } from '../../providers/AuthProvider';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// --- Item Icon Mapping ---
const itemIconMap: { [key: string]: string } = {
  // Fruits
  apple: 'nutrition-outline',
  banana: 'nutrition-outline',
  orange: 'nutrition-outline',
  strawberry: 'nutrition-outline',
  grapes: 'nutrition-outline',
  blueberry: 'nutrition-outline',
  raspberry: 'nutrition-outline',
  avocado: 'leaf-outline', // Often used like a vegetable but botanically a fruit

  // Vegetables
  tomato: 'leaf-outline',
  potato: 'leaf-outline',
  onion: 'leaf-outline',
  lettuce: 'leaf-outline',
  carrot: 'leaf-outline',
  broccoli: 'leaf-outline',
  cucumber: 'leaf-outline',
  bellpepper: 'leaf-outline', // bell pepper
  garlic: 'leaf-outline',
  spinach: 'leaf-outline',

  // Dairy & Alternatives
  milk: 'pint-outline',
  cheese: 'cube-outline', // Generic, can be more specific
  cheddar: 'cube-outline',
  mozzarella: 'ellipse-outline', // Softer cheese
  yogurt: 'ice-cream-outline', // Similar container shape
  butter: 'layers-outline', // Block shape
  "almond milk": 'pint-outline',
  "soy milk": 'pint-outline',
  
  // Bakery
  bread: 'restaurant-outline', // Using a generic food icon as 'baguette-outline' might not exist or fit
  "white bread": 'restaurant-outline',
  "whole wheat bread": 'restaurant-outline',
  bagel: 'ellipse-outline',
  croissant: 'restaurant-outline',

  // Proteins
  eggs: 'egg-outline',
  chicken: 'logo-twitter', // Placeholder, closest to a bird? Or use 'restaurant-outline'
  "chicken breast": 'logo-twitter',
  beef: 'restaurant-outline',
  steak: 'restaurant-outline',
  pork: 'restaurant-outline',
  bacon: 'remove-outline', // Strips?
  fish: 'fish-outline',
  salmon: 'fish-outline',
  shrimp: 'fish-outline',
  tofu: 'square-outline',

  // Pantry Staples
  pasta: 'restaurant-outline',
  rice: 'ellipse-outline', // or grain-outline if available
  flour: 'folder-outline', // Bag shape
  sugar: 'cube-outline', // or folder-outline
  salt: 'cube-outline',
  pepper: 'ellipse-outline', // Peppercorn
  "olive oil": 'water-outline', // Bottle
  vinegar: 'water-outline',
  cereal: 'apps-outline', // Box of items
  oats: 'apps-outline',
  coffee: 'cafe-outline',
  tea: 'cafe-outline',
  
  // Drinks
  juice: 'water-outline',
  "apple juice": 'water-outline', // Could be more specific if icon exists
  "orange juice": 'water-outline',
  soda: 'beer-outline', // Can shape
  water: 'water-outline',

  // Default
  default: 'cube-outline',
};

const getIconForItem = (itemName: string): string => {
  const lowerItemName = itemName.toLowerCase();
  const sortedKeys = Object.keys(itemIconMap).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lowerItemName.includes(key)) {
      return itemIconMap[key];
    }
  }
  return itemIconMap['default'];
};

// Helper function to format date/time
const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });
  } catch (e) {
    console.error("Error formatting date:", e);
    return 'Invalid date';
  }
};

export default function GroceryListScreen() {
  const {
    groceryList, 
    isLoading: isGroceryManagerLoading,
    error: groceryManagerError, 
    toggleGroceryItemChecked,
    removeGroceryItem,
    fetchGroceryList,
    clearAllItems,
  } = useGroceryManager();

  const { user } = useAuth();
  const [mealPlanIngredients, setMealPlanIngredients] = useState<AggregatedIngredient[]>([]);
  const [isLoadingMealPlanIngredients, setIsLoadingMealPlanIngredients] = useState(false);
  const [mealPlanIngredientsError, setMealPlanIngredientsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadIngredientsFromCurrentWeek = async () => {
    setIsLoadingMealPlanIngredients(true);
    setMealPlanIngredientsError(null);
    try {
      const today = new Date();
      const startDate = startOfWeek(today, { weekStartsOn: 1 }); 
      const endDate = endOfWeek(today, { weekStartsOn: 1 });
      const ingredients = await getIngredientsForMealPlanRange(startDate, endDate, user?.id);
      setMealPlanIngredients(ingredients);
    } catch (e: any) {
      setMealPlanIngredientsError(e.message || "Failed to load ingredients from meal plan.");
    } finally {
      setIsLoadingMealPlanIngredients(false);
    }
  };
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroceryList(); 
    if(mealPlanIngredients.length > 0 || mealPlanIngredientsError) { 
        await loadIngredientsFromCurrentWeek();
    }
    setRefreshing(false);
  }, [fetchGroceryList, mealPlanIngredients, mealPlanIngredientsError]); 

  const clearCheckedItems = async () => {
    const checkedItems = groceryList.filter(item => item.is_checked);
    if (checkedItems.length === 0) {
      Alert.alert("No items to clear", "There are no checked items in your grocery list."); return;
    }
    Alert.alert("Confirm Clear", `Are you sure you want to remove ${checkedItems.length} checked item(s)?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: async () => {
            try {
              for (const item of checkedItems) { await removeGroceryItem(item.id); }
            } catch (e: any) { Alert.alert("Error", e.message || "Failed to clear checked items."); }
        }},
    ]);
  };

  const handleClearAllItems = () => {
    if (groceryList.length === 0) {
      Alert.alert("List Empty", "Your grocery list is already empty."); return;
    }
    Alert.alert("Clear All Items", "Are you sure you want to remove all items from your grocery list?", [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: async () => {
            try { await clearAllItems(); } catch (e: any) { Alert.alert("Error", `Failed to clear all items: ${e.message}`); }
        }},
    ]);
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    Alert.alert("Delete Item", `Are you sure you want to delete "${itemName}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try { await removeGroceryItem(itemId); } catch (e: any) { Alert.alert("Error", `Failed to delete item: ${e.message}`); }
        }},
    ]);
  };

  const handleToggleChecked = async (item: GroceryItem) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try { await toggleGroceryItemChecked(item.id, !item.is_checked); } catch (e: any) { Alert.alert("Error", `Failed to update item: ${e.message}`); }
  };

  const renderItem = ({ item }: { item: GroceryItem }) => {
    const itemIconName = getIconForItem(item.item_name);
    return (
      <TouchableOpacity onPress={() => handleToggleChecked(item)} activeOpacity={0.7} style={{ transform: [{ scale: item.is_checked ? 0.98 : 1 }] }}>
        <View style={[styles.itemContainer, item.is_checked && styles.itemChecked]}>
          <View style={styles.itemIcon}><Icon name={itemIconName} size={SIZES.large} color={item.is_checked ? COLORS.gray : COLORS.primary} /></View>
          <View style={styles.itemTextContainer}>
            <Text style={[styles.itemText, item.is_checked && styles.itemTextChecked]} numberOfLines={1} ellipsizeMode="tail">{item.item_name}</Text>
            {(item.recipe_name || item.created_at) && (
              <View style={styles.metaDataContainer}>
                {item.recipe_name && <Text style={styles.metaText}><Icon name="restaurant-outline" size={SIZES.body5} /> {item.recipe_name}</Text>}
                {item.created_at && <Text style={styles.metaText}><Icon name="time-outline" size={SIZES.body5} /> {format(new Date(item.created_at), "MMM d, h:mm a")}</Text>}
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => handleDeleteItem(item.id, item.item_name)} style={styles.deleteButton}><Icon name="trash-bin-outline" size={SIZES.h3} color={COLORS.error} /></TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAggregatedIngredient = ({ item }: { item: AggregatedIngredient }) => (
    <View style={styles.mpiContainer}>
      <Text style={styles.mpiName}>{item.name}</Text>
      {item.appearances.map((appearance, index) => (
        <View key={index} style={styles.mpiAppearance}>
          <Text style={styles.mpiQuantityUnit}>
            {appearance.quantity || ''} {appearance.unit || ''}
          </Text>
          <Text style={styles.mpiRecipeName}> (from {appearance.recipe_name})</Text>
        </View>
      ))}
    </View>
  );
  
  const ListHeader = () => (
    <View style={styles.listHeaderButtonsContainer}>
        <TouchableOpacity style={styles.listHeaderButton} onPress={clearCheckedItems}>
            <Icon name="checkmark-done-outline" size={SIZES.h3} color={COLORS.primary} />
            <Text style={styles.listHeaderButtonText}>Clear Checked</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listHeaderButton} onPress={loadIngredientsFromCurrentWeek}>
            <Icon name="calendar-outline" size={SIZES.h3} color={COLORS.primary} />
            <Text style={styles.listHeaderButtonText}>Plan Ingredients</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.listHeaderButton, styles.clearAllListButton]} onPress={handleClearAllItems}>
            <Icon name="trash-outline" size={SIZES.h3} color={COLORS.error} />
            <Text style={[styles.listHeaderButtonText, styles.clearAllListButtonText]}>Clear All</Text>
        </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>My Grocery List</Text>
      </View>

      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]}/>}
      >
        <ListHeader /> 

        {isGroceryManagerLoading && groceryList.length === 0 && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20}}/>}
        {groceryManagerError && <Text style={styles.errorText}>Error loading grocery list: {groceryManagerError}</Text>}
        
        {groceryList.length === 0 && !isGroceryManagerLoading && (
          <Text style={styles.emptyListText}>Your manually added grocery list is empty.</Text>
        )}
        {groceryList.length > 0 &&
            <FlatList
                data={groceryList.sort((a,b) => Number(a.is_checked) - Number(b.is_checked) || new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                style={styles.flatListStyle}
                scrollEnabled={false}
            />
        }

        {isLoadingMealPlanIngredients && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20}} />}
        {mealPlanIngredientsError && <Text style={styles.errorText}>Error: {mealPlanIngredientsError}</Text>}
        
        {mealPlanIngredients.length > 0 && (
          <View style={styles.mpiSectionContainer}>
            <Text style={styles.mpiSectionTitle}>From Your Meal Plan (This Week)</Text>
            <FlatList
                data={mealPlanIngredients}
                renderItem={renderAggregatedIngredient}
                keyExtractor={(item, index) => `${item.name}-${index}`}
                style={styles.flatListStyle}
                scrollEnabled={false}
            />
          </View>
        )}
        {mealPlanIngredients.length === 0 && !isLoadingMealPlanIngredients && !mealPlanIngredientsError && mealPlanIngredients !== null && (
            <View style={styles.mpiSectionContainer}>
                <Text style={styles.emptyListText}>No ingredients loaded from this week's meal plan. Tap "Plan Ingredients" to load.</Text>
            </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background }, 
  container: { flex: 1 },
  screenHeader: {
    paddingHorizontal: SIZES.medium, 
    paddingVertical: SIZES.medium, 
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  screenHeaderTitle: { fontSize: SIZES.h2, fontWeight: 'bold', color: COLORS.primary },
  listHeaderButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SIZES.medium,
    paddingHorizontal: SIZES.small,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.small,
  },
  listHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.small,
    paddingHorizontal: SIZES.base,
    backgroundColor: COLORS.background, // Changed from lightGray
    borderRadius: SIZES.small,
  },
  listHeaderButtonText: { fontSize: SIZES.body4, color: COLORS.primary, marginLeft: SIZES.base },
  clearAllListButton: { backgroundColor: '#fee2e2' }, // Light red background for clear all
  clearAllListButtonText: { color: COLORS.error }, 
  flatListStyle: { paddingHorizontal: SIZES.small },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.small, 
    paddingHorizontal: SIZES.small,
    marginBottom: SIZES.small / 2,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.small,
    elevation: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  itemChecked: { backgroundColor: COLORS.primaryLight, opacity: 0.7, elevation: 0 }, // Use primaryLight and opacity
  itemIcon: { marginRight: SIZES.medium },
  itemTextContainer: { flex: 1 }, 
  itemText: { fontSize: SIZES.body2, color: COLORS.text }, // Use SIZES.body2
  itemTextChecked: { textDecorationLine: 'line-through', color: COLORS.textSecondary }, // Use textSecondary
  metaDataContainer: { flexDirection: 'row', marginTop: SIZES.base / 2 },
  metaText: { fontSize: SIZES.body5, color: COLORS.textSecondary, marginRight: SIZES.base },
  deleteButton: { padding: SIZES.base },
  emptyListText: { fontSize: SIZES.body3, color: COLORS.textSecondary, textAlign: 'center', marginVertical: SIZES.large, paddingHorizontal: SIZES.medium },
  errorText: { fontSize: SIZES.body3, color: COLORS.error, textAlign: 'center', margin: SIZES.medium },
  mpiSectionContainer: {
    marginTop: SIZES.medium,
    marginHorizontal: SIZES.small,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.small,
    padding: SIZES.small,
    elevation: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  mpiSectionTitle: { fontSize: SIZES.h3, fontWeight: 'bold', color: COLORS.primaryDark, marginBottom: SIZES.small }, // Use primaryDark
  mpiContainer: {
    paddingVertical: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border, // Use border color
  },
  mpiName: { fontSize: SIZES.body3, fontWeight: 'bold', color: COLORS.text, marginBottom: SIZES.base / 2 },
  mpiAppearance: { flexDirection: 'row', marginLeft: SIZES.medium, alignItems: 'center' },
  mpiQuantityUnit: { fontSize: SIZES.body4, color: COLORS.text },
  mpiRecipeName: { fontSize: SIZES.body5, color: COLORS.textSecondary }, // Use textSecondary
}); 