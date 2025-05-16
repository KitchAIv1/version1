import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import WeekNavigator from './components/WeekNavigator';

// Helper function to get the start of the week (Monday)
const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
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

// Helper function to format date for display (e.g., "Mon")
const formatShortDay = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Helper function to format a week range string
const formatWeekRangeText = (startDate: Date): string => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const monthDayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  
  return `${monthDayFormat.format(startDate)} - ${monthDayFormat.format(endDate)}`;
};

// This helper should be available or imported if used like this
function getWeekStartDateHelper(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

const MealPlannerV2Screen = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekIndicatorText, setWeekIndicatorText] = useState(() => 
    formatWeekRangeText(getWeekStartDateHelper(new Date()))
  );

  const longDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedDayInfoText = `Displaying for: ${longDateFormat.format(selectedDate)}`;

  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    setWeekIndicatorText(formatWeekRangeText(getWeekStartDateHelper(date)));
  }, []);

  const handleTargetWeekChange = useCallback((newTargetWeekStart: Date) => {
    setWeekIndicatorText(formatWeekRangeText(newTargetWeekStart));
    setSelectedDate(new Date(newTargetWeekStart));
  }, []);

  console.log("---- MEAL PLANNER V2 SCREEN RENDERED (Callbacks Memoized) ----");

  return (
    <View style={styles.container}> 
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>Meal Plan This Week</Text>
        <Text style={styles.weekIndicator}>{weekIndicatorText}</Text>
      </View>

      <WeekNavigator 
        selectedDate={selectedDate} 
        onDateSelect={handleDayPress} 
        onTargetWeekChange={handleTargetWeekChange}
      />

      <View style={styles.selectedDayInfoContainer}>
        <Text style={styles.selectedDayInfoText}>{selectedDayInfoText}</Text> 
      </View>

      <View style={styles.mealSlotsContainer}>
        <View style={[styles.mealSlotCard, styles.breakfastCard]}>
          <Text style={styles.mealSlotTitle}>Breakfast</Text>
          <Text style={styles.placeholderText}>+ Add Recipe</Text>
        </View>
        <View style={[styles.mealSlotCard, styles.lunchCard]}>
          <Text style={styles.mealSlotTitle}>Lunch</Text>
          <Text style={styles.placeholderText}>+ Add Recipe</Text>
        </View>
        <View style={[styles.mealSlotCard, styles.dinnerCard]}>
          <Text style={styles.mealSlotTitle}>Dinner</Text>
          <Text style={styles.placeholderText}>+ Add Recipe</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4f7f6',
  },
  titleContainer: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  weekIndicator: {
    fontSize: 14,
    color: '#555',
  },
  selectedDayInfoContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
  },
  selectedDayInfoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A4A4A',
  },
  mealSlotsContainer: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mealSlotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 150,
    width: '31%',
    justifyContent: 'center',
  },
  breakfastCard: {
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  lunchCard: {
    borderColor: '#90EE90',
    borderWidth: 1,
  },
  dinnerCard: {
    borderColor: '#ADD8E6',
    borderWidth: 1,
  },
  mealSlotTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  placeholderText: {
    color: '#777',
    fontSize: 14,
  },
});

export default MealPlannerV2Screen; 