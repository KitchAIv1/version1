import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FeedScreen from '../screens/main/FeedScreen';
// import DiscoverScreen from '../screens/main/DiscoverScreen';
import MyStockScreen from '../screens/main/MyStockScreen';
// import CreateScreen from '../screens/main/CreateScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import GroceryListScreen from '../screens/grocery/GroceryListScreen';
import { MainTabsParamList } from './types';
import { Feather } from '@expo/vector-icons';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const MainTabs = () => {
  return (
    <Tab.Navigator 
      initialRouteName="Feed"
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
          } else if (route.name === 'Pantry') {
            iconName = 'inbox';
          } else if (route.name === 'Profile') {
            iconName = 'user';
          } else if (route.name === 'GroceryList') { 
            iconName = 'list'; 
          }
          
          if (!iconName) return null; 
          return <Feather name={iconName as any} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Pantry" component={MyStockScreen} />
      {/* Discover, Create screens are fully removed for this test */}
      <Tab.Screen 
        name="GroceryList" 
        component={GroceryListScreen}
        options={{
          tabBarLabel: 'Grocery',
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainTabs; 