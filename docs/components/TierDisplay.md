# TierDisplay Component Documentation

## Overview

The `TierDisplay` component is a versatile UI component that displays user tier information (FREEMIUM/PREMIUM/CREATOR) and usage statistics in KitchAI v2. It provides visual feedback about the user's subscription status, remaining usage limits, and upgrade options, serving as a key component in the access control system.

## Location
`src/components/TierDisplay.tsx`

## Purpose

- **Tier Visualization**: Display user's current subscription tier with appropriate styling
- **Usage Tracking**: Show remaining usage for FREEMIUM users
- **Upgrade Promotion**: Encourage upgrades with clear call-to-action buttons
- **Status Indication**: Provide visual cues about account status and benefits
- **Flexible Display**: Support both compact and full display modes

## Architecture

### Component Interface

```typescript
interface TierDisplayProps {
  onUpgradePress?: () => void;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

interface UsageDisplayData {
  tierDisplay: string;
  scanUsage: string;
  aiRecipeUsage: string;
  showUsage: boolean;
  showUpgradePrompt: boolean;
}
```

### Visual Layouts

#### Full Display Mode
```
┌─────────────────────────────────────┐
│ ⭐ CREATOR                          │ ← Tier Header
│ Unlimited access to all features    │
└─────────────────────────────────────┘
```

#### FREEMIUM Full Display
```
┌─────────────────────────────────────┐
│ 👤 FREEMIUM                         │ ← Tier Header
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Monthly Usage                       │ ← Usage Section
│ 📷 Pantry Scans    💡 AI Recipes    │
│    2/3 used           8/10 used     │
│                                     │
│ [⬆️ Upgrade to PREMIUM]             │ ← Upgrade Button
└─────────────────────────────────────┘
```

#### Compact Display Mode
```
┌─────────────────┐
│ ⭐ CREATOR       │ ← Compact Badge
└─────────────────┘
```

## Key Features

### 1. Tier-Based Styling

