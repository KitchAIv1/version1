import React, { useState } from 'react';
import { View, Alert, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const nav = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const onLogin = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);

    if (error) {
      return Alert.alert('Login failed', error.message);
    }
    // Successful login: AuthProvider state change will trigger AppNavigator to show MainTabs
    // nav.reset({ index: 0, routes: [{ name: 'MainTabs' as never }] }); // Not strictly needed if AuthProvider works
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
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            className="mb-6"
          />
          <Button 
            mode="contained" 
            onPress={onLogin} 
            disabled={!email || !password || isLoading} 
            loading={isLoading}
          >
            Log in
          </Button>
          <Text className="mt-6 text-center" onPress={() => !isLoading && nav.replace('Signup')}> 
            Need an account? <Text className="text-brand-green font-semibold">Sign up</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 