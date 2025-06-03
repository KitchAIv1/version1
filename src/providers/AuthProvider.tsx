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

// Define usage limits type
type UsageLimits = {
  scan_count: number;
  ai_recipe_count: number;
  last_reset: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  usageLimits: UsageLimits | null; // Added usage limits
  loading: boolean;
  updateProfile: (newProfileData: Partial<UserProfile>) => void;
  refreshProfile: (userId: string) => Promise<void>;
  refreshUsageLimits: (userId: string) => Promise<void>; // Added usage limits refresh
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
  usageLimits: null,
  loading: true,
  updateProfile: () => {},
  refreshProfile: async () => {},
  refreshUsageLimits: async () => {},
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
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Fetch usage limits for FREEMIUM users
  const fetchUsageLimits = async (
    userId: string,
    profileData?: UserProfile,
  ) => {
    if (!userId) {
      setUsageLimits(null);
      return;
    }

    // Use passed profileData or current profile state
    const currentProfile = profileData || profile;

    // Only fetch usage limits for non-CREATOR FREEMIUM users
    if (
      currentProfile?.role?.toLowerCase() === 'creator' ||
      currentProfile?.tier === 'PREMIUM'
    ) {
      console.log(
        `AuthProvider: User is ${currentProfile?.role?.toLowerCase() === 'creator' ? 'CREATOR' : 'PREMIUM'}, setting usage limits to 0`,
      );
      setUsageLimits({ scan_count: 0, ai_recipe_count: 0, last_reset: null });
      return;
    }

    try {
      console.log(
        `AuthProvider: Fetching usage limits for FREEMIUM user ${userId}`,
      );
      const { data, error } = await supabase
        .from('user_usage_limits')
        .select('scan_count, ai_recipe_count, last_reset')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle missing records

      if (error) {
        console.error(
          'AuthProvider: Error fetching usage limits:',
          error.message,
        );
        // Set default values if error occurs
        setUsageLimits({ scan_count: 0, ai_recipe_count: 0, last_reset: null });
        return;
      }

      // Handle case where no record exists (data will be null)
      if (!data) {
        console.log(
          'AuthProvider: No usage limits record found, creating default values',
        );
        setUsageLimits({ scan_count: 0, ai_recipe_count: 0, last_reset: null });
        return;
      }

      setUsageLimits({
        scan_count: data.scan_count || 0,
        ai_recipe_count: data.ai_recipe_count || 0,
        last_reset: data.last_reset,
      });
    } catch (e: any) {
      console.error(
        'AuthProvider: Unexpected error in fetchUsageLimits:',
        e.message,
      );
      setUsageLimits({ scan_count: 0, ai_recipe_count: 0, last_reset: null });
    }
  };

  const fetchProfileWithRPC = async (userId: string) => {
    if (!userId) {
      setProfile({
        username: null,
        role: null,
        onboarded: false,
        avatar_url: null,
        bio: null,
        tier: null,
      });
      setUsageLimits(null);
      return;
    }
    try {
      console.log(
        `AuthProvider: Fetching profile via RPC get_profile_details for user ${userId}`,
      );
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_profile_details',
        { p_user_id: userId },
      );

      if (rpcError) {
        console.error(
          'AuthProvider: Error fetching profile via RPC:',
          rpcError.message,
        );
        setProfile({
          username: null,
          role: null,
          onboarded: false,
          avatar_url: null,
          bio: null,
          tier: null,
        });
        setUsageLimits(null);
        return;
      }

      if (rpcData) {
        console.log('AuthProvider: Profile data fetched via RPC:', rpcData);
        console.log('AuthProvider: RPC Data Details:');
        console.log('  - username:', rpcData.username);
        console.log('  - role:', rpcData.role);
        console.log('  - tier:', rpcData.tier);
        console.log('  - onboarded:', rpcData.onboarded);
        console.log('  - bio:', rpcData.bio);
        console.log('  - avatar_url:', rpcData.avatar_url);

        const newProfile = {
          username: rpcData.username || null,
          role: rpcData.role || null,
          onboarded: rpcData.onboarded || false,
          avatar_url: rpcData.avatar_url || null,
          bio: rpcData.bio || null,
          tier: rpcData.tier || 'FREEMIUM', // Default to FREEMIUM if not set
        };

        console.log('AuthProvider: Processed Profile Object:', newProfile);
        console.log(
          'AuthProvider: getEffectiveTier() will return:',
          newProfile.role?.toLowerCase() === 'creator'
            ? 'PREMIUM'
            : newProfile.tier || 'FREEMIUM',
        );

        setProfile(newProfile);

        // Fetch usage limits with the new profile data
        await fetchUsageLimits(userId, newProfile);
      } else {
        console.log(
          'AuthProvider: No profile data returned from RPC (new user or profile not yet created).',
        );
        const defaultProfile = {
          username: null,
          role: null,
          onboarded: false,
          avatar_url: null,
          bio: null,
          tier: 'FREEMIUM',
        };
        setProfile(defaultProfile);
        await fetchUsageLimits(userId, defaultProfile);
      }
    } catch (e: any) {
      console.error(
        'AuthProvider: Unexpected error in fetchProfileWithRPC:',
        e.message,
      );
      const defaultProfile = {
        username: null,
        role: null,
        onboarded: false,
        avatar_url: null,
        bio: null,
        tier: 'FREEMIUM',
      };
      setProfile(defaultProfile);
      await fetchUsageLimits(userId, defaultProfile);
    }
  };

  useEffect(() => {
    setLoading(true); // For initial load
    const processInitialSession = async () => {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) {
          console.error('Error fetching session:', sessionError.message);
          setUser(null); // Ensure user is null if session fetch fails
          setProfile({
            username: null,
            role: null,
            onboarded: false,
            avatar_url: null,
            bio: null,
            tier: null,
          });
        } else {
          setSession(sessionData.session);
          const currentUser = sessionData.session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfileWithRPC(currentUser.id);
          } else {
            setProfile({
              username: null,
              role: null,
              onboarded: false,
              avatar_url: null,
              bio: null,
              tier: null,
            });
          }
        }
      } catch (e: any) {
        console.error(
          'AuthProvider: Unexpected error in processInitialSession:',
          e,
        );
        setProfile({
          username: null,
          role: null,
          onboarded: false,
          avatar_url: null,
          bio: null,
          tier: null,
        });
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false); // End initial load
      }
    };

    processInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log(
          'Auth state changed:',
          _event,
          newSession ? 'Got session' : 'No session',
        );
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        setUser(currentUser);

        if (_event === 'SIGNED_IN' && currentUser) {
          setLoading(true); // Start loading for profile fetch on sign-in
          console.log(
            'AuthProvider (SIGNED_IN): setLoading(true), fetching profile...',
          );
          await fetchProfileWithRPC(currentUser.id);
          setLoading(false); // End loading after profile fetch
          console.log(
            'AuthProvider (SIGNED_IN): setLoading(false), profile fetched.',
          );
        } else if (_event === 'SIGNED_OUT') {
          setProfile({
            username: null,
            role: null,
            onboarded: false,
            avatar_url: null,
            bio: null,
            tier: null,
          });
          setUsageLimits(null);
          setLoading(false); // Ensure loading is false on sign_out
        } else if (!currentUser) {
          // Handles other cases like USER_DELETED, TOKEN_REFRESHED with no user
          setProfile({
            username: null,
            role: null,
            onboarded: false,
            avatar_url: null,
            bio: null,
            tier: null,
          });
          setUsageLimits(null);
        }
        // For TOKEN_REFRESHED with a currentUser, profile should ideally remain as is or be re-verified if necessary.
        // Current fetchProfileWithRPC might be redundant if profile is already fresh.
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        usageLimits,
        loading,
        updateProfile: updateProfileLocally,
        refreshProfile: fetchProfileWithRPC,
        refreshUsageLimits: (userId: string) => fetchUsageLimits(userId),
        getEffectiveTier,
        isCreator,
      }}>
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
