import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON;

if (!supabaseUrl) {
  console.warn('Supabase URL environment variable (EXPO_PUBLIC_SUPABASE_URL) is not set. Check your .env file.');
  // Alert.alert('Configuration Error', 'Supabase URL is not configured. Please ensure EXPO_PUBLIC_SUPABASE_URL is set in your .env file.');
}

if (!supabaseAnonKey) {
  console.warn('Supabase Anon Key environment variable (EXPO_PUBLIC_SUPABASE_ANON) is not set. Check your .env file.');
  // Alert.alert('Configuration Error', 'Supabase Anon Key is not configured. Please ensure EXPO_PUBLIC_SUPABASE_ANON is set in your .env file.');
}

// The createClient function expects the URL and key to be strings.
// If they are undefined (because they are not set in .env), 
// Supabase client creation will fail at runtime, which is expected.
// Adding non-null assertion operator (!) as we are warning above if they are not set.
export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
}); 