import React from 'react';
import { ActivityIndicator, View } from 'react-native'; // Import ActivityIndicator and View
import { useAuth } from '../providers/AuthProvider';
import AuthStack from './AuthStack';
// import MainTabs from './MainTabs'; // No longer directly used here
import MainStack from './MainStack'; // Import MainStack

export default function AppNavigator() {
  const { loading, session, profile, profileLoading } = useAuth();

  // Show loading screen while authentication is being determined
  if (loading || profileLoading) {
    return <LoadingScreen />;
  }

  // If no session, show auth stack
  if (!session) {
    return <AuthStack />;
  }

  // If session exists but no profile, show loading
  if (!profile) {
    return <LoadingScreen />;
  }

  // Check if user has completed onboarding
  const userOnboarded = profile?.onboarded === true;

  if (__DEV__) {
    console.log('[AppNavigator] Session exists. User onboarded status:', userOnboarded);
  }

  // Pass userOnboarded to MainStack
  return <MainStack userOnboarded={userOnboarded} />;
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
