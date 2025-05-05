import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

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
  // SearchResults removed from here, moved to MainStack
};

// For the main application stack (after login)
export type MainStackParamList = {
  MainTabs: undefined; // Nest the tabs navigator
  SearchResults: { query: string };
  RecipeDetail: { id: string }; // Add RecipeDetail based on DiscoverScreen code
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