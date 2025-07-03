# PantryScreen Component Documentation

## Overview

The `PantryScreen` is a comprehensive pantry management interface in KitchAI v2 that allows users to view, add, edit, and delete pantry items. It integrates with the camera scanning system, access control for FREEMIUM/PREMIUM users, and provides a smooth user experience with search functionality and real-time updates.

## Location
`src/screens/main/PantryScreen.tsx`

## Purpose

- **Pantry Management**: Complete CRUD operations for pantry items
- **Camera Integration**: Access to pantry scanning with tier-based restrictions
- **Search & Filter**: Real-time search through pantry items
- **Access Control**: FREEMIUM/PREMIUM scanning limits enforcement
- **User Experience**: Smooth animations and intuitive interface

## Architecture

### Screen Structure

```typescript
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

type PantryNavigationProp = NativeStackNavigationProp<MainStackParamList>;
```

### Visual Layout

```
┌─────────────────────────────────────┐
│ Fixed Green Header (Status Bar)     │ ← Fixed Header
├─────────────────────────────────────┤
│ My Pantry                    [24]   │ ← Title & Count
├─────────────────────────────────────┤
│ [🔍] Search your pantry...    [×]   │ ← Search Bar
├─────────────────────────────────────┤
│ [📷 Scan Pantry] [➕ Add Manually]  │ ← Action Buttons
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🥕 Carrots                      │ │ ← Pantry Items
│ │ 📦 2 units • 2 days ago        │ │
│ │                        [✏️][🗑️] │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🥛 Milk                         │ │
│ │ 📦 1 l • 1 day ago              │ │
│ │                        [✏️][🗑️] │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Key Features

### 1. Pantry Item Management

**CRUD Operations**:
- Create new pantry items manually
- Read/view all pantry items with metadata
- Update existing items (name, quantity, unit, description)
- Delete items with confirmation

**Item Display**:
- Smart icon mapping based on item names
- Quantity and unit display
- Creation/update timestamps
- Optional descriptions

### 2. Camera Scanning Integration

**Access Control**:
- FREEMIUM users: 3 scans per month
- PREMIUM users: Unlimited scans
- Real-time limit checking
- Upgrade prompts when limits reached

**Scanning Flow**:
- Navigation to dedicated scanning screen
- Access control validation before navigation
- Processing state management

### 3. Search and Filtering

**Real-time Search**:
- Instant filtering as user types
- Case-insensitive search
- Search through item names
- Clear search functionality

**Search States**:
- Empty state when no items
- No results state for failed searches
- Loading states during data fetch

### 4. User Interface Features

**Animations**:
- Button press animations
- Smooth transitions
- Loading indicators
- Pull-to-refresh

**Visual Design**:
- Consistent color scheme (ACTIVE_COLOR: #10b981)
- Icon-based item identification
- Clean card-based layout
- Responsive design

## Implementation Details

### Main Component Structure

```typescript
export default function PantryScreen() {
  const navigation = useNavigation<PantryNavigationProp>();
  const { user } = useAuth();
  const { performPantryScan, canPerformScan, isProcessing } = useAccessControl();
  
  // State management
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PantryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal state
  const [isManualAddSheetVisible, setIsManualAddSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  
  // Animation values
  const scanButtonScale = useRef(new Animated.Value(1)).current;
  const addButtonScale = useRef(new Animated.Value(1)).current;

  return (
    <View style={styles.container}>
      <View style={styles.fixedGreenHeader}>
        <SafeAreaView edges={['top']} />
      </View>
      
      <View style={styles.mainContent}>
        {renderPantryHeader()}
        
        <ScrollView 
          style={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Content rendering logic */}
        </ScrollView>
      </View>

      <ManualAddSheet 
        isVisible={isManualAddSheetVisible}
        onClose={handleCloseSheet}
        onSubmit={handleSaveItemFromSheet}
        mode={editingItem ? 'edit' : 'add'}
        initialItemData={editingItem}
        unitOptions={unitOptions}
      />
    </View>
  );
}
```

### Data Fetching and Management

```typescript
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

// Fetch data on screen focus
useFocusEffect(
  useCallback(() => {
    fetchPantryData();
  }, [fetchPantryData])
);
```

### Search Implementation

```typescript
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
```

### Access Control Integration

```typescript
const handleScanPress = async () => {
  // Check access before navigating to scanning screen
  if (!canPerformScan()) {
    Alert.alert(
      'Scan Limit Reached',
      'FREEMIUM limit reached: 3 scans per month. Upgrade to PREMIUM for unlimited access.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade Now', onPress: () => navigation.navigate('UpgradeScreen') }
      ]
    );
    return;
  }

  // Navigate to dedicated scanning screen
  navigation.navigate('PantryScan');
};
```

### Item Management Operations

#### Add/Edit Item

```typescript
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
```

#### Delete Item

```typescript
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
```

### Icon Mapping System

```typescript
const itemIconMap: { [key: string]: string } = {
  // Fruits
  apple: 'nutrition-outline',
  banana: 'nutrition-outline',
  orange: 'nutrition-outline',
  
  // Vegetables
  tomato: 'leaf-outline',
  potato: 'leaf-outline',
  onion: 'leaf-outline',
  
  // Dairy & Alternatives
  milk: 'pint-outline',
  cheese: 'cube-outline',
  yogurt: 'ice-cream-outline',
  
  // Proteins
  eggs: 'egg-outline',
  chicken: 'logo-twitter',
  beef: 'restaurant-outline',
  
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
```

### Animation System

```typescript
const animateButtonPress = (animatedValue: Animated.Value, toValue: number) => {
  Animated.spring(animatedValue, {
    toValue,
    useNativeDriver: true,
    friction: 7,
    tension: 40
  }).start();
};

// Usage in button
<Pressable
  style={[styles.actionButton, styles.scanButton]}
  onPress={handleScanPress}
  onPressIn={() => animateButtonPress(scanButtonScale, 0.95)}
  onPressOut={() => animateButtonPress(scanButtonScale, 1)}
>
  <Animated.View style={[styles.buttonContent, { transform: [{ scale: scanButtonScale }] }]}>
    <Ionicons name="camera-outline" size={20} color={ACTIVE_COLOR} />
    <Text style={styles.actionButtonText}>Scan Pantry</Text>
  </Animated.View>
</Pressable>
```

## Component Rendering

### Header Component

```typescript
const renderPantryHeader = () => (
  <View style={styles.pantryHeaderContainer}>
    {/* Title and Count */}
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
    
    {/* Search Bar */}
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

    {/* Action Buttons */}
    <View style={styles.actionButtonsSection}>
      <Pressable
        style={[styles.actionButton, styles.scanButton, !canPerformScan() && styles.disabledButton]}
        onPress={handleScanPress}
        disabled={isProcessing}
      >
        <Animated.View style={[styles.buttonContent, { transform: [{ scale: scanButtonScale }] }]}>
          {isProcessing ? (
            <ActivityIndicator size={20} color={ACTIVE_COLOR} />
          ) : (
            <Ionicons name="camera-outline" size={20} color={canPerformScan() ? ACTIVE_COLOR : '#9ca3af'} />
          )}
          <Text style={[styles.actionButtonText, styles.scanButtonText, !canPerformScan() && styles.disabledButtonText]}>
            {isProcessing ? 'Processing...' : 'Scan Pantry'}
          </Text>
        </Animated.View>
      </Pressable>

      <Pressable
        style={[styles.actionButton, styles.manualButton]}
        onPress={handleManualAddPress}
      >
        <Animated.View style={[styles.buttonContent, { transform: [{ scale: addButtonScale }] }]}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={[styles.actionButtonText, styles.manualButtonText]}>Add Manually</Text>
        </Animated.View>
      </Pressable>
    </View>
  </View>
);
```

### Item Rendering

```typescript
const renderPantryItem = ({ item }: { item: PantryItem }) => {
  const itemIconName = getIconForItem(item.item_name) as any;
  
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
```

### Empty States

```typescript
const renderEmptyState = () => (
  <View style={styles.emptyStateContainer}>
    <Ionicons name="archive-outline" size={48} color="#cbd5e1" />
    <Text style={styles.emptyStateTitle}>Your pantry is empty</Text>
    <Text style={styles.emptyStateText}>
      Add ingredients by scanning with camera or adding manually
    </Text>
  </View>
);

// No search results state
{searchQuery ? (
  <View style={styles.emptyStateContainer}>
    <Ionicons name="search-outline" size={48} color="#cbd5e1" />
    <Text style={styles.emptyStateTitle}>No items found</Text>
    <Text style={styles.emptyStateText}>
      Try a different search term or add new items to your pantry
    </Text>
  </View>
) : (
  renderEmptyState()
)}
```

## Styling

### Key Style Constants

```typescript
const ACTIVE_COLOR = '#10b981'; // Primary green color

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
  // ... additional styles
});
```

### Button Styling

```typescript
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
disabledButton: {
  opacity: 0.5,
},
```

### Item Container Styling

```typescript
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
```

## Error Handling

### Network Errors

```typescript
const fetchPantryData = useCallback(async () => {
  try {
    // ... fetch logic
  } catch (err: any) {
    console.error('[PantryScreen] Error fetching pantry data:', err);
    setError(err.message || 'Failed to load pantry data');
  } finally {
    setIsLoading(false);
  }
}, [user?.id]);
```

### User Input Validation

```typescript
const handleSaveItemFromSheet = async (submittedItem: any) => {
  if (!user?.id) {
    Alert.alert("Error", "User session not found. Cannot save item.");
    return;
  }

  try {
    // ... save logic
  } catch (err: any) {
    console.error('Error saving item:', err);
    Alert.alert('Error', `Failed to save item: ${err.message}`);
  }
};
```

### Error Display

```typescript
{error ? (
  <View style={styles.errorContainer}>
    <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorText}>{error}</Text>
    <TouchableOpacity style={styles.retryButton} onPress={fetchPantryData}>
      <Text style={styles.retryButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
) : (
  // Normal content
)}
```

## Performance Optimizations

### Memoization

```typescript
const fetchPantryData = useCallback(async () => {
  // Fetch logic
}, [user?.id]);

