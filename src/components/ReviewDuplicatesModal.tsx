import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DuplicateGroup,
  DuplicateItem,
} from '../services/DuplicateDetectionService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReviewDuplicatesModalProps {
  isVisible: boolean;
  duplicateGroups: DuplicateGroup[];
  onClose: () => void;
  onMergeItems: (items: DuplicateItem[]) => void;
  onEditItem: (item: DuplicateItem) => void;
  onDeleteItem: (item: DuplicateItem) => void;
  onRefresh: () => void;
}

const ReviewDuplicatesModal: React.FC<ReviewDuplicatesModalProps> = ({
  isVisible,
  duplicateGroups,
  onClose,
  onMergeItems,
  onEditItem,
  onDeleteItem,
  onRefresh,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleMergeSelected = () => {
    if (selectedItems.size < 2) {
      Alert.alert(
        'Selection Required',
        'Please select at least 2 items to merge.',
      );
      return;
    }

    // Find all selected items across groups
    const itemsToMerge: DuplicateItem[] = [];
    duplicateGroups.forEach(group => {
      group.items.forEach(item => {
        if (selectedItems.has(item.id)) {
          itemsToMerge.push(item);
        }
      });
    });

    // Check if all selected items have the same name
    const itemNames = [...new Set(itemsToMerge.map(item => item.item_name))];
    if (itemNames.length > 1) {
      Alert.alert(
        'Invalid Selection',
        'You can only merge items with the same name. Please select items from a single group.',
      );
      return;
    }

    onMergeItems(itemsToMerge);
    setSelectedItems(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) {
      Alert.alert('Selection Required', 'Please select items to delete.');
      return;
    }

    Alert.alert(
      'Delete Items',
      `Are you sure you want to delete ${selectedItems.size} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Find and delete selected items
            duplicateGroups.forEach(group => {
              group.items.forEach(item => {
                if (selectedItems.has(item.id)) {
                  onDeleteItem(item);
                }
              });
            });
            setSelectedItems(new Set());
          },
        },
      ],
    );
  };

  const renderDuplicateGroup = (group: DuplicateGroup) => {
    const isExpanded = expandedGroups.has(group.itemName);

    return (
      <View key={group.itemName} style={styles.groupContainer}>
        {/* Group Header */}
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => toggleGroupExpansion(group.itemName)}>
          <View style={styles.groupHeaderLeft}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={20}
              color="#666"
            />
            <Text style={styles.groupTitle}>{group.itemName}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{group.totalCount}</Text>
            </View>
          </View>
          <Text style={styles.suggestedAction}>
            {group.suggestedAction === 'merge' ? '🔀 Merge' : '👁️ Review'}
          </Text>
        </TouchableOpacity>

        {/* Group Items */}
        {isExpanded && (
          <View style={styles.itemsList}>
            {group.items.map((item, index) => (
              <View key={item.id} style={styles.itemRow}>
                {/* Selection Checkbox */}
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => toggleItemSelection(item.id)}>
                  <Ionicons
                    name={
                      selectedItems.has(item.id) ? 'checkbox' : 'square-outline'
                    }
                    size={20}
                    color={selectedItems.has(item.id) ? '#2563eb' : '#999'}
                  />
                </TouchableOpacity>

                {/* Item Details */}
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={styles.itemLocation}>
                    📍 {item.storage_location}
                  </Text>
                  {item.description && (
                    <Text style={styles.itemDescription}>
                      {item.description}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onEditItem(item)}>
                    <Ionicons name="pencil" size={16} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onDeleteItem(item)}>
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <View style={styles.headerContent}>
            <Text style={styles.title}>Review Duplicates</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {duplicateGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={64} color="#10b981" />
              <Text style={styles.emptyTitle}>No Duplicates Found</Text>
              <Text style={styles.emptySubtitle}>
                Your pantry is clean and organized!
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Found {duplicateGroups.length} group(s) with duplicate items
              </Text>
              {duplicateGroups.map(renderDuplicateGroup)}
            </>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        {selectedItems.size > 0 && (
          <View style={styles.bottomActions}>
            <Text style={styles.selectionCount}>
              {selectedItems.size} item(s) selected
            </Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.mergeButton}
                onPress={handleMergeSelected}>
                <Ionicons name="git-merge" size={16} color="#fff" />
                <Text style={styles.mergeButtonText}>Merge</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteSelected}>
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: SCREEN_HEIGHT * 0.1,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginVertical: 16,
  },
  groupContainer: {
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  suggestedAction: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  itemsList: {
    backgroundColor: '#f9fafb',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  checkbox: {
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  itemLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  selectionCount: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mergeButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  mergeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default ReviewDuplicatesModal;
