import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageLocation, STORAGE_LOCATIONS } from '../hooks/usePantryData';

interface StorageLocationTabsProps {
  activeLocation: StorageLocation;
  onLocationChange: (location: StorageLocation) => void;
  itemCounts: Record<StorageLocation, number>;
  style?: any;
}

// Storage location icons mapping (same as picker)
const STORAGE_ICONS: Record<StorageLocation, string> = {
  refrigerator: 'snow-outline',
  freezer: 'cube-outline',
  cupboard: 'storefront-outline',
  condiments: 'flask-outline',
};

// Storage location colors (same as picker)
const STORAGE_COLORS: Record<StorageLocation, string> = {
  refrigerator: '#3b82f6', // Blue
  freezer: '#6366f1', // Indigo
  cupboard: '#8b5cf6', // Purple
  condiments: '#f59e0b', // Amber
};

export const StorageLocationTabs: React.FC<StorageLocationTabsProps> = ({
  activeLocation,
  onLocationChange,
  itemCounts,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}>
        {Object.entries(STORAGE_LOCATIONS).map(([value, label]) => {
          const location = value as StorageLocation;
          const isActive = activeLocation === location;
          const iconName = STORAGE_ICONS[location];
          const color = STORAGE_COLORS[location];
          const count = itemCounts[location] || 0;

          return (
            <TouchableOpacity
              key={location}
              style={[
                styles.tab,
                isActive && styles.activeTab,
                isActive && {
                  backgroundColor: `${color}15`,
                  borderBottomColor: color,
                },
              ]}
              onPress={() => onLocationChange(location)}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.iconContainer,
                  isActive && { backgroundColor: color },
                ]}>
                <Ionicons
                  name={iconName as any}
                  size={18}
                  color={isActive ? '#fff' : color}
                />
              </View>

              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.activeTabLabel,
                    isActive && { color },
                  ]}>
                  {label}
                </Text>
                <Text style={[styles.tabCount, isActive && { color }]}>
                  {count} item{count !== 1 ? 's' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minWidth: 120,
  },
  activeTab: {
    // backgroundColor and borderBottomColor set dynamically
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#e2e8f0',
  },
  textContainer: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  activeTabLabel: {
    fontWeight: '700',
    // color set dynamically
  },
  tabCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});

export default StorageLocationTabs;