**Dynamic Colors**:
- PREMIUM/CREATOR: Green (#10b981)
- FREEMIUM: Amber (#f59e0b)
- Consistent color theming throughout

**Icon Mapping**:
- CREATOR: Star icon (⭐)
- PREMIUM: Diamond icon (💎)
- FREEMIUM: Person icon (👤)

### 2. Usage Display

**FREEMIUM Users**:
- Monthly usage statistics
- Pantry scan count (X/3 used)
- AI recipe generation count (X/10 used)
- Visual progress indicators

**PREMIUM/CREATOR Users**:
- "Unlimited access" messaging
- No usage tracking displayed
- Premium status highlighting

### 3. Upgrade Promotion

**Conditional Display**:
- Shows upgrade button for FREEMIUM users
- Configurable via props
- Clear call-to-action styling

**Upgrade Button**:
- Prominent green styling
- Icon + text combination
- Shadow effects for emphasis

### 4. Display Modes

**Full Mode** (default):
- Complete tier information
- Usage statistics
- Upgrade button
- Detailed layout

**Compact Mode**:
- Minimal badge display
- Icon + tier name only
- Suitable for headers/navigation

## Implementation Details

### Main Component Structure

```typescript
export const TierDisplay: React.FC<TierDisplayProps> = ({ 
  onUpgradePress, 
  showUpgradeButton = true,
  compact = false 
}) => {
  const { getUsageDisplay } = useAccessControl();
  const usageData = getUsageDisplay();

  const getTierColor = () => {
    if (usageData.tierDisplay.includes('PREMIUM')) {
      return '#10b981'; // Green for premium
    }
    return '#f59e0b'; // Amber for freemium
  };

  const getTierIcon = () => {
    if (usageData.tierDisplay.includes('CREATOR')) {
      return 'star';
    } else if (usageData.tierDisplay.includes('PREMIUM')) {
      return 'diamond';
    }
    return 'person';
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderColor: getTierColor() }]}>
        <Ionicons name={getTierIcon()} size={16} color={getTierColor()} />
        <Text style={[styles.compactTierText, { color: getTierColor() }]}>
          {usageData.tierDisplay}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tier Status */}
      <View style={[styles.tierContainer, { backgroundColor: `${getTierColor()}15` }]}>
        <View style={styles.tierHeader}>
          <Ionicons name={getTierIcon()} size={24} color={getTierColor()} />
          <Text style={[styles.tierText, { color: getTierColor() }]}>
            {usageData.tierDisplay}
          </Text>
        </View>
        
        {usageData.tierDisplay.includes('CREATOR') && (
          <Text style={styles.creatorSubtext}>
            Unlimited access to all features
          </Text>
        )}
      </View>

      {/* Usage Display for FREEMIUM users */}
      {usageData.showUsage && (
        <View style={styles.usageContainer}>
          <Text style={styles.usageTitle}>Monthly Usage</Text>
          
          <View style={styles.usageRow}>
            <View style={styles.usageItem}>
              <Ionicons name="camera-outline" size={20} color="#6b7280" />
              <Text style={styles.usageLabel}>Pantry Scans</Text>
              <Text style={styles.usageValue}>{usageData.scanUsage}</Text>
            </View>
            
            <View style={styles.usageItem}>
              <Ionicons name="bulb-outline" size={20} color="#6b7280" />
              <Text style={styles.usageLabel}>AI Recipes</Text>
              <Text style={styles.usageValue}>{usageData.aiRecipeUsage}</Text>
            </View>
          </View>

          {/* Upgrade Button */}
          {showUpgradeButton && onUpgradePress && (
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
              <Ionicons name="arrow-up-circle" size={20} color="#fff" />
              <Text style={styles.upgradeButtonText}>Upgrade to PREMIUM</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};
```

### Dynamic Styling Functions

```typescript
const getTierColor = () => {
  if (usageData.tierDisplay.includes('PREMIUM')) {
    return '#10b981'; // Green for premium
  }
  return '#f59e0b'; // Amber for freemium
};

const getTierIcon = () => {
  if (usageData.tierDisplay.includes('CREATOR')) {
    return 'star';
  } else if (usageData.tierDisplay.includes('PREMIUM')) {
    return 'diamond';
  }
  return 'person';
};
```

### Usage Data Integration

```typescript
const { getUsageDisplay } = useAccessControl();
const usageData = getUsageDisplay();

// usageData structure:
// {
//   tierDisplay: 'FREEMIUM' | 'PREMIUM' | 'CREATOR',
//   scanUsage: '2/3 used' | 'Unlimited',
//   aiRecipeUsage: '8/10 used' | 'Unlimited',
//   showUsage: boolean,
//   showUpgradePrompt: boolean
// }
```

## Usage Examples

### Basic Usage in Profile Screen

```typescript
import { TierDisplay } from '../components/TierDisplay';

const ProfileScreen = () => {
  const navigation = useNavigation();

  const handleUpgradePress = () => {
    navigation.navigate('UpgradeScreen');
  };

  return (
    <ScrollView style={styles.container}>
      <TierDisplay 
        onUpgradePress={handleUpgradePress}
        showUpgradeButton={true}
        compact={false}
      />
      {/* Other profile content */}
    </ScrollView>
  );
};
```

### Compact Display in Header

```typescript
const HeaderComponent = () => {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>KitchAI</Text>
      <TierDisplay compact={true} showUpgradeButton={false} />
    </View>
  );
};
```

### Settings Screen Integration

```typescript
const SettingsScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Account Status</Text>
      <TierDisplay 
        onUpgradePress={() => navigation.navigate('UpgradeScreen')}
        showUpgradeButton={true}
      />
      
      <Text style={styles.sectionTitle}>Preferences</Text>
      {/* Other settings */}
    </View>
  );
};
```

### Conditional Rendering Based on Tier

```typescript
const FeatureScreen = () => {
  const { isPremium } = useAuth();

  return (
    <View style={styles.container}>
      {!isPremium && (
        <TierDisplay 
          onUpgradePress={() => navigation.navigate('UpgradeScreen')}
          showUpgradeButton={true}
        />
      )}
      
      <PremiumFeatureComponent />
    </View>
  );
};
```

### Custom Upgrade Handler

```typescript
const CustomTierDisplay = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const handleUpgrade = () => {
    // Analytics tracking
    analytics.track('upgrade_button_pressed', {
      user_id: user?.id,
      source: 'tier_display',
      current_tier: user?.tier,
    });

    // Navigate to upgrade screen
    navigation.navigate('UpgradeScreen', {
      source: 'tier_display',
      feature: 'general',
    });
  };

  return (
    <TierDisplay 
      onUpgradePress={handleUpgrade}
      showUpgradeButton={true}
    />
  );
};
```

## Styling

### Style Structure

```typescript
const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  compactTierText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  tierContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  creatorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginLeft: 32,
  },
  usageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usageItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  usageLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  usageValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 2,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
```

### Dynamic Styling

```typescript
// Tier container with dynamic background
<View style={[
  styles.tierContainer, 
  { backgroundColor: `${getTierColor()}15` }
]}>

// Compact container with dynamic border
<View style={[
  styles.compactContainer, 
  { borderColor: getTierColor() }
]}>

// Text with dynamic color
<Text style={[
  styles.tierText, 
  { color: getTierColor() }
]}>
```

## Integration Points

### Hook Integration

```typescript
import { useAccessControl } from '../hooks/useAccessControl';

const TierDisplay = () => {
  const { getUsageDisplay } = useAccessControl();
  const usageData = getUsageDisplay();
  
  // Component logic
};
```

### Navigation Integration

```typescript
// Common navigation patterns
const handleUpgradePress = () => {
  navigation.navigate('UpgradeScreen');
};

// With parameters
const handleUpgradePress = () => {
  navigation.navigate('UpgradeScreen', {
    source: 'tier_display',
    feature: 'pantry_scan',
  });
};
```

### Analytics Integration

```typescript
const handleUpgradePress = () => {
  // Track upgrade button interaction
  analytics.track('upgrade_button_pressed', {
    component: 'tier_display',
    user_tier: usageData.tierDisplay,
    usage_scan: usageData.scanUsage,
    usage_ai: usageData.aiRecipeUsage,
  });
  
  onUpgradePress?.();
};
```

## Error Handling

### Graceful Degradation

```typescript
const TierDisplay = ({ onUpgradePress, showUpgradeButton, compact }) => {
  const { getUsageDisplay } = useAccessControl();
  
  try {
    const usageData = getUsageDisplay();
    
    // Normal rendering
    return (
      <View style={styles.container}>
        {/* Component content */}
      </View>
    );
  } catch (error) {
    console.error('TierDisplay error:', error);
    
    // Fallback display
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>Account Status</Text>
      </View>
    );
  }
};
```

### Missing Data Handling

```typescript
const getTierColor = () => {
  try {
    if (usageData?.tierDisplay?.includes('PREMIUM')) {
      return '#10b981';
    }
    return '#f59e0b';
  } catch (error) {
    return '#6b7280'; // Default gray
  }
};
```

## Performance Optimizations

### Memoization

```typescript
import React, { memo, useMemo } from 'react';

export const TierDisplay = memo<TierDisplayProps>(({ 
  onUpgradePress, 
  showUpgradeButton, 
  compact 
}) => {
  const { getUsageDisplay } = useAccessControl();
  const usageData = getUsageDisplay();

  const tierColor = useMemo(() => getTierColor(), [usageData.tierDisplay]);
  const tierIcon = useMemo(() => getTierIcon(), [usageData.tierDisplay]);

  // Component rendering
});
```

### Conditional Rendering

```typescript
// Only render usage section when needed
{usageData.showUsage && (
  <UsageSection usageData={usageData} />
)}

// Only render upgrade button when appropriate
{showUpgradeButton && onUpgradePress && usageData.showUpgradePrompt && (
  <UpgradeButton onPress={onUpgradePress} />
)}
```

## Testing

### Unit Tests

```typescript
describe('TierDisplay', () => {
  const mockUsageData = {
    tierDisplay: 'FREEMIUM',
    scanUsage: '2/3 used',
    aiRecipeUsage: '8/10 used',
    showUsage: true,
    showUpgradePrompt: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders FREEMIUM tier correctly', () => {
    render(<TierDisplay />);
    
    expect(screen.getByText('FREEMIUM')).toBeInTheDocument();
    expect(screen.getByText('2/3 used')).toBeInTheDocument();
    expect(screen.getByText('8/10 used')).toBeInTheDocument();
  });

  it('renders compact mode correctly', () => {
    render(<TierDisplay compact={true} />);
    
    expect(screen.getByText('FREEMIUM')).toBeInTheDocument();
    expect(screen.queryByText('Monthly Usage')).not.toBeInTheDocument();
  });

  it('handles upgrade button press', () => {
    const mockOnUpgrade = jest.fn();
    render(<TierDisplay onUpgradePress={mockOnUpgrade} />);
    
    const upgradeButton = screen.getByText('Upgrade to PREMIUM');
    fireEvent.press(upgradeButton);
    
    expect(mockOnUpgrade).toHaveBeenCalled();
  });

  it('hides upgrade button when showUpgradeButton is false', () => {
    render(<TierDisplay showUpgradeButton={false} />);
    
    expect(screen.queryByText('Upgrade to PREMIUM')).not.toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
describe('TierDisplay Integration', () => {
  it('integrates with useAccessControl hook', () => {
    const mockGetUsageDisplay = jest.fn().mockReturnValue({
      tierDisplay: 'PREMIUM',
      showUsage: false,
    });

    render(<TierDisplay />);
    
    expect(mockGetUsageDisplay).toHaveBeenCalled();
    expect(screen.getByText('PREMIUM')).toBeInTheDocument();
  });

  it('navigates to upgrade screen on button press', () => {
    const mockNavigation = { navigate: jest.fn() };
    
    render(
      <TierDisplay 
        onUpgradePress={() => mockNavigation.navigate('UpgradeScreen')}
      />
    );
    
    fireEvent.press(screen.getByText('Upgrade to PREMIUM'));
    
    expect(mockNavigation.navigate).toHaveBeenCalledWith('UpgradeScreen');
  });
});
```

### Visual Testing

```typescript
describe('TierDisplay Visual Tests', () => {
  it('applies correct colors for different tiers', () => {
    const { rerender } = render(<TierDisplay />);
    
    // Test FREEMIUM color
    expect(screen.getByTestId('tier-icon')).toHaveStyle({
      color: '#f59e0b',
    });
    
    // Test PREMIUM color
    mockUsageData.tierDisplay = 'PREMIUM';
    rerender(<TierDisplay />);
    
    expect(screen.getByTestId('tier-icon')).toHaveStyle({
      color: '#10b981',
    });
  });
});
```

## Accessibility

### Screen Reader Support

```typescript
<TouchableOpacity 
  style={styles.upgradeButton} 
  onPress={onUpgradePress}
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Upgrade to Premium subscription"
  accessibilityHint="Double tap to view upgrade options"
>
  <Ionicons name="arrow-up-circle" size={20} color="#fff" />
  <Text style={styles.upgradeButtonText}>Upgrade to PREMIUM</Text>
</TouchableOpacity>
```

### Tier Status Accessibility

```typescript
<View 
  style={styles.tierContainer}
  accessible={true}
  accessibilityRole="text"
  accessibilityLabel={`Current subscription tier: ${usageData.tierDisplay}`}
>
  <Ionicons name={getTierIcon()} size={24} color={getTierColor()} />
  <Text style={styles.tierText}>{usageData.tierDisplay}</Text>
</View>
```

## Future Enhancements

### Planned Features

1. **Progress Bars**: Visual progress indicators for usage limits
2. **Animated Transitions**: Smooth animations between tier changes
3. **Custom Themes**: User-selectable color themes
4. **Usage History**: Historical usage tracking and trends
5. **Tier Benefits**: Detailed feature comparison display

### Performance Improvements

1. **Lazy Loading**: Defer non-critical usage data
2. **Caching**: Cache tier status for offline display
3. **Optimized Re-renders**: Minimize unnecessary updates

### UX Enhancements

1. **Interactive Elements**: Tap to expand usage details
2. **Tooltips**: Explanatory tooltips for features
3. **Celebration Animations**: Animations for tier upgrades
4. **Smart Notifications**: Proactive upgrade suggestions

## Dependencies

### Required Packages

```json
{
  "react": "^18.x.x",
  "react-native": "^0.x.x",
  "@expo/vector-icons": "^13.x.x"
}
```

### Internal Dependencies

- `src/hooks/useAccessControl.ts`: Access control and usage data
- `src/providers/AuthProvider.tsx`: Authentication context

## Troubleshooting

### Common Issues

1. **Tier Not Updating**: Check useAccessControl hook integration
2. **Colors Not Applying**: Verify getTierColor function logic
3. **Usage Data Missing**: Check backend RPC function responses
4. **Button Not Working**: Verify onUpgradePress prop is passed

### Debug Tips

```typescript
// Enable debug logging
const DEBUG_TIER_DISPLAY = __DEV__;

if (DEBUG_TIER_DISPLAY) {
  console.log('TierDisplay State:', {
    tierDisplay: usageData.tierDisplay,
    showUsage: usageData.showUsage,
    scanUsage: usageData.scanUsage,
    aiRecipeUsage: usageData.aiRecipeUsage,
    compact,
    showUpgradeButton,
  });
}
```

## Conclusion

The `TierDisplay` component provides a clean, informative interface for displaying user tier status and usage information in KitchAI v2. It successfully balances functionality with visual appeal while maintaining flexibility for different use cases throughout the application.

---

**Last Updated**: January 2025  
**Component Version**: 2.0.0  
**Maintainer**: KitchAI Development Team 