import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';

type IngredientSelectionScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'IngredientSelection'
>;
type IngredientSelectionScreenRouteProp = RouteProp<
  MainStackParamList,
  'IngredientSelection'
>;

interface PantryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    textAlign: 'center',
    marginBottom: 20,
  },
  itemCountWarning: {
    color: '#ef4444',
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedItemCard: {
    backgroundColor: '#f3f4f6',
  },
  unselectedItemCard: {
    backgroundColor: '#f9fafb',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  selectedItemName: {
    color: '#10b981',
  },
  unselectedItemName: {
    color: '#6b7280',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectedItemQuantity: {
    color: '#10b981',
  },
  unselectedItemQuantity: {
    color: '#6b7280',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  continueButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#f3f4f6',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  requirementText: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default function IngredientSelectionScreen() {
  const navigation = useNavigation<IngredientSelectionScreenNavigationProp>();
  const route = useRoute<IngredientSelectionScreenRouteProp>();

  const { pantryItems } = route.params;

  // State for selected ingredients (start with all selected)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(pantryItems.map(item => item.id)),
  );

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    // Get selected ingredients
    const selectedIngredients = pantryItems
      .filter(item => selectedItems.has(item.id))
      .map(item => item.item_name);

    console.log(
      '[IngredientSelection] Navigating to RecipeResults with ingredients:',
      selectedIngredients,
    );
    console.log(
      '[IngredientSelection] Total selected items:',
      selectedIngredients.length,
    );
    console.log(
      '[IngredientSelection] Selected ingredients:',
      selectedIngredients.slice(0, 10),
    );

    navigation.navigate('RecipeResults', {
      selectedIngredients,
    });
  };

  const renderPantryItem = ({ item }: { item: PantryItem }) => {
    const isSelected = selectedItems.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.itemCard,
          isSelected ? styles.selectedItemCard : styles.unselectedItemCard,
        ]}
        onPress={() => handleToggleItem(item.id)}
        activeOpacity={0.7}>
        <View style={styles.itemInfo}>
          <Text
            style={[
              styles.itemName,
              isSelected ? styles.selectedItemName : styles.unselectedItemName,
            ]}>
            {item.item_name}
          </Text>
          <Text
            style={[
              styles.itemQuantity,
              isSelected
                ? styles.selectedItemQuantity
                : styles.unselectedItemQuantity,
            ]}>
            {item.quantity} {item.unit}
          </Text>
        </View>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={isSelected ? '#10b981' : '#9ca3af'}
        />
      </TouchableOpacity>
    );
  };

  const selectedCount = selectedItems.size;
  const canContinue = selectedCount >= 3;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Ingredients</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Tap ingredients to select or deselect them for recipe matching.
        </Text>

        <Text
          style={[styles.itemCount, !canContinue && styles.itemCountWarning]}>
          {selectedCount} ingredients selected
        </Text>

        <FlatList
          data={pantryItems}
          renderItem={renderPantryItem}
          keyExtractor={item => item.id}
          style={styles.itemsList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.disabledButton]}
          onPress={handleContinue}
          disabled={!canContinue}>
          <Text
            style={[
              styles.continueButtonText,
              !canContinue && styles.disabledButtonText,
            ]}>
            Find Recipes
          </Text>
        </TouchableOpacity>

        {!canContinue && (
          <Text style={styles.requirementText}>
            Select at least 3 ingredients to continue
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
