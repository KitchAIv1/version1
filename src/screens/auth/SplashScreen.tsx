import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../providers/AuthProvider';
import { AuthStackParamList } from '../../navigation/AuthStack';

// Define the specific navigation prop type for this screen
type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

const SplashScreen = () => {
  // Get session and loading state from auth context
  const { session, loading } = useAuth(); // Use 'loading' as defined in AuthProvider
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    // Only navigate once the initial loading is finished
    if (!loading) {
      if (session) {
        // If session exists, user is logged in. Reset to MainTabs.
        // 'MainTabs' is not in AuthStackParamList, so type assertion is needed.
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' as never }] });
      } else {
        // If no session, user is not logged in. Replace Splash with Login.
        navigation.replace('Login');
      }
    }
  }, [loading, session, navigation]); // Dependencies for the effect

  // Show loading indicator while checking session
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#00B388" />
    </View>
  );
};

export default SplashScreen; 