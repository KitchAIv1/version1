import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs'; // Import the tabs navigator
import SearchResultsScreen from '../screens/main/SearchResultsScreen';
import RecipeDetailScreen from '../screens/main/RecipeDetailScreen'; // Import placeholder
import { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
    <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
    {/* Add other stack screens like Settings here */}
  </Stack.Navigator>
);

export default MainStack; 