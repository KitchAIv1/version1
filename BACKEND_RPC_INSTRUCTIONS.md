# Backend RPC Implementation Instructions

## 🎯 **RPC Function: `generate_ai_recipe`**

### **Overview**
This RPC function generates AI-powered custom recipes based on user-selected ingredients, integrates with the freemium access control system, and tracks usage for billing/limits.

---

## 📋 **Function Specification**

### **Function Name**
```sql
generate_ai_recipe(
  p_user_id UUID,
  p_recipe_data JSONB
)
```

### **Input Parameters**

#### **p_user_id** (UUID, Required)
- The authenticated user's ID from the `auth.users` table
- Used for access control and usage tracking

#### **p_recipe_data** (JSONB, Required)
Expected structure:
```json
{
  "selected_ingredients": ["chicken breast", "spaghetti", "parmesan cheese", "olive oil"],
  "dietary_preferences": ["gluten-free", "low-carb"], // Optional
  "cuisine_style": "Italian", // Optional
  "difficulty": "Medium", // Optional: "Easy", "Medium", "Hard"
  "prep_time_preference": 30, // Optional: max prep time in minutes
  "servings": 4 // Optional: number of servings
}
```

### **Return Value**
```json
{
  "success": true,
  "data": {
    "recipe_id": "uuid-generated-id",
    "recipe_name": "AI-Generated Chicken Parmesan Pasta",
    "ingredients": [
      "2 chicken breasts, sliced",
      "300g spaghetti",
      "100g parmesan cheese, grated",
      "3 tbsp olive oil",
      "Salt to taste",
      "Black pepper"
    ],
    "preparation_steps": [
      "Heat olive oil in a large pan over medium heat.",
      "Season chicken with salt and pepper, cook for 6-8 minutes until golden.",
      "Cook spaghetti according to package instructions.",
      "Combine pasta with chicken and parmesan cheese.",
      "Serve hot with extra parmesan on top."
    ],
    "prep_time_minutes": 15,
    "cook_time_minutes": 25,
    "servings": 4,
    "difficulty": "Medium",
    "estimated_cost": "$12-15",
    "nutrition_notes": "High in protein, moderate carbs. Rich in calcium from parmesan.",
    "ai_confidence_score": 0.92
  },
  "usage_info": {
    "remaining_generations": 7, // For FREEMIUM users only
    "tier": "FREEMIUM" // or "PREMIUM", "CREATOR"
  }
}
```

---

## 🗄️ **Database Schema Requirements**

### **1. AI Recipe Generation Tracking Table**
```sql
CREATE TABLE ai_recipe_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_data JSONB NOT NULL, -- The generated recipe
  input_ingredients TEXT[] NOT NULL, -- User's selected ingredients
  generation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ai_model_used VARCHAR(50) DEFAULT 'gpt-4', -- Track which AI model was used
  confidence_score DECIMAL(3,2), -- AI confidence in recipe quality (0.00-1.00)
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5), -- User feedback
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_recipe_generations_user_id ON ai_recipe_generations(user_id);
CREATE INDEX idx_ai_recipe_generations_timestamp ON ai_recipe_generations(generation_timestamp);
```

### **2. Update Usage Limits Table**
Ensure the existing `user_usage_limits` table includes:
```sql
-- Add if not exists
ALTER TABLE user_usage_limits 
ADD COLUMN IF NOT EXISTS ai_recipe_count INTEGER DEFAULT 0;

-- Update the refresh function to include AI recipe count
```

---

## 🔧 **Implementation Steps**

