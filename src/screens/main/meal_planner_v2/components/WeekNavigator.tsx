import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DayItem from './DayItem';
import { COLORS } from '../../../../constants/theme'; // Assuming COLORS is here for potential use in styles

// Helper function to get the start of the week (Monday)
const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Normalize to start of the day
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (0) to be start of week
  return new Date(d.setDate(diff));
};

// Helper function to generate an array of 7 dates for a week
const getWeekDates = (startDate: Date): Date[] => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + i);
    dates.push(nextDate);
  }
  return dates;
};

// Helper function to check if two dates are the same day
// Note: If this is used elsewhere, consider moving to a shared utils file.
const isSameDay = (date1: Date, date2: Date): boolean => {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

interface WeekNavigatorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onTargetWeekChange?: (targetWeekStartDate: Date) => void;
}

const WeekNavigator: React.FC<WeekNavigatorProps> = ({ selectedDate, onDateSelect, onTargetWeekChange }) => {
  const [currentActualWeekStartDate] = useState(getWeekStartDate(new Date()));
  const [maxTargetWeekStartDate] = useState(() => {
    const maxDate = getWeekStartDate(new Date());
    maxDate.setDate(maxDate.getDate() + 3 * 7); // Current week + 3 weeks
    return maxDate;
  });

  const [displayWeekStartDate, setDisplayWeekStartDate] = useState(getWeekStartDate(selectedDate));
  const [targetWeekStartDate, setTargetWeekStartDate] = useState(getWeekStartDate(selectedDate));
  const [weekDatesForDisplay, setWeekDatesForDisplay] = useState<Date[]>(getWeekDates(displayWeekStartDate));

  useEffect(() => {
    setWeekDatesForDisplay(getWeekDates(displayWeekStartDate));
  }, [displayWeekStartDate]);
  
  // Effect to synchronize internal week states when selectedDate prop changes from parent
  useEffect(() => {
    const newActualWeekStart = getWeekStartDate(selectedDate);
    
    // Only update if the week has actually changed to avoid potential issues
    if (!isSameDay(newActualWeekStart, displayWeekStartDate)) {
      setDisplayWeekStartDate(newActualWeekStart);
    }
    if (!isSameDay(newActualWeekStart, targetWeekStartDate)) {
      setTargetWeekStartDate(newActualWeekStart);
    }
    // DO NOT call onTargetWeekChange here. 
    // This effect is for reacting to parent's selectedDate.
    // Parent updates its own week indicator when selectedDate changes (e.g. in handleDayPress).
  }, [selectedDate]); // Removed onTargetWeekChange from deps; also displayWeekStartDate and targetWeekStartDate to avoid self-triggering if included incorrectly.

  const canNavigatePrev = !isSameDay(targetWeekStartDate, currentActualWeekStartDate) && targetWeekStartDate > currentActualWeekStartDate;
  const canNavigateNext = !isSameDay(targetWeekStartDate, maxTargetWeekStartDate) && targetWeekStartDate < maxTargetWeekStartDate;

  const handlePrevWeekArrow = () => {
    if (!canNavigatePrev) return;

    const prevTargetWeekStart = new Date(targetWeekStartDate);
    prevTargetWeekStart.setDate(targetWeekStartDate.getDate() - 7);
    setTargetWeekStartDate(prevTargetWeekStart);
    if (onTargetWeekChange) {
      onTargetWeekChange(prevTargetWeekStart);
    }
  };

  const handleNextWeekArrow = () => {
    if (!canNavigateNext) return;

    const nextTargetWeekStart = new Date(targetWeekStartDate);
    nextTargetWeekStart.setDate(targetWeekStartDate.getDate() + 7);
    setTargetWeekStartDate(nextTargetWeekStart);
    if (onTargetWeekChange) {
      onTargetWeekChange(nextTargetWeekStart);
    }
  };

  const handleDayItemPress = (dayIndexInDisplayedWeek: number) => {
    const newSelectedDate = new Date(targetWeekStartDate);
    newSelectedDate.setDate(targetWeekStartDate.getDate() + dayIndexInDisplayedWeek);
    onDateSelect(newSelectedDate); 
  };

  return (
    <View style={styles.daySelectorRow}>
      <TouchableOpacity 
        onPress={handlePrevWeekArrow} 
        style={[styles.arrowButton, !canNavigatePrev && styles.disabledArrow]}
        disabled={!canNavigatePrev}
      >
        <Icon name="chevron-left" size={28} color={canNavigatePrev ? (COLORS.text || '#333') : (COLORS.textSecondary || '#aaa')} />
      </TouchableOpacity>
      <FlatList
        data={weekDatesForDisplay}
        renderItem={({ item, index }) => (
          <DayItem 
            date={item} 
            isSelected={isSameDay(item, selectedDate)}
            onPress={() => handleDayItemPress(index)} 
          />
        )}
        keyExtractor={(item) => item.toISOString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daySelectorList}
      />
      <TouchableOpacity 
        onPress={handleNextWeekArrow} 
        style={[styles.arrowButton, !canNavigateNext && styles.disabledArrow]}
        disabled={!canNavigateNext}
      >
        <Icon name="chevron-right" size={28} color={canNavigateNext ? (COLORS.text || '#333') : (COLORS.textSecondary || '#aaa')} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  daySelectorRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 5, 
    backgroundColor: COLORS.white || '#FFFFFF', // Use theme color
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#e9ecef', // Use theme color
  },
  arrowButton: {
    padding: 5,
  },
  disabledArrow: {
    // opacity: 0.3, // Example: visually indicate disabled state
    // You can also change the icon color directly as done in the Icon component
  },
  daySelectorList: { 
    paddingHorizontal: 5, 
    alignItems: 'center',
  },
});

export default WeekNavigator; 