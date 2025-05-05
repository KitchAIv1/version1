import 'react-native-url-polyfill/auto';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { paperTheme } from './theme/paperTheme';
import { AuthProvider } from './src/providers/AuthProvider';
import AppNavigator from './src/navigation/AppNavigator';

// Create a client
const queryClient = new QueryClient();

export default function App() {
  return (
    // Wrap with GestureHandlerRootView
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <AuthProvider>
            <NavigationContainer>
              <AppNavigator />
              <StatusBar style="auto" />
            </NavigationContainer>
          </AuthProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
