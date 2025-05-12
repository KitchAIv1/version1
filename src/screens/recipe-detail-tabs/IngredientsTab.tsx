import React, { useMemo, useEffect, useState } from 'react';
import { View, ScrollView, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRecipeDetails } from '../../hooks/useRecipeDetails';
import { useAuth } from '../../providers/AuthProvider';
import { parseIngredients, Ingredient } from '../../utils/parseIngredients';
import IngredientRow from '../../components/IngredientRow';
import { supabase } from '../../services/supabase';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { MainStackParamList } from '../../navigation/types';
import { Feather } from '@expo/vector-icons';
import { useGroceryManager, GroceryItemInput } from '../../hooks/useGroceryManager';

type IngredientsTabRouteProp = RouteProp<MainStackParamList, 'RecipeDetail'>;

export default function IngredientsTab() {
  const nav = useNavigation();
  const { user } = useAuth();
  const route = useRoute<IngredientsTabRouteProp>();
  const recipeId = route.params?.id;
  const queryClient = useQueryClient();
  const { data: recipeDetails, isLoading, error } = useRecipeDetails(recipeId, user?.id);
  const [forceRenderKey, setForceRenderKey] = useState(0);

  // Debug logging for useRecipeDetails response in IngredientsTab
  useEffect(() => {
    if (recipeId === '5380a8c1-c8de-4e20-a7ed-1d9062a7916d') {
      console.log('IngredientsTab - useRecipeDetails response for 5380a8c1-c8de-4e20-a7ed-1d9062a7916d:', {
        matched_ingredients: recipeDetails?.matched_ingredients,
        missing_ingredient_names: recipeDetails?.missing_ingredient_names,
        // If you also have a raw missing_ingredients field from the hook, log it too:
        // missing_ingredients_raw: recipeDetails?.missing_ingredients, 
        full_recipeDetails: recipeDetails ? { ...recipeDetails } : null // Log a shallow copy to see all fields if needed
      });
    }
  }, [recipeDetails, recipeId]);

  // Original debug logging
  console.log('IngredientsTab debug:', {
    recipeId,
    userId: user?.id,
    error,
    recipeDetails
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setForceRenderKey(prevKey => prevKey + 1);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const {
    addGroceryItem,
    fetchGroceryList
  } = useGroceryManager();

  // Pantry match logic
  const matchedSet = useMemo(() => new Set((recipeDetails?.matched_ingredients || []).map(name => name.trim().toLowerCase())), [recipeDetails]);
  const missingSet = useMemo(() => new Set((recipeDetails?.missing_ingredient_names || []).map(name => name.trim().toLowerCase())), [recipeDetails]);

  const ingredients = useMemo(() => {
    if (!recipeDetails?.ingredients) return [];
    return parseIngredients(recipeDetails.ingredients);
  }, [recipeDetails]);

  const handleAddSingleItemToGrocery = async (item: GroceryItemInput) => {
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated. Cannot add item.");
      return;
    }
    try {
      await addGroceryItem(item, user.id);
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
    } catch (e: any) {
      console.error(`Error adding item ${item.item_name} to grocery list:`, e);
      Alert.alert("Error", e.message || `Could not add ${item.item_name} to grocery list.`);
    }
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error || !recipeDetails) {
    return <View style={styles.centered}><Text style={styles.errorText}>Could not load ingredients.</Text></View>;
  }

  const totalIngredientsCount = ingredients.length;

  return (
    <View key={`ingredients-tab-${forceRenderKey}`} style={styles.container} className="flex-1 bg-white">
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {totalIngredientsCount} Ingredients
            </Text>
          </View>
        </View>

        {ingredients.length > 0 ? (
          <View style={styles.ingredientsContainer}>
            <View style={styles.ingredientsList}>
              {ingredients.map((ing, index) => {
                const ingName = ing.name?.trim().toLowerCase();
                const matched = matchedSet.has(ingName);
                const missing = missingSet.has(ingName);
                return (
                  <View 
                    key={`ingredient-${ing.name}-${index}`} 
                    style={[
                      styles.ingredientRow,
                      index === ingredients.length - 1 ? null : styles.ingredientBorder
                    ]}
                  >
                    <IngredientRow
                      ing={ing}
                      matched={matched}
                      missing={missing}
                      {...(missing ? { onAddItem: handleAddSingleItemToGrocery } : {})}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="info" size={24} color="#6b7280" />
            <Text style={styles.emptyText}>No ingredients listed for this recipe yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40, // Smaller bottom padding - we'll use flexGrow to fill space
  },
  headerContainer: {
    backgroundColor: '#f9fafb',
    paddingTop: 24,
    paddingBottom: 16,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  ingredientsContainer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  ingredientsList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ingredientRow: {
    paddingVertical: 4,
  },
  ingredientBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
  }
}); 