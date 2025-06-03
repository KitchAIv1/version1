import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';

interface FloatingTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  visible: Animated.Value; // Animated value from parent controlling visibility
  offsetTop?: number; // Prop for top offset (e.g., height of video header)
}

const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  visible,
  offsetTop,
}) => {
  // Memoize interpolated values to prevent reading during render
  const animatedStyles = useMemo(() => {
    const opacity = visible.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0, 0.4, 0.9, 1], // More gradual opacity change
    });

    // Transform for slight slide-in effect with subtle bounce
    const translateY = visible.interpolate({
      inputRange: [0, 0.5, 0.8, 1],
      outputRange: [-15, -8, -2, 0], // More gradual movement with slight bounce
    });

    // Scale effect for more dimensionality
    const scale = visible.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.97, 0.98, 1],
    });

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  }, [visible]);

  // Get the status bar height
  const STATUS_BAR_HEIGHT =
    Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

  // Use provided offsetTop or default to STATUS_BAR_HEIGHT
  const finalOffsetTop =
    offsetTop !== undefined ? offsetTop : STATUS_BAR_HEIGHT;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: finalOffsetTop,
          ...animatedStyles,
        },
      ]}>
      <View style={styles.tabBarContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={`floating-tab-${tab}`}
            style={[
              styles.tabButton,
              activeTab === tab && styles.activeTabButton,
            ]}
            onPress={() => onTabChange(tab)}>
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab && styles.activeTabButtonText,
              ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    // Ensure the container itself doesn't have a background if only tabBarContainer should be colored
  },
  tabBarContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
    backgroundColor: COLORS.primary || '#00796b', // Solid metallic green background
    // Potentially add some horizontal padding if needed, or rounded corners for a more refined bar look
    // e.g., paddingHorizontal: 10, borderRadius: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10, // Restored: Reduced padding for compactness
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.white || '#FFFFFF', // White indicator for active tab
  },
  tabButtonText: {
    fontSize: 14, // Increased font size
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)', // Light color for inactive tabs (70% white)
    textTransform: 'capitalize',
  },
  activeTabButtonText: {
    fontSize: 14, // Increased font size
    color: COLORS.white || '#FFFFFF', // White for active tab text
    fontWeight: '600',
  },
});

export default FloatingTabBar;
