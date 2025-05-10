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

  const addAllMissingToList = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found. Cannot add items to grocery list.");
      console.error("User not found for adding to grocery list");
      return;
    }
    if (ingredients.length === 0) return;

    try {
      const itemsToAdd = ingredients.map((i) => ({
        user_id: user.id,
        item_name: i.name,
        quantity: typeof i.qty === 'string' ? parseFloat(i.qty) : (i.qty || 1),
        unit: i.unit ?? 'units',
        is_checked: false,
      }));

      const { error: insertError } = await supabase.from('grocery_list').insert(itemsToAdd);
      
      if (insertError) throw insertError;

      await fetchGroceryList(user.id);
      
      Alert.alert("Success", `${ingredients.length} item(s) added to your grocery list!`);
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
    } catch (e: any) {
      console.error("Error adding all missing items to grocery list:", e);
      Alert.alert("Error", e.message || "Could not add items to grocery list.");
    }
  };

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
    <View key={`ingredients-tab-${forceRenderKey}`} style={{ opacity: 0.999 }} className="flex-1 bg-white">
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 24, paddingTop: 20 }}
      >
        <View className="bg-gray-50 pt-6 pb-4 border-b border-gray-200">
          <View className="flex-row items-center justify-start mb-1">
            <Text className="text-lg font-semibold text-gray-800">
              {totalIngredientsCount} Ingredients
            </Text>
          </View>
        </View>

        {ingredients.length > 0 ? (
          <View className="pt-4">
            <View className="bg-white rounded-lg border border-gray-200">
              {ingredients.map((ing, index) => {
                const ingName = ing.name?.trim().toLowerCase();
                const matched = matchedSet.has(ingName);
                const missing = missingSet.has(ingName);
                return (
                  <View key={`ingredient-${ing.name}-${index}`} className={index === ingredients.length - 1 ? '' : 'border-b border-gray-100'}>
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
          <View className="items-center justify-center py-10 px-4">
            <Feather name="info" size={24} color="#6b7280" />
            <Text className="text-gray-600 text-base mt-2 text-center">No ingredients listed for this recipe yet.</Text>
          </View>
        )}
      </ScrollView>

      {ingredients.length > 0 && (
        <View className="px-4 py-10 border-t border-gray-200 bg-white">
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity 
              className="rounded-lg bg-green-600 p-4 items-center flex-row justify-center shadow-sm"
              onPress={addAllMissingToList}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color="white" />
              <Text className="text-white text-base font-semibold ml-2 uppercase tracking-wide">
                Add All Ingredients to Grocery List
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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