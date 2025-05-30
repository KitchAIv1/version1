# 🔍 **COMPREHENSIVE RPC & TABLE AUDIT**
## *Complete Analysis of All Functions and Their Table Dependencies*

---

## 📊 **Executive Summary**

**SCOPE**: Complete audit of ALL 40+ RPC functions in the KitchAI app  
**CRITICAL FINDING**: Systematic table inconsistencies affecting multiple feature areas  
**RECOMMENDATION**: Consolidate on `recipe_uploads` as single recipes table

---

## 🎯 **All RPC Functions by Category**

### **🍽️ RECIPE CORE OPERATIONS**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `get_recipe_details` | RecipeDetailScreen | ❌ `recipes` | 🔴 BROKEN | Recipe details don't load |
| `update_recipe_details` | EditRecipeScreen | ❌ MISSING | 🔴 BROKEN | Recipe editing fails |
| `delete_recipe` | ProfileRecipeCard | ❓ UNKNOWN | ⚠️ UNKNOWN | Deletion may fail |
| `get_recipe_details_with_pantry_match` | Not used | ❓ UNKNOWN | ⚠️ LEGACY | May be unused |

### **📱 FEED & DISCOVERY**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `get_community_feed_pantry_match_v3` | FeedScreen, useFeed | ✅ `recipe_uploads` | 🟢 WORKING | Feed loads correctly |
| `generate_recipe_suggestions` | useRecipeSuggestions | ❓ UNKNOWN | ⚠️ UNKNOWN | Recommendations may break |
| `match_pantry_ingredients` | useRecipeDetails | ❓ UNKNOWN | ⚠️ UNKNOWN | Pantry matching may fail |
| `calculate_pantry_match` | useRecipeDetails | ❓ UNKNOWN | ⚠️ UNKNOWN | Match % calculations |

### **❤️ SOCIAL INTERACTIONS**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `toggle_like_recipe` | useLikeMutation, RecipeCard | ❓ UNKNOWN | ⚠️ UNKNOWN | Like functionality |
| `save_recipe_video` | useSaveMutation, ProfileRecipeCard | ✅ `recipe_uploads` | 🟢 WORKING | Save/unsave works |
| `unsave_recipe` | ProfileRecipeCard | ❓ UNKNOWN | ⚠️ UNKNOWN | Unsaving may fail |
| `add_like` | Not used directly | ❓ UNKNOWN | ⚠️ LEGACY | May be unused |
| `remove_like` | Not used directly | ❓ UNKNOWN | ⚠️ LEGACY | May be unused |

### **💬 COMMENTS SYSTEM** 

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `get_recipe_comments` | CommentsModal, useRecipeComments | ❌ `recipes` | 🔴 BROKEN | Comments don't load |
| `add_recipe_comment` | Comments functionality | ❌ `recipes` | 🔴 BROKEN | Can't add comments |
| `delete_recipe_comment` | Comments functionality | ❌ `recipes` | 🔴 BROKEN | Can't delete comments |

### **👤 PROFILE & USER MANAGEMENT**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `get_profile_details` | ProfileScreen, useProfile | ✅ `recipe_uploads` | 🟢 WORKING | Profile displays correctly |
| `update_profile` | EditProfileScreen | ❓ UNKNOWN | ⚠️ UNKNOWN | Profile editing |
| `create_user_profile` | Onboarding | ❓ UNKNOWN | ⚠️ UNKNOWN | User registration |

### **🍳 AI RECIPE GENERATION**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `generate_recipe_with_ai` | AIRecipeGenerationScreen | ❓ UNKNOWN | ⚠️ UNKNOWN | AI recipe generation |
| `save_ai_generated_recipe` | AIRecipeGenerationScreen | ✅ `recipe_uploads` | 🟢 WORKING | AI recipe saving |
| `call_openai_api` | Backend only | ❓ UNKNOWN | ⚠️ UNKNOWN | AI API integration |

### **📅 MEAL PLANNING**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `get_meal_plan_for_date` | useDailyMealPlan | ✅ `recipe_uploads` | 🟢 WORKING | Meal plans load |
| `add_recipe_to_meal_slot` | useDailyMealPlan | ✅ `recipe_uploads` | 🟢 WORKING | Adding recipes works |
| `remove_recipe_from_meal_slot` | useDailyMealPlan | ✅ `recipe_uploads` | 🟢 WORKING | Removing recipes works |

### **📱 ACTIVITY & ANALYTICS**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `get_user_activity_feed` | useUserActivityFeed | ❓ UNKNOWN | ⚠️ UNKNOWN | Activity feed |
| `log_recipe_view` | FeedScreen, useRecipeDetails | ❓ UNKNOWN | ⚠️ UNKNOWN | View tracking |
| `log_pantry_scan` | useAccessControl | ❓ UNKNOWN | ⚠️ UNKNOWN | Usage analytics |

### **👥 SOCIAL FEATURES**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `follow_user` | useFollowMutation | ❓ UNKNOWN | ⚠️ UNKNOWN | Following users |
| `unfollow_user` | useFollowMutation | ❓ UNKNOWN | ⚠️ UNKNOWN | Unfollowing users |
| `get_follow_status` | useFollowMutation | ❓ UNKNOWN | ⚠️ UNKNOWN | Follow status |
| `get_user_followers` | useFollowMutation | ❓ UNKNOWN | ⚠️ UNKNOWN | Followers list |
| `get_user_following` | useFollowMutation | ❓ UNKNOWN | ⚠️ UNKNOWN | Following list |

### **🎬 VIDEO PROCESSING**

