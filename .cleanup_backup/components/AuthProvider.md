# AuthProvider Component Documentation

## Overview

The `AuthProvider` is a React Context provider that manages authentication state, user profiles, and access control throughout the KitchAI v2 application. It serves as the central hub for user authentication, session management, and tier-based access control (FREEMIUM/PREMIUM system).

## Location
`src/providers/AuthProvider.tsx`

## Purpose

- **Authentication Management**: Handle user login, logout, and session persistence
- **Profile Management**: Manage user profile data and onboarding status
- **Access Control**: Implement FREEMIUM/PREMIUM tier restrictions
- **Usage Tracking**: Monitor user activity for tier-based limitations
- **Real-time Updates**: Provide live authentication state across the app

## Architecture

### Context Structure

```typescript
interface AuthContextType {
  // Authentication State
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  
  // Usage Limits (FREEMIUM/PREMIUM)
  usageLimits: UsageLimits | null;
  
  // Helper Functions
  isCreator: boolean;
  isPremium: boolean;
  isOnboarded: boolean;
  
  // Actions
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUsageLimits: () => Promise<void>;
}
```

### Type Definitions

```typescript
type UserProfile = {
  username: string | null;
  role: string | null;
  onboarded: boolean | null;
  avatar_url?: string | null;
  bio?: string | null;
  tier?: string | null;
};

type UsageLimits = {
  scan_count: number;
  ai_recipe_count: number;
  last_reset: string | null;
};
```

## Key Features

### 1. Authentication State Management

**Session Handling**:
- Automatic session restoration on app launch
- Real-time session state updates
- Secure session persistence

**User Profile Integration**:
- Automatic profile fetching on authentication
- Profile data caching and updates
- Onboarding status tracking

### 2. Tier-Based Access Control

**FREEMIUM Tier**:
- Limited pantry scans (3 per month)
- Limited AI recipe generation (10 per month)
- Usage tracking and enforcement

**PREMIUM Tier**:
- Unlimited access to all features
- No usage restrictions
- Enhanced user experience

**CREATOR Tier**:
- Automatic PREMIUM benefits
- Special creator privileges
- Enhanced content creation tools

### 3. Usage Limits Management

**Monthly Reset System**:
- Automatic usage counter reset
- Last reset timestamp tracking
- Real-time usage updates

**Usage Tracking**:
- Pantry scan count monitoring
- AI recipe generation tracking
- Access control enforcement

## Implementation Details

### Provider Setup

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);

  // Authentication state management
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchUsageLimits(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
          await fetchUsageLimits(session.user.id);
        } else {
          setProfile(null);
          setUsageLimits(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);
};
```

### Profile Management

**Profile Fetching**:
```typescript
const fetchProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_profile_details', { user_id: userId });
    
    if (error) throw error;
    setProfile(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
  }
};
```

**Profile Updates**:
```typescript
const refreshProfile = async () => {
  if (user?.id) {
    await fetchProfile(user.id);
  }
};
```

### Usage Limits Management

**Limits Fetching**:
```typescript
const fetchUsageLimits = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_usage_limits')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    setUsageLimits(data || { scan_count: 0, ai_recipe_count: 0, last_reset: null });
  } catch (error) {
    console.error('Error fetching usage limits:', error);
  }
};
```

**Limits Refresh**:
```typescript
const refreshUsageLimits = async () => {
  if (user?.id) {
    await fetchUsageLimits(user.id);
  }
};
```

### Helper Functions

**Role Checking**:
```typescript
const isCreator = useMemo(() => profile?.role === 'creator', [profile?.role]);
const isPremium = useMemo(() => 
  profile?.tier === 'PREMIUM' || isCreator, 
  [profile?.tier, isCreator]
);
const isOnboarded = useMemo(() => 
  profile?.onboarded === true, 
  [profile?.onboarded]
);
```

## Usage Examples

### Basic Authentication Check

```typescript
import { useAuth } from '../providers/AuthProvider';

const MyComponent = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <LoginPrompt />;
  
  return <AuthenticatedContent />;
};
```

### Tier-Based Access Control

```typescript
import { useAuth } from '../providers/AuthProvider';

const PremiumFeature = () => {
  const { isPremium, isCreator } = useAuth();
  
  if (!isPremium && !isCreator) {
    return <UpgradePrompt />;
  }
  
  return <PremiumContent />;
};
```

### Usage Limits Checking

```typescript
import { useAuth } from '../providers/AuthProvider';

const ScanFeature = () => {
  const { usageLimits, isPremium } = useAuth();
  
  const canScan = isPremium || (usageLimits?.scan_count || 0) < 3;
  
  if (!canScan) {
    return <UsageLimitReached />;
  }
  
  return <ScanInterface />;
};
```

### Profile Management

```typescript
import { useAuth } from '../providers/AuthProvider';

