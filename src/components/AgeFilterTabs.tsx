import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AgeGroup, AGE_GROUP_CONFIG } from '../hooks/useStockAging';

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  selectedTab: {
    borderWidth: 2,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  selectedTabLabel: {
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  countText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  selectedCountText: {
    color: '#fff',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  helpText: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 4,
    flex: 1,
    lineHeight: 14,
  },
});

interface AgeFilterTabsProps {
  selectedFilter: AgeGroup | 'all';
  onFilterChange: (filter: AgeGroup | 'all') => void;
  statistics: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
}

interface FilterOption {
  key: AgeGroup | 'all';
  label: string;
  icon: string;
  count: number;
  color: string;
  backgroundColor: string;
  textColor: string;
}

export const AgeFilterTabs = memo<AgeFilterTabsProps>(
  ({ selectedFilter, onFilterChange, statistics }) => {
    const filterOptions: FilterOption[] = [
      {
        key: 'all',
        label: 'All Items',
        icon: 'grid-outline',
        count: statistics.total,
        color: '#6b7280',
        backgroundColor: '#f3f4f6',
        textColor: '#374151',
      },
      {
        key: 'green',
        label: 'Fresh',
        icon: 'checkmark-circle-outline',
        count: statistics.green,
        color: AGE_GROUP_CONFIG.green.color,
        backgroundColor: AGE_GROUP_CONFIG.green.backgroundColor,
        textColor: AGE_GROUP_CONFIG.green.textColor,
      },
      {
        key: 'yellow',
        label: 'Use Soon',
        icon: 'warning-outline',
        count: statistics.yellow,
        color: AGE_GROUP_CONFIG.yellow.color,
        backgroundColor: AGE_GROUP_CONFIG.yellow.backgroundColor,
        textColor: AGE_GROUP_CONFIG.yellow.textColor,
      },
      {
        key: 'red',
        label: 'Use Now',
        icon: 'alert-circle-outline',
        count: statistics.red,
        color: AGE_GROUP_CONFIG.red.color,
        backgroundColor: AGE_GROUP_CONFIG.red.backgroundColor,
        textColor: AGE_GROUP_CONFIG.red.textColor,
      },
    ];

    return (
      <View style={styles.container}>
        <View style={styles.tabsContainer}>
          {filterOptions.map(option => {
            const isSelected = selectedFilter === option.key;

            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.tab,
                  isSelected && styles.selectedTab,
                  isSelected && {
                    backgroundColor: option.backgroundColor,
                    borderColor: option.color,
                  },
                ]}
                onPress={() => onFilterChange(option.key)}
                accessibilityLabel={`Filter by ${option.label}, ${option.count} items`}
                accessibilityHint="Tap to filter pantry items"
                accessibilityState={{ selected: isSelected }}>
                <View style={styles.tabContent}>
                  <Ionicons
                    name={option.icon as any}
                    size={18}
                    color={isSelected ? option.textColor : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      isSelected && styles.selectedTabLabel,
                      isSelected && { color: option.textColor },
                    ]}
                    numberOfLines={1}>
                    {option.label}
                  </Text>
                  <View
                    style={[
                      styles.countBadge,
                      isSelected && {
                        backgroundColor: option.color,
                        borderColor: option.color,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.countText,
                        isSelected && styles.selectedCountText,
                      ]}>
                      {option.count}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color="#9ca3af"
          />
          <Text style={styles.helpText}>
            Color badges show how long each item has been in your pantry. Red
            means it's the oldest and should be used soon!
          </Text>
        </View>
      </View>
    );
  },
);

AgeFilterTabs.displayName = 'AgeFilterTabs';
