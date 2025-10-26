/**
 * Logger utility for development and production environments
 * 
 * In development mode (__DEV__ = true), all logs are output to console.
 * In production mode (__DEV__ = false), logs are suppressed for security and performance.
 */

export const log = __DEV__ ? console.log.bind(console) : () => {};
export const warn = __DEV__ ? console.warn.bind(console) : () => {};
export const error = __DEV__ ? console.error.bind(console) : () => {};
export const info = __DEV__ ? console.info.bind(console) : () => {};
export const debug = __DEV__ ? console.debug.bind(console) : () => {};

/**
 * Usage:
 * 
 * import { log, warn, error } from '@/lib/logger';
 * 
 * log('This will only log in development');
 * warn('Warning message');
 * error('Error message');
 */