const ProfileEditor = () => {
  const { profile, refreshProfile } = useAuth();
  
  const handleProfileUpdate = async () => {
    // Update profile logic
    await refreshProfile(); // Refresh context
  };
  
  return (
    <ProfileForm 
      profile={profile} 
      onUpdate={handleProfileUpdate} 
    />
  );
};
```

## Integration Points

### Navigation Integration

```typescript
// AppNavigator.tsx
const AppNavigator = () => {
  const { user, loading, isOnboarded } = useAuth();
  
  if (loading) return <SplashScreen />;
  
  return (
    <NavigationContainer>
      {user ? (
        isOnboarded ? <MainStack /> : <OnboardingStack />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
};
```

### Access Control Integration

```typescript
// useAccessControl.ts
import { useAuth } from '../providers/AuthProvider';

export const useAccessControl = () => {
  const { isPremium, usageLimits, refreshUsageLimits } = useAuth();
  
  const canPerformScan = () => {
    return isPremium || (usageLimits?.scan_count || 0) < 3;
  };
  
  return { canPerformScan, refreshUsageLimits };
};
```

## Error Handling

### Authentication Errors

```typescript
const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out:', error);
    // Handle sign out error
  }
};
```

### Profile Fetch Errors

```typescript
const fetchProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_profile_details', { user_id: userId });
    
    if (error) throw error;
    setProfile(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    // Fallback to basic user data
    setProfile({
      username: user?.email?.split('@')[0] || null,
      role: 'user',
      onboarded: false,
      tier: 'FREEMIUM'
    });
  }
};
```

## Performance Considerations

### Memoization

```typescript
const contextValue = useMemo(() => ({
  session,
  user,
  profile,
  usageLimits,
  loading,
  isCreator,
  isPremium,
  isOnboarded,
  signOut,
  refreshProfile,
  refreshUsageLimits,
}), [
  session,
  user,
  profile,
  usageLimits,
  loading,
  isCreator,
  isPremium,
  isOnboarded,
]);
```

### Selective Updates

- Only fetch profile when user changes
- Cache usage limits to reduce API calls
- Debounce profile refresh requests

## Security Considerations

### Session Management

- Secure session storage
- Automatic session refresh
- Proper session cleanup on logout

### Access Control

- Server-side validation of tier restrictions
- Client-side checks for UX only
- Secure usage limit enforcement

### Data Privacy

- Minimal profile data exposure
- Secure user data handling
- GDPR compliance considerations

## Testing

### Unit Tests

```typescript
describe('AuthProvider', () => {
  it('should provide authentication state', () => {
    // Test authentication state management
  });
  
  it('should handle tier-based access control', () => {
    // Test FREEMIUM/PREMIUM logic
  });
  
  it('should manage usage limits correctly', () => {
    // Test usage limit tracking
  });
});
```

### Integration Tests

```typescript
describe('AuthProvider Integration', () => {
  it('should integrate with navigation', () => {
    // Test navigation integration
  });
  
  it('should work with access control hooks', () => {
    // Test hook integration
  });
});
```

## Future Enhancements

### Planned Features

1. **Multi-Factor Authentication**: Enhanced security
2. **Social Login**: Google, Apple, Facebook integration
3. **Advanced Analytics**: User behavior tracking
4. **Offline Support**: Cached authentication state

### Performance Improvements

1. **Lazy Loading**: Defer non-critical profile data
2. **Background Sync**: Periodic profile updates
3. **Optimistic Updates**: Immediate UI feedback

## Dependencies

### Required Packages

```json
{
  "@supabase/supabase-js": "^2.x.x",
  "react": "^18.x.x",
  "react-native": "^0.x.x"
}
```

### Internal Dependencies

- `src/services/supabase.ts`: Supabase client configuration
- `src/types/`: TypeScript type definitions

## Troubleshooting

### Common Issues

1. **Session Not Persisting**: Check Supabase configuration
2. **Profile Not Loading**: Verify RPC function permissions
3. **Usage Limits Not Updating**: Check database triggers

### Debug Tips

```typescript
// Enable debug logging
const DEBUG_AUTH = __DEV__;

if (DEBUG_AUTH) {
  console.log('Auth State:', { session, user, profile, usageLimits });
}
```

## Conclusion

The `AuthProvider` is a critical component that enables secure, tier-based access control throughout the KitchAI v2 application. It provides a clean, type-safe interface for authentication management while supporting the complex FREEMIUM/PREMIUM business model requirements.

---

**Last Updated**: January 2025  
**Component Version**: 2.0.0  
**Maintainer**: KitchAI Development Team 