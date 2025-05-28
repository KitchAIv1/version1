import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs'; // Import the tabs navigator
// import SearchResultsScreen from '../screens/main/SearchResultsScreen'; // Commented out
import RecipeDetailScreen from '../screens/main/RecipeDetailScreen'; // Uncommented
import PantryScanningScreen from '../screens/pantry/PantryScanningScreen'; // Uncommented
import EditProfileScreen from '../screens/EditProfileScreen'; // Uncommented
import VideoRecipeUploaderScreen from '../screens/recipe/VideoRecipeUploaderScreen';
import EditRecipeScreen from '../screens/recipe/EditRecipeScreen'; // Import EditRecipeScreen
import UpgradeScreen from '../screens/UpgradeScreen'; // Import UpgradeScreen
import { MainStackParamList } from './types';

// Import Onboarding Screens
import OnboardingStep1Screen from '../screens/onboarding/OnboardingStep1Screen';
import OnboardingStep2UserScreen from '../screens/onboarding/OnboardingStep2UserScreen';
import OnboardingStep2CreatorScreen from '../screens/onboarding/OnboardingStep2CreatorScreen';
import OnboardingFinalScreen from '../screens/onboarding/OnboardingFinalScreen';

// Import "What Can I Cook?" Screens
import IngredientSelectionScreen from '../screens/recipe-generation/IngredientSelectionScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

// Define props for MainStack
interface MainStackProps {
  userOnboarded: boolean;
}

const MainStack: React.FC<MainStackProps> = ({ userOnboarded }) => {
  const initialRoute = userOnboarded ? "MainTabs" : "OnboardingStep1";

  return (
    <Stack.Navigator 
      initialRouteName={initialRoute} 
      screenOptions={{ headerShown: false }}
    >
      {/* Onboarding Screens - Placed before MainTabs for potential initial routing */}
      <Stack.Screen name="OnboardingStep1" component={OnboardingStep1Screen} />
      <Stack.Screen name="OnboardingStep2User" component={OnboardingStep2UserScreen} />
      <Stack.Screen name="OnboardingStep2Creator" component={OnboardingStep2CreatorScreen} />
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
          headerShown: true,
          title: 'Upload Recipe',
        }}
      />
      <Stack.Screen 
        name="EditRecipe" 
        component={EditRecipeScreen} 
        options={{ 
          headerShown: true, 
          title: 'Edit Recipe' // Default title, screen will override
        }} 
      />
      <Stack.Screen 
        name="UpgradeScreen" 
        component={UpgradeScreen} 
        options={{ 
          headerShown: false, // UpgradeScreen has its own header
          presentation: 'modal', // Present as modal for better UX
        }} 
      />
      
      {/* "What Can I Cook?" Feature Screens */}
      <Stack.Screen 
        name="IngredientSelection" 
        component={IngredientSelectionScreen} 
        options={{ 
          headerShown: false, // Screen has its own header
          presentation: 'card', // Standard card presentation
        }} 
      />
      
      {/* Add other stack screens like Settings here */}
    </Stack.Navigator>
  );
};

export default MainStack; 