### **Step 1: Access Control & Validation**
```sql
CREATE OR REPLACE FUNCTION generate_ai_recipe(
  p_user_id UUID,
  p_recipe_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_tier TEXT;
  v_current_usage INTEGER;
  v_max_limit INTEGER := 10; -- FREEMIUM limit
  v_selected_ingredients TEXT[];
  v_generated_recipe JSONB;
  v_recipe_id UUID;
BEGIN
  -- 1. Validate user exists and is authenticated
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User ID is required'
    );
  END IF;

  -- 2. Get user tier and current usage
  SELECT 
    COALESCE(up.tier, 'FREEMIUM'),
    COALESCE(uul.ai_recipe_count, 0)
  INTO v_user_tier, v_current_usage
  FROM auth.users u
  LEFT JOIN user_profiles up ON u.id = up.user_id
  LEFT JOIN user_usage_limits uul ON u.id = uul.user_id
  WHERE u.id = p_user_id;

  -- 3. Check access control for FREEMIUM users
  IF v_user_tier = 'FREEMIUM' AND v_current_usage >= v_max_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AI recipe generation limit reached',
      'error_code', 'LIMIT_EXCEEDED',
      'usage_info', jsonb_build_object(
        'current_usage', v_current_usage,
        'max_limit', v_max_limit,
        'tier', v_user_tier
      )
    );
  END IF;

  -- 4. Validate input data
  v_selected_ingredients := ARRAY(SELECT jsonb_array_elements_text(p_recipe_data->'selected_ingredients'));
  
  IF array_length(v_selected_ingredients, 1) IS NULL OR array_length(v_selected_ingredients, 1) < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'At least 2 ingredients are required'
    );
  END IF;

  -- Continue with AI generation...
END;
$$;
```

### **Step 2: AI Integration**
```sql
-- Within the same function, add AI generation logic:

  -- 5. Call AI service (implement based on your AI provider)
  -- This is where you'll integrate with OpenAI, Claude, or your preferred AI service
  
  -- Example structure for AI call:
  v_generated_recipe := generate_recipe_with_ai(
    v_selected_ingredients,
    p_recipe_data->'dietary_preferences',
    p_recipe_data->'cuisine_style',
    p_recipe_data->'difficulty',
    (p_recipe_data->>'prep_time_preference')::INTEGER,
    (p_recipe_data->>'servings')::INTEGER
  );

  -- 6. Generate unique recipe ID
  v_recipe_id := gen_random_uuid();
```

### **Step 3: AI Service Integration Function**
```sql
CREATE OR REPLACE FUNCTION generate_recipe_with_ai(
  p_ingredients TEXT[],
  p_dietary_preferences JSONB DEFAULT NULL,
  p_cuisine_style TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL,
  p_prep_time INTEGER DEFAULT NULL,
  p_servings INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_ai_prompt TEXT;
  v_ai_response JSONB;
BEGIN
  -- Build AI prompt
  v_ai_prompt := format(
    'Create a detailed recipe using these ingredients: %s. ',
    array_to_string(p_ingredients, ', ')
  );
  
  IF p_cuisine_style IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format('Cuisine style: %s. ', p_cuisine_style);
  END IF;
  
  IF p_difficulty IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format('Difficulty level: %s. ', p_difficulty);
  END IF;
  
  IF p_prep_time IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format('Maximum prep time: %s minutes. ', p_prep_time);
  END IF;
  
  v_ai_prompt := v_ai_prompt || format(
    'Servings: %s. Return a JSON response with: recipe_name, ingredients (array), preparation_steps (array), prep_time_minutes, cook_time_minutes, difficulty, estimated_cost, nutrition_notes.',
    p_servings
  );

  -- TODO: Implement actual AI service call here
  -- This could be:
  -- 1. HTTP request to OpenAI API using pg_net extension
  -- 2. Call to your AI microservice
  -- 3. Integration with Claude API
  
  -- For now, return a structured response that matches expected format
  RETURN jsonb_build_object(
    'recipe_name', 'AI-Generated Recipe with ' || p_ingredients[1],
    'ingredients', to_jsonb(p_ingredients),
    'preparation_steps', jsonb_build_array(
      'Prepare all ingredients',
      'Follow cooking steps',
      'Serve and enjoy'
    ),
    'prep_time_minutes', COALESCE(p_prep_time, 15),
    'cook_time_minutes', 20,
    'servings', p_servings,
    'difficulty', COALESCE(p_difficulty, 'Medium'),
    'estimated_cost', '$8-12',
    'nutrition_notes', 'Nutritious and delicious',
    'ai_confidence_score', 0.85
  );
END;
$$;
```

