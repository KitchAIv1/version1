import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  Alert,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons'; // Changed from Icon to Feather for consistency
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGroceryManager, GroceryItem } from '../../hooks/useGroceryManager';
import { COLORS, FONTS, SIZES } from '../../constants/theme';
import {
  getIngredientsForMealPlanRange,
  AggregatedIngredient,
} from '../../hooks/useMealPlanAggregatedIngredients';
import { useAuth } from '../../providers/AuthProvider';
import { MainStackParamList } from '../../navigation/types';
import { getShortRelativeTime } from '../../utils/dateUtils';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Navigation type
type GroceryNavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Constants - Updated to match premium design
const ACTIVE_COLOR = '#10b981'; // Primary brand green

// --- Item Icon Mapping ---
const itemIconMap: { [key: string]: string } = {
  // Fruits - using shopping-bag for general food items
  apple: 'shopping-bag',
  banana: 'shopping-bag',
  orange: 'shopping-bag',
  strawberry: 'shopping-bag',
  grapes: 'shopping-bag',
  blueberry: 'shopping-bag',
  raspberry: 'shopping-bag',
  avocado: 'shopping-bag',

  // Vegetables
  tomato: 'shopping-bag',
  potato: 'shopping-bag',
  onion: 'shopping-bag',
  lettuce: 'shopping-bag',
  carrot: 'shopping-bag',
  broccoli: 'shopping-bag',
  cucumber: 'shopping-bag',
  bellpepper: 'shopping-bag',
  garlic: 'shopping-bag',
  spinach: 'shopping-bag',

  // Dairy & Alternatives
  milk: 'shopping-bag',
  cheese: 'shopping-bag',
  cheddar: 'shopping-bag',
  mozzarella: 'shopping-bag',
  yogurt: 'coffee',
  butter: 'shopping-bag',
  'almond milk': 'shopping-bag',
  'soy milk': 'shopping-bag',

  // Bakery
  bread: 'shopping-bag',
  'white bread': 'shopping-bag',
  'whole wheat bread': 'shopping-bag',
  bagel: 'shopping-bag',
  croissant: 'shopping-bag',

  // Proteins
  eggs: 'shopping-bag',
  chicken: 'shopping-bag',
  'chicken breast': 'shopping-bag',
  beef: 'shopping-bag',
  steak: 'shopping-bag',
  pork: 'shopping-bag',
  bacon: 'shopping-bag',
  fish: 'shopping-bag',
  salmon: 'shopping-bag',
  shrimp: 'shopping-bag',
  tofu: 'shopping-bag',

  // Pantry Staples
  pasta: 'shopping-bag',
  rice: 'shopping-bag',
  flour: 'shopping-bag',
  sugar: 'shopping-bag',
  salt: 'shopping-bag',
  pepper: 'shopping-bag',
  'olive oil': 'shopping-bag',
  vinegar: 'shopping-bag',
  cereal: 'shopping-bag',
  oats: 'shopping-bag',
  coffee: 'coffee',
  tea: 'coffee',

  // Drinks
  juice: 'shopping-bag',
  'apple juice': 'shopping-bag',
  'orange juice': 'shopping-bag',
  soda: 'shopping-bag',
  water: 'shopping-bag',

  // Default
  default: 'shopping-bag',
};

const getIconForItem = (itemName: string): string => {
  const lowerItemName = itemName.toLowerCase();
  const sortedKeys = Object.keys(itemIconMap).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of sortedKeys) {
    if (lowerItemName.includes(key)) {
      return itemIconMap[key];
    }
  }
  return itemIconMap.default;
};

// Helper function to format date/time
const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'Invalid date';
  }
};

