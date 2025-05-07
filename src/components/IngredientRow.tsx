import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

type Props = {
  ing: { name: string; qty?: string; unit?: string };
  matched: boolean;
  missing: boolean;
};

export default function IngredientRow({ ing, matched, missing }: Props) {
  return (
    <View style={styles.rowContainer}>
      {/* Icon Section */}
      <View style={styles.iconContainer}>
        {matched && <Feather name="check-circle" size={18} color="#22c55e" />}
        {missing && <Feather name="x-circle" size={18} color="#dc2626" />}
      </View>

      {/* Text Group - This View takes up the available space and arranges its children in a row */}
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
        {/* Name Text - This should shrink and truncate if needed */}
        <Text 
          style={[styles.textBase, styles.nameText, matched ? styles.matchedText : styles.missingText]} 
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {ing.name}
        </Text>
      </View>

      {/* ADD Button Section */}
      {missing && (
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>ADD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Using StyleSheet for more precise control and potentially better performance
const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9, // Slightly adjusted for visual balance
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6', // Softer border like in IngredientsTab
  },
  iconContainer: {
    width: 20, // Fixed width for icon container
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  textGroupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden', // Important for text truncation within flex children
    flexShrink: 1, // Allow this group to shrink if very long and button needs space
  },
  textBase: {
    fontSize: 14, // Equivalent to text-sm
  },
  qtyText: {
    marginRight: 4,
  },
  unitText: {
    marginRight: 4,
  },
  nameText: {
    flex: 1,
  },
  matchedText: {
    fontWeight: '500', // Equivalent to font-medium
    color: '#1f2937', // Equivalent to text-gray-800
  },
  missingText: {
    color: '#6b7280', // Equivalent to text-gray-500
  },
  matchedUnitText: {
    color: '#4b5563', // Equivalent to text-gray-600
  },
  missingUnitText: {
    color: '#9ca3af', // Equivalent to text-gray-400
  },
  addButton: {
    marginLeft: 8, // Fixed margin for consistency
    backgroundColor: '#fef3c7', // amber-100
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6, // rounded-md
  },
  addButtonText: {
    color: '#b45309', // amber-600
    fontSize: 12, // text-xs
    fontWeight: '500',
  },
}); 