const onRefresh = useCallback(async () => {
  setRefreshing(true);
  await fetchPantryData();
  setRefreshing(false);
}, [fetchPantryData]);
```

### FlatList Optimization

```typescript
<FlatList
  data={filteredItems}
  renderItem={renderPantryItem}
  keyExtractor={(item) => item.id}
  style={styles.list}
  scrollEnabled={false}
  showsVerticalScrollIndicator={false}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

### Search Debouncing

```typescript
// Could be enhanced with debouncing
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    // Search logic
  }, 300),
  []
);
```

## Integration Points

### Navigation Integration

```typescript
// From MainTabs
<Tab.Screen
  name="Pantry"
  component={PantryScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="archive" size={size} color={color} />
    ),
    headerShown: false,
  }}
/>

// Navigation to other screens
navigation.navigate('PantryScan');
navigation.navigate('UpgradeScreen');
```

### Hook Integration

```typescript
const { user } = useAuth();
const { performPantryScan, canPerformScan, isProcessing } = useAccessControl();
```

### Component Integration

```typescript
<ManualAddSheet 
  isVisible={isManualAddSheetVisible}
  onClose={handleCloseSheet}
  onSubmit={handleSaveItemFromSheet}
  mode={editingItem ? 'edit' : 'add'}
  initialItemData={editingItem}
  unitOptions={unitOptions}
/>
```

