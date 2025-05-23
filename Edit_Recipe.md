
**Feature: Edit Recipe**

This feature allows users to modify the details of their existing recipes. It consists of a new screen (`EditRecipeScreen.tsx`) and a custom hook (`useEditableRecipeDetails.ts`) to manage data fetching and state.

**1. `useEditableRecipeDetails.ts` (Custom Hook):**

*   **Purpose:** Fetches the specific details of a recipe required for editing.
*   **Data Fetching:**
    *   Uses the `get_recipe_details` Supabase RPC, passing the `p_recipe_id`.
    *   Employs `@tanstack/react-query` for efficient data fetching, caching (with a 1-minute stale time for active editing), and managing loading/error states.
    *   Uses a unique query key `['editableRecipeDetails', recipeId]` to avoid conflicts with other recipe data queries.
*   **Data Transformation:**
    *   Maps the raw data returned by the RPC to a clean `RecipeEditableData` interface. This interface includes fields like `recipe_id`, `title`, `description`, `ingredients` (as an array of `{name, quantity, unit}`), `diet_tags`, `preparation_steps`, `prep_time_minutes`, `cook_time_minutes`, `servings`, the original `video_url` (which is not editable in this screen but needs to be passed back), `thumbnail_url`, and `is_public`.
*   **Error Handling:** Propagates errors from the RPC call.

**2. `EditRecipeScreen.tsx` (React Native Screen):**

*   **Navigation:**
    *   Receives `recipeId` as a navigation parameter.
    *   Defined in `MainStackParamList` (in `src/navigation/types.ts`) as `EditRecipe: { recipeId: string }`.
*   **UI & Form Structure:**
    *   Presents a user-friendly interface for editing recipe details, organized into collapsible sections using a reusable `CollapsibleCard` component:
        *   General Details (Title, Description)
        *   Timings & Servings (Prep time, Cook time, Servings)
        *   Thumbnail
        *   Ingredients (dynamically add/remove)
        *   Preparation Steps (dynamically add/remove)
        *   Dietary Tags (multi-select from predefined options)
        *   Visibility (Public/Private switch)
    *   Form fields are pre-populated with data fetched by `useEditableRecipeDetails`.
*   **State Management:**
    *   Uses React `useState` hooks to manage the state of all editable fields (title, description, ingredients, steps, tags, timings, visibility, and selected thumbnail).
    *   `useEffect` is used to populate form state once `initialRecipeData` is loaded from the hook.
*   **Thumbnail Management:**
    *   Allows users to select a new thumbnail image using `expo-image-picker` (`handleSelectThumbnail`).
    *   The selected image URI is stored locally (`newLocalThumbnailUri`).
    *   Previews the current or newly selected thumbnail.
    *   **Upload Process:**
        *   If a new thumbnail is chosen, it's uploaded to a Supabase Storage bucket (intended to be `recipe-thumbnails`). The path includes `recipe_id` and a timestamp for uniqueness.
        *   Uses `FileSystem.readAsStringAsync` (from `expo-file-system`) to read the image file as a base64 string on mobile.
        *   This base64 string is then decoded into an `ArrayBuffer` using `decode` (from `base64-arraybuffer`) for the Supabase storage upload.
        *   The public URL of the newly uploaded thumbnail is retrieved and stored.
*   **Saving Changes (`handleSaveRecipe`):**
    *   **Validation:** Performs basic validation (e.g., checks if the title is present).
    *   **Payload Preparation:** Constructs a payload object for the `update_recipe_details` Supabase RPC. All parameter keys are prefixed with `p_` (e.g., `p_title`, `p_ingredients`). It includes:
        *   The `p_recipe_id`.
        *   Updated metadata (title, description, timings, servings, visibility).
        *   Cleaned lists of ingredients and preparation steps (empty entries are filtered out).
        *   Selected dietary tags.
        *   The `p_thumbnail_url` (either the new one if changed, or the existing one).
        *   The original `p_video_url` (as video editing is not part of this screen).
    *   **RPC Call:** Invokes the `update_recipe_details` Supabase RPC with the prepared payload.
    *   **Feedback & Navigation:**
        *   Displays an activity indicator and upload progress during the save operation.
        *   Provides success or error alerts to the user.
        *   On successful update, it invalidates relevant React Query keys (`['editableRecipeDetails', recipeId]`, `['recipeDetails', recipeId]` for the recipe detail view, and `['profile', user.id]` if the user is logged in) to ensure data consistency across the app.
        *   Navigates the user back to the previous screen.
*   **Error Handling:** Includes `try-catch` blocks for robust error handling during thumbnail upload and RPC calls.
*   **Dependencies:**
    *   `@react-navigation/native-stack` for navigation.
    *   `react-native-vector-icons/MaterialIcons` for icons.
    *   `expo-image-picker` for image selection.
    *   `@tanstack/react-query` for data fetching and caching.
    *   `supabase-js` for Supabase interactions.
    *   `base64-arraybuffer` for decoding base64 strings.
    *   `expo-file-system` for reading files.
    *   `useAuth` hook to get the current user ID for query invalidation.

**Summary of Functionality:**

The "Edit Recipe" feature enables users to comprehensively update their recipe's textual information, dietary classifications, timings, and visual thumbnail. It fetches existing data, provides an intuitive editing interface, handles new thumbnail uploads to cloud storage, and persists changes to the backend via a Supabase RPC. The implementation emphasizes clear data flow, state management, and user feedback.
