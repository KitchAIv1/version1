import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DayItem from './DayItem';

// Helper function to get the start of the week (Monday)
const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

  const handlePrevWeekArrow = () => {
    const prevTargetWeekStart = new Date(targetWeekStartDate);
    prevTargetWeekStart.setDate(targetWeekStartDate.getDate() - 7);
    setTargetWeekStartDate(prevTargetWeekStart);
    if (onTargetWeekChange) {
      onTargetWeekChange(prevTargetWeekStart);
    }
  };

  const handleNextWeekArrow = () => {
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
      <TouchableOpacity onPress={handlePrevWeekArrow} style={styles.arrowButton}>
        <Icon name="chevron-left" size={28} color="#333" />
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
      <TouchableOpacity onPress={handleNextWeekArrow} style={styles.arrowButton}>
        <Icon name="chevron-right" size={28} color="#333" />
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  arrowButton: {
    padding: 5,
  },
  daySelectorList: { 
    paddingHorizontal: 5, 
    alignItems: 'center',
  },
});

export default WeekNavigator; 