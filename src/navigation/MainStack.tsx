import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs'; // Import the tabs navigator
// import SearchResultsScreen from '../screens/main/SearchResultsScreen'; // Commented out
import RecipeDetailScreen from '../screens/main/RecipeDetailScreen'; // Uncommented
// import PantryScanningScreen from '../screens/pantry/PantryScanningScreen'; // Commented out
// import EditProfileScreen from '../screens/EditProfileScreen'; // Commented out
import { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={MainTabs} />
    {/* <Stack.Screen name="SearchResults" component={SearchResultsScreen} /> */}
    <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
    {/* <Stack.Screen 
      name="PantryScan" 
      component={PantryScanningScreen} 
      options={{ presentation: 'modal' }} 
    /> */}
    {/* <Stack.Screen 
      name="EditProfile" // Changed from EditProfileScreen to EditProfile for brevity
      component={EditProfileScreen} 
      options={{ 
        headerShown: true, // Show header for this screen
        title: 'Edit Profile', // Set a title
        // Add back button customization if needed
      }} 
    /> */}
    {/* Add other stack screens like Settings here */}
  </Stack.Navigator>
);

export default MainStack; 