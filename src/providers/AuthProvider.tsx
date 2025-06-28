import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  PropsWithChildren,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../services/supabase';

// Define a type for the user profile data we want in the auth context
type UserProfile = {
  username: string | null;
  role: string | null;
  onboarded: boolean | null;
  avatar_url?: string | null;
  bio?: string | null;
  tier?: string | null; // Added for FREEMIUM/PREMIUM
};

// Usage limits removed - Edge Function handles all tracking

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  updateProfile: (newProfileData: Partial<UserProfile>) => void;
  refreshProfile: (userId: string) => Promise<void>;
  getEffectiveTier: () => 'FREEMIUM' | 'PREMIUM'; // Helper to determine effective tier
  isCreator: () => boolean; // Helper to check if user is creator
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: {
    username: null,
    role: null,
    onboarded: null,
    avatar_url: null,
    bio: null,
    tier: null,
  },
  loading: true,
  profileLoading: false,
  updateProfile: () => {},
  refreshProfile: async () => {},
  getEffectiveTier: () => 'FREEMIUM',
  isCreator: () => false,
});

export const AuthProvider: React.FC<PropsWithChildren<object>> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>({
    username: null,
    role: null,
    onboarded: null,
    avatar_url: null,
    bio: null,
    tier: null,
  });
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const updateProfileLocally = (newProfileData: Partial<UserProfile>) => {
    setProfile(prevProfile => ({
      ...(prevProfile || {
        username: null,
        role: null,
        onboarded: null,
        avatar_url: null,
        bio: null,
        tier: null,
      }),
      ...newProfileData,
    }));
  };

  // Helper functions
  const getEffectiveTier = (): 'FREEMIUM' | 'PREMIUM' => {
    if (profile?.role?.toLowerCase() === 'creator') return 'PREMIUM';
    return (profile?.tier as 'FREEMIUM' | 'PREMIUM') || 'FREEMIUM';
  };

  const isCreator = (): boolean => {
    return profile?.role?.toLowerCase() === 'creator';
  };

  // Usage limits removed - Edge Function handles all tracking

  const fetchProfileWithRPC = async (userId: string) => {
    try {
      setProfileLoading(true);
      console.log('AuthProvider: Fetching profile via RPC get_profile_details for user', userId);
      
      const { data, error } = await supabase.rpc('get_profile_details', {
        p_user_id: userId,
      });

      if (error) {
        console.error(
          'AuthProvider: Error from get_profile_details RPC:',
          error,
        );
        throw new Error(error.message || 'Failed to fetch profile.');
      }

      console.log('AuthProvider: Raw RPC response:', data);

      // 🔍 ENHANCED DEBUGGING for specific user investigation
      const isTargetUser = userId === '4eaf7ede-53fa-488c-8e88-98a93338aa04';
      
      if (isTargetUser) {
        console.log('🚨 [CREATOR DEBUG] RPC Response for target user:', JSON.stringify(data, null, 2));
        console.log('🚨 [CREATOR DEBUG] Data type:', typeof data);
        console.log('🚨 [CREATOR DEBUG] Data is null:', data === null);
        console.log('🚨 [CREATOR DEBUG] Data is undefined:', data === undefined);
      }

      if (!data || !data.profile) {
        console.warn('AuthProvider: No profile data returned from RPC.');
        
        if (isTargetUser) {
          console.log('🚨 [CREATOR DEBUG] No profile data - will set defaults');
        }
        
        // Set default profile structure for new users
        const defaultProfile: UserProfile = {
          username: null,
          bio: null,
          avatar_url: null,
          role: null,
          tier: null,
          onboarded: false, // Default to false for new users
        };
        setProfile(defaultProfile);
        setProfileLoading(false);
        return;
      }

      // Extract profile data from RPC response
      const profileData = data.profile;
      
      if (isTargetUser) {
        console.log('🔍 DEBUG: Profile data from RPC:', profileData);
        console.log('🔍 DEBUG: Type of onboarded:', typeof profileData.onboarded);
        console.log('🔍 DEBUG: Value of onboarded:', profileData.onboarded);
        console.log('🔍 DEBUG: Role:', profileData.role);
        console.log('🔍 DEBUG: Tier:', profileData.tier);
        console.log('🚨 [CREATOR DEBUG] Extracted profile data:', JSON.stringify(profileData, null, 2));
        console.log('🚨 [CREATOR DEBUG] onboarded value:', profileData.onboarded);
        console.log('🚨 [CREATOR DEBUG] role value:', profileData.role);
      }

      // Create processed profile object
      const processedProfile: UserProfile = {
        username: profileData.username || null,
        bio: profileData.bio || null,
        avatar_url: profileData.avatar_url || null,
        role: profileData.role || null,
        tier: profileData.tier || null,
        onboarded: profileData.onboarded || false,
      };

      if (isTargetUser) {
        console.log('🔍 DEBUG: Final processed profile:', processedProfile);
      }

      setProfile(processedProfile);
      
      if (isTargetUser) {
        console.log('🔍 DEBUG: getEffectiveTier() returns:', getEffectiveTier());
        console.log('🔍 DEBUG: isCreator() returns:', isCreator());
      }
      
      console.log('AuthProvider: Processed Profile Object:', processedProfile);
      console.log('AuthProvider: getEffectiveTier() will return:', getEffectiveTier());
      
    } catch (error) {
      console.error('AuthProvider: Failed to fetch profile with RPC:', error);
      
      // Set default profile structure on error
      const defaultProfile: UserProfile = {
        username: null,
        bio: null,
        avatar_url: null,
        role: null,
        tier: null,
        onboarded: false,
      };
      setProfile(defaultProfile);
    } finally {
      setProfileLoading(false);
    }
  };

  // Function to refresh profile data
  const refreshProfile = async (userId: string) => {
    if (!userId) return;

    try {
      await fetchProfileWithRPC(userId);
    } catch (error: any) {
      console.error('AuthProvider: Error refreshing profile:', error.message);
    }
  };

  // Function to process initial session and load profile
  const processInitialSession = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setSession(session);
        setUser(session.user);

        await fetchProfileWithRPC(session.user.id);
      } else {
        setSession(null);
        setUser(null);
        setProfile({
          username: null,
          role: null,
          onboarded: null,
          avatar_url: null,
          bio: null,
          tier: null,
        });
        // Usage limits removed - Edge Function handles tracking
      }
    } catch (error: any) {
      console.error('AuthProvider: Error in processInitialSession:', error);
      // Set safe defaults on error
      setSession(null);
      setUser(null);
      setProfile({
        username: null,
        role: null,
        onboarded: null,
        avatar_url: null,
        bio: null,
        tier: null,
      });
      // Usage limits removed - Edge Function handles tracking
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load initial session
    processInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session ? 'Got session' : 'No session');

      if (session) {
        setSession(session);
        setUser(session.user);

        try {
          await fetchProfileWithRPC(session.user.id);
        } catch (error: any) {
          console.error(
            'AuthProvider: Error fetching profile on auth change:',
            error.message,
          );
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile({
          username: null,
          role: null,
          onboarded: null,
          avatar_url: null,
          bio: null,
          tier: null,
        });
        // Usage limits removed - Edge Function handles tracking
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        profileLoading,
        updateProfile: updateProfileLocally,
        refreshProfile,
        getEffectiveTier,
        isCreator,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