## Testing

### Unit Tests

```typescript
describe('PantryScreen', () => {
  it('renders pantry items correctly', () => {
    render(<PantryScreen />);
    expect(screen.getByText('My Pantry')).toBeInTheDocument();
  });

  it('handles search functionality', () => {
    render(<PantryScreen />);
    const searchInput = screen.getByPlaceholderText('Search your pantry...');
    
    fireEvent.changeText(searchInput, 'tomato');
    expect(searchInput.props.value).toBe('tomato');
  });

  it('shows access control for scanning', () => {
    const mockCanPerformScan = jest.fn().mockReturnValue(false);
    render(<PantryScreen />);
    
    const scanButton = screen.getByText('Scan Pantry');
    fireEvent.press(scanButton);
    
    expect(screen.getByText('Scan Limit Reached')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
describe('PantryScreen Integration', () => {
  it('fetches and displays pantry items', async () => {
    const mockItems = [
      { id: '1', item_name: 'tomato', quantity: 2, unit: 'units' }
    ];
    
    render(<PantryScreen />);
    
    await waitFor(() => {
      expect(screen.getByText('Tomato')).toBeInTheDocument();
    });
  });

  it('handles item deletion', async () => {
    render(<PantryScreen />);
    
    const deleteButton = screen.getByTestId('delete-button-1');
    fireEvent.press(deleteButton);
    
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
  });
});
```

