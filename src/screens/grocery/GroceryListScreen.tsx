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
    return (
      <TouchableOpacity onPress={() => handleToggleChecked(item)} activeOpacity={0.7}>
        <View style={[styles.itemContainer, item.is_checked && styles.itemChecked]}>
          <Icon name={itemIconName} size={SIZES.large || 20} color={COLORS.primary || '#22c55e'} style={styles.itemIcon} />
          <View style={styles.itemTextContainer}>
            <Text style={[styles.itemText, item.is_checked && styles.itemTextChecked]}>
              {item.item_name}
            </Text>
            { (item.quantity || item.unit) && 
              <View style={styles.tagContainer}>
                 {item.quantity && <Text style={styles.tagText}>{item.quantity}</Text>}
                 {item.unit && <Text style={styles.tagText}>{item.unit}</Text>}
              </View>
            }
          </View>
          <TouchableOpacity onPress={() => handleDeleteItem(item.id, item.item_name)} style={styles.deleteButton}>
            <Icon name="trash-bin-outline" size={SIZES.medium || 20} color={COLORS.gray || '#6b7280'} />
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
            <TouchableOpacity onPress={clearCheckedItems} style={styles.headerButton}>
              <Icon name="checkmark-done-outline" size={SIZES.medium || 24} color={COLORS.primary || '#22c55e'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearAllItems} style={[styles.headerButton, styles.clearAllButton]}>
              <Icon name="trash-outline" size={SIZES.medium || 24} color={COLORS.error || '#ef4444'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Area */}
        {groceryList.length === 0 && !isLoading ? (
          <View style={[styles.container, styles.centered]}>
            {/* <Image 
              source={require('../../assets/images/empty-basket.png')} 
              style={{ width: 150, height: 150, marginBottom: SIZES.large }} 
              resizeMode="contain"
            /> */}
            <Text style={styles.emptyText}>Your Basket is Empty</Text>
            <Text style={styles.emptySubText}>Add items from recipes or manually.</Text>
          </View>
        ) : (
          <FlatList
            data={groceryList.sort((a, b) => {
              // Sort by is_checked (false first), then by created_at or item_name
              if (a.is_checked !== b.is_checked) {
                return a.is_checked ? 1 : -1;
              }
              // Add secondary sort if needed, e.g., by name or date
              // return a.item_name.localeCompare(b.item_name);
              return 0; // Keep original order for items with same checked status for now
            })}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()} // Ensure id is a string
            contentContainerStyle={groceryList.length === 0 ? styles.centered : { paddingBottom: SIZES.large }} // Added paddingBottom
            // ListEmptyComponent is handled by the conditional rendering above the FlatList
          />
        )}
      </View>
    </SafeAreaView>
  );

  /* --- Further original JSX to be restored incrementally ---
  // const handleDeleteItem = (itemId: string, itemName: string) => { ... };
  // const handleToggleChecked = async (item: GroceryItem) => { ... };
  // const renderItem = ({ item }: { item: GroceryItem }) => { ... };

  // return (
  //   <SafeAreaView style={styles.safeAreaContainer}>
  //     <View style={styles.container}>
  //       <View style={styles.headerBar}>{ ... }</View>
  //       {groceryList.length === 0 && !isLoading ? ( ... empty state ... ) : ( <FlatList ... /> )}
  //     </View>
  //   </SafeAreaView>
  // );
  */
}

// --- Original Styles (Restored) ---
const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: COLORS.background || '#f8fafc',
  },
  container: {
    flex: 1,
    // backgroundColor is now on safeAreaContainer
    // paddingHorizontal and paddingTop are handled by headerBar or specific content sections
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.medium || 16,
    paddingVertical: SIZES.small || 12, // A bit more padding for header
    backgroundColor: COLORS.surface || '#ffffff', // Or COLORS.background if you want it to blend more
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#e5e7eb',
    // elevation: 2, // Optional: if you want a slight shadow for the header
  },
  headerTitle: {
    fontSize: SIZES.h2 || 22, // Adjusted size slightly
    fontWeight: 'bold',
    color: COLORS.text || '#1f2937',
    // fontFamily: FONTS.family?.bold, 
  },
  headerButtonsContainer: { // Added to group buttons
    flexDirection: 'row',
  },
  headerButton: {
    padding: SIZES.base / 2 || 4,
    marginLeft: SIZES.small || 8, // Add some space between buttons
  },
  clearAllButton: { // Specific style for clear all if needed, e.g., margin
    // No specific style needed yet other than icon color, handled inline
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.medium || 16, // Add padding back for centered content like empty/error state
    flex: 1, // Ensure centered content like error/loading takes full available space within its container
  },
  title: {
    fontSize: SIZES.h2 || 24, // Use SIZES.h2 if available, else fallback
    fontWeight: 'bold',
    // fontFamily: FONTS.family?.bold, // Example if FONTS.family.bold exists
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
    borderRadius: SIZES.small || 8, // Changed from SIZES.radius to SIZES.small as radius might not exist
    marginBottom: SIZES.small || 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    marginHorizontal: SIZES.medium || 16, // Add horizontal margin for items, so list can be full width
  },
  itemChecked: {
    backgroundColor: COLORS.primaryLight || '#e6f7e7', // Changed from COLORS.successLight to primaryLight or fallback
    opacity: 0.7,
  },
  itemIcon: { // Style for the new icon
    marginRight: SIZES.small || 10,
  },
  itemTextContainer: {
    flex: 1,
    // marginRight: SIZES.small || 8, // Already has margin for delete button, icon is on the left
  },
  itemText: {
    fontSize: SIZES.body3 || 16, // Use SIZES.body3 if available, else fallback
    // fontFamily: FONTS.family?.regular, // Example
    color: COLORS.text || '#1f2937',
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.gray || '#6b7280',
  },
  deleteButton: {
    padding: (SIZES.base || 8) / 2, // Use SIZES.base if available
  },
  errorText: {
    fontSize: SIZES.body1 || 16, // Use SIZES.body1 if available
    // fontFamily: FONTS.family?.regular, // Example
    color: COLORS.error || '#ef4444',
    textAlign: 'center',
    marginBottom: SIZES.medium || 16,
  },
  emptyText: {
    fontSize: SIZES.h3 || 18, // Use SIZES.h3 if available
    fontWeight: '600',
    // fontFamily: FONTS.family?.semibold, // Example
    color: COLORS.textSecondary || '#4b5563',
    marginTop: SIZES.small || 8, // Adjusted from SIZES.medium
  },
  emptySubText: {
    fontSize: SIZES.body2 || 14, // Use SIZES.body2 if available
    // fontFamily: FONTS.family?.regular, // Example
    color: COLORS.textSecondary || '#9ca3af', // Changed from textMuted
    marginTop: (SIZES.base || 8) / 2,
    textAlign: 'center',
  },
  // Styles for item tags
  tagContainer: {
    flexDirection: 'row',
    marginTop: SIZES.base / 2 || 4,
  },
  tagText: {
    fontSize: SIZES.body5 || 12, // Use SIZES.body5 or a small size
    // fontFamily: FONTS.family?.regular, // Example
    color: COLORS.textSecondary || '#6b7280',
    backgroundColor: COLORS.border || '#e5e7eb', // Light background for tag
    paddingHorizontal: SIZES.base || 8,
    paddingVertical: SIZES.base / 2 || 4,
    borderRadius: SIZES.small || 4, // SIZES.radius might not exist
    marginRight: SIZES.base / 2 || 4,
    overflow: 'hidden', // Ensure text stays within rounded corners
  },
}); 