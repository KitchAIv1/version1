import React from 'react';
import { useAuth } from '../providers/AuthProvider';
import AuthStack from './AuthStack';
// import MainTabs from './MainTabs'; // No longer directly used here
import MainStack from './MainStack'; // Import MainStack

const AppNavigator = () => {
  const { session } = useAuth();

  // The AuthProvider handles the initial loading state,
  // so we just need to check if a session exists here.
  if (session) {
    // return <MainTabs />; // Render MainStack instead
    return <MainStack />;
  }

  return <AuthStack />;
};

export default AppNavigator; 