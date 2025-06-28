import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { paperTheme } from './theme/paperTheme';
import { AuthProvider } from './src/providers/AuthProvider';
import { GroceryProvider } from './src/providers/GroceryProvider';
import { NetworkProvider } from './src/providers/NetworkProvider';
import AppNavigator from './src/navigation/AppNavigator';
import GlobalOfflineIndicator from './src/components/GlobalOfflineIndicator';
import DeepLinkingService from './src/services/DeepLinkingService';

// Create a client with optimized caching and global retry configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Global retry configuration - 3 retries with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Use stale data while fetching new data
      refetchOnMount: true,
      // Don't refetch on window focus by default (reduces unnecessary network calls)
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  // Initialize deep linking service
  useEffect(() => {
    const deepLinkingService = DeepLinkingService.getInstance();
    deepLinkingService.initialize();
    console.log('🔗 Deep linking service initialized');

    // Cleanup on unmount
    return () => {
      deepLinkingService.cleanup();
    };
  }, []);

  return (
    // Wrap with GestureHandlerRootView
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider queryClient={queryClient}>
          <PaperProvider theme={paperTheme}>
            <AuthProvider>
              <GroceryProvider>
                <NavigationContainer>
                  <AppNavigator />
                  <GlobalOfflineIndicator />
                  <StatusBar style="auto" />
                </NavigationContainer>
              </GroceryProvider>
            </AuthProvider>
          </PaperProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