export default function GroceryListScreen() {
  const navigation = useNavigation<GroceryNavigationProp>();
  const insets = useSafeAreaInsets();
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
  const [mealPlanIngredients, setMealPlanIngredients] = useState<
    AggregatedIngredient[]
  >([]);
  const [isLoadingMealPlanIngredients, setIsLoadingMealPlanIngredients] =
    useState(false);
  const [mealPlanIngredientsError, setMealPlanIngredientsError] = useState<
    string | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadIngredientsFromCurrentWeek = async () => {
    setIsLoadingMealPlanIngredients(true);
    setMealPlanIngredientsError(null);
    try {
      const today = new Date();
      const startDate = startOfWeek(today, { weekStartsOn: 1 });
      const endDate = endOfWeek(today, { weekStartsOn: 1 });
      const ingredients = await getIngredientsForMealPlanRange(
        startDate,
        endDate,
        user?.id,
      );
      setMealPlanIngredients(ingredients);
    } catch (e: any) {
      setMealPlanIngredientsError(
        e.message || 'Failed to load ingredients from meal plan.',
      );
    } finally {
      setIsLoadingMealPlanIngredients(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroceryList();
    if (mealPlanIngredients.length > 0 || mealPlanIngredientsError) {
      await loadIngredientsFromCurrentWeek();
    }
    setRefreshing(false);
  }, [fetchGroceryList, mealPlanIngredients, mealPlanIngredientsError]);

  const clearCheckedItems = async () => {
    const checkedItems = groceryList.filter(item => item.is_checked);
    if (checkedItems.length === 0) {
      Alert.alert(
        'No items to clear',
        'There are no checked items in your grocery list.',
      );
      return;
    }
    Alert.alert(
      'Confirm Clear',
      `Are you sure you want to remove ${checkedItems.length} checked item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const item of checkedItems) {
                await removeGroceryItem(item.id);
              }
            } catch (e: any) {
              Alert.alert(
                'Error',
                e.message || 'Failed to clear checked items.',
              );
            }
          },
        },
      ],
    );
  };

  const handleClearAllItems = () => {
    if (groceryList.length === 0) {
      Alert.alert('List Empty', 'Your grocery list is already empty.');
      return;
    }
    Alert.alert(
      'Clear All Items',
      'Are you sure you want to remove all items from your grocery list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllItems();
            } catch (e: any) {
              Alert.alert('Error', `Failed to clear all items: ${e.message}`);
            }
          },
        },
      ],
    );
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGroceryItem(itemId);
            } catch (e: any) {
              Alert.alert('Error', `Failed to delete item: ${e.message}`);
            }
          },
        },
      ],
    );
  };

  const handleToggleChecked = async (item: GroceryItem) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      await toggleGroceryItemChecked(item.id, !item.is_checked);
    } catch (e: any) {
      Alert.alert('Error', `Failed to update item: ${e.message}`);
    }
  };

  const renderItem = ({ item }: { item: GroceryItem }) => {
    const itemIconName = getIconForItem(item.item_name) as any; // Type assertion for Feather icons
    return (
      <TouchableOpacity
        onPress={() => handleToggleChecked(item)}
        activeOpacity={0.7}
        style={{ transform: [{ scale: item.is_checked ? 0.98 : 1 }] }}>
        <View
          style={[styles.itemContainer, item.is_checked && styles.itemChecked]}>
          <View style={styles.itemIcon}>
            <Feather
              name={itemIconName}
              size={20}
              color={item.is_checked ? '#9ca3af' : ACTIVE_COLOR}
            />
          </View>
          <View style={styles.itemTextContainer}>
            <Text
              style={[
                styles.itemText,
                item.is_checked && styles.itemTextChecked,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {item.item_name}
            </Text>
            {(item.recipe_name || item.created_at) && (
              <View style={styles.metaDataContainer}>
                {item.recipe_name && (
                  <Text style={styles.metaText}>
                    <Feather name="package" size={12} color="#6b7280" />{' '}
                    {item.recipe_name}
                  </Text>
                )}
                {item.created_at && (
                  <Text style={styles.metaText}>
                    <Feather name="clock" size={12} color="#6b7280" />{' '}
                    {getShortRelativeTime(item.created_at)}
                  </Text>
                )}
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteItem(item.id, item.item_name)}
            style={styles.deleteButton}>
            <Feather name="trash" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAggregatedIngredient = ({
    item,
  }: {
    item: AggregatedIngredient;
  }) => (
    <View style={styles.mpiContainer}>
      <Text style={styles.mpiName}>{item.name}</Text>
      {item.appearances.map((appearance, index) => (
        <View key={index} style={styles.mpiAppearance}>
          <Text style={styles.mpiQuantityUnit}>
            {appearance.quantity || ''} {appearance.unit || ''}
          </Text>
          <Text style={styles.mpiRecipeName}>
            {' '}
            (from {appearance.recipe_name})
          </Text>
        </View>
      ))}
    </View>
  );

  function ListHeader() {
    return (
      <View style={styles.actionButtonsSection}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={clearCheckedItems}>
          <View style={styles.actionButtonIcon}>
            <Feather name="check-circle" size={20} color={ACTIVE_COLOR} />
          </View>
          <Text style={styles.actionButtonText}>Clear Checked</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={loadIngredientsFromCurrentWeek}>
          <View style={styles.actionButtonIcon}>
            <Feather name="calendar" size={20} color={ACTIVE_COLOR} />
          </View>
          <Text style={styles.actionButtonText}>Plan Ingredients</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerActionButton]}
          onPress={handleClearAllItems}>
          <View style={styles.actionButtonIcon}>
            <Feather name="trash" size={20} color="#ef4444" />
          </View>
          <Text
            style={[styles.actionButtonText, styles.dangerActionButtonText]}>
            Clear All
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Grocery List</Text>
          <Text style={styles.headerSubtitle}>
            {groceryList.length} items •{' '}
            {groceryList.filter(item => item.is_checked).length} completed
          </Text>
        </View>
        <View style={styles.itemCountBadge}>
          <Text style={styles.itemCountText}>{groceryList.length}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[ACTIVE_COLOR]}
              tintColor={ACTIVE_COLOR}
            />
          }>
          <ListHeader />

          {isGroceryManagerLoading && groceryList.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={ACTIVE_COLOR} />
              <Text style={styles.loadingText}>
                Loading your grocery list...
              </Text>
            </View>
          )}

          {groceryManagerError && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={48} color="#ef4444" />
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>
                Error loading grocery list: {groceryManagerError}
              </Text>
            </View>
          )}

          {groceryList.length === 0 && !isGroceryManagerLoading && (
            <View style={styles.emptyContainer}>
              <Feather name="shopping-bag" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Your grocery list is empty</Text>
              <Text style={styles.emptyText}>
                Add items from your meal plan or manually to get started.
              </Text>
            </View>
          )}

          {groceryList.length > 0 && (
            <View style={styles.itemsSection}>
              <FlatList
                data={groceryList.sort(
                  (a, b) =>
                    Number(a.is_checked) - Number(b.is_checked) ||
                    new Date(b.created_at || 0).getTime() -
                      new Date(a.created_at || 0).getTime(),
                )}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            </View>
          )}

          {isLoadingMealPlanIngredients && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={ACTIVE_COLOR} />
              <Text style={styles.loadingText}>
                Loading meal plan ingredients...
              </Text>
            </View>
          )}

          {mealPlanIngredientsError && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={48} color="#ef4444" />
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>
                Error: {mealPlanIngredientsError}
              </Text>
            </View>
          )}

          {mealPlanIngredients.length > 0 && (
            <View style={styles.mealPlanSection}>
              <Text style={styles.sectionTitle}>
                From Your Meal Plan (This Week)
              </Text>
              <FlatList
                data={mealPlanIngredients}
                renderItem={renderAggregatedIngredient}
                keyExtractor={(item, index) => `${item.name}-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {mealPlanIngredients.length === 0 &&
            !isLoadingMealPlanIngredients &&
            !mealPlanIngredientsError &&
            mealPlanIngredients !== null && (
              <View style={styles.infoContainer}>
                <Feather name="info" size={24} color="#6b7280" />
                <Text style={styles.infoText}>
                  No ingredients loaded from this week's meal plan. Tap "Plan
                  Ingredients" to load.
                </Text>
              </View>
            )}
        </ScrollView>
      </View>
    </SafeAreaView>
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
    justifyContent: 'space-between',
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  itemCountBadge: {
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  itemCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  actionButtonsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    minWidth: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonIcon: {
    marginBottom: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  dangerActionButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  dangerActionButtonText: {
    color: '#dc2626',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  itemChecked: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    opacity: 0.8,
  },
  itemIcon: {
    marginRight: 16,
    width: 24,
    alignItems: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  metaDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  itemsSection: {
    marginBottom: 32,
  },
  mealPlanSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  mpiContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  mpiName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  mpiAppearance: {
    flexDirection: 'row',
    marginLeft: 16,
    alignItems: 'center',
    marginBottom: 2,
  },
  mpiQuantityUnit: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  mpiRecipeName: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});
