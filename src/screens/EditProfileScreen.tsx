import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView, Alert, StyleSheet } from 'react-native';
import { AvatarEditorAndBio } from '../components/AvatarEditorAndBio'; // Check path
import { Button } from 'react-native-paper';
// import { COLORS } from '../constants/colors'; // Removed invalid import
import { supabase } from '../services/supabase'; // Corrected path
import { useQueryClient } from '@tanstack/react-query'; // Import useQueryClient

// Placeholder colors - replace with your actual theme colors later
const PLACEHOLDER_BACKGROUND = '#f5f5f5';
const PLACEHOLDER_PRIMARY = '#22c55e'; // Using the green from profile

// Define route params type if not already defined elsewhere
// Assuming MainStackParamList includes EditProfileScreen
type EditProfileRouteParams = {
  initialProfileData?: { 
    bio?: string | null;
    avatar_url?: string | null;
    username?: string | null; // Add username to route params
  };
  userId?: string;
};

// Define navigation prop type if needed
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// type Props = NativeStackScreenProps<MainStackParamList, 'EditProfileScreen'>;
// const EditProfileScreen = ({ navigation, route }: Props) => { ... }

const EditProfileScreen = ({ navigation, route }: any) => { // Using any temporarily for navigation/route types
  const queryClient = useQueryClient(); // Get queryClient instance
  const { initialProfileData, userId } = route.params || {};
  const [bio, setBio] = useState(initialProfileData?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfileData?.avatar_url || null); // Use null as default if not provided
  const [saving, setSaving] = useState(false);

  // Handler for when AvatarEditorAndBio successfully uploads/changes URL
  const handleAvatarUrlUpdate = (newUrl: string) => {
    setAvatarUrl(newUrl);
  };

  const updateProfile = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID missing. Cannot update profile.");
      return;
    }

    // Retrieve username from initialProfileData, with fallback
    const usernameToUpdate = initialProfileData?.username || 'testuser@example.com';

    setSaving(true);
    try {
      // Call the RPC function to update the profile
      // Ensure the RPC 'update_profile' exists and accepts these parameters
      const { error } = await supabase.rpc('update_profile', {
        p_avatar_url: avatarUrl, // Use p_ prefix
        p_bio: bio,              // Use p_ prefix
        p_username: usernameToUpdate, // Use p_ prefix
        // Pass p_user_id if the RPC needs it explicitly (often uses auth.uid() internally)
        // p_user_id: userId 
      });

      if (error) throw error;

      Alert.alert("Profile Updated", "Your profile has been saved.", [
        { text: "OK", onPress: () => {
            // Use the specific query key that ProfileScreen uses
            queryClient.invalidateQueries({ queryKey: ['profile', userId] }); 
            navigation.goBack();
          } 
        },
      ]);
    } catch (e: any) {
      console.error("Update profile error:", e);
      Alert.alert("Error", e.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <AvatarEditorAndBio
          userId={userId ?? ''} // Pass userId, handle case where it might be undefined initially
          initialAvatarUrl={avatarUrl} // Pass current state avatarUrl
          initialBio={bio}          // Pass current state bio
          onAvatarChange={handleAvatarUrlUpdate} // Callback to update state on new upload
          onBioChange={setBio}           // Directly update state on bio change
        />

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={updateProfile}
            loading={saving}
            disabled={saving || !userId} // Disable if saving or no userId
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
          >
            Save Changes
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: PLACEHOLDER_BACKGROUND, // Use placeholder
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  buttonContainer: {
    paddingHorizontal: 20, 
    marginTop: 30,
  },
  button: {
    backgroundColor: PLACEHOLDER_PRIMARY, // Use placeholder
    borderRadius: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContent: {
     paddingVertical: 8,
  },
});

export default EditProfileScreen; 