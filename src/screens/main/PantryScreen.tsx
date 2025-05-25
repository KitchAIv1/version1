import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Animated,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useAccessControl } from '../../hooks/useAccessControl';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { getShortRelativeTime } from '../../utils/dateUtils';
import ManualAddSheet from '../../components/ManualAddSheet';

// Navigation type
type PantryNavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Constants
const ACTIVE_COLOR = '#10b981'; // Same as ProfileScreen and GroceryListScreen

// --- Item Icon Mapping (same as grocery list) ---
const itemIconMap: { [key: string]: string } = {
  // Fruits
  apple: 'nutrition-outline',
  banana: 'nutrition-outline',
  orange: 'nutrition-outline',
  strawberry: 'nutrition-outline',
  grapes: 'nutrition-outline',
  blueberry: 'nutrition-outline',
  raspberry: 'nutrition-outline',
  avocado: 'leaf-outline',

  // Vegetables
  tomato: 'leaf-outline',
  potato: 'leaf-outline',
  onion: 'leaf-outline',
  lettuce: 'leaf-outline',
  carrot: 'leaf-outline',
  broccoli: 'leaf-outline',
  cucumber: 'leaf-outline',
  bellpepper: 'leaf-outline',
  garlic: 'leaf-outline',
  spinach: 'leaf-outline',

  // Dairy & Alternatives
  milk: 'pint-outline',
  cheese: 'cube-outline',
  cheddar: 'cube-outline',
  mozzarella: 'ellipse-outline',
  yogurt: 'ice-cream-outline',
  butter: 'layers-outline',
  "almond milk": 'pint-outline',
  "soy milk": 'pint-outline',
  
  // Bakery
  bread: 'restaurant-outline',
  "white bread": 'restaurant-outline',
  "whole wheat bread": 'restaurant-outline',
  bagel: 'ellipse-outline',
  croissant: 'restaurant-outline',

  // Proteins
  eggs: 'egg-outline',
  chicken: 'logo-twitter',
  "chicken breast": 'logo-twitter',
  beef: 'restaurant-outline',
  steak: 'restaurant-outline',
  pork: 'restaurant-outline',
  bacon: 'remove-outline',
  fish: 'fish-outline',
  salmon: 'fish-outline',
  shrimp: 'fish-outline',
  tofu: 'square-outline',

  // Pantry Staples
  pasta: 'restaurant-outline',
  rice: 'ellipse-outline',
  flour: 'folder-outline',
  sugar: 'cube-outline',
  salt: 'cube-outline',
  pepper: 'ellipse-outline',
  "olive oil": 'water-outline',
  vinegar: 'water-outline',
  cereal: 'apps-outline',
  oats: 'apps-outline',
  coffee: 'cafe-outline',
  tea: 'cafe-outline',
  
  // Drinks
  juice: 'water-outline',
  "apple juice": 'water-outline',
  "orange juice": 'water-outline',
  soda: 'beer-outline',
  water: 'water-outline',

  // Default
  default: 'cube-outline',
};

const getIconForItem = (itemName: string): string => {
  const lowerItemName = itemName.toLowerCase();
  const sortedKeys = Object.keys(itemIconMap).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lowerItemName.includes(key)) {
      return itemIconMap[key];
    }
  }
  return itemIconMap['default'];
};

