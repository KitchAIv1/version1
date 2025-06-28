import * as Sentry from '@sentry/react-native';

// Sentry configuration for production error reporting
export const initializeSentry = () => {
  if (!__DEV__) {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || 'https://your-sentry-dsn@sentry.io/project-id',
      environment: process.env.NODE_ENV || 'production',
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      beforeSend(event) {
        // Filter out debug/development errors
        if (event.level === 'debug' || event.level === 'info') {
          return null;
        }
        return event;
      },
      tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
    });
    
    console.log('📊 Sentry initialized for production error reporting');
  } else {
    console.log('🔧 Sentry disabled in development mode');
  }
};

// Helper function to capture user context
export const setSentryUser = (user: { id: string; email?: string; username?: string }) => {
  if (!__DEV__) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }
};

// Helper function to capture breadcrumbs
export const addSentryBreadcrumb = (message: string, category: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (!__DEV__) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now(),
    });
  }
};

export default Sentry; 