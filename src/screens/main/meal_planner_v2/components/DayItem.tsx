import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

// Helper function to format date for display (e.g., "Mon")
// Note: If this is used elsewhere, consider moving to a shared utils file.
const formatShortDay = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const formatDayNumber = (date: Date): string => {
  return date.getDate().toString();
};

export interface DayItemProps {
  date: Date;
  isSelected: boolean;
  onPress: () => void;
}

const DayItem: React.FC<DayItemProps> = React.memo(
  ({ date, isSelected, onPress }) => {
    return (
      <TouchableOpacity
        style={[styles.dayItem, isSelected && styles.selectedDayItem]}
        onPress={onPress}
        activeOpacity={0.7}>
        <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>
          {formatShortDay(date)}
        </Text>
        <Text
          style={[styles.dayNumber, isSelected && styles.selectedDayNumber]}>
          {formatDayNumber(date)}
        </Text>
      </TouchableOpacity>
    );
  },
);

const styles = StyleSheet.create({
  dayItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedDayItem: {
    backgroundColor: '#10b981',
    borderColor: '#0ea472',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dayText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  selectedDayNumber: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default DayItem;