| Function | Frontend Usage | Table Used | Status | Impact |
|----------|---------------|------------|--------|---------|
| `increment_video_metric` | Not used directly | ❓ UNKNOWN | ⚠️ UNKNOWN | Video analytics |

---

## 🔍 **Detailed Table Usage Analysis**

### **✅ CONFIRMED WORKING (Using `recipe_uploads`)**

1. **`get_profile_details`** ✅  
   - **Tables**: `recipe_uploads`, `saved_recipe_videos`
   - **Usage**: Profile screen, user recipes display
   - **Status**: Working correctly

2. **`get_community_feed_pantry_match_v3`** ✅  
   - **Tables**: `recipe_uploads`, `stock` 
   - **Usage**: Main feed, recipe discovery
   - **Status**: Working correctly

3. **`save_recipe_video`** ✅  
   - **Tables**: `recipe_uploads`, `saved_recipe_videos`
   - **Usage**: Save/unsave recipes functionality
   - **Status**: Working correctly

4. **`save_ai_generated_recipe`** ✅  
   - **Tables**: `recipe_uploads`
   - **Usage**: AI recipe saving
   - **Status**: Working correctly (documented)

5. **Meal Planning RPCs** ✅  
   - **Tables**: `recipe_uploads`, `meal_plans`
   - **Usage**: Meal planner functionality
   - **Status**: Working correctly

### **❌ CONFIRMED BROKEN (Using wrong `recipes` table)**

1. **`get_recipe_details`** ❌  
   - **Wrong Table**: `recipes` (should be `recipe_uploads`)
   - **Impact**: Recipe Detail Screen completely broken
   - **Frontend Effect**: Users can't view recipe details
   
2. **`get_recipe_comments`** ❌  
   - **Wrong Table**: `recipe_comments` → `recipes` (should be `recipe_uploads`)
   - **Impact**: Comments system completely broken
   - **Frontend Effect**: Users can't view/add comments

3. **Comments Trigger Functions** ❌  
   - **Wrong Table**: Updates `recipes.comments_count` (should be `recipe_uploads`)
   - **Impact**: Comment counts not updated
   - **Frontend Effect**: Incorrect comment counters

### **⚠️ UNKNOWN STATUS (Need Investigation)**

These functions need immediate investigation to determine their table usage:

1. **`toggle_like_recipe`** - Critical for social features
2. **`generate_recipe_suggestions`** - Critical for "What Can I Cook" 
3. **`delete_recipe`** - Critical for recipe management
4. **`update_recipe_details`** - Missing entirely
5. **`calculate_pantry_match`** - Critical for pantry matching
6. **All follow/unfollow functions** - Critical for social features
7. **Activity logging functions** - Important for analytics

---

## 🚨 **Critical Impacts by Screen**

### **🔴 COMPLETELY BROKEN**
- **RecipeDetailScreen**: Can't load recipe details (`get_recipe_details`)
- **Comments functionality**: Can't view/add comments (comments system)
- **Recipe editing**: Missing `update_recipe_details` RPC

### **🟡 POTENTIALLY BROKEN**
- **Social interactions**: Unknown table usage for likes/follows
- **Recipe suggestions**: Unknown table usage for recommendations  
- **Recipe deletion**: Unknown table usage for delete function
- **Search functionality**: May depend on broken functions

### **🟢 WORKING CORRECTLY**
- **Profile screens**: Uses `recipe_uploads` correctly
- **Feed screen**: Uses `recipe_uploads` correctly  
- **Meal planning**: Uses `recipe_uploads` correctly
- **AI recipe generation**: Uses `recipe_uploads` correctly

---

## 🛠️ **Recommended Fix Strategy**

### **IMMEDIATE (Priority 1) - Fix Broken Core**
1. **Fix `get_recipe_details`**: Change `FROM recipes` → `FROM recipe_uploads`
2. **Fix comments system**: Update foreign keys to `recipe_uploads`
3. **Create `update_recipe_details`**: Target `recipe_uploads` table
4. **Test RecipeDetailScreen**: Verify everything works

### **URGENT (Priority 2) - Investigate Unknown**
1. **Audit `toggle_like_recipe`**: Determine table usage
2. **Audit `delete_recipe`**: Ensure uses `recipe_uploads`
3. **Audit `calculate_pantry_match`**: Verify table references
4. **Audit `generate_recipe_suggestions`**: Check dependencies

### **IMPORTANT (Priority 3) - Complete Migration**
1. **Audit all social functions**: Follow, unfollow, activity logs
2. **Check analytics functions**: Ensure consistent table usage
3. **Migrate any legacy `recipes` data**: To `recipe_uploads`
4. **Drop `recipes` table**: After confirming migration complete

---

## 📈 **Expected Outcomes**

**After Priority 1 fixes:**
- ✅ Recipe Detail Screen functional
- ✅ Comments system working
- ✅ Recipe editing operational

**After Priority 2 investigation:**
- ✅ Social features confirmed working
- ✅ Recipe suggestions functional  
- ✅ Pantry matching reliable

**After Priority 3 completion:**
- ✅ Single consistent data model
- ✅ All features using same table
- ✅ Simplified maintenance

---

## 🏁 **Action Items for Backend Team**

**IMMEDIATE ACTION NEEDED:**
1. ✅ Fix `get_recipe_details` RPC (5 min fix)
2. ✅ Fix comments foreign keys (2 min fix)  
3. ✅ Create missing `update_recipe_details` RPC (15 min)
4. ✅ Investigate `toggle_like_recipe` table usage (5 min)
5. ✅ Test critical screens after fixes

This comprehensive audit reveals the extent of the table redundancy issue and provides a clear roadmap for resolution. 