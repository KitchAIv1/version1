import React from 'react';
import { useAuth } from '../providers/AuthProvider';
import AuthStack from './AuthStack';
// import MainTabs from './MainTabs'; // No longer directly used here
import MainStack from './MainStack'; // Import MainStack
import { ActivityIndicator, View } from 'react-native'; // Import ActivityIndicator and View

const AppNavigator = () => {
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
    console.log(`[AppNavigator] Session exists. User onboarded status: ${userOnboarded}, Profile:`, profile);
    return <MainStack userOnboarded={userOnboarded} />;
  }

  return <AuthStack />;
};

export default AppNavigator; 