import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON;

// Log the Supabase URL and Anon Key to verify them at runtime
console.log('[SupabaseClient] Initializing with URL:', supabaseUrl);
console.log('[SupabaseClient] Initializing with Anon Key (from EXPO_PUBLIC_SUPABASE_ANON):', supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'undefined');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SupabaseClient] Supabase URL or Anon Key (EXPO_PUBLIC_SUPABASE_ANON) is missing. Check environment variables.');
  // You might want to throw an error here or handle it in a way that alerts the developer
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