### **Step 4: Complete the Main Function**
```sql
-- Continue the generate_ai_recipe function:

  -- 7. Store the generation record
  INSERT INTO ai_recipe_generations (
    id,
    user_id,
    recipe_data,
    input_ingredients,
    ai_model_used,
    confidence_score
  ) VALUES (
    v_recipe_id,
    p_user_id,
    v_generated_recipe,
    v_selected_ingredients,
    'gpt-4', -- or your AI model
    (v_generated_recipe->>'ai_confidence_score')::DECIMAL
  );

  -- 8. Update usage limits for FREEMIUM users
  IF v_user_tier = 'FREEMIUM' THEN
    INSERT INTO user_usage_limits (user_id, ai_recipe_count)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      ai_recipe_count = user_usage_limits.ai_recipe_count + 1,
      updated_at = NOW();
  END IF;

  -- 9. Return success response
  RETURN jsonb_build_object(
    'success', true,
    'data', v_generated_recipe || jsonb_build_object('recipe_id', v_recipe_id),
    'usage_info', jsonb_build_object(
      'remaining_generations', 
      CASE 
        WHEN v_user_tier = 'FREEMIUM' THEN v_max_limit - (v_current_usage + 1)
        ELSE NULL
      END,
      'tier', v_user_tier
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Internal server error: ' || SQLERRM
    );
END;
$$;
```

---

## 🔒 **Security & Permissions**

### **Row Level Security (RLS)**
```sql
-- Enable RLS on the new table
ALTER TABLE ai_recipe_generations ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own generations
CREATE POLICY "Users can view own AI recipe generations" ON ai_recipe_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for the RPC function to insert records
CREATE POLICY "Service can insert AI recipe generations" ON ai_recipe_generations
  FOR INSERT WITH CHECK (true);
```

### **Function Permissions**
```sql
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_ai_recipe(UUID, JSONB) TO authenticated;
```

---

## 🧪 **Testing**

### **Test Cases**

#### **1. FREEMIUM User - Within Limits**
```sql
SELECT generate_ai_recipe(
  'user-uuid-here',
  '{"selected_ingredients": ["chicken", "rice", "vegetables"], "difficulty": "Easy", "servings": 4}'::jsonb
);
```

#### **2. FREEMIUM User - Exceeds Limits**
```sql
-- After user has used 10 generations
SELECT generate_ai_recipe(
  'user-uuid-here',
  '{"selected_ingredients": ["beef", "pasta"]}'::jsonb
);
-- Should return limit exceeded error
```

#### **3. PREMIUM User - Unlimited**
```sql
SELECT generate_ai_recipe(
  'premium-user-uuid',
  '{"selected_ingredients": ["salmon", "quinoa", "asparagus"], "cuisine_style": "Mediterranean"}'::jsonb
);
```

---

## 📊 **Monitoring & Analytics**

### **Usage Analytics Query**
```sql
-- Daily AI recipe generation stats
SELECT 
  DATE(generation_timestamp) as date,
  COUNT(*) as total_generations,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(confidence_score) as avg_confidence,
  COUNT(*) FILTER (WHERE user_rating IS NOT NULL) as rated_recipes,
  AVG(user_rating) FILTER (WHERE user_rating IS NOT NULL) as avg_rating
FROM ai_recipe_generations
WHERE generation_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(generation_timestamp)
ORDER BY date DESC;
```

---

## 🚀 **Deployment Checklist**

- [ ] Create `ai_recipe_generations` table
- [ ] Update `user_usage_limits` table with `ai_recipe_count` column
- [ ] Implement `generate_recipe_with_ai` helper function
- [ ] Implement main `generate_ai_recipe` RPC function
- [ ] Set up Row Level Security policies
- [ ] Grant appropriate permissions
- [ ] Test with FREEMIUM and PREMIUM users
- [ ] Set up monitoring queries
- [ ] Configure AI service integration (OpenAI/Claude/etc.)
- [ ] Update frontend to remove mock implementation

