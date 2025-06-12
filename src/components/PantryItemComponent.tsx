import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMostRecentActivity } from '../utils/dateUtils';
import { PantryItem } from '../hooks/usePantryData';

// Constants
const ACTIVE_COLOR = '#10b981';

// Helper function to detect mixed batches
const isMixedBatches = (item: PantryItem): boolean => {
  return !!(
    item.quantity_added !== null && 
    item.quantity_added !== undefined && 
    item.quantity_added !== 0 &&
    item.previous_quantity !== null &&
    item.previous_quantity !== undefined &&
    item.previous_quantity > 0
  );
};

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  itemTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  metaDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 12,
    marginBottom: 2,
    fontWeight: '500',
  },
  mixedBatchesText: {
    fontSize: 12,
    color: '#6366f1', // indigo-500 to match the badge color
    marginRight: 12,
    marginBottom: 2,
    fontWeight: '600', // slightly bolder to make it stand out
  },
  itemDescription: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  itemActionButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
});

// Item Icon Mapping (optimized - pre-sorted)
const itemIconMap: { [key: string]: string } = {
  // Fruits
  apple: 'nutrition-outline',
  banana: 'nutrition-outline',
  orange: 'nutrition-outline',
  strawberry: 'nutrition-outline',
  grapes: 'nutrition-outline',
  blueberry: 'nutrition-outline',
  raspberry: 'nutrition-outline',
  avocado: 'leaf-outline',

  // Vegetables
  tomato: 'leaf-outline',
  potato: 'leaf-outline',
  onion: 'leaf-outline',
  lettuce: 'leaf-outline',
  carrot: 'leaf-outline',
  broccoli: 'leaf-outline',
  cucumber: 'leaf-outline',
  bellpepper: 'leaf-outline',
  garlic: 'leaf-outline',
  spinach: 'leaf-outline',

  // Dairy & Alternatives
  milk: 'pint-outline',
  cheese: 'cube-outline',
  cheddar: 'cube-outline',
  mozzarella: 'ellipse-outline',
  yogurt: 'ice-cream-outline',
  butter: 'layers-outline',
  'almond milk': 'pint-outline',
  'soy milk': 'pint-outline',

  // Bakery
  bread: 'restaurant-outline',
  'white bread': 'restaurant-outline',
  'whole wheat bread': 'restaurant-outline',
  bagel: 'ellipse-outline',
  croissant: 'restaurant-outline',

  // Proteins
  eggs: 'egg-outline',
  chicken: 'logo-twitter',
  'chicken breast': 'logo-twitter',
  beef: 'restaurant-outline',
  steak: 'restaurant-outline',
  pork: 'restaurant-outline',
  bacon: 'remove-outline',
  fish: 'fish-outline',
  salmon: 'fish-outline',
  shrimp: 'fish-outline',
  tofu: 'square-outline',

  // Pantry Staples
  pasta: 'restaurant-outline',
  rice: 'ellipse-outline',
  flour: 'folder-outline',
  sugar: 'cube-outline',
  salt: 'cube-outline',
  pepper: 'ellipse-outline',
  'olive oil': 'water-outline',
  vinegar: 'water-outline',
  cereal: 'apps-outline',
  oats: 'apps-outline',
  coffee: 'cafe-outline',
  tea: 'cafe-outline',

  // Drinks
  juice: 'water-outline',
  'apple juice': 'water-outline',
  'orange juice': 'water-outline',
  soda: 'beer-outline',
  water: 'water-outline',

  // Default
  default: 'cube-outline',
};

// Pre-sorted keys for performance (longest first)
const sortedIconKeys = Object.keys(itemIconMap).sort(
  (a, b) => b.length - a.length,
);

// Memoized icon getter function
const getIconForItem = (itemName: string): string => {
  const lowerItemName = itemName.toLowerCase();
  for (const key of sortedIconKeys) {
    if (lowerItemName.includes(key)) {
      return itemIconMap[key];
    }
  }
  return itemIconMap.default;
};

interface PantryItemComponentProps {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
}

export const PantryItemComponent = memo<PantryItemComponentProps>(
  ({ item, onEdit, onDelete }) => {
    // Memoize icon calculation
    const itemIconName = useMemo(
      () => getIconForItem(item.item_name),
      [item.item_name],
    );

    // Check if this item has mixed batches
    const hasMixedBatches = useMemo(() => isMixedBatches(item), [item]);

    // Memoize activity calculation
    const activityInfo = useMemo(
      () => getMostRecentActivity(item.created_at, item.updated_at),
      [item.created_at, item.updated_at],
    );

    // Memoize event handlers
    const handleEdit = useCallback(() => onEdit(item), [onEdit, item]);
    const handleDelete = useCallback(() => onDelete(item), [onDelete, item]);

    const handleEditPress = useCallback(
      (e: any) => {
        e.stopPropagation();
        handleEdit();
      },
      [handleEdit],
    );

    const handleDeletePress = useCallback(
      (e: any) => {
        e.stopPropagation();
        handleDelete();
      },
      [handleDelete],
    );

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={handleEdit}
        activeOpacity={0.7}>
        <View style={styles.itemIcon}>
          <Ionicons name={itemIconName as any} size={24} color={ACTIVE_COLOR} />
        </View>
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
            {item.item_name.charAt(0).toUpperCase() + item.item_name.slice(1)}
          </Text>
          <View style={styles.metaDataContainer}>
            <Text style={styles.metaText}>
              <Ionicons name="cube-outline" size={12} /> {item.quantity}{' '}
              {item.unit}
            </Text>
            {hasMixedBatches ? (
              <Text style={styles.mixedBatchesText}>
                <Ionicons name="layers-outline" size={12} /> Mixed Batches
              </Text>
            ) : (
              activityInfo.formattedTime && (
                <Text style={styles.metaText}>
                  <Ionicons name="time-outline" size={12} />{' '}
                  {activityInfo.label} {activityInfo.formattedTime}
                </Text>
              )
            )}
          </View>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={handleEditPress}>
          <Ionicons name="create-outline" size={22} color="#757575" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={handleDeletePress}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
);

PantryItemComponent.displayName = 'PantryItemComponent';
