import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GroceryItemInput } from '../hooks/useGroceryManager'; // Import the type

type Props = {
  ing: { name: string; qty?: string; unit?: string };
  matched: boolean;
  missing: boolean;
  onAddItem?: (item: GroceryItemInput) => Promise<void>;
};

export default function IngredientRow({ ing, matched, missing, onAddItem }: Props) {
  const handleAddItem = async () => {
    if (!ing.name) {
      Alert.alert("Error", "Ingredient name is missing.");
      return;
    }
    const itemToAdd: GroceryItemInput = {
      item_name: ing.name,
      quantity: ing.qty ? parseFloat(ing.qty) : null,
      unit: ing.unit || null,
    };
    if (isNaN(itemToAdd.quantity as number)) {
      itemToAdd.quantity = 1;
    }
    if (onAddItem) {
      try {
        await onAddItem(itemToAdd);
      } catch (error: any) {
        Alert.alert("Error", error.message || "Could not add item to grocery list.");
      }
    }
  };

  return (
    <View style={styles.rowContainer}>
      {/* Icon Section */}
      <View style={styles.iconContainer}>
        {matched && <Feather name="check-circle" size={18} color="#22c55e" />}
        {missing && !onAddItem && <Feather name="x-circle" size={18} color="#dc2626" />}
      </View>
      {/* Text Group */}
      <View style={styles.textGroupContainer}>
        {ing.qty && (
          <Text style={[styles.textBase, styles.qtyText, matched ? styles.matchedText : styles.missingText]}>
            {ing.qty}
          </Text>
        )}
        {ing.unit && (
          <Text style={[styles.textBase, styles.unitText, matched ? styles.matchedUnitText : styles.missingUnitText]}>
            {ing.unit}
          </Text>
        )}
        <Text 
          style={[
            styles.textBase, 
            styles.nameText, 
            matched ? styles.matchedText : styles.missingText,
            { fontWeight: 'bold' }
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {ing.name}
        </Text>
      </View>
      {/* ADD Button Section */}
      {missing && onAddItem && (
        <TouchableOpacity onPress={handleAddItem} style={styles.addButton} activeOpacity={0.7}>
          <Feather name="plus-circle" size={18} color="#b45309" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Styles remain the same, but ensure addButton is styled appropriately for an icon if text is removed
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
    // Removed flex: 1 here as textGroupContainer handles flexing
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
    marginLeft: 8,
    paddingHorizontal: 6, // Adjust padding for icon
    paddingVertical: 4,   // Adjust padding for icon
    borderRadius: 15, // Make it rounder for an icon button
    // backgroundColor: '#fef3c7', // Consider removing bg or using a more subtle one for icon only
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { // This style is no longer used if using an icon
    color: '#b45309',
    fontSize: 12,
    fontWeight: '500',
  },
}); 