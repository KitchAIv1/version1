# useAccessControl Hook Documentation

## Overview

The `useAccessControl` hook is a critical custom hook that manages the FREEMIUM/PREMIUM access control system in KitchAI v2. It enforces usage limits, tracks user activity, and provides seamless access control for tier-restricted features like pantry scanning and AI recipe generation.

## Location
`src/hooks/useAccessControl.ts`

## Purpose

- **Access Control**: Enforce FREEMIUM/PREMIUM tier restrictions
- **Usage Tracking**: Monitor and log user activity for limited features
- **Limit Enforcement**: Prevent overuse of restricted features
- **User Experience**: Provide clear feedback on usage limits and upgrade prompts
- **Backend Integration**: Seamlessly integrate with Supabase RPC functions

## Architecture

### Hook Interface

```typescript
interface UseAccessControlReturn {
  // Access checks
  canPerformScan: () => boolean;
  canGenerateAIRecipe: () => boolean;
  
  // Usage information
  scanUsage: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  aiRecipeUsage: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  
  // Actions with usage tracking
  performPantryScan: (items: PantryItem[], scanStatus: ScanStatus) => Promise<boolean>;
  generateAIRecipe: (recipeData: AIRecipeData) => Promise<any>;
  
  // Display helpers
  getUsageDisplay: () => UsageDisplayData;
  getUpgradeMessage: (feature: FeatureType) => string;
  
  // State
  isLoading: boolean;
  error: string | null;
}
```

### Type Definitions

```typescript
interface PantryItem {
  item_name: string;
  quantity: number;
  unit: string;
  description?: string;
}

interface ScanStatus {
  success: boolean;
  items_detected: number;
  confidence_score?: number;
}

interface AIRecipeData {
  ingredients: string[];
  dietary_preferences?: string[];
  cuisine_type?: string;
  difficulty_level?: string;
}

interface UsageDisplayData {
  scanDisplay: string;
  aiRecipeDisplay: string;
  showUpgradePrompt: boolean;
  nextResetDate: string;
}

type FeatureType = 'pantry_scan' | 'ai_recipe';
```

## Key Features

### 1. Tier-Based Access Control

**FREEMIUM Limits**:
- Pantry scans: 3 per month
- AI recipe generation: 10 per month
- Monthly reset cycle

**PREMIUM/CREATOR Benefits**:
- Unlimited access to all features
- No usage tracking required
- Enhanced user experience

### 2. Real-time Usage Tracking

**Usage Monitoring**:
- Real-time usage count updates
- Automatic limit enforcement
- Monthly reset handling

**Backend Synchronization**:
- Server-side usage validation
- Secure usage logging
- Consistent state management

### 3. User Experience Features

**Clear Feedback**:
- Usage progress indicators
- Remaining usage display
- Upgrade prompts when needed

**Graceful Degradation**:
- Smooth limit enforcement
- Alternative feature suggestions
- Clear upgrade paths

## Implementation Details

### Main Hook Structure

```typescript
export const useAccessControl = () => {
  const { user, profile, usageLimits, isPremium, refreshUsageLimits } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Constants
  const FREEMIUM_SCAN_LIMIT = 3;
  const FREEMIUM_AI_RECIPE_LIMIT = 10;

  // Access check functions
  const canPerformScan = useCallback(() => {
    if (isPremium) return true;
    return (usageLimits?.scan_count || 0) < FREEMIUM_SCAN_LIMIT;
  }, [isPremium, usageLimits?.scan_count]);

  const canGenerateAIRecipe = useCallback(() => {
    if (isPremium) return true;
    return (usageLimits?.ai_recipe_count || 0) < FREEMIUM_AI_RECIPE_LIMIT;
  }, [isPremium, usageLimits?.ai_recipe_count]);

  // Usage calculations
  const scanUsage = useMemo(() => {
    const used = usageLimits?.scan_count || 0;
    const limit = FREEMIUM_SCAN_LIMIT;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentage: (used / limit) * 100,
    };
  }, [usageLimits?.scan_count]);

  const aiRecipeUsage = useMemo(() => {
    const used = usageLimits?.ai_recipe_count || 0;
    const limit = FREEMIUM_AI_RECIPE_LIMIT;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentage: (used / limit) * 100,
    };
  }, [usageLimits?.ai_recipe_count]);

  return {
    canPerformScan,
    canGenerateAIRecipe,
    scanUsage,
    aiRecipeUsage,
    performPantryScan,
    generateAIRecipe,
    getUsageDisplay,
    getUpgradeMessage,
    isLoading,
    error,
  };
};
```

