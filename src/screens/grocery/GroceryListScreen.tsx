import React from 'react';
import { View, Text, SafeAreaView, /* other imports used by original component */ ActivityIndicator, Button, Alert, StyleSheet, LayoutAnimation, UIManager, Platform, FlatList, TouchableOpacity, Image } from 'react-native';
import { useGroceryManager, GroceryItem } from '../../hooks/useGroceryManager';
import { COLORS, FONTS, SIZES } from '../../constants/theme';
import Icon from 'react-native-vector-icons/Ionicons';

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
  // Sort keys by length, longest first, to match more specific phrases first
  const sortedKeys = Object.keys(itemIconMap).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (lowerItemName.includes(key)) {
      return itemIconMap[key];
    }
  }
  return itemIconMap['default']; // Access default icon safely
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
    isLoading,
    error, 
    toggleGroceryItemChecked,
    removeGroceryItem,
    fetchGroceryList,
    clearAllItems,
  } = useGroceryManager();

  console.log('[GroceryListScreen] isLoading:', isLoading, 'error:', error, 'list length:', groceryList.length);

  // Helper function to clear checked items
  const clearCheckedItems = async () => {
    const checkedItems = groceryList.filter(item => item.is_checked);
    if (checkedItems.length === 0) {
      Alert.alert("No items to clear", "There are no checked items in your grocery list.");
      return;
    }

    Alert.alert(
      "Confirm Clear",
      `Are you sure you want to remove ${checkedItems.length} checked item(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              for (const item of checkedItems) {
                await removeGroceryItem(item.id);
              }
              // fetchGroceryList(); // removeGroceryItem already refreshes
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to clear checked items.");
            }
          },
        },
      ]
    );
  };

  // Helper function to clear all items
  const handleClearAllItems = () => {
    if (groceryList.length === 0) {
      Alert.alert("List Empty", "Your grocery list is already empty.");
      return;
    }
    Alert.alert(
      "Clear All Items",
      "Are you sure you want to remove all items from your grocery list? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllItems();
              // fetchGroceryList(); // clearAllItems already refreshes
            } catch (e: any) {
              Alert.alert("Error", `Failed to clear all items: ${e.message}`);
            }
          },
        },
      ]
    );
  };

  // Helper function to handle deleting an item
  const handleDeleteItem = (itemId: string, itemName: string) => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${itemName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeGroceryItem(itemId);
            } catch (e: any) {
              Alert.alert("Error", `Failed to delete item: ${e.message}`);
            }
          },
        },
      ]
    );
  };

  // Helper function to toggle item checked state
  const handleToggleChecked = async (item: GroceryItem) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      await toggleGroceryItemChecked(item.id, !item.is_checked);
    } catch (e: any) {
      Alert.alert("Error", `Failed to update item: ${e.message}`);
    }
  };

  // Render individual grocery item
  const renderItem = ({ item }: { item: GroceryItem }) => {
    const itemIconName = getIconForItem(item.item_name);
    const formattedDate = formatDateTime(item.created_at);

    return (
      <TouchableOpacity 
        onPress={() => handleToggleChecked(item)} 
        activeOpacity={0.7}
        style={{ transform: [{ scale: item.is_checked ? 0.98 : 1 }] }} // Subtle scale difference for checked items
      >
        <View style={[styles.itemContainer, item.is_checked && styles.itemChecked]}>
          <View style={styles.itemIcon}>
            <Icon 
              name={itemIconName} 
              size={SIZES.large || 20} 
              color={item.is_checked ? COLORS.gray || '#9ca3af' : COLORS.primary || '#22c55e'} 
            />
          </View>
          <View style={styles.itemTextContainer}>
            <Text style={[styles.itemText, item.is_checked && styles.itemTextChecked]} numberOfLines={1} ellipsizeMode="tail">
              {item.item_name}
            </Text>
            {/* Display Recipe Name and Added Date/Time */}
            {(item.recipe_name || formattedDate) && (
              <View style={styles.metaDataContainer}>
                {item.recipe_name && 
                  <Text style={styles.metaDataText} numberOfLines={1} ellipsizeMode="tail"> 
                    <Icon name="book-outline" size={SIZES.body5 || 12} color={COLORS.textSecondary || '#6b7280'} /> From: {item.recipe_name}
                  </Text>
                }
                {formattedDate && 
                  <Text style={styles.metaDataText} numberOfLines={1} ellipsizeMode="tail"> 
                    <Icon name="time-outline" size={SIZES.body5 || 12} color={COLORS.textSecondary || '#6b7280'} /> Added: {formattedDate}
                  </Text>
                }
              </View>
            )}
            { (item.quantity || item.unit) && 
              <View style={styles.tagContainer}>
                {item.quantity && (
                  <Text style={styles.tagText}>
                    {item.quantity} {item.unit && item.unit}
                  </Text>
                )}
                {!item.quantity && item.unit && <Text style={styles.tagText}>{item.unit}</Text>}
              </View>
            }
          </View>
          <TouchableOpacity 
            onPress={() => handleDeleteItem(item.id, item.item_name)} 
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
          >
            <Icon 
              name="trash-bin-outline" 
              size={SIZES.medium || 20} 
              color={COLORS.error || '#ef4444'} 
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // 1. isLoading block (already restored)
  if (isLoading && groceryList.length === 0) { 
    return (
      <SafeAreaView style={styles.safeAreaContainer}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={COLORS.primary || '#22c55e'} />
        </View>
      </SafeAreaView>
    );
  }

  // 2. Restore if (error) block
  if (error) {
    return (
      <SafeAreaView style={styles.safeAreaContainer}>
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={() => fetchGroceryList()} color={COLORS.primary || '#22c55e'} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Restore main content structure ---
  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Grocery List</Text>
          <View style={styles.headerButtonsContainer}>
            <TouchableOpacity 
              onPress={clearCheckedItems} 
              style={styles.headerButton}
              disabled={groceryList.filter(item => item.is_checked).length === 0} // Disable if no checked items
            >
              <Icon 
                name="checkmark-done-outline" 
                size={SIZES.medium || 24} 
                color={groceryList.filter(item => item.is_checked).length === 0 ? 
                  COLORS.gray || '#9ca3af' : 
                  COLORS.primary || '#22c55e'} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleClearAllItems} 
              style={[styles.headerButton, styles.clearAllButton]}
              disabled={groceryList.length === 0} // Disable if list is empty
            >
              <Icon 
                name="trash-outline" 
                size={SIZES.medium || 24} 
                color={groceryList.length === 0 ? 
                  COLORS.gray || '#9ca3af' : 
                  COLORS.error || '#ef4444'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Area */}
        {groceryList.length === 0 && !isLoading ? (
          <View style={[styles.container, styles.centered]}>
            <Icon 
              name="basket-outline" 
              size={80} 
              color={COLORS.border || '#e5e7eb'} 
              style={{ marginBottom: SIZES.large || 24 }} 
            />
            <Text style={styles.emptyText}>Your Basket is Empty</Text>
            <Text style={styles.emptySubText}>
              Add items from recipes or manually.
            </Text>
          </View>
        ) : (
          <FlatList
            data={groceryList.sort((a, b) => {
              // Sort by is_checked (false first), then by created_at
              if (a.is_checked !== b.is_checked) {
                return a.is_checked ? 1 : -1;
              }
              // Secondary sort by name for better organization
              return a.item_name.localeCompare(b.item_name);
            })}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[
              styles.listContainer,
              { paddingBottom: 32 } // Use fallback value directly
            ]}
            showsVerticalScrollIndicator={false} // Hide scrollbar for cleaner look
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// --- Original Styles (Restored) ---
const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: COLORS.background || '#f8fafc',
  },
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.medium || 16,
    paddingVertical: SIZES.medium || 16, // Increased vertical padding
    backgroundColor: COLORS.surface || '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#e5e7eb',
    elevation: 2, // Added slight elevation for better depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginBottom: SIZES.small || 8, // Added spacing after header
  },
  headerTitle: {
    fontSize: SIZES.h2 || 22,
    fontWeight: 'bold',
    color: COLORS.text || '#1f2937',
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: SIZES.base || 8, // Increased touch target area
    marginLeft: SIZES.medium || 16, // More space between buttons
    borderRadius: (SIZES.base || 8) * 2, // Make buttons more circular
    backgroundColor: 'rgba(0,0,0,0.05)', // Very subtle background for buttons
  },
  clearAllButton: {
    backgroundColor: 'rgba(239,68,68,0.1)', // Subtle red background for clear button
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.medium || 16,
    flex: 1,
  },
  title: {
    fontSize: SIZES.h2 || 24,
    fontWeight: 'bold',
    color: COLORS.primary || '#22c55e',
    marginBottom: SIZES.medium || 16,
    textAlign: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.medium || 16,
    backgroundColor: COLORS.surface || '#ffffff',
    borderRadius: SIZES.small || 12, // Increased border radius
    marginBottom: SIZES.small || 12, // Increased margin between items
    elevation: 2, // Slightly more elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, // Subtle shadow
    shadowRadius: 3,
    marginHorizontal: SIZES.medium || 16,
    borderLeftWidth: 3, // Add a subtle colored bar on the left
    borderLeftColor: COLORS.primary || '#22c55e',
  },
  itemChecked: {
    backgroundColor: COLORS.primaryLight || '#e6f7e7',
    opacity: 0.9, // Less opacity reduction for better readability
    borderLeftColor: COLORS.gray || '#9ca3af', // Change left border color when checked
  },
  itemIcon: {
    marginRight: SIZES.medium || 16, // More space between icon and text
    padding: SIZES.base / 2 || 4, // Padding around icon
    backgroundColor: 'rgba(34,197,94,0.1)', // Very subtle background for icon
    borderRadius: SIZES.small || 8,
    width: 36, // Fixed width for consistency
    height: 36, // Fixed height for consistency
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextContainer: {
    flex: 1,
    paddingVertical: SIZES.small / 2 || 4, // Add some vertical padding
  },
  itemText: {
    fontSize: SIZES.body3 || 16,
    color: COLORS.text || '#1f2937',
    fontWeight: '500', // Slightly bolder item name
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.gray || '#6b7280',
    fontWeight: 'normal', // Normal weight when checked
  },
  deleteButton: {
    padding: SIZES.small || 8, // Larger touch target
    marginLeft: SIZES.small || 8,
    borderRadius: SIZES.small || 8,
    backgroundColor: 'rgba(239,68,68,0.1)', // Subtle background for delete
  },
  errorText: {
    fontSize: SIZES.body1 || 16,
    color: COLORS.error || '#ef4444',
    textAlign: 'center',
    marginBottom: SIZES.medium || 16,
  },
  emptyText: {
    fontSize: SIZES.h3 || 18,
    fontWeight: '600',
    color: COLORS.textSecondary || '#4b5563',
    marginTop: SIZES.medium || 16,
    marginBottom: SIZES.small || 8, // Add some space between title and subtitle
  },
  emptySubText: {
    fontSize: SIZES.body2 || 14,
    color: COLORS.textSecondary || '#9ca3af',
    textAlign: 'center',
    maxWidth: '80%', // Constrain width for better readability
  },
  tagContainer: {
    flexDirection: 'row',
    marginTop: SIZES.small || 8, // More space before tags
    flexWrap: 'wrap', // Allow wrapping for multiple tags
  },
  tagText: {
    fontSize: SIZES.body5 || 12,
    color: COLORS.textSecondary || '#6b7280',
    backgroundColor: COLORS.border || '#e5e7eb',
    paddingHorizontal: SIZES.small || 8, // More padding
    paddingVertical: SIZES.base / 2 || 4,
    borderRadius: SIZES.medium || 16, // More rounded for pill effect
    marginRight: SIZES.small / 2 || 4,
    marginBottom: SIZES.small / 2 || 4, // For wrapped tags
    overflow: 'hidden',
  },
  // New styles for improved UI
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary || '#22c55e',
    position: 'absolute',
    left: 4,
  },
  statusIndicatorChecked: {
    backgroundColor: COLORS.gray || '#9ca3af',
  },
  listContainer: {
    paddingTop: SIZES.small || 8, // Add top padding to list
  },
  metaDataContainer: {
    marginTop: SIZES.small / 2 || 4, // Space below item name
  },
  metaDataText: {
    fontSize: SIZES.body5 || 12,
    color: COLORS.textSecondary || '#6b7280',
    marginTop: 2, // Small space between lines if both present
  },
}); 