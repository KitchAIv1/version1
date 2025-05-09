import React from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Button, SafeAreaView, LayoutAnimation, UIManager, Platform } from 'react-native';
import { useGroceryManager, GroceryItem } from '../../hooks/useGroceryManager'; // Corrected hook name and import GroceryItem type
import { COLORS, FONTS, SIZES } from '../../constants/theme'; // Assuming these constants are correctly set up
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
    groceryList, // Changed from groceryItems
    isLoading,
    error, // Added error handling from hook
    toggleGroceryItemChecked, // Corrected name
    removeGroceryItem,      // Corrected name
    fetchGroceryList,       // Corrected name (for manual refresh, if needed)
    currentUserId,          // Available from hook if needed for other operations
    clearAllItems,          // Added clearAllItems
  } = useGroceryManager();

  const clearCheckedItems = async () => {
    const checkedItems = groceryList.filter(item => item.is_checked);
    if (checkedItems.length === 0) {
      Alert.alert("No Items", "No checked items to clear.");
      return;
    }

    Alert.alert(
      "Clear Checked Items",
      `Are you sure you want to remove ${checkedItems.length} checked item(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Items",
          style: "destructive",
          onPress: async () => {
            try {
              // Await all promises from removeGroceryItem
              await Promise.all(checkedItems.map(item => removeGroceryItem(item.id)));
              // The list will refresh via the hook after each successful removal, 
              // or more efficiently, the last successful removal triggers the final refresh.
              // No need to call fetchGroceryList() here explicitly if removeGroceryItem handles it.
              Alert.alert("Success", "Checked items cleared.");
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not clear checked items.");
            }
          },
        },
      ]
    );
  };

  const handleClearAllItems = () => {
    if (groceryList.length === 0) {
      Alert.alert("No Items", "The grocery list is already empty.");
      return;
    }
    Alert.alert(
      "Clear All Items",
      "Are you sure you want to remove ALL items from your grocery list? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllItems(); // Call the hook function
              Alert.alert("Success", "All grocery items cleared.");
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not clear all items.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteItem = (itemId: string, itemName: string) => { // itemId is string
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${itemName}" from your grocery list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', onPress: async () => {
            try {
              await removeGroceryItem(itemId); 
              // List automatically refreshes via hook after successful removal
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not delete item.");
            }
          }, style: 'destructive' 
        }
      ]
    );
  };

  const handleToggleChecked = async (item: GroceryItem) => {
    try {
      // Configure the animation before the state change
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await toggleGroceryItemChecked(item.id, !item.is_checked);
      // List automatically refreshes via hook
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not update item.");
    }
  };

  const renderItem = ({ item }: { item: GroceryItem }) => {
    const iconName = getIconForItem(item.item_name);
    return (
      <TouchableOpacity
        style={[styles.itemContainer, item.is_checked && styles.itemChecked]}
        onPress={() => handleToggleChecked(item)} // Use new handler
      >
        <Icon name={iconName} size={24} color={item.is_checked ? (COLORS.gray || '#6b7280') : (COLORS.primary || '#22c55e')} style={styles.itemIcon} />
        <View style={styles.itemTextContainer}> 
          <Text style={[styles.itemText, item.is_checked && styles.itemTextChecked]}>
            {/* Conditional rendering for quantity and unit if they can be null */}
            {item.quantity ? `${item.quantity} ` : ''}
            {item.unit ? `${item.unit} ` : ''}
            {item.item_name}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteItem(item.id, item.item_name)} style={styles.deleteButton}>
          <Icon name="trash-outline" size={22} color={COLORS.error || '#dc2626'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (isLoading && groceryList.length === 0) { // Show full page loader only on initial load
    return (
      <SafeAreaView style={styles.safeAreaContainer}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={COLORS.primary || '#22c55e'} />
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <View style={styles.container}>
        {/* New Header Bar */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>🛒 Grocery List</Text>
          <View style={styles.headerButtonsContainer}> 
            <TouchableOpacity onPress={clearCheckedItems} style={styles.headerButton}>
              <Icon name="checkmark-done-outline" size={28} color={COLORS.primary || '#22c55e'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearAllItems} style={[styles.headerButton, styles.clearAllButton]}> 
              <Icon name="trash-bin-outline" size={26} color={COLORS.error || '#dc2626'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Area */}
        {groceryList.length === 0 && !isLoading ? (
          <View style={[styles.centered, { flex: 1 }]}> {/* Ensure empty state also takes up space below header */}
            <Icon name="list-outline" size={48} color={COLORS.gray || '#9ca3af'} />
            <Text style={styles.emptyText}>Your grocery list is empty.</Text>
            <Text style={styles.emptySubText}>Add items from recipes or manually.</Text>
          </View>
        ) : (
          <FlatList
            data={groceryList} // Use groceryList from hook
            keyExtractor={(item) => item.id} // .toString() not needed as id is already string
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            // Optionally add a RefreshControl if you want pull-to-refresh
            // refreshing={isLoading} // Link to isLoading if implementing RefreshControl
            // onRefresh={fetchGroceryList} 
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// Assuming SIZES, FONTS, COLORS are defined in your theme constants
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
    marginTop: SIZES.small || 8,
  },
  emptySubText: {
    fontSize: SIZES.body2 || 14, // Use SIZES.body2 if available
    // fontFamily: FONTS.family?.regular, // Example
    color: COLORS.textSecondary || '#9ca3af', // Changed from textMuted
    marginTop: (SIZES.base || 8) / 2,
    textAlign: 'center',
  }
}); 