### Pantry Scan Implementation

```typescript
const performPantryScan = useCallback(async (
  items: PantryItem[],
  scanStatus: ScanStatus
): Promise<boolean> => {
  if (!user?.id) {
    setError('User not authenticated');
    return false;
  }

  // Check access before proceeding
  if (!canPerformScan()) {
    setError('Scan limit reached. Upgrade to Premium for unlimited scans.');
    return false;
  }

  setIsLoading(true);
  setError(null);

  try {
    // Call backend RPC function
    const { data, error: rpcError } = await supabase.rpc('log_pantry_scan', {
      user_id: user.id,
      items_scanned: items,
      scan_status: scanStatus,
    });

    if (rpcError) throw rpcError;

    // Refresh usage limits
    await refreshUsageLimits();

    // Log analytics
    analytics.track('pantry_scan_completed', {
      user_id: user.id,
      items_count: items.length,
      scan_success: scanStatus.success,
      usage_after: (usageLimits?.scan_count || 0) + 1,
    });

    return true;
  } catch (error) {
    console.error('Error performing pantry scan:', error);
    setError('Failed to process scan. Please try again.');
    return false;
  } finally {
    setIsLoading(false);
  }
}, [user?.id, canPerformScan, usageLimits?.scan_count, refreshUsageLimits]);
```

### AI Recipe Generation Implementation

```typescript
const generateAIRecipe = useCallback(async (
  recipeData: AIRecipeData
): Promise<any> => {
  if (!user?.id) {
    setError('User not authenticated');
    return null;
  }

  // Check access before proceeding
  if (!canGenerateAIRecipe()) {
    setError('AI recipe limit reached. Upgrade to Premium for unlimited generation.');
    return null;
  }

  setIsLoading(true);
  setError(null);

  try {
    // Call backend RPC function
    const { data, error: rpcError } = await supabase.rpc('generate_ai_recipe', {
      user_id: user.id,
      recipe_data: recipeData,
    });

    if (rpcError) throw rpcError;

    // Refresh usage limits
    await refreshUsageLimits();

    // Log analytics
    analytics.track('ai_recipe_generated', {
      user_id: user.id,
      ingredients_count: recipeData.ingredients.length,
      cuisine_type: recipeData.cuisine_type,
      usage_after: (usageLimits?.ai_recipe_count || 0) + 1,
    });

    return data;
  } catch (error) {
    console.error('Error generating AI recipe:', error);
    setError('Failed to generate recipe. Please try again.');
    return null;
  } finally {
    setIsLoading(false);
  }
}, [user?.id, canGenerateAIRecipe, usageLimits?.ai_recipe_count, refreshUsageLimits]);
```

### Usage Display Helpers

```typescript
const getUsageDisplay = useCallback((): UsageDisplayData => {
  if (isPremium) {
    return {
      scanDisplay: 'Unlimited',
      aiRecipeDisplay: 'Unlimited',
      showUpgradePrompt: false,
      nextResetDate: '',
    };
  }

  const nextReset = getNextResetDate(usageLimits?.last_reset);
  
  return {
    scanDisplay: `${scanUsage.used}/${scanUsage.limit} scans used`,
    aiRecipeDisplay: `${aiRecipeUsage.used}/${aiRecipeUsage.limit} recipes generated`,
    showUpgradePrompt: scanUsage.remaining === 0 || aiRecipeUsage.remaining === 0,
    nextResetDate: nextReset,
  };
}, [isPremium, scanUsage, aiRecipeUsage, usageLimits?.last_reset]);

const getUpgradeMessage = useCallback((feature: FeatureType): string => {
  if (isPremium) return '';

  const messages = {
    pantry_scan: `You've used all ${FREEMIUM_SCAN_LIMIT} monthly scans. Upgrade to Premium for unlimited pantry scanning!`,
    ai_recipe: `You've used all ${FREEMIUM_AI_RECIPE_LIMIT} monthly AI recipes. Upgrade to Premium for unlimited recipe generation!`,
  };

  return messages[feature];
}, [isPremium]);

