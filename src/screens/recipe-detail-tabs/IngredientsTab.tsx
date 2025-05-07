import React, { useMemo, useEffect } from 'react';
import { View, ScrollView, Button, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRecipeDetails } from '../../hooks/useRecipeDetails';
import { useAuth } from '../../providers/AuthProvider';
import { parseIngredients, Ingredient } from '../../utils/parseIngredients';
import IngredientRow from '../../components/IngredientRow';
import { supabase } from '../../services/supabase';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { MainStackParamList } from '../../navigation/types';

// Define route prop type for this tab if it needs specific params from parent
// However, RecipeDetailScreen passes its own route to tabs, so we can access params from there.
type IngredientsTabRouteProp = RouteProp<MainStackParamList, 'RecipeDetail'>;

export default function IngredientsTab() {
  // console.log("--- IngredientsTab COMPONENT RENDER START ---"); // Cleaned
  const nav = useNavigation();
  const { user } = useAuth();
  const route = useRoute<IngredientsTabRouteProp>();

  const recipeId = route.params?.id;
  // console.log(`IngredientsTab: recipeId from route.params = ${recipeId} (Type: ${typeof recipeId}, IsUndefined: ${recipeId === undefined})`); // Cleaned
  // console.log(`IngredientsTab: user from useAuth = ${user ? user.id : 'null'}`); // Cleaned

  // useRecipeDetails will be called with recipeId (which might be undefined initially)
  const { data: recipeDetails, isLoading, error } = useRecipeDetails(recipeId, user?.id);
  
  // console.log(
  //   `IngredientsTab LOG: useRecipeDetails state (called with recipeId: ${recipeId}) - isLoading: ${isLoading}, hasError: ${!!error}, errorMsg: ${error?.message || 'null'}, hasData: ${!!recipeDetails}`
  // ); // Cleaned

  // This useEffect will show if recipeId prop itself changes or becomes defined later
  // useEffect(() => {
  //   console.log(`IngredientsTab LOG: useEffect detected recipeId = ${recipeId}`);
  // }, [recipeId]); // Cleaned

  useEffect(() => {
    if (recipeDetails) {
      // console.log("IngredientsTab LOG (Full): recipeDetails.output_ingredients_json:", JSON.stringify(recipeDetails.output_ingredients_json, null, 2)); // Cleaned
      // console.log("IngredientsTab LOG: recipeDetails.output_matched_ingredients:", JSON.stringify(recipeDetails.output_matched_ingredients, null, 2)); // Cleaned
      // console.log("IngredientsTab LOG: recipeDetails.output_missing_ingredient_names:", JSON.stringify(recipeDetails.output_missing_ingredient_names, null, 2)); // Cleaned
    }
  }, [recipeDetails]);

  const ingredients = useMemo(() => {
    if (!recipeDetails?.output_ingredients_json) return [];
    return parseIngredients(recipeDetails.output_ingredients_json);
  }, [recipeDetails]);

  const matchedIngredients = useMemo(() => {
    if (!recipeDetails?.output_matched_ingredients) return new Set<string>();
    const matchedArray = Array.isArray(recipeDetails.output_matched_ingredients)
        ? recipeDetails.output_matched_ingredients.map(item => 
            (typeof item === 'string' ? item : String(item.name || item)).trim().toLowerCase()
          )
        : [];
    return new Set(matchedArray);
  }, [recipeDetails]);

  const missingIngredientNames = useMemo(() => {
    if (!recipeDetails?.output_missing_ingredient_names) return new Set<string>();
    const missingArray = Array.isArray(recipeDetails.output_missing_ingredient_names)
        ? recipeDetails.output_missing_ingredient_names.map(item => 
            (typeof item === 'string' ? item : String(item.name || item)).trim().toLowerCase()
          )
        : [];
    return new Set(missingArray);
  }, [recipeDetails]);

  // useEffect(() => {
  //   if (recipeDetails) {
  //       console.log("IngredientsTab LOG: matchedIngredients Set:", JSON.stringify(Array.from(matchedIngredients), null, 2)); // Cleaned
  //       console.log("IngredientsTab LOG: missingIngredientNames Set:", JSON.stringify(Array.from(missingIngredientNames), null, 2)); // Cleaned
  //   }
  // }, [matchedIngredients, missingIngredientNames, recipeDetails]); // Cleaned

  const missingItemsToDisplay: Ingredient[] = useMemo(() => ingredients.filter((i) => missingIngredientNames.has(i.name?.trim().toLowerCase())), [ingredients, missingIngredientNames]);

  const addToList = async () => {
    if (!user) {
      console.error("User not found for adding to grocery list"); // Keep this error log
      return;
    }
    if (missingItemsToDisplay.length === 0) return;

    try {
      const { error: insertError } = await supabase.from('grocery_list').insert(
        missingItemsToDisplay.map((i) => ({
          user_id: user.id,
          name: i.name,
          quantity: typeof i.qty === 'string' ? parseFloat(i.qty) : (i.qty || 1),
          unit: i.unit ?? '',
          is_checked: false,
        }))
      );
      if (insertError) throw insertError;
      alert(`${missingItemsToDisplay.length} item(s) added to your grocery list!`);
    } catch (e) {
      console.error("Error adding to grocery list:", e); // Keep this error log
      alert("Could not add items to grocery list.");
    }
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator /></View>;
  }

  if (error || !recipeDetails) {
    return <View style={styles.centered}><Text style={styles.errorText}>Could not load ingredients.</Text></View>;
  }

  const totalIngredientsCount = recipeDetails.output_total_ingredients_count ?? 0;
  const userIngredientsCount = recipeDetails.output_user_ingredients_count ?? 0;
  
  const pct = totalIngredientsCount === 0
      ? 0
      : Math.round((userIngredientsCount / totalIngredientsCount) * 100);

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="font-semibold mb-2 text-base">
        {totalIngredientsCount} ingredients • {pct}% in pantry
      </Text>
      <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
        {ingredients.map((ing, index) => {
          const ingNameForCheck = ing.name?.trim().toLowerCase();
          const isMatched = matchedIngredients.has(ingNameForCheck);
          const isMissing = missingIngredientNames.has(ingNameForCheck);
          // console.log(
          //   `IngredientsTab LOG: Item ${index} - Raw Name: '${ing.name}', Compared Name: '${ingNameForCheck}', Matched: ${isMatched}, Missing: ${isMissing}`
          // ); // Cleaned
          return (
            <IngredientRow
              key={`${ing.name}-${index}`}
              ing={ing}
              matched={isMatched}
              missing={isMissing}
            />
          );
        })}
      </ScrollView>

      {missingItemsToDisplay.length > 0 ? (
        <Button
          title={`Add ${missingItemsToDisplay.length} missing item${
            missingItemsToDisplay.length > 1 ? 's' : ''
          } to Grocery List`}
          onPress={addToList}
          color="#f59e0b"
        />
      ) : (
        <View className="rounded-lg bg-green-500 p-3 items-center">
          <Text className="text-white font-semibold">✔ Ready to cook</Text>
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
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  }
}); 