## Accessibility

### Screen Reader Support

```typescript
<TouchableOpacity 
  style={styles.itemContainer}
  onPress={() => handleEditItem(item)}
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel={`${item.item_name}, ${item.quantity} ${item.unit}`}
  accessibilityHint="Double tap to edit this pantry item"
>
```

### Button Accessibility

```typescript
<Pressable
  style={styles.actionButton}
  onPress={handleScanPress}
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Scan pantry with camera"
  accessibilityHint="Opens camera to scan pantry items"
  disabled={!canPerformScan()}
>
```

## Future Enhancements

### Planned Features

1. **Barcode Scanning**: Scan product barcodes for automatic item addition
2. **Expiration Tracking**: Track expiration dates and send notifications
3. **Shopping List Integration**: Add missing items to shopping list
4. **Nutrition Information**: Display nutritional data for items
5. **Recipe Suggestions**: Suggest recipes based on available items

### Performance Improvements

1. **Virtual Scrolling**: For very large pantry inventories
2. **Image Caching**: Cache item images for faster loading
3. **Offline Support**: Local storage for offline pantry management
4. **Background Sync**: Sync changes when connection is restored

### UX Enhancements

1. **Drag and Drop**: Reorder items by dragging
2. **Bulk Operations**: Select multiple items for bulk actions
3. **Categories**: Organize items by categories (fruits, vegetables, etc.)
4. **Smart Suggestions**: Auto-complete item names based on common items

## Dependencies

### Required Packages

```json
{
  "react": "^18.x.x",
  "react-native": "^0.x.x",
  "@react-navigation/native": "^6.x.x",
  "react-native-safe-area-context": "^4.x.x",
  "@expo/vector-icons": "^13.x.x",
  "date-fns": "^2.x.x",
  "@supabase/supabase-js": "^2.x.x"
}
```

### Internal Dependencies

- `src/providers/AuthProvider.tsx`: Authentication context
- `src/hooks/useAccessControl.ts`: Access control for scanning
- `src/components/ManualAddSheet.tsx`: Add/edit item modal
- `src/services/supabase.ts`: Database client
- `src/utils/dateUtils.ts`: Date formatting utilities
- `src/navigation/types.ts`: Navigation type definitions

## Troubleshooting

### Common Issues

1. **Items Not Loading**: Check authentication and network connectivity
2. **Scan Button Disabled**: Verify FREEMIUM limits and tier status
3. **Search Not Working**: Check search query state management
4. **Items Not Saving**: Verify Supabase permissions and user session

### Debug Tips

```typescript
// Enable debug logging
const DEBUG_PANTRY = __DEV__;

if (DEBUG_PANTRY) {
  console.log('Pantry State:', {
    itemsCount: pantryItems.length,
    filteredCount: filteredItems.length,
    searchQuery,
    canScan: canPerformScan(),
    isLoading,
    error,
  });
}
```

### Performance Monitoring

```typescript
// Monitor render performance
const renderStart = performance.now();
// ... render logic
const renderEnd = performance.now();
console.log(`Pantry render time: ${renderEnd - renderStart}ms`);
```

## Conclusion

The `PantryScreen` provides a comprehensive, user-friendly interface for pantry management in KitchAI v2. It successfully integrates access control, search functionality, and smooth animations while maintaining excellent performance and accessibility standards.

---

**Last Updated**: January 2025  
**Component Version**: 2.0.0  
**Maintainer**: KitchAI Development Team 