import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StockItem, UnitOption, DEFAULT_UNIT_OPTIONS } from '../../hooks/useStockManager'; // Adjust path

interface ManualAddModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (item: StockItem, originalItemName?: string) => Promise<boolean | void>; // Return promise to handle loading state
  initialItem?: StockItem | null; // For editing
  unitOptions?: UnitOption[];
  isSaving: boolean; // To disable form while saving
}

export const ManualAddModal: React.FC<ManualAddModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialItem,
  unitOptions = DEFAULT_UNIT_OPTIONS,
  isSaving,
}) => {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>(unitOptions[0]?.value || 'units');
  const [description, setDescription] = useState('');
  const [originalItemNameForEdit, setOriginalItemNameForEdit] = useState<string | undefined>(undefined);

  const isEditMode = !!initialItem;

  useEffect(() => {
    if (initialItem && visible) {
      setItemName(initialItem.item_name);
      setQuantity(initialItem.quantity.toString());
      setUnit(initialItem.unit || (unitOptions[0]?.value || 'units'));
      setDescription(initialItem.description || '');
      setOriginalItemNameForEdit(initialItem.item_name); // Store original name for submit
    } else if (!visible) {
      // Reset form when modal is closed or not in edit mode initially
      setItemName('');
      setQuantity('1');
      setUnit(unitOptions[0]?.value || 'units');
      setDescription('');
      setOriginalItemNameForEdit(undefined);
    }
  }, [initialItem, visible, unitOptions]);

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('Validation Error', 'Item name cannot be empty.');
      return;
    }
    const numQuantity = parseFloat(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive quantity.');
      return;
    }

    const itemToSubmit: StockItem = {
      id: initialItem?.id, // Include ID if editing
      item_name: itemName.trim(),
      quantity: numQuantity,
      unit: unit,
      description: description.trim() || null,
    };
    
    await onSubmit(itemToSubmit, isEditMode ? originalItemNameForEdit : undefined);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>{isEditMode ? 'Edit Item' : 'Add New Item'}</Text>
                <TouchableOpacity onPress={onClose} disabled={isSaving}>
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Item Name*</Text>
                <TextInput
                  style={styles.input}
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="e.g., All-Purpose Flour"
                  placeholderTextColor="#bbb"
                  editable={!isSaving}
                />
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.formGroup, styles.quantityInputContainer]}>
                  <Text style={styles.label}>Quantity*</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="e.g., 2"
                    placeholderTextColor="#bbb"
                    keyboardType="numeric"
                    editable={!isSaving}
                  />
                </View>

                <View style={[styles.formGroup, styles.unitPickerContainer]}>
                  <Text style={styles.label}>Unit*</Text>
                  <RNPickerSelect
                    onValueChange={(value: string | null) => value && setUnit(value)} 
                    items={unitOptions}
                    style={pickerSelectStyles}
                    value={unit}
                    disabled={isSaving}
                    placeholder={{ label: "Select unit...", value: null }}
                    useNativeAndroidPickerStyle={false} 
                    Icon={() => <Icon name="arrow-drop-down" size={24} color="#888" style={styles.pickerIcon} />}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g., Brand, notes, expiry date"
                  placeholderTextColor="#bbb"
                  multiline
                  numberOfLines={3}
                  editable={!isSaving}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{isEditMode ? 'Save Changes' : 'Add Item'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    color: '#555',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quantityInputContainer: {
    flex: 0.48, 
  },
  unitPickerContainer: {
    flex: 0.48, 
  },
  submitButton: {
    backgroundColor: '#22c55e', 
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#a5d6a7', 
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  pickerIcon: {
    position: 'absolute',
    right: 10,
    top: Platform.OS === 'ios' ? 10 : 12, 
  }
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    color: '#333',
    paddingRight: 30, 
    backgroundColor: '#f9f9f9',
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    color: '#333',
    paddingRight: 30, 
    backgroundColor: '#f9f9f9',
  },
  placeholder: {
    color: '#bbb',
  },
  iconContainer: { 
    top: Platform.OS === 'ios' ? 10 : 12,
    right: 12,
  },
});

export default ManualAddModal;
