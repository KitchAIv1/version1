# 🍳 "What Can I Cook?" Feature Specification

## 📋 **Feature Overview**

The "What Can I Cook?" feature is an intelligent recipe discovery and AI generation system that analyzes users' pantry items to suggest recipes they can make immediately. This feature bridges pantry management with smart recipe recommendations, showcasing the app's AI capabilities while providing genuine value to users.

### **Core Value Proposition**
- **Instant Recipe Discovery**: Find recipes based on available ingredients
- **AI-Powered Generation**: Create custom recipes from pantry items
- **Reduce Food Waste**: Utilize existing ingredients effectively
- **Seamless Integration**: Works with existing pantry, meal planning, and recipe systems

---

## 🎯 **Feature Requirements**

### **1. Smart Button Component**
- **Placement**: Pantry and Home (Feed) screens
- **Activation Logic**: Enabled only when ≥3 pantry items in stock
- **Visual Design**: Primary, high-contrast button with clear call-to-action
- **Insufficient Items**: Modal prompt when <3 items available

### **2. Ingredient Selection Screen**
- **Item Display**: All in-stock pantry items grouped by storage zones
- **Storage Zones**: Fridge, Cupboard, Freezer, Condiments (no DB changes needed)
- **Selection Logic**: All items pre-selected, users can deselect/add more
- **Search Functionality**: Add additional ingredients from search
- **Validation**: Minimum 3 ingredients required to continue
- **UI State**: Disable "Continue"/"Generate" until ≥3 items selected

### **3. Recipe Results Screen**
- **Database Matches**: Display top 2-3 recipes from existing database
- **Match Indicators**: Show percentage match and missing ingredient tags
- **AI Option**: Always visible "Generate a New Recipe with AI" button
- **Threshold Logic**: If no recipes match ≥80%, auto-surface AI generation

### **4. AI Recipe Generation Flow**
- **Loading State**: Animated loading, maximum 3-4 seconds
- **Recipe Display**: Name, ingredients, steps, time, servings, difficulty
- **Safety Features**: Allergen disclaimer banner below recipe name
- **AI Badge**: Permanent "AI-Generated" badge (cannot be dismissed)
- **Usage Limits**: FREEMIUM users limited to 10 AI recipes/month

### **5. Action System**
- **Universal Actions**: Save, Edit, Add to Meal Plan, Share/Export
- **Creator Actions**: "Upload Video to Post to Community Feed" (after save/edit)
- **Creator Logic**: Without video upload, recipe stays in "My Recipes/Drafts"

### **6. Edge Case Handling**
- **Insufficient Ingredients**: Block flow, suggest adding items or snack recipes
- **No Database Matches**: Automatically surface AI generation as primary action
- **Generation Failure**: Show "next best step" (shopping list, try again)
- **Usage Limits**: Upgrade prompts for FREEMIUM users

---

## 🏗️ **Technical Architecture**

### **New Components**

#### Core Components
```
src/components/
├── WhatCanICookButton.tsx          # Smart button with validation
├── IngredientSelectionCard.tsx     # Grouped ingredient display
├── RecipeMatchCard.tsx             # Database recipe results
├── AIRecipeDisplay.tsx             # AI-generated recipe view
├── RecipeActionButtons.tsx         # Role-based action buttons
├── AllergenDisclaimer.tsx          # Safety disclaimer banner
└── StorageZoneGroup.tsx            # Ingredient grouping component
```

#### Modal Components
```
src/components/modals/
├── InsufficientItemsModal.tsx      # <3 items warning
├── AIGenerationModal.tsx           # Loading state for AI
└── RecipeGenerationErrorModal.tsx  # Error handling
```

### **New Screens**
```
src/screens/recipe-generation/
├── IngredientSelectionScreen.tsx   # Ingredient picker interface
├── RecipeResultsScreen.tsx         # Results display screen
└── AIRecipeGenerationScreen.tsx    # AI recipe generation flow
```

### **Custom Hooks**
```
src/hooks/
├── useRecipeMatching.ts            # Database recipe matching logic
├── useAIRecipeGeneration.ts        # AI recipe creation with limits
├── useIngredientGrouping.ts        # Storage zone categorization
├── useRecipeActions.ts             # Save/edit/share functionality
└── useWhatCanICook.ts              # Main feature orchestration
```

