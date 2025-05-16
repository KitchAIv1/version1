import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

// Helper function to format date for display (e.g., "Mon")
// Note: If this is used elsewhere, consider moving to a shared utils file.
const formatShortDay = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

export interface DayItemProps {
  date: Date;
  isSelected: boolean;
  onPress: () => void;
}

const DayItem: React.FC<DayItemProps> = ({ date, isSelected, onPress }) => {
  return (
    <TouchableOpacity 
      style={[styles.dayItem, isSelected && styles.selectedDayItem]}
      onPress={onPress}
    >
      <Text style={[styles.dayItemText, isSelected && styles.selectedDayItemText]}>
        {formatShortDay(date)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  dayItem: {
    paddingVertical: 10,
    paddingHorizontal: 12, 
    borderRadius: 20, 
    marginHorizontal: 3, 
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50, 
  },
  selectedDayItem: {
    backgroundColor: '#22c55e',
  },
  dayItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedDayItemText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default DayItem; 