const getNextResetDate = (lastReset: string | null): string => {
  if (!lastReset) return '';
  
  const resetDate = new Date(lastReset);
  resetDate.setMonth(resetDate.getMonth() + 1);
  
  return resetDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};
```

## Usage Examples

### Basic Access Check

```typescript
import { useAccessControl } from '../hooks/useAccessControl';

const PantryScanButton = () => {
  const { canPerformScan, scanUsage, getUpgradeMessage } = useAccessControl();
  const navigation = useNavigation();

  const handleScanPress = () => {
    if (canPerformScan()) {
      navigation.navigate('PantryScan');
    } else {
      Alert.alert(
        'Scan Limit Reached',
        getUpgradeMessage('pantry_scan'),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('UpgradeScreen') },
        ]
      );
    }
  };

  return (
    <View>
      <Pressable
        style={[styles.scanButton, !canPerformScan() && styles.disabled]}
        onPress={handleScanPress}
        disabled={!canPerformScan()}
      >
        <Text style={styles.buttonText}>Scan Pantry</Text>
      </Pressable>
      <Text style={styles.usageText}>
        {scanUsage.remaining} scans remaining this month
      </Text>
    </View>
  );
};
```

### Pantry Scanning with Usage Tracking

```typescript
const PantryScanScreen = () => {
  const { performPantryScan, isLoading, error } = useAccessControl();
  const [scannedItems, setScannedItems] = useState<PantryItem[]>([]);

  const handleScanComplete = async (items: PantryItem[]) => {
    const scanStatus: ScanStatus = {
      success: true,
      items_detected: items.length,
      confidence_score: 0.85,
    };

    const success = await performPantryScan(items, scanStatus);
    
    if (success) {
      setScannedItems(items);
      showToast('Scan completed successfully!');
    } else {
      showToast(error || 'Scan failed');
    }
  };

  return (
    <View style={styles.container}>
      <CameraView onScanComplete={handleScanComplete} />
      {isLoading && <LoadingOverlay />}
      {error && <ErrorMessage message={error} />}
    </View>
  );
};
```

### AI Recipe Generation

```typescript
const AIRecipeGenerator = () => {
  const { generateAIRecipe, canGenerateAIRecipe, aiRecipeUsage } = useAccessControl();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [generatedRecipe, setGeneratedRecipe] = useState(null);

  const handleGenerateRecipe = async () => {
    if (!canGenerateAIRecipe()) {
      Alert.alert('Limit Reached', 'Upgrade to Premium for unlimited AI recipes');
      return;
    }

    const recipeData: AIRecipeData = {
      ingredients,
      dietary_preferences: ['vegetarian'],
      cuisine_type: 'italian',
      difficulty_level: 'medium',
    };

    const recipe = await generateAIRecipe(recipeData);
    if (recipe) {
      setGeneratedRecipe(recipe);
    }
  };

  return (
    <View style={styles.container}>
      <IngredientSelector
        ingredients={ingredients}
        onIngredientsChange={setIngredients}
      />
      
      <Pressable
        style={[styles.generateButton, !canGenerateAIRecipe() && styles.disabled]}
        onPress={handleGenerateRecipe}
        disabled={!canGenerateAIRecipe()}
      >
        <Text style={styles.buttonText}>Generate Recipe</Text>
      </Pressable>
      
      <UsageIndicator usage={aiRecipeUsage} />
      
      {generatedRecipe && (
        <GeneratedRecipeDisplay recipe={generatedRecipe} />
      )}
    </View>
  );
};
```

### Usage Display Component

```typescript
const UsageDisplay = () => {
  const { getUsageDisplay, isPremium } = useAccessControl();
  const navigation = useNavigation();
  
  const usageData = getUsageDisplay();

  if (isPremium) {
    return (
      <View style={styles.premiumBadge}>
        <Icon name="star" color={colors.gold} />
        <Text style={styles.premiumText}>Premium Member</Text>
      </View>
    );
  }

  return (
    <View style={styles.usageContainer}>
      <Text style={styles.usageTitle}>Monthly Usage</Text>
      
      <View style={styles.usageItem}>
        <Text style={styles.usageLabel}>Pantry Scans</Text>
        <Text style={styles.usageValue}>{usageData.scanDisplay}</Text>
      </View>
      
      <View style={styles.usageItem}>
        <Text style={styles.usageLabel}>AI Recipes</Text>
        <Text style={styles.usageValue}>{usageData.aiRecipeDisplay}</Text>
      </View>
      
      <Text style={styles.resetText}>
        Resets on {usageData.nextResetDate}
      </Text>
      
      {usageData.showUpgradePrompt && (
        <Pressable
          style={styles.upgradeButton}
          onPress={() => navigation.navigate('UpgradeScreen')}
        >
          <Text style={styles.upgradeText}>Upgrade to Premium</Text>
        </Pressable>
      )}
    </View>
  );
};
```

## Error Handling

### Access Control Errors

```typescript
const handleAccessError = useCallback((feature: FeatureType, error: string) => {
  // Log error for analytics
  analytics.track('access_control_error', {
    feature,
    error_message: error,
    user_tier: isPremium ? 'premium' : 'freemium',
  });

  // Show appropriate user message
  if (error.includes('limit reached')) {
    showUpgradePrompt(feature);
  } else {
    showToast('Something went wrong. Please try again.');
  }
}, [isPremium]);

