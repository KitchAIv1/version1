import React from 'react';
import { ActivityIndicator, View } from 'react-native'; // Import ActivityIndicator and View
import { useAuth } from '../providers/AuthProvider';
import AuthStack from './AuthStack';
// import MainTabs from './MainTabs'; // No longer directly used here
import MainStack from './MainStack'; // Import MainStack

function AppNavigator() {
  const { session, profile, loading } = useAuth(); // Add profile and loading

  if (loading) {
    // AuthProvider shows a loading screen, but AppNavigator might render briefly before
    // AuthProvider's loading state resolves or if there are nested navigators.
    // Adding a basic loading check here ensures no flicker or rendering of AuthStack/MainStack prematurely.
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (session) {
    // ENHANCED: Additional safeguards for profile state
    // If there's a session but no profile yet (e.g., new user), default to not onboarded
    // This prevents white screen issues during onboarding
    const userOnboarded = profile?.onboarded ?? false;
    
    console.log('🔍 [AppNavigator] CRITICAL DEBUG:');
    console.log('🔍 [AppNavigator] profile object:', profile);
    console.log('🔍 [AppNavigator] profile?.onboarded value:', profile?.onboarded);
    console.log('🔍 [AppNavigator] typeof profile?.onboarded:', typeof profile?.onboarded);
    console.log('🔍 [AppNavigator] userOnboarded result:', userOnboarded);
    console.log('🔍 [AppNavigator] Will route to:', userOnboarded ? 'MainTabs' : 'OnboardingStep1');
    
    // Additional safety check: if profile is completely null/undefined for new users
    if (profile === null || profile === undefined) {
      console.log('🔍 [AppNavigator] Profile is null/undefined - treating as new user (not onboarded)');
    }
    
    console.log(
      `[AppNavigator] Session exists. User onboarded status: ${userOnboarded}, Profile:`,
      profile,
    );
    return <MainStack userOnboarded={userOnboarded} />;
  }

  return <AuthStack />;
}

export default AppNavigator;
