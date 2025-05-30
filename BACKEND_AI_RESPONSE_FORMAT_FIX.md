# 🚨 CRITICAL: Edge Function JSON Parsing Failure

## 📋 **URGENT Problem**
The Edge Function is **FAILING** and returning error responses because it cannot parse the OpenAI response:

```
{"error":"Unexpected token '`', \"```json\n[\n\"... is not valid JSON"}
```

**Status**: AI Recipe Generation is currently **BROKEN** for users.

## 🎯 **Root Cause**
1. OpenAI returns JSON wrapped in markdown: ````json [...] ````
2. Edge Function tries to `JSON.parse()` the raw response
3. Parsing fails because of markdown formatting
4. Edge Function returns error instead of recipes

## 🔧 **IMMEDIATE Backend Fix Required**

**Replace this broken code in your Edge Function:**
```javascript
// ❌ BROKEN - This fails with markdown
const recipes = JSON.parse(aiResponse.choices[0].message.content);
```

**With this working code:**
```javascript
// ✅ WORKING - Handles markdown formatting
let recipeData = aiResponse.choices[0].message.content;

// Extract JSON from markdown if needed
if (recipeData.includes('```json')) {
  const jsonMatch = recipeData.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    recipeData = jsonMatch[1];
  }
}

// Now parse the cleaned JSON
const recipes = JSON.parse(recipeData);

// Return clean JSON response
return new Response(JSON.stringify(recipes), {
  headers: { 'Content-Type': 'application/json' },
  status: 200
});
```

## 🛡️ **Frontend Emergency Workaround**
Added fallback to extract JSON from error messages, but **backend fix is still required**.

## 🎯 **Better OpenAI Prompt (Recommended)**
Update your prompt to prevent markdown formatting:

```javascript
const systemPrompt = `You are a professional chef AI. Create exactly 3 recipe variations.

CRITICAL: Return ONLY a valid JSON array. NO markdown, NO code blocks, NO formatting.

Response format: [{"name":"Recipe Name","ingredients":["item1","item2"],"steps":["step1","step2"],"estimated_time":30,"servings":4,"difficulty":"Medium"}]`;
```

## ⏰ **Timeline**
- **Immediate**: Frontend workaround deployed
- **URGENT**: Backend fix needed within 24 hours
- **Goal**: Prevent markdown formatting at source

**Current Status**: Users can generate recipes but with degraded experience due to error handling. 