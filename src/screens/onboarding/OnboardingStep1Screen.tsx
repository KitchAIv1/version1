import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../services/supabase';

// TODO: Define navigation props if needed
// type OnboardingStep1ScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingStep1'>;

function OnboardingStep1Screen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'OnboardingStep1'>
    >();
  const { user, updateProfile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectRole = async (selectedRole: 'user' | 'creator') => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated. Please try again.');
      return;
    }
    setIsLoading(true);
    try {
      console.log(
        `[OnboardingStep1] Attempting to set role for user ID: ${user.id} to: ${selectedRole}`,
      );

      // Step 2.4: Update Frontend to Handle Missing Profiles (User's new logic)
      // Fetch the existing profile to ensure it exists
      console.log('Fetching profile for id:', user.id);
      let { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id) // Using 'id' as per user's snippet
        .maybeSingle();

      if (fetchError) {
        console.error('Failed to fetch profile:', fetchError);
        Alert.alert('Error fetching profile. Please try again.');
        setIsLoading(false); // Ensure loading is stopped
        return;
      }

      if (!existingProfile) {
        console.log('Profile not found for id:', user.id, 'creating a new one');
        // Generate a unique username to avoid duplicates
        const baseUsername = user.email?.split('@')[0] || 'user';
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        const uniqueUsername = `${baseUsername}_${timestamp}`;

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id, // Assuming user.id is the UUID for profiles.id
            username: uniqueUsername,
            bio: 'Welcome to KitchHub!', // Default bio
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            role: null, // Will be updated shortly
            onboarded: false, // Will be updated shortly
            free_ai_generations_used: 0,
            free_scans_used: 0,
          })
          .select('id') // Select 'id' or enough fields to satisfy 'existingProfile'
          .single();

        if (createError) {
          console.error('Failed to create profile:', createError);
          Alert.alert('Failed to create profile. Please try again.');
          setIsLoading(false); // Ensure loading is stopped
          return;
        }
        existingProfile = newProfile; // Assign the newly created profile
        console.log('Profile created successfully:', existingProfile);
      }

      // Update the existing profile using RPC function (ensures proper tier assignment)
      console.log(
        'Updating profile with role:',
        selectedRole,
        'onboarded:',
        true,
        'for user ID:',
        user.id,
      );
      const { data: updateData, error: updateError } = await supabase.rpc(
        'update_profile',
        {
          p_user_id: user.id,
          p_role: selectedRole,
          p_onboarded: true,
          // Don't set p_username - let it keep the existing username from signup
        }
      );

      if (updateError) {
        console.error('Failed to update profile (1st attempt):', updateError);
        let retries = 0;
        const maxRetries = 2;
        let success = false;
        // Ensure finalUpdateData can hold either an array or null
        let finalUpdateData: any[] | null = updateData;

        while (retries < maxRetries && !success) {
          retries++;
          console.log(`Retrying profile update (${retries}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: retryData, error: retryError } = await supabase.rpc(
            'update_profile',
            {
              p_user_id: user.id,
              p_role: selectedRole,
              p_onboarded: true,
              // Don't set p_username - let it keep the existing username from signup
            }
          );

          if (retryError) {
            console.error(`Retry ${retries} failed:`, retryError);
            if (retries === maxRetries) {
              Alert.alert(
                'Failed to complete onboarding after retries. Please try again later.',
              );
            }
          } else {
            console.log('Profile updated successfully after retry:', retryData);
            finalUpdateData = retryData;
            success = true;
            break;
          }
        }
        if (!success) {
          setIsLoading(false); // Ensure loading is stopped
          return; // Exit if all retries failed
        }
        // Use finalUpdateData for logging if needed, e.g. console.log('Final update data:', finalUpdateData);
      } else {
        console.log('Profile updated successfully (1st attempt):', updateData);
      }

      // 3. Update local AuthContext state by calling refreshProfile
      if (refreshProfile) {
        console.log(
          '[OnboardingStep1] Calling refreshProfile to update AuthContext...',
        );
        await refreshProfile(user.id);
        console.log('[OnboardingStep1] AuthContext profile refreshed via RPC.');
      } else {
        console.warn(
          '[OnboardingStep1] refreshProfile function not available in AuthContext. Falling back to local update.',
        );
        // Fallback to old local update if refreshProfile is somehow not available (should not happen)
        if (updateProfile) {
          updateProfile({
            onboarded: true,
            role: selectedRole,
            username: user.email,
          }); // Also update username as a guess
        }
      }

      // 4. Navigate
      if (selectedRole === 'user') {
        navigation.navigate('OnboardingStep2User');
      } else {
        navigation.navigate('OnboardingStep2Creator');
      }
    } catch (e: any) {
      console.error('[OnboardingStep1] Generic error in handleSelectRole:', e);
      if (
        !e.message?.includes('Could not save your role choice') &&
        !e.message?.includes('Could not verify your profile') &&
        !e.message?.includes('Your profile setup is incomplete')
      ) {
        Alert.alert(
          'An Unexpected Error Occurred',
          e.message || 'There was an issue selecting your role.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Kitch Hub!</Text>
      <Text style={styles.subtitle}>What brings you here?</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#22c55e" />
      ) : (
        <>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleSelectRole('user')}>
            <Text style={styles.buttonText}>
              I'm here to discover recipes & manage my pantry
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => handleSelectRole('creator')}>
            <Text style={styles.buttonText}>
              I'm here to share my recipes with the world
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'gray',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
    width: '90%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default OnboardingStep1Screen;
