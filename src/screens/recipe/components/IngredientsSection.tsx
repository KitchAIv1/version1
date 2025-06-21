import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { OptimizedCollapsibleCard } from './OptimizedCollapsibleCard';

const BRAND_PRIMARY = '#10B981';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface IngredientsSectionProps {
  ingredients: Ingredient[];
  ingredientCount: number;
  onIngredientChange: (
    index: number,
    field: keyof Ingredient,
    value: string,
  ) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (index: number) => void;
}

// Optimized Ingredient Item Component
const OptimizedIngredientItem = React.memo<{
  ingredient: Ingredient;
  index: number;
  onIngredientChange: (
    index: number,
    field: keyof Ingredient,
    value: string,
  ) => void;
  onRemoveIngredient: (index: number) => void;
}>(({ ingredient, index, onIngredientChange, onRemoveIngredient }) => {
  const handleNameChange = useCallback(
    (value: string) => {
      onIngredientChange(index, 'name', value);
    },
    [index, onIngredientChange],
  );

  const handleQuantityChange = useCallback(
    (value: string) => {
      onIngredientChange(index, 'quantity', value);
    },
    [index, onIngredientChange],
  );

  const handleUnitChange = useCallback(
    (value: string) => {
      onIngredientChange(index, 'unit', value);
    },
    [index, onIngredientChange],
  );

  const handleRemove = useCallback(() => {
    onRemoveIngredient(index);
  }, [index, onRemoveIngredient]);

  return (
    <View style={styles.listItemContainer}>
      <TextInput
        placeholder="Ingredient name"
        value={ingredient.name}
        onChangeText={handleNameChange}
        style={styles.inputFlex}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Qty"
        value={ingredient.quantity}
        onChangeText={handleQuantityChange}
        style={styles.inputQty}
        keyboardType="numeric"
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Unit"
        value={ingredient.unit}
        onChangeText={handleUnitChange}
        style={styles.inputUnit}
        placeholderTextColor="#999"
      />
      <TouchableOpacity onPress={handleRemove} style={styles.removeButton}>
        <Feather name="x-circle" size={24} color="#ff6347" />
      </TouchableOpacity>
    </View>
  );
});
OptimizedIngredientItem.displayName = 'OptimizedIngredientItem';

// Optimized Add Button Component
const OptimizedAddButton = React.memo<{
  onAddIngredient: () => void;
}>(({ onAddIngredient }) => (
  <TouchableOpacity
    style={styles.addButton}
    onPress={onAddIngredient}
    activeOpacity={0.8}>
    <Feather
      name="plus-circle"
      size={20}
      color={BRAND_PRIMARY}
      style={styles.addButtonIcon}
    />
    <Text style={styles.addButtonText}>Add Ingredient</Text>
  </TouchableOpacity>
));
OptimizedAddButton.displayName = 'OptimizedAddButton';

// Main IngredientsSection Component
export const IngredientsSection = React.memo<IngredientsSectionProps>(
  ({
    ingredients,
    ingredientCount,
    onIngredientChange,
    onAddIngredient,
    onRemoveIngredient,
  }) => {
    // Memoize the ingredient list to prevent unnecessary re-renders
    const memoizedIngredients = useMemo(
      () =>
        ingredients.map((ingredient, index) => (
          <OptimizedIngredientItem
            key={`ingredient-${index}`}
            ingredient={ingredient}
            index={index}
            onIngredientChange={onIngredientChange}
            onRemoveIngredient={onRemoveIngredient}
          />
        )),
      [ingredients, onIngredientChange, onRemoveIngredient],
    );

    const cardTitle = useMemo(
      () => `Ingredients (${ingredientCount})`,
      [ingredientCount],
    );

    return (
      <OptimizedCollapsibleCard title={cardTitle} icon="shopping-bag">
        {memoizedIngredients}
        <OptimizedAddButton onAddIngredient={onAddIngredient} />
      </OptimizedCollapsibleCard>
    );
  },
);

IngredientsSection.displayName = 'IngredientsSection';

const styles = StyleSheet.create({
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  inputFlex: {
    flex: 1,
    padding: 10,
    fontSize: 15,
    color: '#111827',
  },
  inputQty: {
    width: 50,
    padding: 10,
    textAlign: 'center',
    fontSize: 15,
    color: '#111827',
  },
  inputUnit: {
    width: 70,
    padding: 10,
    fontSize: 15,
    color: '#111827',
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_PRIMARY,
    backgroundColor: '#f0fdf4',
  },
  addButtonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: BRAND_PRIMARY,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default IngredientsSection;