// Types
interface PantryItem {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

interface UnitOption {
  label: string;
  value: string;
}

export default function PantryScreen() {
  const navigation = useNavigation<PantryNavigationProp>();
  const { user } = useAuth();
  const { 
    performPantryScan, 
    canPerformScan, 
    isProcessing, 
    getUsageDisplay,
    FREEMIUM_SCAN_LIMIT 
  } = useAccessControl();
  
  // State
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PantryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Manual Add Sheet state
  const [isManualAddSheetVisible, setIsManualAddSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  
  // Upgrade Modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Animation values
  const scanButtonScale = useRef(new Animated.Value(1)).current;
  const addButtonScale = useRef(new Animated.Value(1)).current;

  // Get usage data for display
  const usageData = getUsageDisplay();

  // Unit options
  const unitOptions: UnitOption[] = [
    { label: 'Units', value: 'units' },
    { label: 'Grams', value: 'grams' },
    { label: 'Cups', value: 'cups' },
    { label: 'Milliliters', value: 'ml' },
    { label: 'Liters', value: 'l' },
    { label: 'Kilograms', value: 'kg' },
    { label: 'Ounces', value: 'oz' },
    { label: 'Pounds', value: 'lbs' }
  ];

  // Fetch pantry data
  const fetchPantryData = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('stock')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      const items = data || [];
      setPantryItems(items);
      setFilteredItems(items);
    } catch (err: any) {
      console.error('[PantryScreen] Error fetching pantry data:', err);
      setError(err.message || 'Failed to load pantry data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Filter items based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(pantryItems);
    } else {
      const filtered = pantryItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, pantryItems]);

  // Fetch data on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchPantryData();
    }, [fetchPantryData])
  );

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPantryData();
    setRefreshing(false);
  }, [fetchPantryData]);

  // Animation helper
  const animateButtonPress = (animatedValue: Animated.Value, toValue: number) => {
    Animated.spring(animatedValue, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 40
    }).start();
  };

  // Camera handlers with access control
  const handleScanPress = async () => {
    // Check access before navigating to scanning screen
    if (!canPerformScan()) {
      setShowUpgradeModal(true);
      return;
    }

    // Navigate to dedicated scanning screen
    navigation.navigate('PantryScan');
  };

  const handleManualAddPress = () => {
    setEditingItem(null);
    setIsManualAddSheetVisible(true);
  };

  const handleEditItem = (item: PantryItem) => {
    setEditingItem(item);
    setIsManualAddSheetVisible(true);
  };

  const handleDeleteItem = (item: PantryItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${item.item_name}" from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('stock')
                .delete()
                .eq('id', item.id);
              
              if (error) throw error;
              await fetchPantryData();
            } catch (err: any) {
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  // Handle manual add sheet submission
  const handleSaveItemFromSheet = async (submittedItem: any) => {
    if (!user?.id) {
      Alert.alert("Error", "User session not found. Cannot save item.");
      return;
    }

    try {
      if (submittedItem.original_item_name) {
        // Edit mode
        const { error: updateError } = await supabase
          .from('stock')
          .update({ 
            item_name: submittedItem.item_name, 
            quantity: submittedItem.quantity, 
            unit: submittedItem.unit,
            description: submittedItem.description
          })
          .eq('user_id', user.id)
          .eq('item_name', submittedItem.original_item_name);
        
        if (updateError) throw updateError;
      } else {
        // Add mode
        const { error: insertError } = await supabase
          .from('stock')
          .insert({
            user_id: user.id,
            item_name: submittedItem.item_name,
            quantity: submittedItem.quantity,
            unit: submittedItem.unit,
            description: submittedItem.description
          });
        
        if (insertError) throw insertError;
      }

      setIsManualAddSheetVisible(false);
      setEditingItem(null);
      await fetchPantryData();
    } catch (err: any) {
      console.error('Error saving item:', err);
      Alert.alert('Error', `Failed to save item: ${err.message}`);
    }
  };

  const handleCloseSheet = () => {
    setIsManualAddSheetVisible(false);
    setEditingItem(null);
  };

  // Header component
  const renderPantryHeader = () => (
    <View style={styles.pantryHeaderContainer}>
      {/* Scrollable Header with pantry title and item count badge */}
      <View style={styles.scrollableHeader}>
        <View style={styles.headerSpacer} />
        <Text style={styles.scrollableHeaderTitle}>My Pantry</Text>
        <View style={styles.headerActions}>
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCountText}>
              {pantryItems.length}
            </Text>
          </View>
        </View>
      </View>
      
      {/* Search Bar Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your pantry..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Action Buttons Section */}
      <View style={styles.actionButtonsSection}>
        <Pressable
          style={[styles.actionButton, styles.scanButton, (isProcessing || !canPerformScan()) && styles.disabledButton]}
          onPress={handleScanPress}
          onPressIn={() => !(isProcessing) && animateButtonPress(scanButtonScale, 0.95)}
          onPressOut={() => !(isProcessing) && animateButtonPress(scanButtonScale, 1)}
          disabled={isProcessing}
        >
          <Animated.View style={[styles.buttonContent, { transform: [{ scale: scanButtonScale }] }]}>
            {(isProcessing) ? (
              <ActivityIndicator size={20} color={ACTIVE_COLOR} />
            ) : (
              <Ionicons name="camera-outline" size={20} color={canPerformScan() ? ACTIVE_COLOR : '#9ca3af'} />
            )}
            <View style={styles.scanButtonTextContainer}>
              <Text style={[styles.actionButtonText, styles.scanButtonText, !canPerformScan() && styles.disabledButtonText]}>
                {(isProcessing) ? 'Processing...' : 'Scan Pantry'}
              </Text>
              {/* Scan Counter Badge */}
              {usageData.showUsage && (
                <View style={[styles.scanCounterBadge, !canPerformScan() && styles.scanCounterBadgeWarning]}>
                  <Text style={[styles.scanCounterText, !canPerformScan() && styles.scanCounterTextWarning]}>
                    {(() => {
                      const [used, total] = usageData.scanUsage.split('/').map(Number);
                      const remaining = total - used;
                      return `${remaining} left`;
                    })()}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.manualButton]}
          onPress={handleManualAddPress}
          onPressIn={() => animateButtonPress(addButtonScale, 0.95)}
          onPressOut={() => animateButtonPress(addButtonScale, 1)}
        >
          <Animated.View style={[styles.buttonContent, { transform: [{ scale: addButtonScale }] }]}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, styles.manualButtonText]}>Add Manually</Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );

  // Render pantry item with grocery list format
  const renderPantryItem = ({ item }: { item: PantryItem }) => {
    const itemIconName = getIconForItem(item.item_name) as any; // Type assertion for Ionicons
    
    return (
      <TouchableOpacity 
        style={styles.itemContainer}
        onPress={() => handleEditItem(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemIcon}>
          <Ionicons name={itemIconName} size={24} color={ACTIVE_COLOR} />
        </View>
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
            {item.item_name.charAt(0).toUpperCase() + item.item_name.slice(1)}
          </Text>
          <View style={styles.metaDataContainer}>
            <Text style={styles.metaText}>
              <Ionicons name="cube-outline" size={12} /> {item.quantity} {item.unit}
            </Text>
            {item.created_at && (
              <Text style={styles.metaText}>
                <Ionicons name="time-outline" size={12} /> {getShortRelativeTime(item.created_at)}
              </Text>
            )}
          </View>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={(e) => {
            e.stopPropagation();
            handleEditItem(item);
          }}
        >
          <Ionicons name="create-outline" size={22} color="#757575" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteItem(item);
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="archive-outline" size={48} color="#cbd5e1" />
      <Text style={styles.emptyStateTitle}>Your pantry is empty</Text>
      <Text style={styles.emptyStateText}>
        Add ingredients by scanning with camera or adding manually
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Fixed Green Header - covers status bar area and stays fixed */}
      <View style={styles.fixedGreenHeader}>
        <SafeAreaView edges={['top']} />
      </View>
      
      {/* Main Content */}
      <View style={styles.mainContent}>
        {renderPantryHeader()}
        
        <ScrollView 
          style={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACTIVE_COLOR]}/>}
        >
          {isLoading && pantryItems.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={ACTIVE_COLOR} />
              <Text style={styles.loadingText}>Loading your pantry...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchPantryData}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : filteredItems.length === 0 ? (
            searchQuery ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyStateTitle}>No items found</Text>
                <Text style={styles.emptyStateText}>
                  Try a different search term or add new items to your pantry
                </Text>
              </View>
            ) : (
              renderEmptyState()
            )
          ) : (
            <FlatList
              data={filteredItems}
              renderItem={renderPantryItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </ScrollView>
      </View>

      {/* Manual Add/Edit Sheet */}
      <ManualAddSheet 
        isVisible={isManualAddSheetVisible}
        onClose={handleCloseSheet}
        onSubmit={handleSaveItemFromSheet}
        mode={editingItem ? 'edit' : 'add'}
        initialItemData={editingItem}
        unitOptions={unitOptions}
      />

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="camera-outline" size={48} color="#ef4444" />
              <Text style={styles.modalTitle}>Scan Limit Reached!</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              You've used your <Text style={styles.modalHighlight}>3 free pantry scans</Text> this month! 
            </Text>
            
            <Text style={styles.modalSubMessage}>
              Go Premium for unlimited smart scans + AI recipe matching.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowUpgradeModal(false)}
              >
                <Text style={styles.modalCancelText}>Maybe Later</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalUpgradeButton}
                onPress={() => {
                  setShowUpgradeModal(false);
                  navigation.navigate('UpgradeScreen');
                }}
              >
                <Ionicons name="arrow-up-circle" size={20} color="#fff" />
                <Text style={styles.modalUpgradeText}>Upgrade Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedGreenHeader: {
    backgroundColor: ACTIVE_COLOR,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  mainContent: {
    flex: 1,
    paddingTop: 50, // Account for fixed green header
  },
  scrollContainer: {
    flex: 1,
  },
  pantryHeaderContainer: {
    backgroundColor: '#fff',
  },
  scrollableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scrollableHeaderTitle: {
    color: '#1f2937',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'flex-end',
  },
  itemCountBadge: {
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 4,
  },
  actionButtonsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  scanButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  manualButton: {
    backgroundColor: ACTIVE_COLOR,
    marginLeft: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  scanButtonText: {
    color: ACTIVE_COLOR,
  },
  manualButtonText: {
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  itemIcon: {
    marginRight: 12,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  metaDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  itemActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  scanButtonTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanCounterBadge: {
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 8,
  },
  scanCounterBadgeWarning: {
    backgroundColor: '#ef4444',
  },
  scanCounterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  scanCounterTextWarning: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalHighlight: {
    fontWeight: 'bold',
    color: '#ef4444',
  },
  modalSubMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalUpgradeButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalUpgradeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
}); 