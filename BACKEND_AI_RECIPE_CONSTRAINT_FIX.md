# 🚨 URGENT: AI Recipe Generation Not Matching Pantry Items

## 📋 **Problem**
The AI recipe generation is creating recipes that include ingredients not in the user's selected pantry items. Users expect AI recipes to use ONLY their selected ingredients.

## 🎯 **Required Backend Fix**

### **1. Update AI Prompt to Enforce Ingredient Constraints**

The current AI prompt needs to be more restrictive. Update the `generate_recipe_with_ai` function:

```sql
CREATE OR REPLACE FUNCTION generate_recipe_with_ai(
  p_ingredients TEXT[],
  p_dietary_preferences JSONB DEFAULT NULL,
  p_cuisine_style TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL,
  p_prep_time INTEGER DEFAULT NULL,
  p_servings INTEGER DEFAULT 4
)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_ai_prompt TEXT;
  v_ai_response JSONB;
  v_recipes JSONB[];
BEGIN
  -- Build STRICT AI prompt that enforces ingredient constraints
  v_ai_prompt := format(
    'Create 3 different recipe variations using ONLY these exact ingredients: %s

CRITICAL CONSTRAINTS:
- You MUST use ONLY the ingredients listed above
- Do NOT add any ingredients not in the list
- You can use basic seasonings (salt, pepper) if not provided
- You can suggest optional additions separately
- Each recipe must use at least 3 of the provided ingredients
- Maximum 8 ingredients per recipe (from the provided list)

Create 3 different cooking styles:
1. Classic preparation
2. Modern/fusion style  
3. Simple/quick preparation

Return a JSON array with 3 recipes, each having this exact structure:
[
  {
    "name": "Recipe Name",
    "ingredients": ["ingredient1", "ingredient2", ...],
    "optional_additions": ["optional1", "optional2"],
    "steps": ["step1", "step2", ...],
    "estimated_time": 35,
    "servings": 4,
    "difficulty": "Medium",
    "estimated_cost": "$12-16",
    "nutrition_notes": "Nutritional information",
    "ai_confidence_score": 0.85
  }
]

IMPORTANT: The "ingredients" array must ONLY contain items from this list: %s
Optional additions can suggest complementary ingredients not in the pantry.',
    array_to_string(p_ingredients, ', '),
    array_to_string(p_ingredients, ', ')
  );

  -- Add dietary preferences if provided
  IF p_dietary_preferences IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format(
      ' Dietary preferences: %s',
      p_dietary_preferences::text
    );
  END IF;

  -- Call AI service with strict prompt
  v_ai_response := call_openai_api(v_ai_prompt, 2000);

  IF v_ai_response IS NULL THEN
    -- Enhanced fallback that respects ingredient constraints
    RETURN ARRAY[
      jsonb_build_object(
        'name', format('Pantry Special with %s', p_ingredients[1]),
        'ingredients', to_jsonb(p_ingredients[1:LEAST(6, array_length(p_ingredients, 1))]),
        'optional_additions', jsonb_build_array('Salt', 'Pepper', 'Olive oil'),
        'steps', jsonb_build_array(
          'Prepare all ingredients by washing and chopping as needed.',
          format('Heat a large pan over medium heat.'),
          format('Cook %s until tender and flavorful.', p_ingredients[1]),
          'Combine all ingredients and season to taste.',
          'Serve hot and enjoy!'
        ),
        'estimated_time', COALESCE(p_prep_time, 30),
        'servings', p_servings,
        'difficulty', COALESCE(p_difficulty, 'Medium'),
        'estimated_cost', '$8-12',
        'nutrition_notes', 'Made with your pantry ingredients.',
        'ai_confidence_score', 0.75
      )
    ];
  END IF;

  -- Parse and validate AI response
  BEGIN
    v_recipes := v_ai_response;
    
    -- Validate that each recipe only uses provided ingredients
    FOR i IN 1..array_length(v_recipes, 1) LOOP
      DECLARE
        v_recipe JSONB := v_recipes[i];
        v_recipe_ingredients TEXT[];
        v_invalid_ingredients TEXT[] := ARRAY[]::TEXT[];
        v_ingredient TEXT;
      BEGIN
        -- Extract ingredients from recipe
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_recipe->'ingredients'))
        INTO v_recipe_ingredients;
        
        -- Check each ingredient against provided list
        FOREACH v_ingredient IN ARRAY v_recipe_ingredients LOOP
          IF NOT (v_ingredient = ANY(p_ingredients)) THEN
            v_invalid_ingredients := array_append(v_invalid_ingredients, v_ingredient);
          END IF;
        END LOOP;
        
        -- If invalid ingredients found, filter them out
        IF array_length(v_invalid_ingredients, 1) > 0 THEN
          RAISE WARNING 'Recipe % contains invalid ingredients: %', 
            v_recipe->>'name', array_to_string(v_invalid_ingredients, ', ');
          
          -- Filter out invalid ingredients
          v_recipe := jsonb_set(
            v_recipe,
            '{ingredients}',
            to_jsonb(
              ARRAY(
                SELECT unnest(v_recipe_ingredients) 
                WHERE unnest = ANY(p_ingredients)
              )
            )
          );
          
          v_recipes[i] := v_recipe;
        END IF;
      END;
    END LOOP;
    
    RETURN v_recipes;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'AI response validation failed: %', SQLERRM;
      -- Return constrained fallback
      RETURN ARRAY[
        jsonb_build_object(
          'name', format('Simple %s Recipe', p_ingredients[1]),
          'ingredients', to_jsonb(p_ingredients[1:LEAST(5, array_length(p_ingredients, 1))]),
          'optional_additions', jsonb_build_array('Basic seasonings'),
          'steps', jsonb_build_array(
            'Prepare your ingredients.',
            'Cook according to your preference.',
            'Season and serve.'
          ),
          'estimated_time', 25,
          'servings', p_servings,
          'difficulty', 'Easy',
          'estimated_cost', '$6-10',
          'nutrition_notes', 'Simple and nutritious.',
          'ai_confidence_score', 0.70
        )
      ];
  END;
END;
$$;
```

