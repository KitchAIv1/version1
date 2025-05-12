import 'react-native-url-polyfill/auto';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { paperTheme } from './theme/paperTheme';
import { AuthProvider } from './src/providers/AuthProvider';
import { GroceryProvider } from './src/providers/GroceryProvider';
import AppNavigator from './src/navigation/AppNavigator';

// Create a client with optimized caching configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests 1 time
      retry: 1,
      // Use stale data while fetching new data
      refetchOnMount: true,
      // Don't refetch on window focus by default (reduces unnecessary network calls)
      refetchOnWindowFocus: false,
    }
  }
});

export default function App() {
  return (
    // Wrap with GestureHandlerRootView
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <AuthProvider>
            <GroceryProvider>
              <NavigationContainer>
                <AppNavigator />
                <StatusBar style="auto" />
              </NavigationContainer>
            </GroceryProvider>
          </AuthProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
