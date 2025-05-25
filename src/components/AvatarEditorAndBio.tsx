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
import { compressImageWithPreset, needsCompression } from '../utils/imageCompression';

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
  const [compressionInfo, setCompressionInfo] = useState<string>('');

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
      quality: 1.0, // Start with highest quality, we'll compress it ourselves
      base64: false, // We'll get base64 from compression
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      await processAndUploadImage(asset.uri);
    }
  };

  const processAndUploadImage = async (uri: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing.');
      return;
    }

    try {
      setUploading(true);
      setCompressionInfo('Checking image size...');

      // Check if compression is needed
      const { needsCompression: shouldCompress, currentSizeKB } = await needsCompression(uri, 100);
      
      if (shouldCompress) {
        setCompressionInfo(`Compressing ${Math.round(currentSizeKB)}KB image...`);
        
        // Compress using AVATAR preset (400x400, ~100KB target)
        const compressionResult = await compressImageWithPreset(uri, 'AVATAR');
        
        const finalSizeKB = compressionResult.fileSize ? Math.round(compressionResult.fileSize / 1024) : 0;
        const compressionPercent = compressionResult.compressionRatio ? Math.round(compressionResult.compressionRatio * 100) : 0;
        
        setCompressionInfo(`Optimized: ${finalSizeKB}KB (${compressionPercent}% smaller)`);
        
        // Upload the compressed image
        await uploadAvatar(compressionResult.base64!, compressionResult.uri);
      } else {
        setCompressionInfo(`Image already optimized (${Math.round(currentSizeKB)}KB)`);
        
        // Image is already small enough, but still compress for consistency
        const compressionResult = await compressImageWithPreset(uri, 'AVATAR');
        await uploadAvatar(compressionResult.base64!, compressionResult.uri);
      }

      // Clear compression info after a delay
      setTimeout(() => setCompressionInfo(''), 3000);

    } catch (error: any) {
      console.error("Image processing error:", error);
      Alert.alert('Processing Failed', error.message || 'Could not process image.');
      setCompressionInfo('');
    }
  };

  const uploadAvatar = async (base64: string, uri: string) => {
    try {
      setCompressionInfo('Uploading to cloud...');
      
      const fileExt = 'jpg'; // Always use jpg for avatars (better compression)
      const path = `${userId}/${userId}-${Date.now()}.${fileExt}`;
      const contentType = 'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, decode(base64), { contentType });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = urlData.publicUrl;
      
      setAvatarUrl(newUrl); 
      onAvatarChange(newUrl);
      setCompressionInfo('Upload complete!');

    } catch (error: any) {
      console.error("Avatar upload error:", error);
      Alert.alert('Upload Failed', error.message || 'Could not upload avatar.');
      setCompressionInfo('');
      throw error;
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
          <View style={styles.uploadIndicator}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <View style={styles.editIconContainer}>
             <Icon name="edit" size={18} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      
      {/* Compression info display */}
      {compressionInfo && (
        <Text style={styles.compressionInfo}>{compressionInfo}</Text>
      )}
      
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
    position: 'relative',
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
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 15,
  },
  compressionInfo: {
    fontSize: 12,
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
    minHeight: 16,
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