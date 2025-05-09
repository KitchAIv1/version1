import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FeedScreen from '../screens/main/FeedScreen';
import DiscoverScreen from '../screens/main/DiscoverScreen';
// import PantryScreen from '../screens/main/PantryScreen'; // Old Pantry Screen
import MyStockScreen from '../screens/main/MyStockScreen'; // Corrected import path
import CreateScreen from '../screens/main/CreateScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
// import StockManagerV2TestScreen from '../screens/StockManagerV2TestScreen'; // <-- REMOVE IMPORT
import GroceryListScreen from '../screens/grocery/GroceryListScreen'; // <-- IMPORT
import { MainTabsParamList } from './types';
import { Feather } from '@expo/vector-icons'; // Import Feather icons

const Tab = createBottomTabNavigator<MainTabsParamList>();

const MainTabs = () => {
  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#22c55e', 
        tabBarInactiveTintColor: '#6b7280', 
        tabBarLabelStyle: { fontWeight: '500', fontSize: 10, marginBottom: 3 },
        tabBarStyle: { paddingTop: 5 }, 
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          const iconSize = focused ? 24 : 22;

          if (route.name === 'Feed') {
            iconName = 'home'; 
          } else if (route.name === 'Discover') {
            iconName = 'search';
          } else if (route.name === 'Pantry') {
            iconName = 'package'; // Using 'package' icon for the new MyStockScreen
          } else if (route.name === 'Create') {
            iconName = 'plus-square';
          } else if (route.name === 'Profile') {
            iconName = 'user';
          } else if (route.name === 'GroceryList') { // <-- ADD ICON LOGIC
            iconName = 'list'; 
          }
          // else if (route.name === 'StockV2Test') { // <-- REMOVE ICON LOGIC
          //   iconName = 'tool'; 
          // }
          // Added check for iconName to prevent errors
          if (!iconName) return null; 
          return <Feather name={iconName as any} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      {/* Correctly assign MyStockScreen (from /main) to the Pantry tab */}
      <Tab.Screen name="Pantry" component={MyStockScreen} /> 
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen // <-- ADD NEW TAB SCREEN
        name="GroceryList" 
        component={GroceryListScreen}
        options={{
          tabBarLabel: 'Grocery',
        }}
      />
      {/* <Tab.Screen // <-- REMOVE TAB SCREEN
        name="StockV2Test"
        component={StockManagerV2TestScreen}
        options={{
          tabBarLabel: 'Stock V2 Test',
        }}
      /> */}
    </Tab.Navigator>
  );
};

export default MainTabs; 