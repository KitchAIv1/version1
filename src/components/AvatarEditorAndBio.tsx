import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase'; // Corrected path
import Icon from 'react-native-vector-icons/MaterialIcons';
import { decode } from 'base64-arraybuffer'; // For handling base64 upload

const MAX_BIO_LENGTH = 150; // Define max bio length

interface AvatarEditorAndBioProps {
  userId: string;
  initialAvatarUrl: string | null;
  initialBio: string;
  onAvatarChange: (url: string) => void;
  onBioChange: (text: string) => void;
}

export const AvatarEditorAndBio: React.FC<AvatarEditorAndBioProps> = ({ 
  userId,
  initialAvatarUrl,
  initialBio,
  onAvatarChange,
  onBioChange 
}) => {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [bio, setBio] = useState(initialBio);
  const [uploading, setUploading] = useState(false);

  // Update internal state if initial props change (e.g., after saving)
  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
    setBio(initialBio);
  }, [initialAvatarUrl, initialBio]);

  const handleBioChange = (text: string) => {
    setBio(text);
    onBioChange(text);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true, // Request base64 for easier upload handling
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        uploadAvatar(asset.base64, asset.uri);
      } else {
        // Fallback if base64 is not available (shouldn't happen with base64: true)
        Alert.alert('Error', 'Could not get image data.');
      }
    }
  };

  const uploadAvatar = async (base64: string, uri: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing.');
      return;
    }
    try {
      setUploading(true);
      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const path = `${userId}/${userId}-${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars') // Assuming 'avatars' bucket
        .upload(path, decode(base64), { contentType });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = urlData.publicUrl;
      
      console.log('New avatar URL:', newUrl);
      setAvatarUrl(newUrl); 
      onAvatarChange(newUrl);

    } catch (error: any) {
      console.error("Avatar upload error:", error);
      Alert.alert('Upload Failed', error.message || 'Could not upload avatar.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={pickImage} style={styles.avatarContainer} disabled={uploading}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={40} color="#ccc" />
          </View>
        )}
        {uploading ? (
          <ActivityIndicator style={styles.uploadIndicator} size="large" color="#fff" />
        ) : (
          <View style={styles.editIconContainer}>
             <Icon name="edit" size={18} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      
      <Text style={styles.bioLabel}>Bio</Text>
      <TextInput
        value={bio}
        onChangeText={handleBioChange}
        style={styles.textInput}
        placeholder="Tell us about yourself..."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={4}
        maxLength={MAX_BIO_LENGTH}
      />
      <Text style={styles.charCounter}>{`${bio.length}/${MAX_BIO_LENGTH}`}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    marginBottom: 20,
    position: 'relative', // For positioning upload indicator/icon
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  uploadIndicator: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 15,
  },
  bioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
    minHeight: 100,
    width: '90%',
    backgroundColor: '#fff',
  },
  charCounter: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    width: '90%',
    marginTop: 4,
  },
});

export default AvatarEditorAndBio; 