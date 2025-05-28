# 🔧 Backend Instructions: "What Can I Cook?" Feature RPC

## 📋 **Overview**

This document outlines the backend RPC function needed for the "What Can I Cook?" feature. This RPC will be called in **Phase 2** of the implementation.

---

## 🎯 **Required RPC Function**

### **Function Name**: `generate_recipe_suggestions`

### **Purpose**
Analyze user's selected pantry ingredients and return:
1. **Database Recipe Matches**: Existing recipes that can be made with available ingredients
2. **AI Recipe Generation Trigger**: Determine if AI generation should be offered

---

## 📥 **Input Parameters**

```sql
CREATE OR REPLACE FUNCTION generate_recipe_suggestions(
  p_user_id UUID,
  p_selected_ingredients TEXT[], -- Array of ingredient names
  p_freemium_limit INTEGER DEFAULT 10 -- Limit for freemium users
)
RETURNS JSON
```

### **Parameter Details**
- `p_user_id`: User's UUID for personalization and usage tracking
- `p_selected_ingredients`: Array of ingredient names selected by user
- `p_freemium_limit`: Maximum suggestions for freemium users (default: 10)

---

## 📤 **Expected Output Format**

```json
{
  "database_matches": [
    {
      "recipe_id": "uuid-string",
      "recipe_title": "Chicken Stir Fry",
      "match_percentage": 85,
      "missing_ingredients": ["soy sauce", "ginger"],
      "thumbnail_url": "https://...",
      "prep_time_minutes": 15,
      "cook_time_minutes": 20,
      "difficulty": "Easy",
      "creator_username": "chef_mike"
    }
  ],
  "ai_generation_available": true,
  "user_tier": "FREEMIUM",
  "suggestions_remaining": 7,
  "total_matches_found": 12,
  "matches_returned": 10
}
```

---

## 🔍 **Matching Logic Requirements**

### **1. Recipe Matching Algorithm**
- **Minimum Match**: Recipe must use at least 60% of selected ingredients
- **Match Percentage**: `(matching_ingredients / total_recipe_ingredients) * 100`
- **Sorting**: Order by match percentage (highest first)
- **Filtering**: Exclude recipes user has already seen/skipped recently

### **2. Missing Ingredients**
- List ingredients required by recipe but not in user's selection
- Limit to 3 most important missing ingredients per recipe
- Prioritize common/essential ingredients

### **3. User Tier Handling**
- **FREEMIUM**: Return max 10 suggestions
- **PREMIUM**: Return all matches (up to reasonable limit like 50)
- Track usage for freemium users

---

## 🎨 **AI Generation Logic**

### **When to Offer AI Generation**
- Always available as an option
- Prioritize when database matches < 3 recipes with 80%+ match
- Consider user's previous AI generation usage

### **Freemium Limitations**
- Track AI recipe generations per user per month
- Limit: 10 AI generations per month for freemium users
- Return `ai_generation_available: false` if limit exceeded

---

## 🗄️ **Database Queries Needed**

### **1. Recipe Matching Query**
```sql
-- Find recipes that match selected ingredients
SELECT 
  r.id as recipe_id,
  r.title as recipe_title,
  r.thumbnail_url,
  r.prep_time_minutes,
  r.cook_time_minutes,
  r.difficulty,
  u.username as creator_username,
  -- Calculate match percentage
  (COUNT(ri.ingredient_name) FILTER (WHERE ri.ingredient_name = ANY(p_selected_ingredients))) * 100.0 / COUNT(ri.ingredient_name) as match_percentage,
  -- Get missing ingredients
  ARRAY_AGG(ri.ingredient_name) FILTER (WHERE ri.ingredient_name != ALL(p_selected_ingredients)) as missing_ingredients
FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN users u ON r.creator_user_id = u.id
WHERE r.is_published = true
GROUP BY r.id, r.title, r.thumbnail_url, r.prep_time_minutes, r.cook_time_minutes, r.difficulty, u.username
HAVING (COUNT(ri.ingredient_name) FILTER (WHERE ri.ingredient_name = ANY(p_selected_ingredients))) * 100.0 / COUNT(ri.ingredient_name) >= 60
ORDER BY match_percentage DESC
LIMIT 50;
```

### **2. User Tier Check**
```sql
-- Check user's subscription tier
SELECT tier FROM user_subscriptions 
WHERE user_id = p_user_id 
AND status = 'active' 
AND expires_at > NOW();
```

### **3. Usage Tracking**
```sql
-- Track suggestion generation
INSERT INTO recipe_suggestion_logs (user_id, ingredients_used, suggestions_count, created_at)
VALUES (p_user_id, p_selected_ingredients, array_length(database_matches, 1), NOW());

-- Check AI generation usage for freemium users
SELECT COUNT(*) FROM ai_recipe_generations 
WHERE user_id = p_user_id 
AND created_at >= date_trunc('month', NOW());
```

---

## 🔒 **Security & Performance**

### **Security Considerations**
- Validate `p_user_id` exists and is authenticated
- Sanitize ingredient names to prevent SQL injection
- Rate limiting: Max 5 calls per minute per user

### **Performance Optimizations**
- Index on `recipe_ingredients.ingredient_name`
- Index on `recipes.is_published`
- Cache common ingredient combinations
- Limit result set size

---

## 📊 **Error Handling**

### **Expected Error Cases**
```json
{
  "error": "INSUFFICIENT_INGREDIENTS",
  "message": "At least 3 ingredients required",
  "code": 400
}

{
  "error": "USER_NOT_FOUND",
  "message": "Invalid user ID",
  "code": 404
}

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please wait.",
  "code": 429
}
```

---

## 🧪 **Testing Requirements**

### **Test Cases**
1. **Valid Input**: 3+ ingredients, valid user
2. **Insufficient Ingredients**: < 3 ingredients
3. **No Matches**: Ingredients that don't match any recipes
4. **Freemium Limit**: User at suggestion limit
5. **Premium User**: Unlimited suggestions
6. **Invalid User**: Non-existent user ID

---

## 📈 **Analytics to Track**

### **Metrics to Log**
- Suggestion generation frequency
- Average match percentages
- Most common ingredient combinations
- AI generation vs database match preferences
- User tier conversion triggers

---

## 🚀 **Implementation Priority**

**Phase 2 Requirements**:
1. ✅ Basic recipe matching algorithm
2. ✅ User tier checking
3. ✅ Freemium limitations
4. ✅ Error handling

**Phase 3 Enhancements**:
- Advanced matching algorithms
- Machine learning recommendations
- Personalization based on user history
- Dietary restriction filtering

---

**This RPC will be called from the frontend in Phase 2 when users proceed from ingredient selection to recipe results.** 