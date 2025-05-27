import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRecipeDetails } from '../../hooks/useRecipeDetails';
import { useAuth } from '../../providers/AuthProvider';
import { parseIngredients, Ingredient } from '../../utils/parseIngredients';
import IngredientRow from '../../components/IngredientRow';
import { supabase } from '../../services/supabase';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { MainStackParamList } from '../../navigation/types';
import { Feather } from '@expo/vector-icons';
import { useGroceryManager, GroceryItemInput, GroceryItem } from '../../hooks/useGroceryManager';

type IngredientsTabRouteProp = RouteProp<MainStackParamList, 'RecipeDetail'>;

export default function IngredientsTab() {
  const nav = useNavigation();
  const { user } = useAuth();
  const route = useRoute<IngredientsTabRouteProp>();
  const recipeId = route.params?.id;
  const queryClient = useQueryClient();
  const { data: recipeDetails, isLoading, error } = useRecipeDetails(recipeId, user?.id);
  const [forceRenderKey, setForceRenderKey] = useState(0);

  const {
    addGroceryItem,
    groceryList,
    fetchGroceryList
  } = useGroceryManager();

  useEffect(() => {
    const timer = setTimeout(() => {
      setForceRenderKey(prevKey => prevKey + 1);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const matchedSet = useMemo(() => new Set((recipeDetails?.matched_ingredients || []).filter(name => name && typeof name === 'string').map(name => name.trim().toLowerCase())), [recipeDetails]);
  const missingSet = useMemo(() => new Set((recipeDetails?.missing_ingredient_names || [])
    .filter((item: any) => item && (typeof item === 'string' || (typeof item === 'object' && item.name)))
    .map((item: any) => {
      if (typeof item === 'string') {
        return item.trim().toLowerCase();
      } else if (typeof item === 'object' && item.name) {
        return item.name.trim().toLowerCase();
      }
      return '';
    })
    .filter(name => name)), [recipeDetails]);

  const ingredients = useMemo(() => {
    if (!recipeDetails?.ingredients) return [];
    return parseIngredients(recipeDetails.ingredients);
  }, [recipeDetails]);

  const groceryListItemNamesSet = useMemo(() => 
    new Set(groceryList.map(item => item.item_name.trim().toLowerCase())), 
    [groceryList]
  );

  const handleAddSingleItemToGrocery = async (item: GroceryItemInput) => {
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated. Cannot add item.");
      return;
    }
    try {
      await addGroceryItem(item, user.id);
    } catch (e: any) {
      console.error(`Error adding item ${item.item_name} to grocery list:`, e);
      Alert.alert("Error", e.message || `Could not add ${item.item_name} to grocery list.`);
    }
  };

  console.log(`IngredientsTab rendering with groceryList length: ${groceryList.length}`);
  
  // Debug the pantry match data structure
  if (recipeDetails) {
    console.log('[IngredientsTab] Pantry match debug:', {
      matched_ingredients: recipeDetails.matched_ingredients,
      missing_ingredient_names: recipeDetails.missing_ingredient_names,
      missing_ingredients: recipeDetails.missing_ingredients,
      pantry_match: recipeDetails.pantry_match,
      ingredients_count: recipeDetails.ingredients?.length || 0
    });
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error || !recipeDetails) {
    return <View style={styles.centered}><Text style={styles.errorText}>Could not load ingredients.</Text></View>;
  }

  const totalIngredientsCount = ingredients.length;

  return (
    <View key={`ingredients-tab-${forceRenderKey}`} style={styles.container} className="flex-1 bg-white">
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>
          {totalIngredientsCount} Ingredients
        </Text>
        
        <Text style={styles.matchSummary}>
          {matchedSet.size} available in your pantry
        </Text>
      </View>

      {ingredients.length > 0 ? (
        <View style={styles.ingredientsContainer}>
          {ingredients.map((ing, index) => {
            const ingName = ing.name?.trim()?.toLowerCase() || '';
            const matched = matchedSet.has(ingName);
            const missing = missingSet.has(ingName);
            
            const isInGroceryList = groceryListItemNamesSet.has(ingName);
            const isEffectivelyAdded = missing && isInGroceryList;

            return (
              <View 
                key={`ingredient-${recipeId}-${ing.name}-${index}`} 
                style={[
                  styles.ingredientCard,
                  index === ingredients.length - 1 ? null : styles.cardMargin
                ]}
              >
                <IngredientRow
                  ing={ing}
                  matched={matched}
                  missing={missing}
                  isAdded={isEffectivelyAdded}
                  recipeName={recipeDetails?.title}
                  {...(missing && !isInGroceryList ? { onAddItem: handleAddSingleItemToGrocery } : {})} 
                />
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Feather name="info" size={24} color="#6b7280" />
          <Text style={styles.emptyText}>No ingredients listed for this recipe yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
  },
  headerContainer: {
    paddingBottom: 16,
    marginBottom: 8, 
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  matchSummary: {
    fontSize: 15,
    color: '#4b5563',
    marginTop: 4,
  },
  ingredientsContainer: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  ingredientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
  },
  cardMargin: {
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 40,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
  }
}); 