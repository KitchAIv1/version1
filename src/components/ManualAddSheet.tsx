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
import { Ionicons } from '@expo/vector-icons';
import { formatDetailedTimestamp } from '../utils/dateUtils';
import { StorageLocationPicker } from './StorageLocationPicker';
import { StorageLocation } from '../hooks/usePantryData';
import { useStorageLocationPreference } from '../hooks/useStorageLocationPreference';

interface PantryItem {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  storage_location?: StorageLocation;
}

interface UnitOption {
  label: string;
  value: string;
}

interface ManualAddSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (item: any) => Promise<void>;
  mode: 'add' | 'edit';
  initialItemData?: PantryItem | null;
  unitOptions: UnitOption[];
}

const ManualAddSheet: React.FC<ManualAddSheetProps> = ({
  isVisible,
  onClose,
  onSubmit,
  mode,
  initialItemData,
  unitOptions,
}) => {
  const { getDefaultLocation, savePreference } = useStorageLocationPreference();

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState(unitOptions[0]?.value || 'units');
  const [description, setDescription] = useState('');
  const [storageLocation, setStorageLocation] =
    useState<StorageLocation>(getDefaultLocation());
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = mode === 'edit';

  useEffect(() => {
    if (initialItemData && isEditMode) {
      setItemName(initialItemData.item_name);
      // Safely handle quantity - ensure it's a number and convert to string
      const quantity = initialItemData.quantity;
      setQuantity(
        quantity !== undefined && quantity !== null 
          ? String(quantity) 
          : '1'
      );
      setUnit(initialItemData.unit || unitOptions[0]?.value || 'units');
      setDescription(initialItemData.description || '');
      setStorageLocation(
        initialItemData.storage_location || getDefaultLocation(),
      );
    } else if (!isVisible || !isEditMode) {
      // Reset form when modal is closed or in add mode
      setItemName('');
      setQuantity('1');
      setUnit(unitOptions[0]?.value || 'units');
      setDescription('');
      setStorageLocation(getDefaultLocation());
    }
  }, [initialItemData, isVisible, isEditMode, unitOptions, getDefaultLocation]);

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('Validation Error', 'Item name cannot be empty.');
      return;
    }
    const numQuantity = parseFloat(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      Alert.alert(
        'Validation Error',
        'Please enter a valid positive quantity.',
      );
      return;
    }

    setIsSaving(true);
    try {
      const itemToSubmit = {
        item_name: itemName.trim(),
        quantity: numQuantity,
        unit,
        description: description.trim() || null,
        storage_location: storageLocation,
        original_item_name: isEditMode ? initialItemData?.item_name : undefined,
      };

      if (!isEditMode) {
        await savePreference(storageLocation);
      }

      await onSubmit(itemToSubmit);
    } catch (error) {
      console.error('Error submitting item:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isVisible}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>
                  {isEditMode ? 'Edit Item' : 'Add New Item'}
                </Text>
                <TouchableOpacity onPress={onClose} disabled={isSaving}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Timestamp Information for Edit Mode */}
              {isEditMode && initialItemData && initialItemData.created_at && (
                <View style={styles.timestampContainer}>
                  <View style={styles.timestampRow}>
                    <Ionicons
                      name="add-circle-outline"
                      size={16}
                      color="#666"
                    />
                    <Text style={styles.timestampLabel}>Added: </Text>
                    <Text style={styles.timestampValue}>
                      {formatDetailedTimestamp(initialItemData.created_at)}
                    </Text>
                  </View>
                </View>
              )}

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
                    onValueChange={(value: string | null) =>
                      value && setUnit(value)
                    }
                    items={unitOptions}
                    style={pickerSelectStyles}
                    value={unit}
                    disabled={isSaving}
                    placeholder={{ label: 'Select unit...', value: null }}
                    useNativeAndroidPickerStyle={false}
                    Icon={() => (
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color="#888"
                        style={styles.pickerIcon}
                      />
                    )}
                  />
                </View>
              </View>

              {/* NEW: Storage Location Picker */}
              <StorageLocationPicker
                selectedLocation={storageLocation}
                onLocationChange={setStorageLocation}
                required
              />

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
                style={[
                  styles.submitButton,
                  isSaving && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isEditMode ? 'Save Changes' : 'Add Item'}
                  </Text>
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
  timestampContainer: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 4,
  },
  timestampValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
    backgroundColor: '#10b981',
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
  },
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

export default ManualAddSheet;
