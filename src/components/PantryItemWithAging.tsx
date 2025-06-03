import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getShortRelativeTime } from '../utils/dateUtils';
import {
  StockAgingItem,
  AGE_GROUP_CONFIG,
  AgeGroup,
} from '../hooks/useStockAging';

// Constants
const ACTIVE_COLOR = '#10b981';

// Item Icon Mapping (reusing from original PantryItemComponent)
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
};

// Helper function to get icon for item
const getIconForItem = (itemName: string): string => {
  const normalizedName = itemName.toLowerCase().trim();
  return itemIconMap[normalizedName] || 'cube-outline'; // Default fallback
};

interface PantryItemWithAgingProps {
  item: StockAgingItem;
  onEdit: (item: StockAgingItem) => void;
  onDelete: (item: StockAgingItem) => void;
}

export const PantryItemWithAging = memo<PantryItemWithAgingProps>(
  ({ item, onEdit, onDelete }) => {
    // Memoize icon calculation
    const itemIconName = useMemo(
      () => getIconForItem(item.item_name),
      [item.item_name],
    );

    // Get age group configuration
    const ageConfig = AGE_GROUP_CONFIG[item.age_group];

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

    // Create accessibility text that combines color with description
    const agingAccessibilityText = `${ageConfig.label} - ${item.age_description}`;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={handleEdit}
        activeOpacity={0.7}
        accessibilityLabel={`${item.item_name}, ${item.quantity} ${item.unit}, ${agingAccessibilityText}`}
        accessibilityHint="Tap to edit this pantry item">
        {/* Main Content Row */}
        <View style={styles.mainContentRow}>
          {/* Item Icon */}
          <View style={styles.itemIcon}>
            <Ionicons
              name={itemIconName as any}
              size={24}
              color={ACTIVE_COLOR}
            />
          </View>

          {/* Item Details */}
          <View style={styles.itemTextContainer}>
            <View style={styles.itemTitleRow}>
              <Text
                style={styles.itemText}
                numberOfLines={1}
                ellipsizeMode="tail">
                {item.item_name.charAt(0).toUpperCase() +
                  item.item_name.slice(1)}
              </Text>

              {/* Age Badge */}
              <View
                style={[
                  styles.ageBadge,
                  {
                    backgroundColor: ageConfig.backgroundColor,
                    borderColor: ageConfig.color,
                  },
                ]}
                accessibilityLabel={agingAccessibilityText}>
                <Text
                  style={[styles.ageBadgeText, { color: ageConfig.textColor }]}
                  accessibilityLabel={ageConfig.label}>
                  {ageConfig.label}
                </Text>
              </View>
            </View>

            {/* Metadata Row */}
            <View style={styles.metaDataContainer}>
              <Text style={styles.metaText}>
                <Ionicons name="cube-outline" size={12} /> {item.quantity}{' '}
                {item.unit}
              </Text>
              <Text style={styles.metaText}>
                <Ionicons name="time-outline" size={12} />{' '}
                {item.age_description}
              </Text>
            </View>

            {/* Description if available */}
            {item.description && (
              <Text style={styles.itemDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>

          {/* Edit Button */}
          <TouchableOpacity
            style={styles.itemActionButton}
            onPress={handleEditPress}
            accessibilityLabel="Edit item"
            accessibilityHint="Opens item editing form">
            <Ionicons name="create-outline" size={22} color="#757575" />
          </TouchableOpacity>
        </View>

        {/* Age Group Visual Indicator Bar */}
        <View
          style={[styles.ageIndicatorBar, { backgroundColor: ageConfig.color }]}
          accessibilityLabel={`Age indicator: ${ageConfig.description}`}
        />
      </TouchableOpacity>
    );
  },
);

PantryItemWithAging.displayName = 'PantryItemWithAging';

const styles = StyleSheet.create({
  itemContainer: {
    backgroundColor: '#fff',
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
    overflow: 'hidden', // Ensures age indicator bar doesn't overflow
  },
  mainContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
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
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  ageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  ageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
    fontWeight: '500',
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
  ageIndicatorBar: {
    height: 3,
    width: '100%',
  },
});