### **Utility Functions**
```
src/utils/
├── ingredientGrouping.ts           # Storage zone classification
├── recipeMatching.ts               # Matching algorithm helpers
└── recipeValidation.ts             # Recipe data validation
```

---

## 🔧 **Backend Requirements**

### **New RPC Functions**

#### 1. Recipe Matching Function
```sql
CREATE OR REPLACE FUNCTION match_recipes_by_ingredients(
  p_user_id UUID,
  p_selected_ingredients TEXT[]
)
RETURNS TABLE (
  recipe_id UUID,
  recipe_title TEXT,
  match_percentage NUMERIC,
  missing_ingredients TEXT[],
  thumbnail_url TEXT,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  difficulty TEXT,
  servings INTEGER
);
```

**Purpose**: Find database recipes matching user's selected ingredients
**Logic**: 
- Calculate percentage match based on available ingredients
- Return recipes with ≥80% match threshold
- Include missing ingredients for partial matches
- Order by match percentage descending

#### 2. AI Recipe Generation Function
```sql
CREATE OR REPLACE FUNCTION generate_recipe_from_ingredients(
  p_user_id UUID,
  p_selected_ingredients TEXT[]
)
RETURNS JSON;
```

**Purpose**: Generate AI recipe with usage tracking
**Features**:
- Check FREEMIUM limits (10/month)
- Call dedicated AI endpoint for recipe generation
- Track usage in `user_usage_limits` table
- Return structured recipe JSON

**Response Format**:
```json
{
  "recipe_name": "string",
  "ingredients": ["string"],
  "preparation_steps": ["string"],
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "servings": number,
  "difficulty": "Easy|Medium|Hard",
  "estimated_cost": "string",
  "nutrition_notes": "string"
}
```

#### 3. Save AI Recipe Function
```sql
CREATE OR REPLACE FUNCTION save_ai_generated_recipe(
  p_user_id UUID,
  p_recipe_data JSON,
  p_is_ai_generated BOOLEAN DEFAULT TRUE
)
RETURNS UUID;
```

**Purpose**: Save AI-generated recipe to user's collection
**Features**:
- Insert into `recipe_uploads` table
- Mark as `is_ai_generated = TRUE`
- Generate unique recipe ID
- Set default visibility and metadata

### **Database Schema Updates**

#### Add AI Recipe Tracking
```sql
-- Add AI generation tracking to recipe_uploads
ALTER TABLE recipe_uploads 
ADD COLUMN is_ai_generated BOOLEAN DEFAULT FALSE;

-- Add index for AI recipe queries
CREATE INDEX idx_recipe_uploads_ai_generated 
ON recipe_uploads(is_ai_generated, user_id);

-- Add recipe difficulty enum if not exists
ALTER TABLE recipe_uploads 
ADD COLUMN difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard'));
```

---

## 🎨 **User Experience Flow**

### **Flow 1: Successful Recipe Generation**
```
1. User taps "What Can I Cook?" button (≥3 pantry items)
2. Navigate to Ingredient Selection Screen
3. Review pre-selected ingredients, adjust selection
4. Tap "Find Recipes" (≥3 ingredients selected)
5. View Recipe Results Screen with database matches
6. Choose "Generate AI Recipe" option
7. Watch loading animation (3-4 seconds)
8. View AI-generated recipe with disclaimer
9. Save/Edit/Add to Meal Plan/Share recipe
10. (Creators) Upload video to post to community
```

### **Flow 2: Insufficient Items**
```
1. User taps "What Can I Cook?" button (<3 pantry items)
2. Modal appears: "Add at least 3 items to your pantry"
3. User can:
   - Navigate to pantry to add items
   - View snack suggestions
   - Close modal and continue browsing
```

### **Flow 3: No Database Matches**
```
1-4. Same as Flow 1
5. Recipe Results Screen shows "No close matches found"
6. AI Generation prominently featured as primary option
7-10. Continue with AI generation flow
```

