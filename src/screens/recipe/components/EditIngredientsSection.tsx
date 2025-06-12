import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { OptimizedCollapsibleCard } from './OptimizedCollapsibleCard';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface EditIngredientsSectionProps {
  ingredients: Ingredient[];
  ingredientCount: number;
  onIngredientChange: (index: number, field: keyof Ingredient, value: string) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (index: number) => void;
}

const IngredientRow: React.FC<{
  ingredient: Ingredient;
  index: number;
  onIngredientChange: (index: number, field: keyof Ingredient, value: string) => void;
  onRemoveIngredient: (index: number) => void;
  canRemove: boolean;
}> = React.memo(({ ingredient, index, onIngredientChange, onRemoveIngredient, canRemove }) => (
  <View style={styles.ingredientRow}>
    <View style={styles.ingredientNumber}>
      <Text style={styles.ingredientNumberText}>{index + 1}</Text>
    </View>
    
    <View style={styles.ingredientInputs}>
      <TextInput
        placeholder="Ingredient name"
        value={ingredient.name}
        onChangeText={(value) => onIngredientChange(index, 'name', value)}
        style={styles.ingredientNameInput}
        placeholderTextColor="#9ca3af"
        maxLength={50}
      />
      
      <View style={styles.quantityUnitRow}>
        <TextInput
          placeholder="Qty"
          value={ingredient.quantity}
          onChangeText={(value) => onIngredientChange(index, 'quantity', value)}
          style={styles.quantityInput}
          keyboardType="numeric"
          placeholderTextColor="#9ca3af"
          maxLength={10}
        />
        
        <TextInput
          placeholder="Unit"
          value={ingredient.unit}
          onChangeText={(value) => onIngredientChange(index, 'unit', value)}
          style={styles.unitInput}
          placeholderTextColor="#9ca3af"
          maxLength={15}
        />
      </View>
    </View>
    
    <TouchableOpacity
      onPress={() => onRemoveIngredient(index)}
      style={[
        styles.removeButton,
        !canRemove && styles.removeButtonDisabled,
      ]}
      disabled={!canRemove}
      activeOpacity={0.7}>
      <Feather
        name="trash-2"
        size={18}
        color={canRemove ? "#ef4444" : "#d1d5db"}
      />
    </TouchableOpacity>
  </View>
));

IngredientRow.displayName = 'IngredientRow';

export const EditIngredientsSection: React.FC<EditIngredientsSectionProps> = React.memo(({
  ingredients,
  ingredientCount,
  onIngredientChange,
  onAddIngredient,
  onRemoveIngredient,
}) => {
  const canRemoveIngredients = ingredients.length > 1;

  return (
    <OptimizedCollapsibleCard 
      title={`Ingredients (${ingredientCount})`} 
      icon="list"
    >
      <View style={styles.ingredientsContainer}>
        {ingredients.map((ingredient, index) => (
          <IngredientRow
            key={index}
            ingredient={ingredient}
            index={index}
            onIngredientChange={onIngredientChange}
            onRemoveIngredient={onRemoveIngredient}
            canRemove={canRemoveIngredients}
          />
        ))}
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddIngredient}
          activeOpacity={0.8}>
          <Feather name="plus-circle" size={20} color="#10B981" />
          <Text style={styles.addButtonText}>Add Ingredient</Text>
        </TouchableOpacity>
        
        <View style={styles.helpContainer}>
          <Feather name="info" size={14} color="#6b7280" />
          <Text style={styles.helpText}>
            Be specific with quantities and units (e.g., "2 cups flour")
          </Text>
        </View>
      </View>
    </OptimizedCollapsibleCard>
  );
});

EditIngredientsSection.displayName = 'EditIngredientsSection';

const styles = StyleSheet.create({
  ingredientsContainer: {
    gap: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ingredientNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  ingredientNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  ingredientInputs: {
    flex: 1,
    gap: 8,
  },
  ingredientNameInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
  },
  quantityUnitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  unitInput: {
    flex: 1.5,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
  },
  removeButton: {
    padding: 8,
    marginTop: 4,
  },
  removeButtonDisabled: {
    opacity: 0.3,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: '#f0fdf4',
    marginTop: 8,
  },
  addButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
    flex: 1,
    fontStyle: 'italic',
  },
});

export default EditIngredientsSection; 