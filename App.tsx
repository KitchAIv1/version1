import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { paperTheme } from './theme/paperTheme';

// Create a client
const queryClient = new QueryClient();

export default function App() {
  return (
    // Provide the client to your App
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={paperTheme}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text className="text-xl text-brand-green">Kitch AI v2 🚀</Text>
          <StatusBar style="auto" />
        </View>
      </PaperProvider>
    </QueryClientProvider>
  );
}
