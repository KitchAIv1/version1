# Client-Side Cache Clearing Guide for KitchAI App

## Overview

This guide provides comprehensive instructions for clearing client-side cache in the KitchAI app to resolve data inconsistency issues and improve performance. The app uses multiple caching mechanisms that may need to be cleared during debugging and testing.

## Caching Mechanisms in KitchAI

### 1. React Query Cache (@tanstack/react-query)
- **Purpose**: Caches API responses for better performance
- **Data Cached**: Feed data, profile data, recipe details, pantry items, etc.
- **Location**: In-memory cache managed by React Query

### 2. AsyncStorage (React Native)
- **Purpose**: Persistent local storage for app data and authentication
- **Data Cached**: Supabase auth sessions, user preferences, temporary data
- **Location**: Device local storage

### 3. Custom Cache Manager (useCacheManager.ts)
- **Purpose**: Manages optimistic updates and cache synchronization
- **Data Cached**: Recipe likes, saves, comments count, feed consistency
- **Location**: React Query cache with custom management logic

## Quick Cache Clearing Methods

### Method 1: Using the Cache Debug Panel (Development Only)

For development and testing, we've created a debug panel that provides easy access to cache clearing functions:

```typescript
import CacheDebugPanel from '../src/components/dev/CacheDebugPanel';

// Add to your development screen or component
const [showCacheDebug, setShowCacheDebug] = useState(false);

// In your render method
<CacheDebugPanel 
  visible={showCacheDebug}
  onClose={() => setShowCacheDebug(false)}
/>
```

**Features of the Debug Panel:**
- Clear all caches (React Query + AsyncStorage)
- Clear data only (preserves authentication)
- Clear specific cache types (profile, feed, pantry)
- Force refresh all queries
- View cache statistics
- View AsyncStorage keys

### Method 2: Programmatic Cache Clearing

Use the cache utility functions directly in your code:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { createCacheManager, clearAllCaches, clearDataCachesOnly } from '../src/utils/cacheUtils';