---

## 🚨 **CURRENT IMPLEMENTATION STATUS**

### **✅ What's Implemented**
- RPC function `generate_ai_recipe` with proper structure
- User tier detection (FREEMIUM vs PREMIUM/CREATOR)
- Usage limit enforcement (10 generations for FREEMIUM)
- Database tracking and storage
- Access control and error handling

### **❌ What's Still Placeholder**
- **Actual AI service integration** (OpenAI/Claude API calls)
- The `generate_recipe_with_ai` function is returning mock data
- No real AI-generated recipes yet

### **🎯 Next Steps for Real AI Integration**

The current placeholder in `generate_recipe_with_ai` needs to be replaced with actual AI service calls.

---

## 🤖 **AI Service Integration Implementation**

### **Option 1: OpenAI Integration (Recommended)**

#### **Step 1: Install Required Extensions**
```sql
-- Enable HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS http;
-- OR use pg_net if available
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### **Step 2: Create OpenAI Integration Function**
```sql
CREATE OR REPLACE FUNCTION call_openai_api(
  p_prompt TEXT,
  p_max_tokens INTEGER DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response JSONB;
  v_api_key TEXT := 'your-openai-api-key-here'; -- Store in secure config
  v_request_body JSONB;
  v_headers JSONB;
BEGIN
  -- Build request body for OpenAI API
  v_request_body := jsonb_build_object(
    'model', 'gpt-4',
    'messages', jsonb_build_array(
      jsonb_build_object(
        'role', 'system',
        'content', 'You are a professional chef AI. Create detailed, realistic recipes in JSON format with the exact structure requested.'
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

  -- Make API call using http extension
  SELECT content::jsonb INTO v_response
  FROM http((
    'POST',
    'https://api.openai.com/v1/chat/completions',
    v_headers,
    'application/json',
    v_request_body::text
  )::http_request);

  -- Extract the recipe from OpenAI response
  RETURN v_response->'choices'->0->'message'->>'content';

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return fallback
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
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_ai_prompt TEXT;
  v_ai_response JSONB;
  v_parsed_recipe JSONB;
BEGIN
  -- Build comprehensive AI prompt
  v_ai_prompt := format(
    'Create a detailed recipe using these ingredients: %s. ',
    array_to_string(p_ingredients, ', ')
  );
  
  IF p_cuisine_style IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format('Cuisine style: %s. ', p_cuisine_style);
  END IF;
  
  IF p_difficulty IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format('Difficulty level: %s. ', p_difficulty);
  END IF;
  
  IF p_prep_time IS NOT NULL THEN
    v_ai_prompt := v_ai_prompt || format('Maximum prep time: %s minutes. ', p_prep_time);
  END IF;
  
  v_ai_prompt := v_ai_prompt || format(
    'Servings: %s. 

IMPORTANT: Return ONLY a valid JSON object with this exact structure:
{
  "recipe_name": "string",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "preparation_steps": ["step 1", "step 2", ...],
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "difficulty": "Easy|Medium|Hard",
  "estimated_cost": "string like $8-12",
  "nutrition_notes": "string",
  "ai_confidence_score": number_between_0_and_1
}

Make the recipe realistic, detailed, and delicious. Use proper cooking techniques and realistic timing.',
    p_servings
  );

  -- Call OpenAI API
  v_ai_response := call_openai_api(v_ai_prompt, 1500);

  IF v_ai_response IS NULL THEN
    -- Fallback to placeholder if API fails
    RETURN jsonb_build_object(
      'recipe_name', 'Chef''s Special with ' || p_ingredients[1],
      'ingredients', to_jsonb(p_ingredients || ARRAY['Salt', 'Pepper', 'Olive oil']),
      'preparation_steps', jsonb_build_array(
        'Prepare all ingredients by washing and chopping as needed.',
        'Heat oil in a large pan over medium heat.',
        'Cook main ingredients until tender and flavorful.',
        'Season with salt and pepper to taste.',
        'Serve hot and enjoy!'
      ),
      'prep_time_minutes', COALESCE(p_prep_time, 15),
      'cook_time_minutes', 25,
      'servings', p_servings,
      'difficulty', COALESCE(p_difficulty, 'Medium'),
      'estimated_cost', '$10-15',
      'nutrition_notes', 'Balanced and nutritious meal.',
      'ai_confidence_score', 0.75
    );
  END IF;

  -- Parse and validate AI response
  BEGIN
    v_parsed_recipe := v_ai_response::jsonb;
    
    -- Validate required fields exist
    IF v_parsed_recipe ? 'recipe_name' AND 
       v_parsed_recipe ? 'ingredients' AND 
       v_parsed_recipe ? 'preparation_steps' THEN
      
      -- Add servings if not provided by AI
      IF NOT (v_parsed_recipe ? 'servings') THEN
        v_parsed_recipe := v_parsed_recipe || jsonb_build_object('servings', p_servings);
      END IF;
      
      RETURN v_parsed_recipe;
    ELSE
      RAISE EXCEPTION 'Invalid AI response structure';
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- If parsing fails, return structured fallback
      RETURN jsonb_build_object(
        'recipe_name', 'AI-Generated Recipe with ' || p_ingredients[1],
        'ingredients', to_jsonb(p_ingredients || ARRAY['Salt to taste', 'Black pepper', 'Olive oil']),
        'preparation_steps', jsonb_build_array(
          'Prepare ingredients according to recipe requirements.',
          'Follow standard cooking procedures for the main ingredients.',
          'Season and serve as appropriate.'
        ),
        'prep_time_minutes', COALESCE(p_prep_time, 20),
        'cook_time_minutes', 30,
        'servings', p_servings,
        'difficulty', COALESCE(p_difficulty, 'Medium'),
        'estimated_cost', '$12-18',
        'nutrition_notes', 'Nutritious and satisfying.',
        'ai_confidence_score', 0.70
      );
  END;
END;
$$;
```

### **Option 2: Supabase Edge Functions (Alternative)**

Create an Edge Function that handles the AI API calls:

```typescript
// supabase/functions/generate-recipe/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  try {
    const { ingredients, preferences } = await req.json()
    
    const prompt = `Create a detailed recipe using: ${ingredients.join(', ')}...`
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a professional chef...' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    })
    
    const aiResult = await response.json()
    const recipe = JSON.parse(aiResult.choices[0].message.content)
    
    return new Response(JSON.stringify({ success: true, recipe }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

Then call it from PostgreSQL:
```sql
-- In generate_recipe_with_ai function
SELECT content::jsonb INTO v_ai_response
FROM http((
  'POST',
  'https://your-project.supabase.co/functions/v1/generate-recipe',
  '{"Authorization": "Bearer ' || service_role_key || '"}',
  'application/json',
  jsonb_build_object('ingredients', p_ingredients, 'preferences', p_dietary_preferences)::text
)::http_request);
```

---

## 🔧 **Implementation Priority**

1. **Immediate**: Use Option 1 (Direct OpenAI integration) for fastest implementation
2. **Production**: Consider Option 2 (Edge Functions) for better security and scalability
3. **Testing**: Start with a simple prompt and gradually enhance

---

## 🧪 **Testing the AI Integration**

```sql
-- Test the AI integration
SELECT generate_recipe_with_ai(
  ARRAY['chicken breast', 'spaghetti', 'parmesan cheese', 'tomatoes'],
  NULL, -- dietary preferences
  'Italian', -- cuisine style
  'Medium', -- difficulty
  30, -- max prep time
  4 -- servings
);
```

Expected result: A real AI-generated Italian chicken pasta recipe!

---

This implementation provides a robust, scalable foundation for AI recipe generation with proper access control, usage tracking, and error handling. 