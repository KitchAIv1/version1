# Pantry Scanning Feature Documentation

## Overview

The Pantry Scanning feature provides AI-powered recognition of pantry items using the device camera. Users can scan their pantry items, and the system will automatically identify and add them to their digital pantry inventory.

## Architecture

### Core Components

#### 1. **PantryScanningScreen** (`src/screens/pantry/PantryScanningScreen.tsx`)
- Main screen that orchestrates the entire scanning workflow
- Manages camera permissions and interface
- Handles AI processing and user confirmation
- Integrates with real-time updates

#### 2. **Pantry Components** (`src/components/pantry/`)
- **CameraInterface**: Custom camera UI with capture controls
- **ScanningLoadingOverlay**: Animated loading screen during AI processing
- **ItemConfirmationModal**: User interface for reviewing and editing scanned items

#### 3. **Scanning Utilities** (`src/utils/pantryScanning/`)
- **imageProcessing**: AI recognition service integration
- **duplicateHandling**: Smart duplicate detection and user choice handling
- **unitConversion**: Unit standardization and conversion logic

#### 4. **Real-time Integration** (`src/hooks/useStockRealtime.ts`)
- WebSocket subscriptions for immediate UI updates
- Cache invalidation for React Query
- Cross-screen synchronization

## Scanning Flow

### 1. Camera Permission Management
```typescript
const ensureCameraPermission = async (): Promise<boolean> => {
  // Request camera permissions
  // Handle denied/permanent denial states
  // Show appropriate user guidance
}
```

### 2. Image Capture
```typescript
const handleCameraCapture = async () => {
  // Take high-quality photo (0.7 quality, base64 enabled)
  // Provide haptic feedback
  // Start loading animation
}
```

### 3. AI Processing
```typescript
const processImageWithAI = async (base64Image: string) => {
  // Send to recognize-stock edge function
  // Parse JSON response (handles markdown-wrapped JSON)
  // Return structured item data
}
```

### 4. Item Recognition
- Uses OpenAI GPT-4o model for image analysis
- Identifies item names and quantities
- Handles various packaging types and labels
- Returns structured data with confidence scoring

### 5. User Confirmation
```typescript
const ItemConfirmationModal = ({ items, onConfirm, onCancel }) => {
  // Display recognized items
  // Allow editing of names, quantities, units
  // Handle duplicate detection
  // Provide confirmation controls
}
```

### 6. Duplicate Handling
```typescript
const processItemsForDuplicates = async (items, userId) => {
  // Check against existing stock
  // Present user choices for duplicates:
  //   - Add to existing quantity
  //   - Replace existing entry
  //   - Cancel addition
}
```

### 7. Database Storage
```typescript
const handleConfirmItems = async (itemsToUpsert) => {
  // Upsert items to stock table
  // Handle storage location defaults
  // Manage created_at timestamps
}
```

### 8. Real-time Updates
```typescript
const useStockRealtime = (userId) => {
  // Subscribe to stock table changes
  // Invalidate React Query cache
  // Update all pantry screens immediately
}
```

## Technical Implementation

### Edge Function Integration

The scanning feature uses the `recognize-stock` Supabase Edge Function:

```typescript
// Edge Function Call
const { data, error } = await supabase.functions.invoke('recognize-stock', {
  body: { image: base64Image }
});

// Expected Response Format
{
  items: [
    { name: "Milk", quantity: "1 gallon" },
    { name: "Bread", quantity: "1 loaf" }
  ]
}
```

### Unit Conversion System

The system handles various unit formats and converts them to standardized backend units:

```typescript
// Frontend Units → Backend Units
const unitToBackend = {
  'carton': { unit: 'ml', multiplier: 946 },
  'bottle': { unit: 'ml', multiplier: 750 },
  'kg': { unit: 'g', multiplier: 1000 },
  'l': { unit: 'ml', multiplier: 1000 }
};
```

