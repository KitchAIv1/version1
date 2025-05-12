import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';

interface FloatingTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  visible: Animated.Value; // Animated value from parent controlling visibility
}

const FloatingTabBar: React.FC<FloatingTabBarProps> = ({ 
  tabs, 
  activeTab, 
  onTabChange,
  visible
}) => {
  // Use opacity and transform for smooth transitions
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

  // Get the status bar height
  const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity,
          transform: [
            { translateY },
            { scale }
          ]
        }
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,1)',     // Fully opaque at top
          'rgba(255,255,255,0.99)',  // Barely noticeable change
          'rgba(255,255,255,0.95)',  // Slight transparency
          'rgba(255,255,255,0.85)',  // More transparent
          'rgba(255,255,255,0.6)',   // Much more transparent
          'rgba(255,255,255,0.1)',   // Almost invisible
          'rgba(255,255,255,0)'      // Completely transparent
        ]}
        locations={[0, 0.25, 0.5, 0.7, 0.85, 0.95, 1]}
        style={styles.gradient}
      >
        {/* Status bar spacer */}
        <View style={[styles.statusBarSpacer, { height: STATUS_BAR_HEIGHT }]} />
        
        {/* Tab bar */}
        <View style={styles.tabBarContainer}>
          {tabs.map(tab => (
            <TouchableOpacity 
              key={`floating-tab-${tab}`}
              style={[styles.tabButton, activeTab === tab && styles.activeTabButton]} 
              onPress={() => onTabChange(tab)}
            >
              <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Extra fade-out space */}
        <View style={styles.bottomFadeSpace} />
      </LinearGradient>
    </Animated.View>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, // Start from the very top of screen
    left: 0,
    right: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  gradient: {
    width: '100%',
  },
  statusBarSpacer: {
    width: '100%',
  },
  tabBarContainer: {
    flexDirection: 'row',
    paddingVertical: 4, // Add a bit more padding
    borderBottomColor: 'rgba(0,0,0,0.05)', // Very subtle bottom border
    borderBottomWidth: 1,
  },
  bottomFadeSpace: {
    height: 20, // Extra space for gradient to fade out
    width: '100%',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary || '#00796b',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary || '#666',
    textTransform: 'capitalize',
  },
  activeTabButtonText: {
    color: COLORS.primary || '#00796b',
    fontWeight: '600',
  },
});

export default FloatingTabBar; 