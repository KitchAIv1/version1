import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MealSlot } from '../../hooks/useMealPlanner';
import { format, addDays, startOfDay } from 'date-fns';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'; // For date picking
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface AddToMealPlannerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAddToPlan: (date: Date, slot: MealSlot) => void;
  recipeName?: string; 
}

const MEAL_SLOTS_AVAILABLE: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const AddToMealPlannerModal: React.FC<AddToMealPlannerModalProps> = ({ 
  isVisible, 
  onClose, 
  onAddToPlan,
  recipeName
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<MealSlot | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    // Reset state when modal becomes visible, if desired
    if (isVisible) {
      setSelectedDate(startOfDay(new Date()));
      setSelectedSlot(null);
      setShowDatePicker(false); // Ensure date picker is hidden initially
    }
  }, [isVisible]);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS until user dismisses
    if (date) {
      setSelectedDate(startOfDay(date));
      if (Platform.OS !== 'ios') { // On Android, it closes automatically
        setShowDatePicker(false);
      }
    }
  };

  const showPicker = () => {
    setShowDatePicker(true);
  };

  const handleConfirm = () => {
    if (!selectedSlot) {
      alert('Please select a meal slot.');
      return;
    }
    onAddToPlan(selectedDate, selectedSlot);
    onClose(); // Modal closes after confirmation
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Add "{recipeName || 'Recipe'}" to Plan</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonHeader}>
                <Icon name="close-circle" size={26} color="#6c757d" />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Select Date</Text>
          <View style={styles.dateSelectionContainer}>
            <TouchableOpacity style={styles.dateButton} onPress={() => setSelectedDate(startOfDay(new Date()))}>
              <Text style={styles.dateButtonText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateButton} onPress={() => setSelectedDate(startOfDay(addDays(new Date(), 1)))}>
              <Text style={styles.dateButtonText}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateButton} onPress={showPicker}>
              <Icon name="calendar-month" size={20} color="#007bff" style={{marginRight: 5}} />
              <Text style={styles.dateButtonText}>Pick Date</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedDateText}>Selected: {format(selectedDate, 'EEE, MMM d, yyyy')}</Text>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()} // Optional: prevent past dates
            />
          )}
           {/* On iOS, if display is 'spinner', need a confirm button for the picker itself if not inline */} 
          {showDatePicker && Platform.OS === 'ios' && (
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.iosPickerConfirmButton}>
              <Text style={styles.iosPickerConfirmText}>Done</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Select Meal Slot</Text>
          <View style={styles.slotSelectionContainer}>
            {MEAL_SLOTS_AVAILABLE.map(slot => (
              <TouchableOpacity 
                key={slot} 
                style={[
                  styles.slotButton,
                  selectedSlot === slot && styles.selectedSlotButton
                ]} 
                onPress={() => setSelectedSlot(slot)}
              >
                <Text 
                  style={[
                    styles.slotButtonText,
                    selectedSlot === slot && styles.selectedSlotButtonText
                  ]}
                >
                  {slot.charAt(0).toUpperCase() + slot.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.actionButtonRow}>
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.actionButton, styles.confirmButton, !selectedSlot && styles.disabledButton]}
                onPress={handleConfirm} 
                disabled={!selectedSlot}
            >
              <Text style={styles.actionButtonText}>Add to Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#343a40',
    flex: 1, // Allow title to take space but center it
    textAlign: 'center',
    marginLeft: 30, // Offset for close button to truly center title
  },
  closeButtonHeader: {
    padding: 5, 
    position: 'absolute', // Position it if flex doesn't center well with title
    right: 0,
    top: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginTop: 15,
    marginBottom: 10,
  },
  dateSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 5,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '500',
  },
  selectedDateText: {
    textAlign: 'center',
    fontSize: 15,
    color: '#28a745',
    fontWeight: '600',
    marginVertical: 10,
  },
  iosPickerConfirmButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  iosPickerConfirmText: {
    color: 'white',
    fontWeight: 'bold',
  },
  slotSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  slotButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    width: '48%', // Two buttons per row
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectedSlotButton: {
    backgroundColor: '#22c55e',
    borderColor: '#1a9847',
  },
  slotButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  selectedSlotButtonText: {
    color: 'white',
  },
  actionButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 15,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 12,
    elevation: 2,
    flex: 1, 
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: '#007bff',
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#adb5bd',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default AddToMealPlannerModal; 