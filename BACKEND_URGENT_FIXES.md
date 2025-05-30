# 🚨 URGENT: Backend AI Recipe Generation Fixes

## 📋 **Current Issue**

The `generate_ai_recipe` RPC is returning basic placeholder data instead of intelligent AI-generated recipes. The frontend is currently enhancing the backend response to provide a better user experience.

---

## 🎯 **Required Backend Fixes**

### **1. IMMEDIATE FIX: Update Response Format**

The backend should return the **new format** as specified:

```json
{
  "success": true,
  "data": [
    {
      "name": "Classic Chicken Spaghetti with Parmesan",
      "ingredients": ["chicken breast", "spaghetti", "parmesan cheese", "olive oil", "garlic", "salt", "pepper"],
      "optional_additions": ["Fresh herbs for garnish", "Extra parmesan cheese"],
      "steps": [
        "Prepare ingredients: wash and dice vegetables, season chicken with salt and pepper.",
        "Bring a large pot of salted water to boil. Cook spaghetti according to package directions until al dente.",
        "Heat oil in a large skillet over medium-high heat. Cook chicken for 6-8 minutes until golden and cooked through.",
        "Add garlic to the pan. Cook for 1 minute until fragrant.",
        "Combine the cooked spaghetti with chicken. Toss gently to combine.",
        "Season with salt, pepper, and herbs to taste. Serve hot and enjoy!"
      ],
      "estimated_time": 35,
      "servings": 4,
      "difficulty": "Medium",
      "estimated_cost": "$12-16",
      "nutrition_notes": "High in protein, provides energy. A delicious and satisfying meal.",
      "ai_confidence_score": 0.92
    },
    {
      "name": "Broccoli & Cauliflower Stir-Fry",
      "ingredients": ["broccoli", "cauliflower", "chicken breast", "olive oil", "soy sauce", "garlic"],
      "optional_additions": ["Lemon zest", "Sesame seeds"],
      "steps": [
        "Prepare ingredients: wash and cut vegetables into bite-sized pieces.",
        "Heat oil in a large pan over medium-high heat.",
        "Cook chicken for 6-8 minutes until golden and cooked through.",
        "Add broccoli and cauliflower to the pan. Cook for 3-5 minutes until tender.",
        "Add soy sauce and garlic. Stir-fry for 1-2 minutes.",
        "Season with salt, pepper, and herbs to taste. Serve hot and enjoy!"
      ],
      "estimated_time": 40,
      "servings": 4,
      "difficulty": "Medium",
      "estimated_cost": "$14-18",
      "nutrition_notes": "High in protein, rich in vitamins and fiber. A delicious and satisfying meal.",
      "ai_confidence_score": 0.87
    },
    {
      "name": "Quick Chicken Skillet",
      "ingredients": ["chicken breast", "onion", "garlic", "olive oil", "salt", "pepper"],
      "optional_additions": ["Red pepper flakes", "Fresh lemon juice"],
      "steps": [
        "Prepare ingredients: dice onion and mince garlic, season chicken with salt and pepper.",
        "Heat oil in a pan over medium heat. Cook chicken until heated through and golden.",
        "Add onion to the pan. Cook for 3-5 minutes until tender.",
        "Add garlic and cook for 1 minute until fragrant.",
        "Season with salt, pepper, and herbs to taste. Serve hot and enjoy!"
      ],
      "estimated_time": 30,
      "servings": 4,
      "difficulty": "Easy",
      "estimated_cost": "$10-14",
      "nutrition_notes": "High in protein. A delicious and satisfying meal.",
      "ai_confidence_score": 0.83
    }
  ],
  "usage_info": {
    "remaining_generations": 9,
    "tier": "FREEMIUM"
  }
}
```

### **2. CRITICAL: Implement Real AI Integration**

Replace the placeholder in `generate_recipe_with_ai` function with actual OpenAI API calls:

#### **Step 1: Install HTTP Extension**
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

#### **Step 2: Create OpenAI API Function**
```sql
CREATE OR REPLACE FUNCTION call_openai_api(
  p_prompt TEXT,
  p_max_tokens INTEGER DEFAULT 1500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response JSONB;
  v_api_key TEXT := 'your-openai-api-key-here'; -- Store securely
  v_request_body JSONB;
  v_headers JSONB;
BEGIN
  -- Build request for OpenAI API
  v_request_body := jsonb_build_object(
    'model', 'gpt-4',
    'messages', jsonb_build_array(
      jsonb_build_object(
        'role', 'system',
        'content', 'You are Kitch AI, a professional chef and kitchen assistant. Create realistic recipes using ONLY the provided ingredients. Return valid JSON with: name, ingredients, optional_additions, steps, estimated_time, servings, difficulty, estimated_cost, nutrition_notes.'
      ),
      jsonb_build_object(
        'role', 'user', 
        'content', p_prompt
      )
    ),
    'max_tokens', p_max_tokens,
    'temperature', 0.7
  );

  -- Set headers
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_api_key
  );

  -- Make API call
  SELECT content::jsonb INTO v_response
  FROM http((
    'POST',
    'https://api.openai.com/v1/chat/completions',
    v_headers,
    'application/json',
    v_request_body::text
  )::http_request);

  -- Extract recipe from response
  RETURN (v_response->'choices'->0->'message'->>'content')::jsonb;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'OpenAI API call failed: %', SQLERRM;
    RETURN NULL;
END;
$$;
```

#### **Step 3: Update generate_recipe_with_ai Function**
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
  i INTEGER;
