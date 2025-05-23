import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

const WeekNavigator: React.FC<WeekNavigatorProps> = React.memo(({ selectedDate, onDateSelect, onTargetWeekChange }) => {
  const currentActualWeekStartDate = useMemo(() => getWeekStartDate(new Date()), []);
  const maxTargetWeekStartDate = useMemo(() => {
    const maxDate = getWeekStartDate(new Date());
    maxDate.setDate(maxDate.getDate() + 3 * 7); // Current week + 3 weeks
    return maxDate;
  }, []);

  const [targetWeekStartDate, setTargetWeekStartDate] = useState(() => getWeekStartDate(selectedDate));

  // Memoize week dates to prevent recalculation and blinking
  const weekDatesForDisplay = useMemo(() => {
    return getWeekDates(targetWeekStartDate);
  }, [targetWeekStartDate]);

  // Synchronize with parent's selectedDate changes
  useEffect(() => {
    const newWeekStart = getWeekStartDate(selectedDate);
    if (!isSameDay(newWeekStart, targetWeekStartDate)) {
      setTargetWeekStartDate(newWeekStart);
    }
  }, [selectedDate]);

  const canNavigatePrev = useMemo(() => 
    !isSameDay(targetWeekStartDate, currentActualWeekStartDate) && targetWeekStartDate > currentActualWeekStartDate,
    [targetWeekStartDate, currentActualWeekStartDate]
  );

  const canNavigateNext = useMemo(() => 
    !isSameDay(targetWeekStartDate, maxTargetWeekStartDate) && targetWeekStartDate < maxTargetWeekStartDate,
    [targetWeekStartDate, maxTargetWeekStartDate]
  );

  const handlePrevWeekArrow = useCallback(() => {
    if (!canNavigatePrev) return;

    const prevTargetWeekStart = new Date(targetWeekStartDate);
    prevTargetWeekStart.setDate(targetWeekStartDate.getDate() - 7);
    
    // Update state immediately to prevent blinking
    setTargetWeekStartDate(prevTargetWeekStart);
    
    // Notify parent after a brief delay to ensure smooth transition
    if (onTargetWeekChange) {
      requestAnimationFrame(() => {
        onTargetWeekChange(prevTargetWeekStart);
      });
    }
  }, [canNavigatePrev, targetWeekStartDate, onTargetWeekChange]);

  const handleNextWeekArrow = useCallback(() => {
    if (!canNavigateNext) return;

    const nextTargetWeekStart = new Date(targetWeekStartDate);
    nextTargetWeekStart.setDate(targetWeekStartDate.getDate() + 7);
    
    // Update state immediately to prevent blinking
    setTargetWeekStartDate(nextTargetWeekStart);
    
    // Notify parent after a brief delay to ensure smooth transition
    if (onTargetWeekChange) {
      requestAnimationFrame(() => {
        onTargetWeekChange(nextTargetWeekStart);
      });
    }
  }, [canNavigateNext, targetWeekStartDate, onTargetWeekChange]);

  const handleDayItemPress = useCallback((dayIndexInDisplayedWeek: number) => {
    const newSelectedDate = new Date(targetWeekStartDate);
    newSelectedDate.setDate(targetWeekStartDate.getDate() + dayIndexInDisplayedWeek);
    
    // Prevent unnecessary calls if selecting the same date
    if (!isSameDay(newSelectedDate, selectedDate)) {
      onDateSelect(newSelectedDate);
    }
  }, [targetWeekStartDate, onDateSelect, selectedDate]);

  const renderDayItem = useCallback(({ item, index }: { item: Date; index: number }) => (
    <DayItem 
      date={item} 
      isSelected={isSameDay(item, selectedDate)}
      onPress={() => handleDayItemPress(index)} 
    />
  ), [selectedDate, handleDayItemPress]);

  const keyExtractor = useCallback((item: Date) => item.toISOString(), []);

  return (
    <View style={styles.daySelectorRow}>
      <TouchableOpacity 
        onPress={handlePrevWeekArrow} 
        style={[styles.arrowButton, !canNavigatePrev && styles.disabledArrow]}
        disabled={!canNavigatePrev}
      >
        <Icon name="chevron-left" size={28} color={canNavigatePrev ? '#10b981' : '#ccc'} />
      </TouchableOpacity>
      <FlatList
        data={weekDatesForDisplay}
        renderItem={renderDayItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daySelectorList}
        removeClippedSubviews={false} // Prevent clipping issues
        initialNumToRender={7}
        maxToRenderPerBatch={7}
        windowSize={1}
      />
      <TouchableOpacity 
        onPress={handleNextWeekArrow} 
        style={[styles.arrowButton, !canNavigateNext && styles.disabledArrow]}
        disabled={!canNavigateNext}
      >
        <Icon name="chevron-right" size={28} color={canNavigateNext ? '#10b981' : '#ccc'} />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  daySelectorRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  arrowButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  disabledArrow: {
    backgroundColor: 'rgba(204, 204, 204, 0.1)',
  },
  daySelectorList: { 
    paddingHorizontal: 8, 
    alignItems: 'center',
  },
});

export default WeekNavigator; 