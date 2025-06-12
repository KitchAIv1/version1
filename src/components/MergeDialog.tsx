import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DuplicateItem, DuplicateGroup } from '../services/DuplicateDetectionService';
import { formatDetailedTimestamp, getMostRecentActivity } from '../utils/dateUtils';

interface MergeDialogProps {
  isVisible: boolean;
  duplicateGroup?: DuplicateGroup | null;
  items?: DuplicateItem[]; // For backward compatibility
  onConfirm: (targetUnit: string, targetLocation: string) => void;
  onCancel: () => void;
  onKeepBoth?: () => void;
  isLoading?: boolean;
}

const MergeDialog: React.FC<MergeDialogProps> = ({
  isVisible,
  duplicateGroup,
  items: itemsProp,
  onConfirm,
  onCancel,
  onKeepBoth,
  isLoading = false,
}) => {
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Get items from either duplicateGroup or items prop
  const items = duplicateGroup?.items || itemsProp || [];

  useEffect(() => {
    if (items.length > 0) {
      // Get recommended unit (most common or first)
      const units = items.map(item => item.unit);
      const unitCounts = units.reduce((acc, unit) => {
        acc[unit] = (acc[unit] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const recommendedUnit = Object.entries(unitCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
      
      // Get recommended location (most common or first)
      const locations = items.map(item => item.storage_location);
      const locationCounts = locations.reduce((acc, location) => {
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const recommendedLocation = Object.entries(locationCounts)
        .sort(([,a], [,b]) => b - a)[0][0];

      setSelectedUnit(recommendedUnit);
      setSelectedLocation(recommendedLocation);
    }
  }, [items]);

  const getUniqueUnits = () => {
    return [...new Set(items.map(item => item.unit))];
  };

  const getUniqueLocations = () => {
    return [...new Set(items.map(item => item.storage_location))];
  };

  const getTotalQuantity = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getItemSummary = () => {
    if (items.length === 0) return '';
    
    const itemName = items[0].item_name;
    const totalQuantity = getTotalQuantity();
    
    return `${items.length} entries of "${itemName}" (${totalQuantity} total)`;
  };

  const renderItemDetails = () => {
    if (items.length === 0) return null;

    // Separate pending items from existing items
    const pendingItems = items.filter(item => item.id.startsWith('temp-'));
    const existingItems = items.filter(item => !item.id.startsWith('temp-'));
    
    // Sort existing items by most recent activity
    const sortedExistingItems = existingItems.sort((a, b) => {
      const aActivity = getMostRecentActivity(a.created_at, a.updated_at);
      const bActivity = getMostRecentActivity(b.created_at, b.updated_at);
      return new Date(bActivity.timestamp).getTime() - new Date(aActivity.timestamp).getTime();
    });

    return (
      <View style={styles.itemDetailsSection}>
        <Text style={styles.itemDetailsSectionTitle}>Item Details</Text>
        
        {/* Existing Items */}
        {sortedExistingItems.map((item, index) => {
          const activityInfo = getMostRecentActivity(item.created_at, item.updated_at);
          return (
            <View key={item.id} style={styles.itemDetailRow}>
              <View style={styles.itemDetailIcon}>
                <Ionicons 
                  name={activityInfo.label === 'Updated' ? 'refresh-circle' : 'add-circle'} 
                  size={16} 
                  color={activityInfo.label === 'Updated' ? '#f59e0b' : '#10b981'} 
                />
              </View>
              <View style={styles.itemDetailContent}>
                <View style={styles.itemDetailHeader}>
                  <Text style={styles.itemDetailQuantity}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={styles.itemDetailLocation}>
                    📍 {item.storage_location}
                  </Text>
                </View>
                <Text style={styles.itemDetailTimestamp}>
                  {activityInfo.label}: {formatDetailedTimestamp(activityInfo.timestamp)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Pending Item (new item being added) */}
        {pendingItems.map((item) => (
          <View key={item.id} style={[styles.itemDetailRow, styles.pendingItemRow]}>
            <View style={styles.itemDetailIcon}>
              <Ionicons name="add-circle" size={16} color="#3b82f6" />
            </View>
            <View style={styles.itemDetailContent}>
              <View style={styles.itemDetailHeader}>
                <Text style={styles.itemDetailQuantity}>
                  {item.quantity} {item.unit}
                </Text>
                <Text style={styles.itemDetailLocation}>
                  📍 {item.storage_location}
                </Text>
                <View style={styles.newItemBadge}>
                  <Text style={styles.newItemBadgeText}>New</Text>
                </View>
              </View>
              <Text style={styles.itemDetailTimestamp}>
                Being added now
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const handleConfirm = () => {
    if (!selectedUnit || !selectedLocation) {
      Alert.alert('Selection Required', 'Please select both unit and location.');
      return;
    }
    
    onConfirm(selectedUnit, selectedLocation);
  };

  const renderUnitOption = (unit: string) => {
    const isSelected = selectedUnit === unit;
    const isRecommended = unit === getUniqueUnits()[0]; // First unit is recommended
    
    return (
      <TouchableOpacity
        key={unit}
        style={[
          styles.optionButton,
          isSelected && styles.selectedOption,
        ]}
        onPress={() => setSelectedUnit(unit)}
      >
        <View style={styles.optionContent}>
          <Text style={[
            styles.optionText,
            isSelected && styles.selectedOptionText,
          ]}>
            {unit}
          </Text>
          {isRecommended && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Suggested</Text>
            </View>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark" size={20} color="#2563eb" />
        )}
      </TouchableOpacity>
    );
  };

  const renderLocationOption = (location: string) => {
    const isSelected = selectedLocation === location;
    const isRecommended = location === getUniqueLocations()[0]; // First location is recommended
    
    return (
      <TouchableOpacity
        key={location}
        style={[
          styles.optionButton,
          isSelected && styles.selectedOption,
        ]}
        onPress={() => setSelectedLocation(location)}
      >
        <View style={styles.optionContent}>
          <Text style={[
            styles.optionText,
            isSelected && styles.selectedOptionText,
          ]}>
            📍 {location}
          </Text>
          {isRecommended && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Suggested</Text>
            </View>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark" size={20} color="#2563eb" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="git-merge" size={24} color="#2563eb" />
            <Text style={styles.title}>Merge Items</Text>
          </View>

          {/* Summary */}
          <Text style={styles.summary}>{getItemSummary()}</Text>

          {/* Item Details */}
          {renderItemDetails()}

          {/* Unit Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Unit</Text>
            <View style={styles.optionsContainer}>
              {getUniqueUnits().map(renderUnitOption)}
            </View>
          </View>

          {/* Location Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Location</Text>
            <View style={styles.optionsContainer}>
              {getUniqueLocations().map(renderLocationOption)}
            </View>
          </View>

          {/* Preview */}
          {selectedUnit && selectedLocation && (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>Result Preview</Text>
              <Text style={styles.previewText}>
                {getTotalQuantity()} {selectedUnit} in {selectedLocation}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            {onKeepBoth && (
              <TouchableOpacity style={styles.keepBothButton} onPress={onKeepBoth}>
                <Text style={styles.keepBothButtonText}>Keep Both</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.confirmButton,
                (!selectedUnit || !selectedLocation || isLoading) && styles.disabledButton,
              ]} 
              onPress={handleConfirm}
              disabled={!selectedUnit || !selectedLocation || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="git-merge" size={16} color="#fff" />
                  <Text style={styles.confirmButtonText}>Merge Items</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  summary: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selectedOption: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#2563eb',
  },
  recommendedBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  preview: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 16,
    color: '#0c4a6e',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  keepBothButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  keepBothButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  itemDetailsSection: {
    marginBottom: 20,
  },
  itemDetailsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
     itemDetailRow: {
     flexDirection: 'row',
     alignItems: 'center',
     padding: 12,
     borderWidth: 1,
     borderColor: '#e5e7eb',
     borderRadius: 8,
     marginBottom: 8,
     backgroundColor: '#ffffff',
   },
  itemDetailIcon: {
    marginRight: 12,
  },
  itemDetailContent: {
    flex: 1,
  },
  itemDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemDetailQuantity: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
     itemDetailLocation: {
     fontSize: 14,
     color: '#6b7280',
     fontWeight: '500',
     marginLeft: 8,
   },
  itemDetailTimestamp: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
     pendingItemRow: {
     backgroundColor: '#f0f9ff',
     borderColor: '#3b82f6',
   },
  newItemBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  newItemBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
});

export default MergeDialog; 