BEGIN
  -- Build AI prompt for 3 recipe variations
  v_ai_prompt := format(
    'Create 3 different recipe variations using ONLY these ingredients: %s. 

Requirements:
- Use ONLY the provided ingredients (minimum 3, maximum 8 per recipe)
- Create 3 different cooking styles: Classic, Modern, Simple
- Each recipe should be realistic and delicious
- Vary the difficulty: Medium, Medium, Easy
- Vary cooking times: 30-45 minutes

Return a JSON array with 3 recipes, each having this exact structure:
{
  "name": "Recipe Name",
  "ingredients": ["ingredient1", "ingredient2", ...],
  "optional_additions": ["optional1", "optional2"],
  "steps": ["step1", "step2", ...],
  "estimated_time": 35,
  "servings": 4,
  "difficulty": "Medium",
  "estimated_cost": "$12-16",
  "nutrition_notes": "Nutritional information"
}',
    array_to_string(p_ingredients, ', ')
  );

  -- Add preferences if provided
  IF p_cuisine_style IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format(' Cuisine style: %s.', p_cuisine_style);
  END IF;
  
  IF p_dietary_preferences IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format(' Dietary preferences: %s.', p_dietary_preferences);
  END IF;

  -- Call OpenAI API
  v_ai_response := call_openai_api(v_ai_prompt, 2000);

  IF v_ai_response IS NOT NULL THEN
    -- Parse the array of recipes
    FOR i IN 0..2 LOOP
      IF v_ai_response->i IS NOT NULL THEN
        v_recipes[i+1] := v_ai_response->i;
      END IF;
    END LOOP;
    
    RETURN v_recipes;
  ELSE
    -- Fallback if API fails
    RETURN ARRAY[
      jsonb_build_object(
        'name', 'Chef''s Special with ' || p_ingredients[1],
        'ingredients', to_jsonb(p_ingredients[1:6] || ARRAY['salt', 'pepper', 'olive oil']),
        'optional_additions', ARRAY['Fresh herbs'],
        'steps', ARRAY['Prepare ingredients', 'Cook main components', 'Season and serve'],
        'estimated_time', 30,
        'servings', p_servings,
        'difficulty', 'Medium',
        'estimated_cost', '$12-16',
        'nutrition_notes', 'Balanced and nutritious meal'
      )
    ];
  END IF;
END;
$$;
```

### **3. URGENT: Fix Main RPC Function**

Update the main `generate_ai_recipe` function to return multiple recipes:

```sql
-- In the main generate_ai_recipe function, replace the AI generation section:

-- 5. Call AI service to generate 3 recipes
v_generated_recipes := generate_recipe_with_ai(
  v_selected_ingredients,
  p_recipe_data->'dietary_preferences',
  p_recipe_data->>'cuisine_style',
  p_recipe_data->>'difficulty',
  (p_recipe_data->>'prep_time_preference')::INTEGER,
  (p_recipe_data->>'servings')::INTEGER
);

-- 6. Store each recipe and assign confidence scores
FOR i IN 1..array_length(v_generated_recipes, 1) LOOP
  v_recipe_id := gen_random_uuid();
  
  -- Add confidence score based on position (first recipe = highest confidence)
  v_generated_recipes[i] := v_generated_recipes[i] || jsonb_build_object(
    'ai_confidence_score', 
    CASE i 
      WHEN 1 THEN 0.92
      WHEN 2 THEN 0.87
      ELSE 0.83
    END
  );
  
  -- Store in database
  INSERT INTO ai_recipe_generations (
    id, user_id, recipe_data, input_ingredients, ai_model_used, confidence_score
  ) VALUES (
    v_recipe_id, p_user_id, v_generated_recipes[i], v_selected_ingredients, 'gpt-4',
    (v_generated_recipes[i]->>'ai_confidence_score')::DECIMAL
  );
END LOOP;

-- 7. Return all 3 recipes
RETURN jsonb_build_object(
  'success', true,
  'data', to_jsonb(v_generated_recipes),
  'usage_info', jsonb_build_object(
    'remaining_generations', 
    CASE 
      WHEN v_user_tier = 'FREEMIUM' THEN v_max_limit - (v_current_usage + 1)
      ELSE NULL
    END,
    'tier', v_user_tier
  )
);
```

---

## 🔧 **Implementation Steps**

### **Priority 1: Quick Fix (30 minutes)**
1. Update response format to return array of 3 recipes
2. Use better placeholder data with realistic recipe names
3. Test with frontend

### **Priority 2: Real AI Integration (2-4 hours)**
1. Install HTTP extension
2. Implement OpenAI API function
3. Update generate_recipe_with_ai function
4. Test with real API calls
5. Handle API failures gracefully

### **Priority 3: Production Ready (1 day)**
1. Secure API key storage
2. Add rate limiting
3. Implement caching
4. Add monitoring and logging
5. Error handling and fallbacks

---

## 🧪 **Testing Commands**

```sql
-- Test the updated RPC
SELECT generate_ai_recipe(
  'user-uuid-here',
  '{"selected_ingredients": ["chicken breast", "spaghetti", "parmesan cheese", "garlic", "olive oil"], "servings": 4}'::jsonb
);
```

Expected result: Array of 3 realistic recipes with proper field names.

---

## 🚨 **Critical Notes**

1. **Frontend is currently compensating** for backend limitations
2. **Users expect realistic recipes** - current placeholder is too basic
3. **Response format must match** the new structure exactly
4. **API key security** is critical for production
5. **Fallback handling** is essential for reliability

---

## 📞 **Frontend Contact**

If you need clarification on the expected response format or have questions about the integration, the frontend team can provide:
- Sample request/response data
- Testing assistance
- Format validation
- Integration support

**Goal**: Remove frontend enhancement layer once backend provides real AI-generated recipes. 