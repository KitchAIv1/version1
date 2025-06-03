import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GroceryItemInput } from '../hooks/useGroceryManager'; // Import the type

type Props = {
  ing: { name: string; quantity?: string; unit?: string };
  matched: boolean;
  missing: boolean;
  isAdded?: boolean;
  recipeName?: string | null;
  onAddItem?: (item: GroceryItemInput) => Promise<void>;
};

export default function IngredientRow({
  ing,
  matched,
  missing,
  isAdded,
  recipeName,
  onAddItem,
}: Props) {
  const handleAddItem = async () => {
    if (!ing.name) {
      Alert.alert('Error', 'Ingredient name is missing.');
      return;
    }
    const itemToAdd: GroceryItemInput = {
      item_name: ing.name,
      quantity: ing.quantity ? parseFloat(ing.quantity) : null,
      unit: ing.unit || null,
      recipeName,
    };
    if (isNaN(itemToAdd.quantity as number)) {
      itemToAdd.quantity = 1;
    }
    if (onAddItem) {
      try {
        await onAddItem(itemToAdd);
      } catch (error: any) {
        Alert.alert(
          'Error',
          error.message || 'Could not add item to grocery list.',
        );
      }
    }
  };

  return (
    <View style={styles.rowContainer}>
      {/* Icon Section */}
      <View style={styles.iconContainer}>
        {matched && <Feather name="check-circle" size={18} color="#22c55e" />}
        {missing && !isAdded && !onAddItem && (
          <Feather name="x-circle" size={18} color="#dc2626" />
        )}
        {missing && isAdded && (
          <Feather name="check-circle" size={18} color="#fbbf24" />
        )}
      </View>
      {/* Text Group */}
      <View style={styles.textGroupContainer}>
        {ing.quantity && (
          <Text
            style={[
              styles.textBase,
              styles.qtyText,
              matched ? styles.matchedText : styles.missingText,
              styles.boldText,
            ]}>
            {ing.quantity}
          </Text>
        )}
        {ing.unit && (
          <Text
            style={[
              styles.textBase,
              styles.unitText,
              matched ? styles.matchedUnitText : styles.missingUnitText,
              styles.boldText,
            ]}>
            {ing.unit}
          </Text>
        )}
        <Text
          style={[
            styles.textBase,
            styles.nameText,
            matched ? styles.matchedText : styles.missingText,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {ing.name}
        </Text>
      </View>
      {/* ADD/ADDED Button Section */}
      {isAdded ? (
        <View style={[styles.addButton, styles.addedState]}>
          <Feather name="check" size={16} color="#166534" />
          <Text style={styles.addedButtonText}>ADDED</Text>
        </View>
      ) : missing && onAddItem ? (
        <TouchableOpacity
          onPress={handleAddItem}
          style={styles.addButton}
          activeOpacity={0.7}>
          <Feather name="plus-circle" size={18} color="#b45309" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  textGroupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 1,
    flex: 1, // Allow text group to take up available space before button
  },
  textBase: {
    fontSize: 14,
  },
  boldText: {
    fontWeight: 'bold',
  },
  qtyText: {
    marginRight: 4,
  },
  unitText: {
    marginRight: 4,
  },
  nameText: {
    fontWeight: 'normal',
  },
  matchedText: {
    fontWeight: '500',
    color: '#1f2937',
  },
  missingText: {
    color: '#6b7280',
  },
  matchedUnitText: {
    color: '#4b5563',
  },
  missingUnitText: {
    color: '#9ca3af',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addedState: {
    // Style for the "ADDED" state view
    backgroundColor: '#f0fdf4', // Light green background
    borderColor: '#bbf7d0',
    borderWidth: 1,
  },
  addedButtonText: {
    color: '#166534', // Darker green text
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
});
