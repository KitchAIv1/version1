import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';

// Define ParamList types for each navigator

// For the authentication flow (before login/signup)
export type AuthStackParamList = {
  Splash: undefined; // No params expected for Splash
  Login: undefined;
  Signup: undefined;
};

// For the main application tabs (nested within MainStack)
export type MainTabsParamList = {
  Feed: undefined;
  Discover: undefined;
  Pantry: undefined;
  Create: undefined;
  Profile: { userId?: string }; // Added userId parameter for viewing other users' profiles
  GroceryList: undefined;
  // SearchResults removed from here, moved to MainStack
};

// Type for the Recipe Detail screen parameters
export type RecipeDetailParams = {
  id: string;
  initialSeekTime?: number; // Optional: time in ms to seek video initially
  initialTab?: string; // Added for specifying initial tab
};

// Type for the Edit Profile screen parameters
export type EditProfileParams = {
  initialProfileData?: {
    bio?: string | null;
    avatar_url?: string | null;
    username?: string | null;
  };
  userId?: string; // User ID might be needed if RPC doesn't use auth.uid()
};

// Params for EditRecipeScreen
export type EditRecipeParams = {
  recipeId: string;
};

// Types for "What Can I Cook?" feature screens
export type IngredientSelectionParams = {
  pantryItems: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit: string;
  }>;
  preSelectedItems?: string[];
};

export type RecipeResultsParams = {
  selectedIngredients: string[];
  databaseMatches?: Array<{
    recipe_id: string;
    recipe_title: string;
    match_percentage: number;
    missing_ingredients: string[];
    thumbnail_url?: string;
  }>;
};

export type AIRecipeGenerationParams = {
  selectedIngredients: string[];
  recipeData?: {
    recipe_name: string;
    ingredients: string[];
    preparation_steps: string[];
    prep_time_minutes: number;
    cook_time_minutes: number;
    servings: number;
    difficulty: string;
  };
};

// For the main application stack (after login)
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  SearchResults: { query: string };
  RecipeDetail: RecipeDetailParams;
  PantryScan: undefined; // Add PantryScan screen
  EditProfile: EditProfileParams; // Added EditProfile screen
  VideoRecipeUploader: undefined; // Add VideoRecipeUploader screen
  EditRecipe: EditRecipeParams; // Add EditRecipe route
  SearchScreen: undefined; // Added SearchScreen for the new top bar icon
  OnboardingStep1: undefined; // Added Onboarding Step 1
  OnboardingStep2User: undefined; // Added Onboarding Step 2 User
  OnboardingStep2Creator: undefined; // Added Onboarding Step 2 Creator
  OnboardingFinal: undefined; // Added Onboarding Final Step
  UpgradeScreen: undefined; // Added UpgradeScreen for PREMIUM upgrades
  // "What Can I Cook?" feature screens
  IngredientSelection: IngredientSelectionParams;
  RecipeResults: RecipeResultsParams;
  AIRecipeGeneration: AIRecipeGenerationParams;
  // Add other stack screens here if needed (e.g., Settings)
};

// Combine if needed, or define screen prop types directly

// Example: Prop types for screens within AuthStack
export type SplashScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'Splash'
>;
export type LoginScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'Login'
>;
export type SignupScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'Signup'
>;

// Example: Prop types for screens within MainTabs (if needed for options/listeners)
export type FeedScreenProps = BottomTabScreenProps<MainTabsParamList, 'Feed'>;
export type DiscoverScreenProps = BottomTabScreenProps<
  MainTabsParamList,
  'Discover'
>;
// ... define other tab screen props similarly

// Prop types for screens within MainStack
export type SearchResultsProps = NativeStackScreenProps<
  MainStackParamList,
  'SearchResults'
>;
export type RecipeDetailProps = NativeStackScreenProps<
  MainStackParamList,
  'RecipeDetail'
>;
export type PantryScanProps = NativeStackScreenProps<
  MainStackParamList,
  'PantryScan'
>; // Add prop type for PantryScan
export type UpgradeScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'UpgradeScreen'
>; // Add prop type for UpgradeScreen

// "What Can I Cook?" feature screen prop types
export type IngredientSelectionScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'IngredientSelection'
>;
export type RecipeResultsScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'RecipeResults'
>;
export type AIRecipeGenerationScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'AIRecipeGeneration'
>;
