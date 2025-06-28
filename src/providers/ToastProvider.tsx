import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((config: ToastConfig) => {
    setToastConfig(config);
    setVisible(true);
  }, []);

  const hideToast = useCallback(() => {
    setVisible(false);
    // Clear config after animation completes
    setTimeout(() => {
      setToastConfig(null);
    }, 300);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toastConfig && (
        <Toast
          visible={visible}
          message={toastConfig.message}
          type={toastConfig.type}
          duration={toastConfig.duration}
          onHide={hideToast}
          action={toastConfig.action}
        />
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider; 