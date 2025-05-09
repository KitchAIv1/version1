// Refactored StockConfirmation Modal (V2 Style)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { COLORS, SIZES, FONTS } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabase';
import RNPickerSelect from 'react-native-picker-select';

// Type definitions
interface ScannedItem { // For the items prop
  name?: string;
  quantity?: string;
}

interface ProcessedItem { // For the internal state
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface FormattedConfirmedItem { // For the onConfirm callback
    item_name: string;
    quantity: number;
    unit: string;
}

interface StockConfirmationProps {
  isVisible: boolean;
  items: ScannedItem[];
  onConfirm: (formattedItems: FormattedConfirmedItem[]) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const unitOptions = [
  { label: 'Carton', value: 'carton' },
  { label: 'Bottle', value: 'bottle' },
  { label: 'Units', value: 'units' },
  { label: 'Grams', value: 'g' },
  { label: 'Kilograms', value: 'kg' },
  { label: 'Milliliters', value: 'ml' },
  { label: 'Liters', value: 'l' },
  { label: 'Ounces', value: 'oz' },
  { label: 'Pounds', value: 'lbs' },
  { label: 'Cups', value: 'cups' }
];

const StockConfirmation: React.FC<StockConfirmationProps> = ({ isVisible, items, onConfirm, onCancel, isProcessing }) => {
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);

  const guessUnit = (q: string | undefined): string => {
    const lq = (q || '').toLowerCase();
    if (lq.includes('ml')) return 'ml';
    if (lq.includes('l')) return 'l';
    if (lq.includes('kg')) return 'kg';
    if (lq.includes('g')) return 'g';
    if (lq.includes('oz')) return 'oz';
    if (lq.includes('lb')) return 'lbs';
    if (lq.includes('cup')) return 'cups';
    if (lq.includes('bottle')) return 'bottle';
    if (lq.includes('carton')) return 'carton';
    return 'units';
  };

  useEffect(() => {
    if (items && isVisible) {
      const newItems: ProcessedItem[] = items.map((item: ScannedItem, index: number): ProcessedItem => ({
        id: `item-${index}-${Date.now()}`,
        name: item.name || '',
        quantity: item.quantity || '1',
        unit: guessUnit(item.quantity)
      }));
      setProcessedItems(newItems);
    } else {
      setProcessedItems([]);
    }
  }, [items, isVisible]);

  const handleConfirm = () => {
    const formatted: FormattedConfirmedItem[] = processedItems.map((item: ProcessedItem): FormattedConfirmedItem => ({
      item_name: item.name.trim().toLowerCase(),
      quantity: parseFloat(item.quantity) || 1,
      unit: item.unit
    }));
    onConfirm(formatted);
  };

  const updateItem = (id: string, field: keyof Pick<ProcessedItem, 'name' | 'quantity' | 'unit'>, value: string) => {
    setProcessedItems(prev => prev.map((item: ProcessedItem) =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    setProcessedItems(prev => prev.filter((item: ProcessedItem) => item.id !== id));
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Confirm Ingredients</Text>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" size={28} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.itemList}>
            {processedItems.map((item: ProcessedItem) => (
              <View key={item.id} style={styles.itemRow}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Name"
                  value={item.name}
                  onChangeText={(v: string) => updateItem(item.id, 'name', v)}
                />
                <TextInput
                  style={styles.quantityInput}
                  placeholder="Qty"
                  keyboardType="decimal-pad"
                  value={item.quantity}
                  onChangeText={(v: string) => updateItem(item.id, 'quantity', v)}
                />
                <View style={styles.unitSelect}>
                  <RNPickerSelect
                    onValueChange={(value: string | null) => { // value can be null if placeholder is selected
                        if (value) { // Ensure value is not null before updating
                            updateItem(item.id, 'unit', value);
                        }
                    }}
                    items={unitOptions}
                    value={item.unit}
                    style={pickerStyles}
                    useNativeAndroidPickerStyle={false}
                    placeholder={{ label: 'Select unit', value: null }} // Explicit placeholder
                  />
                </View>
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Ionicons name="trash" size={22} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, (isProcessing || processedItems.length === 0) && styles.disabled]} // Disable if no items
              onPress={handleConfirm}
              disabled={isProcessing || processedItems.length === 0}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmText}>Save All</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const pickerStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    color: COLORS.black,
    backgroundColor: '#f0f0f0',
  },
  inputAndroid: {
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: COLORS.black,
    backgroundColor: '#f0f0f0',
  }
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,255,0.5)',
  },
  container: {
    height: '85%',
    backgroundColor: 'red',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SIZES.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.medium,
  },
  headerTitle: {
    fontFamily: FONTS.family.semibold,
    fontSize: SIZES.h3,
    color: COLORS.primary
  },
  itemList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  nameInput: {
    flex: 2,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    textAlign: 'center'
  },
  unitSelect: {
    flex: 1.5,
    marginRight: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SIZES.medium,
  },
  cancelButton: {
    padding: SIZES.base,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  confirmButton: {
    padding: SIZES.base,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
  },
  confirmText: {
    color: COLORS.white,
    fontWeight: '600'
  },
  cancelText: {
    color: COLORS.gray,
  },
  disabled: {
    opacity: 0.6,
  }
});

export default StockConfirmation;
