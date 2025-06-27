interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  openai: {
    apiKey: string;
  };
  app: {
    environment: 'development' | 'staging' | 'production';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableDevTools: boolean;
  };
}

const getEnvironment = (): EnvironmentConfig => {
  const isDev = __DEV__;
  
  // REVERTED: Back to development database for deployment
  // Using stable dev database instead of separate production database
  const FORCE_PRODUCTION_MODE = false;
  
  const isProduction = process.env.NODE_ENV === 'production' || FORCE_PRODUCTION_MODE;
  
  const config: EnvironmentConfig = {
    supabase: {
      url: isProduction 
        ? process.env.EXPO_PUBLIC_SUPABASE_URL_PROD || process.env.EXPO_PUBLIC_SUPABASE_URL!
        : process.env.EXPO_PUBLIC_SUPABASE_URL!,
      anonKey: isProduction 
        ? process.env.EXPO_PUBLIC_SUPABASE_ANON_PROD || process.env.EXPO_PUBLIC_SUPABASE_ANON!
        : process.env.EXPO_PUBLIC_SUPABASE_ANON!,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
    app: {
      environment: (isProduction ? 'production' : 'development') as 'development' | 'staging' | 'production',
      logLevel: (isProduction ? 'error' : 'debug') as 'debug' | 'info' | 'warn' | 'error',
      enableDevTools: !isProduction,
    },
  };

  // Log database connection info
  console.log('🔗 KitchAI Database Connection:');
  console.log(`📍 Environment: ${config.app.environment.toUpperCase()}`);
  console.log(`🌐 Database URL: ${config.supabase.url}`);
  console.log(`🔑 Using development database: ${!isProduction ? 'YES (STABLE)' : 'NO'}`);
  
  return config;
};

export const ENV = getEnvironment();

// Development-only logging helper
export const devLog = (message: string, ...args: any[]) => {
  if (ENV.app.environment === 'development') {
    console.log(`[KitchAI:${ENV.app.environment}] ${message}`, ...args);
  }
};