### **Flow 4: FREEMIUM Limit Reached**
```
1-6. Same as Flow 1
7. AI Generation blocked with upgrade prompt
8. User can:
   - Upgrade to Premium
   - Use database recipes only
   - Try again next month
```

---

## 🔗 **Integration Points**

### **Existing System Connections**

#### PantryScreen Integration
- **Button Placement**: Header area or floating action button
- **Data Access**: Use existing `usePantryData` hook
- **Item Count**: Real-time validation of pantry item count

#### FeedScreen Integration
- **Button Placement**: Prominent position in main feed area
- **Context**: "Cook with what you have" messaging
- **Navigation**: Direct access to ingredient selection

#### useAccessControl Integration
- **Usage Limits**: Check AI recipe generation limits
- **Tier Display**: Show FREEMIUM/PREMIUM status
- **Upgrade Prompts**: Direct integration with UpgradeScreen

#### VideoRecipeUploader Integration
- **Pre-filled Data**: Pass AI recipe data to uploader
- **Creator Flow**: Seamless transition from generation to upload
- **Draft Management**: Handle recipes without videos

#### MealPlannerV2 Integration
- **Add to Plan**: Direct integration with meal planning
- **Date Selection**: Choose specific meal slots
- **Ingredient Sync**: Update grocery list with recipe ingredients

### **Navigation Updates**
```typescript
// src/navigation/types.ts
export type MainStackParamList = {
  // ... existing screens
  IngredientSelection: { 
    pantryItems: PantryItem[];
    preSelectedItems?: string[];
  };
  RecipeResults: { 
    selectedIngredients: string[];
    databaseMatches?: RecipeMatch[];
  };
  AIRecipeGeneration: { 
    selectedIngredients: string[];
    recipeData?: AIRecipeData;
  };
};
```

---

## 📊 **Performance Requirements**

### **Response Time Targets**
- **Button Validation**: <100ms
- **Ingredient Selection**: <500ms for grouping/display
- **Database Matching**: <1 second
- **AI Recipe Generation**: 3-4 seconds maximum
- **Recipe Save**: <500ms

### **Memory Optimization**
- **Large Pantries**: Efficient rendering for 100+ items
- **Image Loading**: Lazy loading for recipe thumbnails
- **Search Performance**: Debounced search with <300ms response

### **Caching Strategy**
- **Recipe Matches**: Cache results for 5 minutes
- **AI Recipes**: Cache generated recipes until app restart
- **Ingredient Groups**: Cache grouping logic for session

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```
src/hooks/__tests__/
├── useRecipeMatching.test.ts       # Matching algorithm tests
├── useAIRecipeGeneration.test.ts   # AI generation flow tests
├── useIngredientGrouping.test.ts   # Grouping logic tests
└── useWhatCanICook.test.ts         # Main feature tests

src/utils/__tests__/
├── ingredientGrouping.test.ts      # Grouping utility tests
├── recipeMatching.test.ts          # Matching helper tests
└── recipeValidation.test.ts        # Validation tests
```

### **Integration Tests**
- **Navigation Flow**: Complete user journey testing
- **API Integration**: Backend RPC function testing
- **Access Control**: FREEMIUM/PREMIUM limit testing
- **Error Handling**: Network failure and edge case testing

### **E2E Tests**
- **Happy Path**: Full feature flow from button to saved recipe
- **Edge Cases**: Insufficient items, no matches, limit exceeded
- **Creator Flow**: AI recipe to video upload journey
- **Cross-Platform**: iOS and Android compatibility

---

## 🚀 **Implementation Phases**

### **Phase 1: Foundation (Week 1)**
- [ ] Create WhatCanICookButton component
- [ ] Integrate button into PantryScreen and FeedScreen
- [ ] Implement pantry item count validation
- [ ] Create InsufficientItemsModal
- [ ] Add navigation structure for new screens

### **Phase 2: Ingredient Selection (Week 2)**
- [ ] Build IngredientSelectionScreen
- [ ] Implement storage zone grouping logic
- [ ] Add search functionality for additional ingredients
- [ ] Create selection validation system
- [ ] Add minimum ingredient requirement handling

