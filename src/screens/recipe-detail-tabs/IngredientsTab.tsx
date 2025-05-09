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

  const ingredients = useMemo(() => {
    if (!recipeDetails?.output_ingredients_json) return [];
    return parseIngredients(recipeDetails.output_ingredients_json);
  }, [recipeDetails]);

  const matchedIngredientsSet = useMemo(() => {
    if (!recipeDetails?.output_matched_ingredients) return new Set<string>();
    const matchedArray = Array.isArray(recipeDetails.output_matched_ingredients)
        ? recipeDetails.output_matched_ingredients.map(item => 
            (typeof item === 'string' ? item : String(item.name || item)).trim().toLowerCase()
          )
        : [];
    return new Set(matchedArray);
  }, [recipeDetails]);

  const missingIngredientNamesSet = useMemo(() => {
    if (!recipeDetails?.output_missing_ingredient_names) return new Set<string>();
    const missingArray = Array.isArray(recipeDetails.output_missing_ingredient_names)
        ? recipeDetails.output_missing_ingredient_names.map(item => 
            (typeof item === 'string' ? item : String(item.name || item)).trim().toLowerCase()
          )
        : [];
    return new Set(missingArray);
  }, [recipeDetails]);

  const groupedIngredients = useMemo(() => {
    const matched: Ingredient[] = [];
    const missing: Ingredient[] = [];
    const other: Ingredient[] = [];

    ingredients.forEach(ing => {
      const ingNameForCheck = ing.name?.trim().toLowerCase();
      if (matchedIngredientsSet.has(ingNameForCheck)) {
        matched.push(ing);
      } else if (missingIngredientNamesSet.has(ingNameForCheck)) {
        missing.push(ing);
      } else {
        other.push(ing);
      }
    });
    return { matched, missing: [...missing, ...other] };
  }, [ingredients, matchedIngredientsSet, missingIngredientNamesSet]);

  const addAllMissingToList = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found. Cannot add items to grocery list.");
      console.error("User not found for adding to grocery list");
      return;
    }
    if (groupedIngredients.missing.length === 0) return;

    try {
      const itemsToAdd = groupedIngredients.missing.map((i) => ({
        user_id: user.id,
        item_name: i.name,
        quantity: typeof i.qty === 'string' ? parseFloat(i.qty) : (i.qty || 1),
        unit: i.unit ?? 'units',
        is_checked: false,
      }));

      const { error: insertError } = await supabase.from('grocery_list').insert(itemsToAdd);
      
      if (insertError) throw insertError;

      await fetchGroceryList(user.id);
      
      Alert.alert("Success", `${groupedIngredients.missing.length} item(s) added to your grocery list!`);
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
  const userIngredientsCount = groupedIngredients.matched.length;
  
  const pct = totalIngredientsCount === 0
      ? 0
      : Math.round((userIngredientsCount / totalIngredientsCount) * 100);

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

        {groupedIngredients.matched.length > 0 && (
          <View className="pt-4">
            <View className="flex-row items-center mb-2.5">
              <Text className="text-base font-semibold text-gray-700">In Your Pantry ({groupedIngredients.matched.length})</Text>
            </View>
            <View className="bg-white rounded-lg border border-gray-200">
              {groupedIngredients.matched.map((ing, index) => (
                <View key={`matched-${ing.name}-${index}`} className={index === groupedIngredients.matched.length - 1 ? '' : 'border-b border-gray-100'}>
                  <IngredientRow
                    ing={ing}
                    matched={true}
                    missing={false}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {groupedIngredients.missing.length > 0 && (
          <View className="pt-4">
            <View className="flex-row items-center mb-2.5">
              <Text className="text-base font-semibold text-gray-700">Need to Buy ({groupedIngredients.missing.length})</Text>
            </View>
            <View className="bg-white rounded-lg border border-gray-200">
              {groupedIngredients.missing.map((ing, index) => (
                 <View key={`missing-${ing.name}-${index}`} className={index === groupedIngredients.missing.length - 1 ? '' : 'border-b border-gray-100'}>
                  <IngredientRow
                    ing={ing}
                    matched={false}
                    missing={true}
                    onAddItem={handleAddSingleItemToGrocery}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
        
        {totalIngredientsCount === 0 && !isLoading && (
            <View className="items-center justify-center py-10 px-4">
                <Feather name="info" size={24} color="#6b7280" />
                <Text className="text-gray-600 text-base mt-2 text-center">No ingredients listed for this recipe yet.</Text>
            </View>
        )}
      </ScrollView>

      {groupedIngredients.missing.length > 0 && (
        <View className="px-4 py-10 border-t border-gray-200 bg-white">
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity 
              className="rounded-lg bg-green-600 p-4 items-center flex-row justify-center shadow-sm"
              onPress={addAllMissingToList}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color="white" />
              <Text className="text-white text-base font-semibold ml-2 uppercase tracking-wide">
                Add All Missing Items
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {groupedIngredients.missing.length === 0 && totalIngredientsCount > 0 && (
         <View className="px-4 py-3 border-t border-gray-200 bg-white">
          <View className="rounded-lg bg-green-500 p-3.5 items-center flex-row justify-center">
            <Feather name="check-circle" size={18} color="white" />
            <Text className="text-white text-sm font-semibold ml-2">You have all ingredients!</Text>
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