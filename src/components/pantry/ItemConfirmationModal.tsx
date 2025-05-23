import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SectionList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';

import {
  ScannedItem,
  ProcessedItem,
  ItemToUpsert,
  unitOptions,
  parseQuantity,
  getFrontendUnit,
  processItemsForDuplicates,
  processDuplicateActions,
  validateUserSession,
} from '../../utils/pantryScanning';
import { supabase } from '../../services/supabase';

interface ItemConfirmationModalProps {
  isVisible: boolean;
  items: ScannedItem[];
  onConfirm: (confirmedItems: ItemToUpsert[]) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const ItemConfirmationModal: React.FC<ItemConfirmationModalProps> = ({
  isVisible,
  items,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedQuantity, setEditedQuantity] = useState('');
  const [editedUnit, setEditedUnit] = useState('units');

  // Process incoming items when props change
  useEffect(() => {
    if (items && isVisible) {
      console.log('[ItemConfirmationModal] Processing scanned items...');
      const newProcessedItems = items.map((item, index) => {
        const itemNameLower = (item.name || '').toLowerCase().trim();
        const initialQuantityStr = String(item.quantity || '1');
        const initialFrontendUnit = getFrontendUnit(initialQuantityStr);

        return {
          id: `temp-${index}-${Date.now()}`,
          scannedName: item.name || '',
          scannedQuantity: item.quantity || '1',
          currentName: itemNameLower,
          currentQuantity: parseQuantity(initialQuantityStr),
          currentUnit: initialFrontendUnit,
        };
      }).filter(item => item.currentName);

      console.log('[ItemConfirmationModal] Initial processed items:', newProcessedItems);
      setProcessedItems(newProcessedItems);
    } else {
      setProcessedItems([]);
      setEditingItemId(null);
    }
  }, [items, isVisible]);

  // Group items for section list
  const sections = useMemo(() => {
    return [{ title: 'Scanned Items', data: processedItems }];
  }, [processedItems]);

  const handleEdit = (item: ProcessedItem) => {
    setEditingItemId(item.id);
    setEditedName(item.currentName);
    setEditedQuantity(String(item.currentQuantity));
    setEditedUnit(item.currentUnit);
  };

  const handleSaveEdit = () => {
    const nameTrimmed = editedName.trim();
    const quantityParsed = parseQuantity(editedQuantity);

    if (!nameTrimmed || quantityParsed <= 0) {
      Alert.alert('Error', 'Item name must not be empty and quantity must be positive.');
      return;
    }

    setProcessedItems(currentItems =>
      currentItems.map(item =>
        item.id === editingItemId
          ? {
              ...item,
              currentName: nameTrimmed.toLowerCase(),
              currentQuantity: quantityParsed,
              currentUnit: editedUnit,
            }
          : item
      )
    );

    console.log(`[ItemConfirmationModal] Saved edit for ID ${editingItemId}`);
    setEditingItemId(null);
  };

  const handleDelete = (idToDelete: string) => {
    setProcessedItems(currentItems => 
      currentItems.filter(item => item.id !== idToDelete)
    );
    console.log(`[ItemConfirmationModal] Removed item with temporary ID ${idToDelete}`);
  };

  const handleConfirm = async () => {
    if (!processedItems || processedItems.length === 0) {
      onCancel();
      return;
    }

    try {
      // Validate user session
      const userId = await validateUserSession();

      // Process items for duplicates
      const { itemsToUpsert, duplicateActions } = await processItemsForDuplicates(
        processedItems,
        userId
      );

      // Handle duplicate actions if any
      const additionalItems = await processDuplicateActions(duplicateActions, userId);

      // Combine all items to upsert
      const finalItemsToUpsert = [...itemsToUpsert, ...additionalItems];

      console.log('[ItemConfirmationModal] Final items to upsert:', finalItemsToUpsert);

      if (finalItemsToUpsert.length > 0) {
        onConfirm(finalItemsToUpsert);
      } else {
        Alert.alert("No Changes", "No items were added or updated.");
        onCancel();
      }
    } catch (error) {
      console.error('[ItemConfirmationModal] Error in handleConfirm:', error);
      Alert.alert("Error", `Failed to process items: ${(error as Error).message}`);
    }
  };

  const renderItem = ({ item }: { item: ProcessedItem }) => {
    // Editing View
    if (editingItemId === item.id) {
      return (
        <View style={styles.itemContainerEditing}>
          <TextInput
            style={[styles.input, styles.nameInput]}
            value={editedName}
            onChangeText={setEditedName}
            placeholder="Item Name"
            autoFocus={true}
          />
          <TextInput
            style={[styles.input, styles.quantityInput]}
            value={editedQuantity}
            onChangeText={(value) => setEditedQuantity(value.replace(/[^0-9.]/g, ''))}
            placeholder="Quantity"
            keyboardType="decimal-pad"
          />
          <View style={styles.unitPickerWrapper}>
            <RNPickerSelect
              onValueChange={(value) => setEditedUnit(value || 'units')}
              items={unitOptions}
              value={editedUnit}
              style={pickerSelectStyles}
              placeholder={{}}
              useNativeAndroidPickerStyle={false}
            />
          </View>
          <TouchableOpacity onPress={handleSaveEdit} style={styles.actionButton}>
            <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setEditingItemId(null)} 
            style={styles.actionButton}
          >
            <Ionicons name="close-circle" size={28} color="#ef4444" />
          </TouchableOpacity>
        </View>
      );
    }

    // Display View
    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemName}>{item.currentName}</Text>
          <Text style={styles.itemQuantity}>
            {item.currentQuantity} {item.currentUnit}
          </Text>
        </View>
        <View style={styles.actionsContainer}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
            <Ionicons name="pencil" size={22} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Confirm Scanned Items</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>

          {processedItems.length > 0 ? (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={styles.listContentContainer}
            />
          ) : (
            <View style={styles.noItemsContainer}>
              <Text style={styles.noItemsText}>No items found in image.</Text>
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (isProcessing || processedItems.length === 0) && styles.disabledButton
              ]}
              onPress={handleConfirm}
              disabled={isProcessing || processedItems.length === 0}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm & Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: '#000',
    paddingRight: 30,
  },
  inputAndroid: {
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#000',
    paddingRight: 30,
  },
  iconContainer: {
    top: 13,
    right: 15,
  },
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    height: '85%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  closeButton: {
    padding: 8,
  },
  listContentContainer: {
    paddingBottom: 80,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemContainerEditing: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginRight: 8,
    fontSize: 14,
  },
  nameInput: {
    flex: 2,
  },
  quantityInput: {
    flex: 1,
  },
  unitPickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginRight: 8,
  },
  noItemsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noItemsText: {
    fontSize: 16,
    color: '#6b7280',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
});

export default ItemConfirmationModal; 