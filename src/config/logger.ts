/**
 * Centralized Logging System for KitchAI v2
 * 
 * Provides environment-aware logging with data sanitization for beta testing
 * and production deployment. Enables structured debugging while protecting
 * sensitive user information.
 * 
 * Usage:
 * - Development/Beta: Full debug logging enabled
 * - Production: Error-level logging only
 * - Data sanitization: Automatic redaction of sensitive fields
 */

import { logger } from 'react-native-logs';

// Sensitive field patterns to sanitize
const SENSITIVE_FIELDS = [
  'token', 'password', 'email', 'phone', 'user_id', 
  'access_token', 'refresh_token', 'api_key', 'apiKey',
  'authorization', 'session', 'cookie'
];

/**
 * Sanitizes log data by redacting sensitive fields
 */
const sanitizeLogData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
};

/**
 * Custom transport that sanitizes data before logging
 */
const sanitizedConsoleTransport = (msg: any) => {
  if (msg.rawMsg && msg.rawMsg.length > 1) {
    // Sanitize additional data objects
    const sanitizedArgs = msg.rawMsg.slice(1).map(sanitizeLogData);
    console.log(msg.level.text, msg.msg, ...sanitizedArgs);
  } else {
    console.log(msg.level.text, msg.msg);
  }
};

/**
 * Logger configuration
 */
const config = {
  severity: __DEV__ ? 'debug' : 'error',
  transport: sanitizedConsoleTransport,
  transportOptions: {
    colors: {
      info: 'blueBright',
      warn: 'yellowBright',
      error: 'redBright',
      debug: 'gray'
    }
  },
  enabled: true,
  enabledExtensions: __DEV__ ? undefined : ['error', 'warn'],
};

// Create main logger
export const log = logger.createLogger(config);

// Feature-specific loggers for better organization
export const authLog = log.extend('auth');
export const aiLog = log.extend('ai');
export const cameraLog = log.extend('camera');
export const feedLog = log.extend('feed');
export const recipeLog = log.extend('recipe');
export const pantryLog = log.extend('pantry');
export const performanceLog = log.extend('perf');

/**
 * Beta testing utility functions
 */
export const logBetaEvent = (component: string, event: string, data?: any) => {
  if (__DEV__) {
    log.info(`[BETA] ${component}: ${event}`, sanitizeLogData(data));
  }
};

export const logPerformanceMetric = (operation: string, duration: number, metadata?: any) => {
  if (__DEV__) {
    performanceLog.debug(`${operation}: ${duration}ms`, sanitizeLogData(metadata));
  }
};

export const logAIOperation = (operation: string, success: boolean, data?: any) => {
  if (__DEV__) {
    aiLog.info(`AI ${operation} ${success ? 'SUCCESS' : 'FAILED'}`, sanitizeLogData(data));
  }
};

/**
 * Safe logging wrapper that automatically sanitizes data
 */
export const safeLog = {
  debug: (message: string, data?: any) => log.debug(message, sanitizeLogData(data)),
  info: (message: string, data?: any) => log.info(message, sanitizeLogData(data)),
  warn: (message: string, data?: any) => log.warn(message, sanitizeLogData(data)),
  error: (message: string, data?: any) => log.error(message, sanitizeLogData(data)),
};

// Export sanitization utility for manual use
export { sanitizeLogData }; 