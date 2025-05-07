import React, { useMemo, useEffect } from 'react';
import { View, ScrollView, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRecipeDetails } from '../../hooks/useRecipeDetails';
import { useAuth } from '../../providers/AuthProvider';
import { parseIngredients, Ingredient } from '../../utils/parseIngredients';
import IngredientRow from '../../components/IngredientRow';
import { supabase } from '../../services/supabase';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { MainStackParamList } from '../../navigation/types';
import { Feather } from '@expo/vector-icons';

type IngredientsTabRouteProp = RouteProp<MainStackParamList, 'RecipeDetail'>;

export default function IngredientsTab() {
  const nav = useNavigation();
  const { user } = useAuth();
  const route = useRoute<IngredientsTabRouteProp>();
  const recipeId = route.params?.id;
  const { data: recipeDetails, isLoading, error } = useRecipeDetails(recipeId, user?.id);

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
    const other: Ingredient[] = []; // For ingredients not explicitly matched or missing

    ingredients.forEach(ing => {
      const ingNameForCheck = ing.name?.trim().toLowerCase();
      if (matchedIngredientsSet.has(ingNameForCheck)) {
        matched.push(ing);
      } else if (missingIngredientNamesSet.has(ingNameForCheck)) {
        missing.push(ing);
      } else {
        other.push(ing); // Default to other/missing if not in either set explicitly
      }
    });
    // If an ingredient is in 'other', but the logic implies it should be missing if not matched,
    // combine 'other' with 'missing'. This handles cases where an ingredient might not be in either list from backend.
    return { matched, missing: [...missing, ...other] };
  }, [ingredients, matchedIngredientsSet, missingIngredientNamesSet]);

  const addToList = async () => {
    if (!user) {
      console.error("User not found for adding to grocery list");
      return;
    }
    if (groupedIngredients.missing.length === 0) return;

    try {
      const { error: insertError } = await supabase.from('grocery_list').insert(
        groupedIngredients.missing.map((i) => ({
          user_id: user.id,
          name: i.name,
          quantity: typeof i.qty === 'string' ? parseFloat(i.qty) : (i.qty || 1),
          unit: i.unit ?? '',
          is_checked: false,
        }))
      );
      if (insertError) throw insertError;
      alert(`${groupedIngredients.missing.length} item(s) added to your grocery list!`);
    } catch (e) {
      console.error("Error adding to grocery list:", e);
      alert("Could not add items to grocery list.");
    }
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error || !recipeDetails) {
    return <View style={styles.centered}><Text style={styles.errorText}>Could not load ingredients.</Text></View>;
  }

  const totalIngredientsCount = ingredients.length; // Use parsed ingredients length for total
  const userIngredientsCount = groupedIngredients.matched.length;
  
  const pct = totalIngredientsCount === 0
      ? 0
      : Math.round((userIngredientsCount / totalIngredientsCount) * 100);

  return (
    <View className="flex-1 bg-white">
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }} // Add padding for scroll end
      >
        {/* Summary Header */}
        <View className="bg-gray-50 p-4 border-b border-gray-200">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-lg font-semibold text-gray-800">
              {totalIngredientsCount} Ingredients
            </Text>
            <Text className="text-sm font-medium text-green-600">{pct}% In Pantry</Text>
          </View>
          <View className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <View className="h-full bg-green-500" style={{ width: `${pct}%` }} />
          </View>
        </View>

        {/* In Pantry Section */}
        {groupedIngredients.matched.length > 0 && (
          <View className="px-4 pt-4">
            <View className="flex-row items-center mb-2.5">
              {/* <Feather name="check-circle" size={18} color="#16a34a" /> */}
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

        {/* Missing Ingredients Section */}
        {groupedIngredients.missing.length > 0 && (
          <View className="px-4 pt-4">
            <View className="flex-row items-center mb-2.5">
              {/* <Feather name="x-circle" size={18} color="#dc2626" /> */}
              <Text className="text-base font-semibold text-gray-700">Need to Buy ({groupedIngredients.missing.length})</Text>
            </View>
            <View className="bg-white rounded-lg border border-gray-200">
              {groupedIngredients.missing.map((ing, index) => (
                 <View key={`missing-${ing.name}-${index}`} className={index === groupedIngredients.missing.length - 1 ? '' : 'border-b border-gray-100'}>
                  <IngredientRow
                    ing={ing}
                    matched={false}
                    missing={true}
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

      {/* Action Button Area - Pinned to bottom */}
      {groupedIngredients.missing.length > 0 && (
        <View className="px-4 py-3 border-t border-gray-200 bg-white">
          <TouchableOpacity 
            className="rounded-lg bg-amber-500 p-3.5 items-center flex-row justify-center shadow-sm"
            onPress={addToList}
            activeOpacity={0.8}
          >
            <Feather name="plus-circle" size={18} color="white" />
            <Text className="text-white text-sm font-semibold ml-2">
              Add {groupedIngredients.missing.length} Missing to Grocery List
            </Text>
          </TouchableOpacity>
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
    backgroundColor: '#fff', // Ensure background for loading/error
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
  }
}); 