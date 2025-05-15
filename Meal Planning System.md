# 🍽️ KitchAI Meal Planning System – Development Blueprint

## Overview

The Meal Planning System allows users to schedule recipes across a 7-day calendar with designated meal slots (Breakfast, Lunch, Dinner, Snack) and automatically generate grocery lists based on their weekly meal plan.

---

## 🎯 Goals

* Let users add recipes to a visual weekly planner.
* Enable multiple slots per day (e.g., Breakfast, Lunch, Dinner, Snack).
* Automatically generate a consolidated grocery list.
* Enable syncing with pantry (optional).
* Provide UX-friendly interfaces for interaction, drag-and-drop (future), and bulk management.

---

## 🧱 Backend Setup (Supabase)

### Tables Required:

#### 1. `meal_plans`

* `id`: uuid (PK)
* `user_id`: uuid (FK to auth.users)
* `date`: date
* `slot`: text ("breakfast", "lunch", "dinner", "snack")
* `recipe_id`: uuid (FK to recipes.id)
* `created_at`: timestamp (default now())

**Indexes:**

* Composite index on (`user_id`, `date`)

**Policies:**

* SELECT/INSERT/DELETE/UPDATE only if `user_id = auth.uid()`

---

### RPC (Optional): `generate_meal_plan_grocery_list(p_user_id)`

* Joins `meal_plans` with `recipes.ingredients`
* Normalizes units/quantities
* Optionally excludes ingredients that exist in user's pantry
* Inserts the combined list into `grocery_list` table

#### 2. `grocery_list`

(Already exists, but enhance with new column:)

* `source`: text (values: 'manual', 'meal\_plan', etc.)
* `meal_plan_id`: uuid (optional FK to meal\_plans.id, for tracking)

---

## 🖼️ Frontend UX

### 📆 MealPlannerScreen

* **Weekly Calendar Grid**

  * Horizontally scrollable week view
  * Days as columns, slots as rows (B/L/D/S)
* **Slot Cards:**

  * Empty state: "+ Add recipe"
  * Filled state: Mini card with recipe thumbnail + title
  * Long-press or tap: Open modal to remove or replace

### ➕ Add to Meal Plan

* From `RecipeDetailScreen` or `Saved` tab, user taps “Add to Meal Plan”
* Selects day + slot
* Confirm

### 🛒 Generate Grocery List

* CTA Button: “Generate Grocery List” (visible only if recipes are planned)
* Modal: Shows preview list with option to uncheck items
* On confirm: Inserts all ingredients to grocery\_list

---

## ✨ Future Features (Not in MVP)

* Drag and drop within planner
* Link to caloric goals/macros
* Auto-suggest missing meals
* Duplicate previous week's meal plan
* Export to PDF or print

---

## 🔐 RLS & Permissions

**meal\_plans RLS**

```sql
USING (user_id = auth.uid())
```

**grocery\_list (enhancement):** Ensure only owner can view/modify items.

---

## ✅ Summary

This Meal Planning module will:

* Strengthen user retention via planning habits
* Provide an actionable next step from saved/liked recipes
* Serve as a conversion trigger from freemium to premium via locked slots or export features

Let me know if you’d like me to generate the Cursor frontend instructions or Supabase SQL schema next.
