import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs'; // Import the tabs navigator
// import SearchResultsScreen from '../screens/main/SearchResultsScreen'; // Commented out
// Revert to original screen temporarily to fix crash
import RecipeDetailScreen from '../screens/main/RecipeDetailScreen';
import PantryScanningScreen from '../screens/pantry/PantryScanningScreen'; // Uncommented
import EditProfileScreen from '../screens/EditProfileScreen'; // Uncommented
import VideoRecipeUploaderScreen from '../screens/recipe/VideoRecipeUploaderScreen';
import EditRecipeScreen from '../screens/recipe/EditRecipeScreen'; // Import EditRecipeScreen
import UpgradeScreen from '../screens/UpgradeScreen'; // Import UpgradeScreen
import FollowersDetailScreen from '../screens/main/FollowersDetailScreen'; // Import FollowersDetailScreen
import { MainStackParamList } from './types';

// Import Onboarding Screens
import OnboardingStep1Screen from '../screens/onboarding/OnboardingStep1Screen';
import OnboardingStep2UserScreen from '../screens/onboarding/OnboardingStep2UserScreen';
import OnboardingStep2CreatorScreen from '../screens/onboarding/OnboardingStep2CreatorScreen';
import OnboardingFinalScreen from '../screens/onboarding/OnboardingFinalScreen';

// Import "What Can I Cook?" Screens
import IngredientSelectionScreen from '../screens/recipe-generation/IngredientSelectionScreen';
import RecipeResultsScreen from '../screens/recipe-generation/RecipeResultsScreen';
import AIRecipeGenerationScreen from '../screens/recipe-generation/AIRecipeGenerationScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

// Define props for MainStack
interface MainStackProps {
  userOnboarded: boolean;
}

const MainStack: React.FC<MainStackProps> = ({ userOnboarded }) => {
  const initialRoute = userOnboarded ? 'MainTabs' : 'OnboardingStep1';
  
  console.log('🔍 [MainStack] CRITICAL DEBUG:');
  console.log('🔍 [MainStack] userOnboarded prop:', userOnboarded);
  console.log('🔍 [MainStack] typeof userOnboarded:', typeof userOnboarded);
  console.log('🔍 [MainStack] initialRoute set to:', initialRoute);

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}>
      {/* Onboarding Screens - Placed before MainTabs for potential initial routing */}
      <Stack.Screen name="OnboardingStep1" component={OnboardingStep1Screen} />
      <Stack.Screen
        name="OnboardingStep2User"
        component={OnboardingStep2UserScreen}
      />
      <Stack.Screen
        name="OnboardingStep2Creator"
        component={OnboardingStep2CreatorScreen}
      />
      <Stack.Screen name="OnboardingFinal" component={OnboardingFinalScreen} />

      <Stack.Screen name="MainTabs" component={MainTabs} />
      {/* <Stack.Screen name="SearchResults" component={SearchResultsScreen} /> */}
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <Stack.Screen
        name="PantryScan"
        component={PantryScanningScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false, // Disable swipe to dismiss
        }}
      />
      <Stack.Screen
        name="EditProfile" // Changed from EditProfileScreen to EditProfile for brevity
        component={EditProfileScreen}
        options={{
          headerShown: true, // Show header for this screen
          title: 'Edit Profile', // Set a title
          // Add back button customization if needed
        }}
      />
      <Stack.Screen
        name="VideoRecipeUploader"
        component={VideoRecipeUploaderScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false, // Disable swipe to dismiss for upload process
        }}
      />
      <Stack.Screen
        name="EditRecipe"
        component={EditRecipeScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Edit Recipe',
        }}
      />
      <Stack.Screen
        name="UpgradeScreen"
        component={UpgradeScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="FollowersDetail"
        component={FollowersDetailScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />

      {/* "What Can I Cook?" Feature Screens */}
      <Stack.Screen
        name="IngredientSelection"
        component={IngredientSelectionScreen}
        options={{
          headerShown: true,
          title: 'Select Ingredients',
        }}
      />
      <Stack.Screen
        name="RecipeResults"
        component={RecipeResultsScreen}
        options={{
          headerShown: true,
          title: 'Recipe Suggestions',
        }}
      />
      <Stack.Screen
        name="AIRecipeGeneration"
        component={AIRecipeGenerationScreen}
        options={{
          headerShown: true,
          title: 'AI Recipe Generator',
        }}
      />

      {/* Add other stack screens like Settings here */}
    </Stack.Navigator>
  );
};

export default MainStack;
