import React, { useState } from 'react';
import { View, Alert, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { supabase } from '../../services/supabase'; // Corrected path
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack'; // Corrected path

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export default function SignupScreen() {
  const nav = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const onSignup = async () => {
    if (pw !== confirm) {
      Alert.alert('Error','Passwords must match');
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({ email, password: pw });
    setIsLoading(false);

    if (error) {
      return Alert.alert('Sign-up failed', error.message);
    }
    // Navigate to DietPrefs after successful signup
    nav.replace('DietPrefs');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View className="p-6 bg-white">
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            className="mb-4"
          />
          <TextInput
            label="Password"
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            className="mb-4"
          />
          <TextInput
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            className="mb-6"
          />
          <Button 
            mode="contained" 
            onPress={onSignup} 
            disabled={!email || !pw || pw !== confirm || isLoading} 
            loading={isLoading}
          >
            Sign up
          </Button>
          <Text className="mt-6 text-center" onPress={() => !isLoading && nav.replace('Login')}> 
            Already have an account? <Text className="text-brand-green font-semibold">Log in</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 