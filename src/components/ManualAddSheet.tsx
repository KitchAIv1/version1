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
import {
  formatDetailedTimestamp,
  getMostRecentActivity,
} from '../utils/dateUtils';
import { AGE_GROUP_CONFIG, AgeGroup } from '../hooks/useStockAging';
import StorageLocationPicker from './StorageLocationPicker';
import { useStorageLocationPreference } from '../hooks/useStorageLocationPreference';
import { StorageLocation } from '../hooks/usePantryData';
import { supabase } from '../services/supabase';
import { useAuth } from '../providers/AuthProvider';

// Move styles to top to fix "styles used before defined" errors
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  timestampContent: {
    flex: 1,
    marginLeft: 8,
  },
  timestampMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timestampDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestampRowSecondary: {
    marginTop: 8,
    opacity: 0.8,
  },
  timestampLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  quantityDetail: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  agingBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  agingBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  timestampValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  activitySummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  activitySummaryText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 6,
    fontStyle: 'italic',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: '#333',
    // Fix iOS autofill yellow background
    ...(Platform.OS === 'ios' && {
      autoCompleteType: 'off',
      textContentType: 'none',
    }),
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
    marginRight: 10,
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
  },
  placeholder: {
    color: '#bbb',
  },
  iconContainer: {
    top: Platform.OS === 'ios' ? 10 : 12,
    right: 12,
  },
});

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
  quantity_added?: number;
  previous_quantity?: number;
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

// Helper function to calculate aging information from PantryItem
const calculateAgingInfo = (createdAt: string) => {
  const now = new Date();
  const created = new Date(createdAt);
  const daysOld = Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );

  const ageGroup: AgeGroup =
    daysOld < 7 ? 'green' : daysOld <= 14 ? 'yellow' : 'red';
  const ageConfig = AGE_GROUP_CONFIG[ageGroup];

  return {
    daysOld,
    ageGroup,
    ageConfig,
    ageDescription:
      daysOld === 0
        ? 'Added today'
        : daysOld === 1
          ? '1 day old'
          : `${daysOld} days old`,
  };
};

