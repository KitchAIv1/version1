import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { isOfflineError } from '../utils/networkUtils';

interface NetworkContextType {
  isOffline: boolean;
  setOffline: (offline: boolean) => void;
  retryAllQueries: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
  queryClient: QueryClient;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ 
  children, 
  queryClient 
}) => {
  const [isOffline, setIsOffline] = useState(false);

  // Global error handler for all React Query errors
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.query.state.error) {
        const error = event.query.state.error;
        
        // Check if this is an offline error
        if (isOfflineError(error)) {
          console.log('[NetworkProvider] 🔴 Global offline detection:', error);
          setIsOffline(true);
        }
      }
    });

    return unsubscribe;
  }, [queryClient]);

  const setOffline = (offline: boolean) => {
    console.log(`[NetworkProvider] Setting offline state: ${offline}`);
    setIsOffline(offline);
  };

  const retryAllQueries = () => {
    console.log('[NetworkProvider] 🔄 Retrying all failed queries');
    setIsOffline(false);
    queryClient.invalidateQueries();
  };

  return (
    <NetworkContext.Provider value={{ 
      isOffline, 
      setOffline, 
      retryAllQueries 
    }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}; 