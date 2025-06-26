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
    // If there's a session, profile.onboarded should ideally be available.
    // Default to false if profile is null (e.g., edge case, new user profile creation pending)
    // or if onboarded property itself is null/undefined.
    const userOnboarded = profile?.onboarded ?? false;
    
    console.log('🔍 [AppNavigator] CRITICAL DEBUG:');
    console.log('🔍 [AppNavigator] profile object:', profile);
    console.log('🔍 [AppNavigator] profile?.onboarded value:', profile?.onboarded);
    console.log('🔍 [AppNavigator] typeof profile?.onboarded:', typeof profile?.onboarded);
    console.log('🔍 [AppNavigator] userOnboarded result:', userOnboarded);
    console.log('🔍 [AppNavigator] Will route to:', userOnboarded ? 'MainTabs' : 'OnboardingStep1');
    
    console.log(
      `[AppNavigator] Session exists. User onboarded status: ${userOnboarded}, Profile:`,
      profile,
    );
    return <MainStack userOnboarded={userOnboarded} />;
  }

  return <AuthStack />;
}

export default AppNavigator;
