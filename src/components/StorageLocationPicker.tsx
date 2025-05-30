import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageLocation, STORAGE_LOCATIONS } from '../hooks/usePantryData';

interface StorageLocationPickerProps {
  selectedLocation: StorageLocation;
  onLocationChange: (location: StorageLocation) => void;
  style?: any;
  required?: boolean;
}

// Storage location icons mapping
const STORAGE_ICONS: Record<StorageLocation, string> = {
  refrigerator: 'snow-outline',
  freezer: 'cube-outline', 
  cupboard: 'storefront-outline',
  condiments: 'flask-outline'
};

// Storage location colors
const STORAGE_COLORS: Record<StorageLocation, string> = {
  refrigerator: '#3b82f6', // Blue
  freezer: '#6366f1',      // Indigo  
  cupboard: '#8b5cf6',     // Purple
  condiments: '#f59e0b'    // Amber
};

export const StorageLocationPicker: React.FC<StorageLocationPickerProps> = ({
  selectedLocation,
  onLocationChange,
  style,
  required = false
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          Storage Location{required && <Text style={styles.required}> *</Text>}
        </Text>
        <Text style={styles.helpText}>Where do you store this item?</Text>
      </View>
      
      <View style={styles.optionsContainer}>
        {Object.entries(STORAGE_LOCATIONS).map(([value, label]) => {
          const location = value as StorageLocation;
          const isSelected = selectedLocation === location;
          const iconName = STORAGE_ICONS[location];
          const color = STORAGE_COLORS[location];
          
          return (
            <TouchableOpacity
              key={location}
              style={[
                styles.optionButton,
                isSelected && styles.selectedOption,
                isSelected && { borderColor: color, backgroundColor: `${color}10` }
              ]}
              onPress={() => onLocationChange(location)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                isSelected && { backgroundColor: color }
              ]}>
                <Ionicons 
                  name={iconName as any} 
                  size={20} 
                  color={isSelected ? '#fff' : color} 
                />
              </View>
              <Text style={[
                styles.optionText,
                isSelected && styles.selectedOptionText,
                isSelected && { color: color }
              ]}>
                {label}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={18} color={color} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  labelContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  required: {
    color: '#ef4444',
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  selectedOption: {
    borderWidth: 2,
    // borderColor and backgroundColor set dynamically
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f3f4f6',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  selectedOptionText: {
    fontWeight: '600',
    // color set dynamically
  },
});

export default StorageLocationPicker; 