### **2. Update Edge Function to Pass Constraints**

Update the Edge Function to pass the ingredient constraints more clearly:

```typescript
// In your Edge Function (generate-recipe)
const aiPrompt = `
Create 3 recipe variations using ONLY these ingredients: ${ingredients.join(', ')}

STRICT RULES:
- Use ONLY ingredients from the provided list
- Do not add any ingredients not listed
- You can suggest optional additions separately
- Each recipe must use at least 3 provided ingredients

Available ingredients: ${ingredients.join(', ')}

Return 3 recipes in this exact JSON format:
[
  {
    "name": "Recipe Name",
    "ingredients": ["ingredient1", "ingredient2"],
    "optional_additions": ["salt", "pepper"],
    "steps": ["step1", "step2"],
    "estimated_time": 30,
    "servings": 4,
    "difficulty": "Medium",
    "estimated_cost": "$10-15",
    "nutrition_notes": "Nutritional info"
  }
]
`;
```

### **3. Frontend Validation (Temporary Fix)**

Until backend is updated, add frontend validation:

```typescript
// In AIRecipeGenerationScreen.tsx
const validateRecipeIngredients = (recipe: AIRecipeData, selectedIngredients: string[]) => {
  const selectedSet = new Set(selectedIngredients.map(ing => ing.toLowerCase().trim()));
  
  // Filter out ingredients not in user's selection
  const validIngredients = recipe.ingredients.filter(ingredient => {
    const cleanIngredient = ingredient.toLowerCase().trim();
    // Check if any selected ingredient is contained in this recipe ingredient
    return Array.from(selectedSet).some(selected => 
      cleanIngredient.includes(selected) || selected.includes(cleanIngredient)
    );
  });
  
  return {
    ...recipe,
    ingredients: validIngredients,
    // Move invalid ingredients to optional additions
    optional_additions: [
      ...(recipe.optional_additions || []),
      ...recipe.ingredients.filter(ing => !validIngredients.includes(ing))
    ]
  };
};
```

## 🎯 **Expected Result**

After implementation:
1. ✅ AI recipes use ONLY user's selected pantry ingredients
2. ✅ Additional ingredients are suggested as "optional additions"
3. ✅ Recipes are realistic and cookable with available ingredients
4. ✅ Users can trust that AI recipes match their pantry

## ⏰ **Priority: HIGH**
This breaks user trust - they expect AI recipes to use their pantry items. 