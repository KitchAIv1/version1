import React, { useRef } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
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
import { useAccessControl } from '../hooks/useAccessControl';
import { useAuth } from '../providers/AuthProvider';

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

// Custom Kitch Power Button Component
const KitchPowerButton = ({ onPress }: { onPress: () => void }) => {
  const { getUsageDisplay } = useAccessControl();
  const { profile } = useAuth();
  const usageData = getUsageDisplay();
  
  const isCreator = profile?.role?.toLowerCase() === 'creator';
  
  return (
    <TouchableOpacity
      style={styles.kitchPowerButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.kitchPowerButtonInner}>
        <Feather 
          name={isCreator ? "video" : "zap"} 
          size={28} 
          color="#fff" 
        />
      </View>
    </TouchableOpacity>
  );
};

// Placeholder component for Kitch Power functionality
const KitchPowerScreen = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Kitch Power Screen - This will handle navigation</Text>
    </View>
  );
};

function MainTabs() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const handleKitchPowerPress = (navigation: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log('Haptics not available:', e);
    }

    const isCreator = profile?.role?.toLowerCase() === 'creator';
    
    if (isCreator) {
      // Navigate to Video Uploader for CREATOR users
      navigation.navigate('VideoRecipeUploader');
    } else {
      // Navigate to AI Recipe Generation for FREEMIUM/PREMIUM users
      navigation.navigate('IngredientSelection');
    }
  };

  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: { fontWeight: '500', fontSize: 10, marginBottom: 3 },
        tabBarStyle: { 
          paddingTop: 8,
          paddingBottom: 8,
          height: 85,
        },
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
          } else if (route.name === 'KitchPower') {
            // Custom button for Kitch Power - handled separately
            return (
              <KitchPowerButton onPress={() => handleKitchPowerPress(navigation)} />
            );
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
      <Tab.Screen
        name="KitchPower"
        component={KitchPowerScreen}
        options={{
          tabBarLabel: '', // No label for center button
        }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            // Prevent default navigation since this is handled by the custom button
            e.preventDefault();
          },
        })}
      />
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
        options={{
          tabBarLabel: 'Hub',
        }}
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

const styles = StyleSheet.create({
  kitchPowerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20, // Elevate the button above the tab bar
  },
  kitchPowerButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },

});

export default MainTabs;
