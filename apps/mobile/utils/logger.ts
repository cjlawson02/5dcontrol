/**
 * Simple logging utility that respects development mode.
 * In production, only errors and warnings are logged.
 */

const isDev = __DEV__;

export const logger = {
  /**
   * Debug-level logging - only in development
   */
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info-level logging - only in development
   */
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Warning-level logging - always logged
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Error-level logging - always logged
   */
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};
