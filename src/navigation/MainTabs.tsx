import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FeedScreen from '../screens/main/FeedScreen';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import PantryScreen from '../screens/main/PantryScreen';
import CreateScreen from '../screens/main/CreateScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
// import SearchResultsScreen from '../screens/main/SearchResultsScreen'; // No longer needed here
import { MainTabsParamList } from './types';
// import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'; // Example for icons

const Tab = createBottomTabNavigator<MainTabsParamList>();

const MainTabs = () => {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false /* Customize options here */ }}>
      <Tab.Screen 
        name="Feed" 
        component={FeedScreen} 
        // options={{ tabBarIcon: ({ color, size }) => (<MaterialCommunityIcons name="home" color={color} size={size} />) }}
      />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Pantry" component={PantryScreen} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {/* SearchResults screen removed, now part of parent MainStack */}
    </Tab.Navigator>
  );
};

export default MainTabs; 