const Component = () => {
  const queryClient = useQueryClient();

  const handleClearAllCache = async () => {
    try {
      await clearAllCaches(queryClient);
      console.log('All caches cleared successfully');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  };

  const handleClearDataOnly = async () => {
    try {
      await clearDataCachesOnly(queryClient);
      console.log('Data caches cleared (auth preserved)');
    } catch (error) {
      console.error('Failed to clear data caches:', error);
    }
  };

  // For specific cache clearing
  const cacheManager = createCacheManager(queryClient);
  
  const handleClearProfileCache = async () => {
    await cacheManager.clearProfileCache();
  };
};
```

### Method 3: Manual Cache Clearing (Advanced)

For direct control over cache clearing:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

const manualCacheClear = async () => {
  const queryClient = useQueryClient();

  // 1. Clear React Query cache
  queryClient.clear();
  await queryClient.invalidateQueries();

  // 2. Clear AsyncStorage
  await AsyncStorage.clear();

  // 3. Force app restart (optional)
  // RNRestart.Restart(); // if using react-native-restart
};
```

## Specific Cache Clearing Scenarios

### Scenario 1: Profile Data Issues
When user profile data is not updating correctly:

```typescript
const clearProfileCache = async () => {
  const cacheManager = createCacheManager(queryClient);
  await cacheManager.clearProfileCache();
  
  // Or manually:
  await queryClient.invalidateQueries({ queryKey: ['profile'] });
  await queryClient.invalidateQueries({ queryKey: ['user'] });
  queryClient.removeQueries({ queryKey: ['profile'] });
  queryClient.removeQueries({ queryKey: ['user'] });
};
```

### Scenario 2: Feed Data Inconsistencies
When recipe feed shows outdated information:

```typescript
const clearFeedCache = async () => {
  const cacheManager = createCacheManager(queryClient);
  await cacheManager.clearFeedCache();
  
  // Or manually:
  await queryClient.invalidateQueries({ queryKey: ['feed'] });
  await queryClient.invalidateQueries({ queryKey: ['recipe'] });
  queryClient.removeQueries({ queryKey: ['feed'] });
  queryClient.removeQueries({ queryKey: ['recipe'] });
};
```

### Scenario 3: Authentication Issues
When users experience login/logout problems:

```typescript
const clearAuthCache = async () => {
  const cacheManager = createCacheManager(queryClient);
  await cacheManager.clearAuthStorageOnly();
  
  // Or manually clear auth-related AsyncStorage:
  const keys = await AsyncStorage.getAllKeys();
  const authKeys = keys.filter(key => 
    key.includes('supabase') || 
    key.includes('auth') || 
    key.includes('session')
  );
  if (authKeys.length > 0) {
    await AsyncStorage.multiRemove(authKeys);
  }
};
```

## Force Refresh Without Clearing Cache

Sometimes you just need to refresh data without clearing the cache:

```typescript
const forceRefresh = async () => {
  const queryClient = useQueryClient();
  
  // Invalidate all queries to trigger refetch
  await queryClient.invalidateQueries();
  
  // Or invalidate specific queries
  await queryClient.invalidateQueries({ queryKey: ['profile'] });
  await queryClient.invalidateQueries({ queryKey: ['feed'] });
  
  // Force refetch all active queries
  await queryClient.refetchQueries();
};
```

## Platform-Specific Hard Refresh

### React Native (Mobile)
- **iOS**: Close and reopen the app, or shake device and select "Reload"
- **Android**: Close and reopen the app, or shake device and select "Reload"
- **Development**: Use Metro bundler reload (Ctrl+R or Cmd+R)

### Web (if applicable)
- **Hard Refresh**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- **Clear Storage**: Open DevTools → Application → Storage → Clear Site Data

## Testing Cache Clearing

To verify cache clearing is working correctly:

### 1. Check Console Logs
All cache operations log their actions:
```
[CacheManager] Clearing React Query cache...
[CacheManager] React Query cache cleared successfully
[CacheManager] Clearing AsyncStorage...
[CacheManager] AsyncStorage cleared successfully
```

### 2. Monitor Network Requests
After clearing cache, you should see:
- Fresh API requests being made
- No cached responses being served
- New data being fetched from the server

### 3. Verify Data Updates
- Profile information should reflect latest changes
- Feed should show most recent posts
- Pantry items should be up-to-date

## Debugging Cache Issues

### Common Cache-Related Problems

1. **Stale Profile Data**
   - **Symptoms**: Profile shows old information after updates
   - **Solution**: Clear profile cache or force refresh profile queries

2. **Feed Not Updating**
   - **Symptoms**: New recipes not appearing, old likes/saves showing
   - **Solution**: Clear feed cache and refresh

3. **Authentication Persistence Issues**
   - **Symptoms**: Users logged out unexpectedly or login not persisting
   - **Solution**: Clear only auth storage or full AsyncStorage

4. **Pantry Data Inconsistencies**
   - **Symptoms**: Added/removed items not showing correctly
   - **Solution**: Clear pantry cache and refresh

### Debug Information

To get cache information for debugging:

```typescript
// Get React Query cache info
const cache = queryClient.getQueryCache();
const queries = cache.getAll();
console.log('Total cached queries:', queries.length);
console.log('Cache keys:', queries.map(q => q.queryKey));

// Get AsyncStorage info
const keys = await AsyncStorage.getAllKeys();
console.log('AsyncStorage keys:', keys);

// Get specific cached data
const profileData = queryClient.getQueryData(['profile']);
const feedData = queryClient.getQueryData(['feed']);
console.log('Cached profile:', profileData);
console.log('Cached feed:', feedData);
```

## Best Practices

### 1. Selective Cache Clearing
- Clear only specific caches when possible
- Preserve authentication data unless specifically troubleshooting auth issues
- Use `clearDataCachesOnly()` instead of `clearAllCaches()` when appropriate

### 2. User Experience
- Inform users when cache clearing will require re-login
- Provide loading indicators during cache operations
- Consider showing a success message after clearing

### 3. Development vs Production
- Use the debug panel only in development builds
- Log cache operations for debugging
- Implement proper error handling for cache operations

### 4. Testing
- Test cache clearing on both iOS and Android
- Verify that cleared data is properly refetched
- Ensure no crashes occur during cache operations

## Emergency Cache Clear

For critical issues where the app is unusable due to cache problems:

```typescript
const emergencyCacheClear = async () => {
  try {
    // Nuclear option - clear everything
    const queryClient = useQueryClient();
    
    // Clear all React Query cache
    queryClient.clear();
    await queryClient.invalidateQueries();
    
    // Clear all AsyncStorage
    await AsyncStorage.clear();
    
    // Show user message
    Alert.alert(
      'Cache Cleared', 
      'All app data has been cleared. Please restart the app and log in again.',
      [{ text: 'OK', onPress: () => {
        // Optionally restart the app
        // RNRestart.Restart();
      }}]
    );
  } catch (error) {
    console.error('Emergency cache clear failed:', error);
    Alert.alert('Error', 'Failed to clear app cache. Please reinstall the app.');
  }
};
```

## Implementation Checklist

- [ ] Import cache utilities into relevant components
- [ ] Add cache debug panel to development builds
- [ ] Implement cache clearing buttons in settings (if needed)
- [ ] Add proper error handling for cache operations
- [ ] Test cache clearing on both platforms
- [ ] Verify data refetch after cache clear
- [ ] Document any custom cache clearing requirements
- [ ] Train team on when and how to use cache clearing

## Support and Troubleshooting

If cache clearing doesn't resolve the issue:

1. **Check Console Logs**: Look for error messages during cache operations
2. **Verify Network Connectivity**: Ensure the app can reach the API
3. **Test on Different Devices**: Cache issues might be device-specific
4. **Check API Responses**: Verify the backend is returning correct data
5. **Consider App Reinstall**: As a last resort for persistent cache issues

For additional support, refer to the React Query documentation and AsyncStorage documentation for platform-specific issues. 