const ManualAddSheet: React.FC<ManualAddSheetProps> = ({
  isVisible,
  onClose,
  onSubmit,
  mode,
  initialItemData,
  unitOptions,
}) => {
  const { getDefaultLocation, savePreference } = useStorageLocationPreference();
  const { user } = useAuth();

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState(unitOptions[0]?.value || 'units');
  const [description, setDescription] = useState('');
  const [storageLocation, setStorageLocation] =
    useState<StorageLocation>(getDefaultLocation());
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = mode === 'edit';

  // QUANTITY TRACKING FIX: State for fresh item data
  const [freshItemData, setFreshItemData] = useState<PantryItem | null>(
    initialItemData || null,
  );

  // QUANTITY TRACKING FIX: Fetch fresh data when editing an item
  useEffect(() => {
    const fetchFreshData = async () => {
      if (isEditMode && initialItemData?.id && isVisible) {
        try {
          console.log(
            '[ManualAddSheet] 🔄 Fetching fresh data for item:',
            initialItemData.id,
          );

          const { data: freshData, error } = await supabase
            .from('stock')
            .select(
              'id, item_name, quantity, unit, description, created_at, updated_at, user_id, storage_location, quantity_added, previous_quantity',
            )
            .eq('id', initialItemData.id)
            .single();

          if (error) {
            console.error(
              '[ManualAddSheet] ❌ Error fetching fresh data:',
              error,
            );
            return;
          }

          if (freshData) {
            console.log('[ManualAddSheet] ✅ Got fresh data:', {
              itemName: freshData.item_name,
              quantity: freshData.quantity,
              quantityAdded: freshData.quantity_added,
              previousQuantity: freshData.previous_quantity,
            });
            setFreshItemData(freshData);
          }
        } catch (error) {
          console.error('[ManualAddSheet] ❌ Error in fetchFreshData:', error);
        }
      } else {
        setFreshItemData(initialItemData || null);
      }
    };

    fetchFreshData();
  }, [isEditMode, initialItemData?.id, initialItemData?.updated_at, isVisible]);

  useEffect(() => {
    if (initialItemData && isEditMode && isVisible) {
      setItemName(initialItemData.item_name);
      // Safely handle quantity - ensure it's a number and convert to string
      const { quantity } = initialItemData;
      setQuantity(
        quantity !== undefined && quantity !== null ? String(quantity) : '1',
      );
      setUnit(initialItemData.unit || unitOptions[0]?.value || 'units');
      setDescription(initialItemData.description || '');
      setStorageLocation(
        initialItemData.storage_location || getDefaultLocation(),
      );
    } else if (!isEditMode && isVisible) {
      // Only reset form when opening in add mode
      setItemName('');
      setQuantity('1');
      setUnit(unitOptions[0]?.value || 'units');
      setDescription('');
      setStorageLocation(getDefaultLocation());
      setIsSaving(false); // Ensure saving state is reset
    }
  }, [isVisible, isEditMode]); // Simplified dependencies

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
        item_name: itemName.trim().toLowerCase(), // ✅ FIXED: Always normalize case
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

              {/* Enhanced Timestamp + Quantity + Aging Information for Edit Mode */}
              {isEditMode &&
                freshItemData &&
                freshItemData.created_at &&
                (() => {
                  // Debug logging - now using freshItemData
                  console.log('[ManualAddSheet] Debug - freshItemData:', {
                    item_name: freshItemData.item_name,
                    quantity: freshItemData.quantity,
                    quantity_added: freshItemData.quantity_added,
                    previous_quantity: freshItemData.previous_quantity,
                    created_at: freshItemData.created_at,
                    updated_at: freshItemData.updated_at,
                  });

                  const originalAgingInfo = calculateAgingInfo(
                    freshItemData.created_at,
                  );
                  const freshAgingInfo = {
                    ageGroup: 'green' as AgeGroup,
                    ageConfig: AGE_GROUP_CONFIG.green,
                    ageDescription: 'Just added',
                  };
                  const activityInfo = getMostRecentActivity(
                    freshItemData.created_at,
                    freshItemData.updated_at,
                  );

                  return (
                    <View style={styles.timestampContainer}>
                      {/* Updated At - Only show if there's been a meaningful quantity change */}
                      {freshItemData.updated_at &&
                        freshItemData.updated_at !== freshItemData.created_at &&
                        freshItemData.quantity_added !== undefined &&
                        freshItemData.quantity_added !== null &&
                        freshItemData.previous_quantity !== undefined &&
                        freshItemData.previous_quantity !== null &&
                        freshItemData.quantity_added !== 0 && (
                          <View style={styles.timestampRow}>
                            <Ionicons
                              name="refresh-circle-outline"
                              size={16}
                              color="#f59e0b"
                            />
                            <View style={styles.timestampContent}>
                              <View style={styles.timestampMainRow}>
                                <Text style={styles.timestampLabel}>
                                  Updated:{' '}
                                </Text>
                                <Text style={styles.timestampValue}>
                                  {formatDetailedTimestamp(
                                    freshItemData.updated_at,
                                  )}
                                </Text>
                              </View>
                              <View style={styles.timestampDetailsRow}>
                                <Text style={styles.quantityDetail}>
                                  {freshItemData.quantity_added > 0
                                    ? `+${freshItemData.quantity_added} ${freshItemData.unit} (new addition)`
                                    : freshItemData.quantity_added < 0
                                      ? `${freshItemData.quantity_added} ${freshItemData.unit} (removed)`
                                      : `${freshItemData.quantity} ${freshItemData.unit} (current total)`}
                                </Text>
                                <View
                                  style={[
                                    styles.agingBadgeSmall,
                                    {
                                      backgroundColor:
                                        freshAgingInfo.ageConfig
                                          .backgroundColor,
                                      borderColor:
                                        freshAgingInfo.ageConfig.color,
                                    },
                                  ]}>
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={12}
                                    color={freshAgingInfo.ageConfig.color}
                                  />
                                  <Text
                                    style={[
                                      styles.agingBadgeTextSmall,
                                      {
                                        color:
                                          freshAgingInfo.ageConfig.textColor,
                                      },
                                    ]}>
                                    {freshAgingInfo.ageConfig.label}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        )}

                      {/* Created At - ORIGINAL TIMESTAMP */}
                      <View
                        style={[
                          styles.timestampRow,
                          freshItemData.updated_at &&
                            freshItemData.updated_at !==
                              freshItemData.created_at &&
                            styles.timestampRowSecondary,
                        ]}>
                        <Ionicons
                          name="add-circle-outline"
                          size={16}
                          color="#10b981"
                        />
                        <View style={styles.timestampContent}>
                          <View style={styles.timestampMainRow}>
                            <Text style={styles.timestampLabel}>Added: </Text>
                            <Text style={styles.timestampValue}>
                              {formatDetailedTimestamp(
                                freshItemData.created_at,
                              )}
                            </Text>
                          </View>
                          <View style={styles.timestampDetailsRow}>
                            <Text style={styles.quantityDetail}>
                              {freshItemData.previous_quantity !== undefined
                                ? `${freshItemData.previous_quantity} ${freshItemData.unit} (original)`
                                : `${freshItemData.quantity} ${freshItemData.unit} (when first added)`}
                            </Text>
                            <View
                              style={[
                                styles.agingBadgeSmall,
                                {
                                  backgroundColor:
                                    originalAgingInfo.ageConfig.backgroundColor,
                                  borderColor:
                                    originalAgingInfo.ageConfig.color,
                                },
                              ]}>
                              <Ionicons
                                name={
                                  originalAgingInfo.ageGroup === 'red'
                                    ? 'alert-circle'
                                    : originalAgingInfo.ageGroup === 'yellow'
                                      ? 'warning'
                                      : 'checkmark-circle'
                                }
                                size={12}
                                color={originalAgingInfo.ageConfig.color}
                              />
                              <Text
                                style={[
                                  styles.agingBadgeTextSmall,
                                  {
                                    color:
                                      originalAgingInfo.ageConfig.textColor,
                                  },
                                ]}>
                                {originalAgingInfo.ageConfig.label}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Most Recent Activity Summary */}
                      {activityInfo.formattedTime && (
                        <View style={styles.activitySummaryRow}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color="#6b7280"
                          />
                          <Text style={styles.activitySummaryText}>
                            {activityInfo.label} {activityInfo.formattedTime} •{' '}
                            {originalAgingInfo.ageDescription}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Item Name*</Text>
                <TextInput
                  style={styles.input}
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="e.g., All-Purpose Flour"
                  placeholderTextColor="#bbb"
                  editable={true}
                  autoComplete="off"
                  textContentType="none"
                  autoCorrect={false}
                  autoCapitalize="words"
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
                    editable={true}
                    autoComplete="off"
                    textContentType="none"
                    autoCorrect={false}
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
                  editable={true}
                  autoComplete="off"
                  textContentType="none"
                  autoCorrect={true}
                  autoCapitalize="sentences"
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

export default ManualAddSheet;
