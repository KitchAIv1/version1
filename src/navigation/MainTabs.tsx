import React, { useRef } from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
// Revert to original screens temporarily to fix crash
import FeedScreen from '../screens/main/FeedScreen';
import PantryScreen from '../screens/main/PantryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import GroceryListScreen from '../screens/grocery/GroceryListScreen';
import { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Create a global reference for the feed refresh function
let feedRefreshFunction: (() => void) | null = null;

export const registerFeedRefresh = (refreshFn: () => void) => {
  feedRefreshFunction = refreshFn;
};

export const triggerFeedRefresh = () => {
  if (feedRefreshFunction) {
    feedRefreshFunction();
  }
};

function MainTabs() {
  const queryClient = useQueryClient();

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
          return (
            <Feather name={iconName as any} size={iconSize} color={color} />
          );
        },
      })}>
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        listeners={({ navigation, route }) => ({
          tabPress: e => {
            e.preventDefault();

            const state = navigation.getState();
            const currentRoute = state.routes[state.index];

            // Check if we're actually on the Feed tab already
            if (currentRoute.name === 'Feed') {
              // Only do master refresh if this is a deliberate tab press
              // Check if we're coming from a nested screen (like RecipeDetail)
              const currentTabRoute =
                currentRoute.state?.routes &&
                currentRoute.state.index !== undefined
                  ? currentRoute.state.routes[currentRoute.state.index]
                  : null;

              // If we're on the Feed tab but not on the main Feed screen, don't refresh
              if (currentTabRoute && currentTabRoute.name !== 'Feed') {
                console.log(
                  'Returning to Feed from nested screen - preserving state',
                );
              } else {
                console.log(
                  '🔄 Feed tab pressed while active - Master refresh triggered (TikTok-style)',
                );

                // 📳 Light haptic feedback for premium feel
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {
                  // Haptics might not be available on all devices
                  console.log('Haptics not available:', e);
                }

                // ✅ ENHANCED FEED V4 MASTER REFRESH - TikTok-style active tab refresh
                // Invalidate all relevant caches for fresh content
                queryClient.invalidateQueries({ queryKey: ['feed'] });
                queryClient.invalidateQueries({ queryKey: ['pantryData'] });
                queryClient.invalidateQueries({ queryKey: ['recipeDetails'] });
                queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
                queryClient.invalidateQueries({ queryKey: ['groceryList'] });
                
                // 🔝 Trigger scroll to top
                triggerFeedRefresh();
                
                console.log('✅ Master refresh completed - Enhanced Feed V4 refreshed with fresh human recipes');
                console.log('🔝 Feed will auto-scroll to top on data refresh');
              }
            }

            navigation.jumpTo('Feed');
          },
        })}
      />
      <Tab.Screen
        name="Pantry"
        component={PantryScreen}
        listeners={({ navigation, route }) => ({
          tabPress: e => {
            e.preventDefault();

            const state = navigation.getState();
            if (state.routes[state.index].name === 'Pantry') {
              console.log(
                'Pantry tab pressed while it is the current tab. Refreshing pantry and related data.',
              );
              queryClient.invalidateQueries({ queryKey: ['pantryData'] });
              queryClient.invalidateQueries({ queryKey: ['recipeDetails'] });
              queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            }

            navigation.jumpTo('Pantry');
          },
        })}
      />
      {/* Discover, Create screens are fully removed for this test */}
      <Tab.Screen
        name="GroceryList"
        component={GroceryListScreen}
        options={{
          tabBarLabel: 'Grocery',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={({ navigation }) => ({
          tabPress: e => {
            // Prevent default navigation
            e.preventDefault();

            // Navigate to Profile without any parameters to ensure own profile is shown
            navigation.navigate('Profile', {});
          },
        })}
      />
    </Tab.Navigator>
  );
}

export default MainTabs;
