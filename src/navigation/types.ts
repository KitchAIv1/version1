import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';

// Define ParamList types for each navigator

// For the authentication flow (before login/signup)
export type AuthStackParamList = {
  Splash: undefined; // No params expected for Splash
  Login: undefined;
  Signup: undefined;
  DietPrefs: undefined; // Or potentially { userId: string } if needed right after signup
};

// For the main application tabs (nested within MainStack)
export type MainTabsParamList = {
  Feed: undefined;
  Discover: undefined;
  Pantry: undefined;
  Create: undefined;
  Profile: undefined;
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
  // Add other stack screens here if needed (e.g., Settings)
};

// Combine if needed, or define screen prop types directly

// Example: Prop types for screens within AuthStack
export type SplashScreenProps = NativeStackScreenProps<AuthStackParamList, 'Splash'>;
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type SignupScreenProps = NativeStackScreenProps<AuthStackParamList, 'Signup'>;
export type DietPrefsScreenProps = NativeStackScreenProps<AuthStackParamList, 'DietPrefs'>;

// Example: Prop types for screens within MainTabs (if needed for options/listeners)
export type FeedScreenProps = BottomTabScreenProps<MainTabsParamList, 'Feed'>;
export type DiscoverScreenProps = BottomTabScreenProps<MainTabsParamList, 'Discover'>;
// ... define other tab screen props similarly

// Prop types for screens within MainStack
export type SearchResultsProps = NativeStackScreenProps<MainStackParamList, 'SearchResults'>;
export type RecipeDetailProps = NativeStackScreenProps<MainStackParamList, 'RecipeDetail'>;
export type PantryScanProps = NativeStackScreenProps<MainStackParamList, 'PantryScan'>; // Add prop type for PantryScan 