### Duplicate Detection Logic

```typescript
// Smart duplicate detection
const processItemsForDuplicates = async (items, userId) => {
  const existingStock = await fetchCurrentStock(userId);
  const stockMap = createStockMap(existingStock);
  
  // Separate new items from duplicates
  for (const item of items) {
    const existing = stockMap.get(item.name.toLowerCase());
    if (existing) {
      // Handle duplicate with user choice
    } else {
      // Add as new item
    }
  }
};
```

## Database Schema

### Stock Table Structure
```sql
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  description TEXT,
  storage_location storage_location_type DEFAULT 'cupboard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Storage Location Enum
```sql
CREATE TYPE storage_location_type AS ENUM (
  'refrigerator', 'freezer', 'cupboard', 'condiments', 'fridge', 'pantry'
);
```

## Real-time Features

### WebSocket Subscriptions
```typescript
const subscription = supabase
  .channel(`stock-${userId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public', 
    table: 'stock',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Handle real-time updates
    queryClient.invalidateQueries(['stock']);
  })
  .subscribe();
```

### Cache Management
- Automatic React Query cache invalidation
- Cross-screen data synchronization
- Optimistic updates for better UX

## Error Handling

### Common Error Scenarios
1. **Camera Permission Denied**: Graceful fallback with settings guidance
2. **Network Issues**: Retry logic with user feedback
3. **AI Recognition Failures**: Fallback to manual entry
4. **Database Errors**: Transaction rollback and user notification
5. **Duplicate Conflicts**: User choice preservation

### Error Recovery
```typescript
try {
  const result = await processImageWithAI(image);
} catch (error) {
  if (error.message.includes('network')) {
    // Show retry option
  } else if (error.message.includes('recognition')) {
    // Fallback to manual entry
  } else {
    // Generic error handling
  }
}
```

## Performance Optimizations

### Image Processing
- Optimal quality settings (0.7) for balance of speed/accuracy
- Base64 encoding for edge function compatibility
- Minimum display time for smooth UX

### Database Operations
- Batch upsert operations for multiple items
- Optimized queries with proper indexing
- Connection pooling for edge functions

### Real-time Updates
- Selective cache invalidation
- Debounced update handling
- Efficient WebSocket management

## Testing Strategy

### Unit Tests
- Image processing utilities
- Unit conversion logic
- Duplicate detection algorithms

### Integration Tests
- End-to-end scanning workflow
- Database operations
- Real-time synchronization

### User Testing
- Camera interface usability
- AI recognition accuracy
- Duplicate handling UX

## Troubleshooting

### Common Issues

1. **"No Items Recognized"**
   - Check lighting conditions
   - Ensure clear item visibility
   - Try different camera angles

2. **"Function Error: Edge Function returned non-2xx status"**
   - Verify OpenAI API key configuration
   - Check edge function deployment
   - Monitor function logs

3. **"Real-time updates not working"**
   - Verify WebSocket connection
   - Check Supabase realtime configuration
   - Ensure proper authentication

### Debug Tools
- Console logging with prefixed tags
- Error boundary components
- Performance monitoring
- User feedback collection

## Future Enhancements

### Planned Features
1. **Barcode Scanning**: Direct UPC/EAN code recognition
2. **Batch Processing**: Multiple image scanning
3. **Smart Suggestions**: ML-based item recommendations
4. **Nutrition Integration**: Automatic nutritional data lookup
5. **Expiration Tracking**: Smart expiry date detection

### Technical Improvements
1. **Offline Support**: Local processing capabilities
2. **Image Optimization**: Advanced compression algorithms
3. **Caching Strategy**: Intelligent result caching
4. **Performance Metrics**: Detailed analytics integration

## Conclusion

The Pantry Scanning feature represents a sophisticated integration of AI, real-time data synchronization, and user experience design. It provides users with a seamless way to digitize their pantry inventory while maintaining data accuracy and system performance. 