const showUpgradePrompt = useCallback((feature: FeatureType) => {
  const message = getUpgradeMessage(feature);
  
  Alert.alert(
    'Upgrade Required',
    message,
    [
      { text: 'Maybe Later', style: 'cancel' },
      { 
        text: 'Upgrade Now', 
        onPress: () => navigation.navigate('UpgradeScreen', { feature })
      },
    ]
  );
}, [getUpgradeMessage, navigation]);
```

### Network Error Handling

```typescript
const handleNetworkError = useCallback((error: Error) => {
  if (error.message.includes('network')) {
    setError('Please check your internet connection');
  } else if (error.message.includes('unauthorized')) {
    setError('Please log in to continue');
  } else {
    setError('Something went wrong. Please try again.');
  }
}, []);
```

## Performance Considerations

### Memoization

```typescript
const useAccessControl = () => {
  // Memoize expensive calculations
  const scanUsage = useMemo(() => {
    const used = usageLimits?.scan_count || 0;
    const limit = FREEMIUM_SCAN_LIMIT;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentage: (used / limit) * 100,
    };
  }, [usageLimits?.scan_count]);

  // Memoize callback functions
  const canPerformScan = useCallback(() => {
    if (isPremium) return true;
    return (usageLimits?.scan_count || 0) < FREEMIUM_SCAN_LIMIT;
  }, [isPremium, usageLimits?.scan_count]);

  return { scanUsage, canPerformScan };
};
```

### Debounced Updates

```typescript
const debouncedRefreshLimits = useMemo(
  () => debounce(refreshUsageLimits, 1000),
  [refreshUsageLimits]
);
```

## Testing

### Unit Tests

```typescript
describe('useAccessControl', () => {
  const mockUser = { id: 'user1', tier: 'FREEMIUM' };
  const mockUsageLimits = { scan_count: 2, ai_recipe_count: 8 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow scans when under limit', () => {
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => (
        <AuthProvider value={{ user: mockUser, usageLimits: mockUsageLimits }}>
          {children}
        </AuthProvider>
      ),
    });

    expect(result.current.canPerformScan()).toBe(true);
  });

  it('should block scans when limit reached', () => {
    const limitReachedUsage = { scan_count: 3, ai_recipe_count: 8 };
    
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => (
        <AuthProvider value={{ user: mockUser, usageLimits: limitReachedUsage }}>
          {children}
        </AuthProvider>
      ),
    });

    expect(result.current.canPerformScan()).toBe(false);
  });

  it('should allow unlimited access for premium users', () => {
    const premiumUser = { id: 'user1', tier: 'PREMIUM' };
    
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => (
        <AuthProvider value={{ user: premiumUser, isPremium: true }}>
          {children}
        </AuthProvider>
      ),
    });

    expect(result.current.canPerformScan()).toBe(true);
    expect(result.current.canGenerateAIRecipe()).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('useAccessControl Integration', () => {
  it('should track usage after successful scan', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    };

    const { result } = renderHook(() => useAccessControl());
    
    const items: PantryItem[] = [
      { item_name: 'tomato', quantity: 2, unit: 'pieces' },
    ];
    
    const scanStatus: ScanStatus = {
      success: true,
      items_detected: 1,
    };

    await act(async () => {
      await result.current.performPantryScan(items, scanStatus);
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('log_pantry_scan', {
      user_id: 'user1',
      items_scanned: items,
      scan_status: scanStatus,
    });
  });
});
```

## Security Considerations

### Server-Side Validation

```typescript
// All access control is validated server-side
const performPantryScan = async (items: PantryItem[], scanStatus: ScanStatus) => {
  // Client-side check for UX only
  if (!canPerformScan()) {
    setError('Scan limit reached');
    return false;
  }

  // Server-side validation in RPC function
  const { data, error } = await supabase.rpc('log_pantry_scan', {
    user_id: user.id,
    items_scanned: items,
    scan_status: scanStatus,
  });

  // Server will reject if limits exceeded
  if (error) throw error;
  return true;
};
```

### Data Privacy

```typescript
// Minimal data logging
const logUsage = (feature: FeatureType, success: boolean) => {
  analytics.track('feature_usage', {
    feature,
    success,
    user_tier: isPremium ? 'premium' : 'freemium',
    // No personal data logged
  });
};
```

## Future Enhancements

### Planned Features

1. **Dynamic Limits**: Configurable limits per tier
2. **Usage Analytics**: Detailed usage insights
3. **Rollover Credits**: Unused credits carry over
4. **Feature Trials**: Temporary premium access

### Performance Improvements

1. **Caching**: Cache usage data locally
2. **Background Sync**: Sync usage in background
3. **Optimistic Updates**: Immediate UI feedback

## Dependencies

### Required Packages

```json
{
  "react": "^18.x.x",
  "react-native": "^0.x.x",
  "@supabase/supabase-js": "^2.x.x"
}
```

### Internal Dependencies

- `src/providers/AuthProvider.tsx`: Authentication context
- `src/services/supabase.ts`: Supabase client
- `src/utils/analytics.ts`: Analytics tracking

## Troubleshooting

### Common Issues

1. **Usage Not Updating**: Check network connectivity
2. **Limits Not Enforced**: Verify server-side RPC functions
3. **Premium Users Seeing Limits**: Check tier assignment

### Debug Tips

```typescript
// Enable debug logging
const DEBUG_ACCESS_CONTROL = __DEV__;

if (DEBUG_ACCESS_CONTROL) {
  console.log('Access Control State:', {
    isPremium,
    scanUsage,
    aiRecipeUsage,
    canPerformScan: canPerformScan(),
    canGenerateAIRecipe: canGenerateAIRecipe(),
  });
}
```

## Conclusion

The `useAccessControl` hook provides a robust, secure foundation for implementing tier-based access control in KitchAI v2, ensuring a smooth user experience while protecting premium features and encouraging upgrades.

---

**Last Updated**: January 2025  
**Hook Version**: 2.0.0  
**Maintainer**: KitchAI Development Team 