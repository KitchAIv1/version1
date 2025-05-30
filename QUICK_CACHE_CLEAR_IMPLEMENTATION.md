# Quick Cache Clear Implementation Guide

## Immediate Actions Required

### Step 1: Add Cache Clearing to Existing Components

Add this import to any screen where you want to test cache clearing:

```typescript
import { useCacheDebug } from '../hooks/useCacheDebug';
```

Then in your component:

```typescript
const SomeScreen = () => {
  const { showCacheClearDialog, clearDataCachesOnly, forceRefreshAllQueries } = useCacheDebug();

  // Add a temporary button for testing
  const handleCacheTest = () => {
    showCacheClearDialog(); // Shows user-friendly dialog
  };

  return (
    <View>
      {/* Your existing UI */}
      
      {/* Temporary cache test button - REMOVE IN PRODUCTION */}
      {__DEV__ && (
        <TouchableOpacity onPress={handleCacheTest} style={{ padding: 20, backgroundColor: '#f00' }}>
          <Text style={{ color: '#fff' }}>🧹 Clear Cache (DEV ONLY)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### Step 2: Quick Cache Clearing Functions

For immediate testing, use these functions directly:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { clearDataCachesOnly, forceRefreshApp } from '../utils/cacheUtils';

// In any component
const quickCacheClear = async () => {
  const queryClient = useQueryClient();
  
  try {
    // Option 1: Clear data cache (preserves auth)
    await clearDataCachesOnly(queryClient);
    console.log('Data cache cleared successfully');
    
    // Option 2: Force refresh (no cache clearing)
    // await forceRefreshApp(queryClient);
    
  } catch (error) {
    console.error('Cache clear failed:', error);
  }
};
```

### Step 3: Platform-Specific Force Refresh

#### React Native Development
1. **Shake device** → Select "Reload"
2. **Metro bundler**: Press `r` in terminal or `Cmd+R` (iOS) / `Ctrl+R` (Android)
3. **Close and reopen app** completely

#### Manual Cache Clear for Testing
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Nuclear option - clear everything
const emergencyReset = async () => {
  const queryClient = useQueryClient();
  
  // Clear React Query
  queryClient.clear();
  
  // Clear AsyncStorage
  await AsyncStorage.clear();
  
  // Restart app or navigate to login
  Alert.alert('Cache Cleared', 'Please restart the app');
};
```

## Test Scenarios

### Test 1: Profile Data Issues
```typescript
const { clearProfileCache } = useCacheDebug();

// After making profile changes that aren't showing
await clearProfileCache();
```

### Test 2: Feed Not Updating
```typescript
const { clearFeedCache } = useCacheDebug();

// When new recipes aren't appearing
await clearFeedCache();
```

### Test 3: General App Issues
```typescript
const { clearDataCachesOnly } = useCacheDebug();

// Safe cache clear that preserves login
await clearDataCachesOnly();
```

## Quick Debug Commands

Add these to any screen for immediate debugging:

```typescript
const DebugButtons = () => {
  const { logCacheState, getCacheStats } = useCacheDebug();
  
  return __DEV__ ? (
    <View style={{ position: 'absolute', top: 100, right: 20, zIndex: 1000 }}>
      <TouchableOpacity onPress={logCacheState} style={debugButtonStyle}>
        <Text>📊 Log Cache Stats</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => console.log(getCacheStats())} style={debugButtonStyle}>
        <Text>🔍 Show Cache Info</Text>
      </TouchableOpacity>
    </View>
  ) : null;
};

const debugButtonStyle = {
  backgroundColor: '#007bff',
  padding: 10,
  margin: 5,
  borderRadius: 5,
};
```

## Verification Steps

After clearing cache, verify:

1. **Console logs** show cache clearing messages
2. **Network tab** shows fresh API requests
3. **Data updates** reflect latest changes
4. **No errors** in console during cache operations

## Emergency Actions

If the app becomes unusable:

1. **Hard refresh**: Close app completely and reopen
2. **Clear all storage**: Use the emergency reset function above
3. **Reinstall app**: Delete and reinstall if cache issues persist

## Implementation Priority

1. ✅ **High Priority**: Add cache debug hook to main screens (Profile, Feed, Pantry)
2. ✅ **Medium Priority**: Add development cache debug buttons
3. ✅ **Low Priority**: Implement cache debug panel for comprehensive testing

## Common Cache Keys in KitchAI

Monitor these React Query cache keys:
- `['profile']` - User profile data
- `['feed']` - Recipe feed
- `['pantry']` - Pantry items
- `['recipeDetails', recipeId, userId]` - Recipe details
- `['recipe-comments', recipeId]` - Recipe comments

## Quick Testing Script

```typescript
// Add this to any component for quick testing
const runCacheTest = async () => {
  const { logCacheState, clearDataCachesOnly, forceRefreshAllQueries } = useCacheDebug();
  
  console.log('=== CACHE TEST START ===');
  
  // 1. Log initial state
  logCacheState();
  
  // 2. Clear cache
  await clearDataCachesOnly();
  
  // 3. Wait and refresh
  setTimeout(async () => {
    await forceRefreshAllQueries();
    logCacheState();
    console.log('=== CACHE TEST END ===');
  }, 2000);
};
```

This should give you immediate cache clearing capabilities for testing and debugging! 