### **Phase 3: Recipe Matching (Week 3)**
- [ ] Create RecipeResultsScreen
- [ ] Implement database recipe matching
- [ ] Add percentage match calculation
- [ ] Create missing ingredient indicators
- [ ] Add "Generate AI Recipe" option

### **Phase 4: AI Generation (Week 4)**
- [ ] Implement AI recipe generation flow
- [ ] Create loading states and animations
- [ ] Add AI recipe display with disclaimers
- [ ] Implement "AI-Generated" badge system
- [ ] Add FREEMIUM usage limit checking

### **Phase 5: Actions & Integration (Week 5)**
- [ ] Build role-based action system
- [ ] Integrate with existing save/edit functionality
- [ ] Add meal plan integration
- [ ] Implement creator video upload flow
- [ ] Add share/export functionality

### **Phase 6: Polish & Edge Cases (Week 6)**
- [ ] Implement comprehensive error handling
- [ ] Add edge case flows (no matches, limits exceeded)
- [ ] Performance optimization and testing
- [ ] Accessibility improvements
- [ ] Final UI/UX polish

---

## 📈 **Success Metrics**

### **Engagement Metrics**
- **Button Click Rate**: % of users who tap "What Can I Cook?"
- **Flow Completion**: % who complete ingredient selection
- **Recipe Generation**: Database vs AI recipe selection ratio
- **Action Conversion**: % who save/edit/share generated recipes

### **Business Metrics**
- **Premium Conversion**: FREEMIUM users upgrading after limit
- **Creator Engagement**: % of creators uploading videos for AI recipes
- **Retention Impact**: User retention improvement from feature usage
- **Recipe Quality**: User ratings and feedback on AI recipes

### **Technical Metrics**
- **Performance**: Response times for each flow step
- **Error Rates**: Failed generations, network issues
- **Usage Patterns**: Peak usage times, popular ingredients
- **System Load**: Backend performance under load

---

## 🔒 **Security & Privacy**

### **Data Handling**
- **Ingredient Privacy**: User pantry data remains private
- **AI Generation**: No personal data sent to AI service
- **Recipe Ownership**: Clear ownership of generated recipes
- **Usage Tracking**: Anonymized usage analytics only

### **Content Safety**
- **Allergen Disclaimer**: Prominent safety warnings
- **Recipe Validation**: Basic safety checks for generated recipes
- **User Responsibility**: Clear messaging about kitchen safety
- **Content Moderation**: AI recipe quality monitoring

---

## 🎯 **Future Enhancements**

### **Planned Improvements**
- **Dietary Restrictions**: Filter recipes by dietary preferences
- **Nutrition Information**: Calorie and macro calculations
- **Cooking Time Optimization**: Recipes based on available time
- **Seasonal Suggestions**: Recipes based on seasonal ingredients
- **Social Features**: Share ingredient combinations with friends

### **Advanced Features**
- **Voice Input**: "What can I cook with chicken and rice?"
- **Image Recognition**: Scan ingredients with camera
- **Smart Substitutions**: Suggest ingredient alternatives
- **Cooking Instructions**: Step-by-step cooking guidance
- **Video Integration**: AI-generated cooking videos

---

## 📝 **Notes & Considerations**

### **Technical Decisions**
- **Storage Zones**: Using pattern-based grouping instead of DB fields
- **AI Endpoint**: Dedicated endpoint for better optimization
- **Caching Strategy**: Balance between performance and data freshness
- **Error Handling**: Graceful degradation for all failure modes

### **UX Decisions**
- **Pre-selection**: All ingredients selected by default for convenience
- **Minimum Items**: 3-item minimum balances usability with recipe quality
- **AI Prominence**: Always visible to showcase AI capabilities
- **Creator Flow**: Seamless integration with existing video upload

### **Business Decisions**
- **FREEMIUM Limits**: 10 AI recipes/month encourages premium upgrade
- **Creator Benefits**: Video upload incentivizes content creation
- **Safety First**: Prominent disclaimers protect user safety

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Ready for Implementation  
**Estimated Development Time**: 6 weeks  
**Team**: Frontend, Backend, QA 