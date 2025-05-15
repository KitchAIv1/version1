import React, { createContext, useState, useEffect, useContext, PropsWithChildren } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { ActivityIndicator, View } from 'react-native';

// Define a type for the user profile data we want in the auth context
type UserProfile = {
  username: string | null;
  role: string | null;
  onboarded: boolean | null;
  avatar_url?: string | null;
  bio?: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (newProfileData: Partial<UserProfile>) => void;
  refreshProfile: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ 
  session: null, 
  user: null,
  profile: { username: null, role: null, onboarded: null, avatar_url: null, bio: null },
  loading: true, 
  updateProfile: () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<PropsWithChildren<object>> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>({ username: null, role: null, onboarded: null, avatar_url: null, bio: null });
  const [loading, setLoading] = useState(true);

  const updateProfileLocally = (newProfileData: Partial<UserProfile>) => {
    setProfile(prevProfile => ({
      ...(prevProfile || { username: null, role: null, onboarded: null, avatar_url: null, bio: null }),
      ...newProfileData,
    }));
  };

  const fetchProfileWithRPC = async (userId: string) => {
    if (!userId) {
      setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
      return;
    }
    try {
      console.log(`AuthProvider: Fetching profile via RPC get_profile_details for user ${userId}`);
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_profile_details', { p_user_id: userId });

      if (rpcError) {
        console.error('AuthProvider: Error fetching profile via RPC:', rpcError.message);
        setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
        return;
      }

      if (rpcData) {
        console.log('AuthProvider: Profile data fetched via RPC:', rpcData);
        setProfile({
          username: rpcData.username || null,
          role: rpcData.role || null,
          onboarded: rpcData.onboarded || false,
          avatar_url: rpcData.avatar_url || null,
          bio: rpcData.bio || null,
        });
      } else {
        console.log('AuthProvider: No profile data returned from RPC (new user or profile not yet created).');
        setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
      }
    } catch (e: any) {
      console.error('AuthProvider: Unexpected error in fetchProfileWithRPC:', e.message);
      setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
    }
  };

  useEffect(() => {
    setLoading(true); // For initial load
    const processInitialSession = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Error fetching session:', sessionError.message);
          setUser(null); // Ensure user is null if session fetch fails
          setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
        } else {
          setSession(sessionData.session);
          const currentUser = sessionData.session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfileWithRPC(currentUser.id);
          } else {
            setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
          }
        }
      } catch (e: any) {
        console.error('AuthProvider: Unexpected error in processInitialSession:', e);
        setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false); // End initial load
      }
    };

    processInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log('Auth state changed:', _event, newSession ? 'Got session' : 'No session');
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        setUser(currentUser);

        if (_event === 'SIGNED_IN' && currentUser) {
          setLoading(true); // Start loading for profile fetch on sign-in
          console.log('AuthProvider (SIGNED_IN): setLoading(true), fetching profile...');
          await fetchProfileWithRPC(currentUser.id);
          setLoading(false); // End loading after profile fetch
          console.log('AuthProvider (SIGNED_IN): setLoading(false), profile fetched.');
        } else if (_event === 'SIGNED_OUT') {
          setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
          setLoading(false); // Ensure loading is false on sign_out
        } else if (!currentUser) { // Handles other cases like USER_DELETED, TOKEN_REFRESHED with no user
            setProfile({ username: null, role: null, onboarded: false, avatar_url: null, bio: null });
        }
        // For TOKEN_REFRESHED with a currentUser, profile should ideally remain as is or be re-verified if necessary.
        // Current fetchProfileWithRPC might be redundant if profile is already fresh.
      }
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
    <AuthContext.Provider value={{ session, user, profile, loading, updateProfile: updateProfileLocally, refreshProfile: fetchProfileWithRPC }}>
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