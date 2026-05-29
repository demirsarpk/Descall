/**
 * Centralized Error Handling System for Descall
 * Captures all frontend errors and sends them to admin logs
 */

import { getToken } from '../lib/storage';

// Error buffer to prevent duplicate errors
const errorBuffer = new Map();
const ERROR_BUFFER_TIME = 5000; // 5 seconds
const ERROR_RATE_LIMIT = 10; // Max 10 errors per minute
let errorCount = 0;
let errorWindowStart = Date.now();

/**
 * Check if we're being rate limited
 */
function isRateLimited() {
  const now = Date.now();
  if (now - errorWindowStart > 60000) {
    // Reset window
    errorCount = 0;
    errorWindowStart = now;
  }
  errorCount++;
  return errorCount > ERROR_RATE_LIMIT;
}

/**
 * Generate unique error signature
 */
function getErrorSignature(error) {
  const stack = error.stack || '';
  const message = error.message || '';
  return `${message}_${stack.split('\n')[0]}`;
}

/**
 * Check if error is duplicate (sent recently)
 */
function isDuplicate(error) {
  const signature = getErrorSignature(error);
  const lastSeen = errorBuffer.get(signature);
  const now = Date.now();
  
  if (lastSeen && now - lastSeen < ERROR_BUFFER_TIME) {
    return true;
  }
  
  errorBuffer.set(signature, now);
  
  // Cleanup old entries
  errorBuffer.forEach((timestamp, key) => {
    if (now - timestamp > ERROR_BUFFER_TIME) {
      errorBuffer.delete(key);
    }
  });
  
  return false;
}

/**
 * Get browser and system information
 */
function getSystemInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Get current user info
 */
async function getUserInfo() {
  try {
    const user = await getCurrentUser();
    return {
      id: user?.id || 'anonymous',
      username: user?.username || 'Unknown',
      email: user?.email || null,
      ip: user?.lastIp || null,
      session: user?.sessionId || null,
    };
  } catch (e) {
    return {
      id: 'anonymous',
      username: 'Unknown',
      email: null,
      ip: null,
      session: null,
    };
  }
}

/**
 * Categorize error type
 */
function categorizeError(error) {
  const message = (error.message || '').toLowerCase();
  const stack = (error.stack || '').toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
    return { type: 'network', severity: 'warning' };
  }
  if (message.includes('permission') || message.includes('denied') || message.includes('unauthorized')) {
    return { type: 'auth', severity: 'warning' };
  }
  if (message.includes('undefined') || message.includes('null') || message.includes('is not defined') || message.includes('cannot read')) {
    return { type: 'runtime', severity: 'error' };
  }
  if (message.includes('memory') || message.includes('heap') || message.includes('out of memory')) {
    return { type: 'system', severity: 'critical' };
  }
  if (message.includes('syntax') || message.includes('unexpected token')) {
    return { type: 'syntax', severity: 'critical' };
  }
  if (stack.includes('react') || stack.includes('component')) {
    return { type: 'ui', severity: 'error' };
  }
  if (stack.includes('webrtc') || stack.includes('rtc') || stack.includes('media')) {
    return { type: 'webrtc', severity: 'error' };
  }
  
  return { type: 'unknown', severity: 'error' };
}

/**
 * Send error to backend
 */
async function sendToBackend(errorData) {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
    const response = await fetch(`${API_BASE_URL}/api/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken() || ''}`
      },
      body: JSON.stringify({
        message: errorData.message,
        stack: errorData.stack,
        componentStack: errorData.component,
        url: errorData.url,
        userAgent: errorData.userAgent,
        timestamp: errorData.timestamp,
        userId: errorData.userId,
        username: errorData.username,
        severity: errorData.severity || 'error',
        source: errorData.type || 'frontend'
      }),
    });
    
    if (!response.ok) {
      console.error('[ErrorHandler] Failed to send error:', response.status);
    } else {
      console.log('[ErrorHandler] Error reported successfully');
    }
  } catch (e) {
    // Silent fail - don't cause infinite loop
    console.error('[ErrorHandler] Failed to report error:', e);
  }
}

/**
 * Main error capture function
 */
export async function captureError(error, context = {}) {
  // Rate limiting
  if (isRateLimited()) {
    console.warn('[ErrorHandler] Rate limited, skipping error');
    return;
  }
  
  // Duplicate check
  if (isDuplicate(error)) {
    console.log('[ErrorHandler] Duplicate error, skipping');
    return;
  }
  
  const systemInfo = getSystemInfo();
  const userInfo = await getUserInfo();
  const { type, severity } = categorizeError(error);
  
  const errorData = {
    // Error details
    message: error.message,
    name: error.name,
    stack: error.stack,
    type,
    severity,
    
    // Context
    component: context.component || null,
    action: context.action || null,
    additionalData: context.data || null,
    
    // User info
    userId: userInfo.id,
    username: userInfo.username,
    userEmail: userInfo.email,
    userIp: userInfo.ip,
    sessionId: userInfo.session,
    
    // System info
    userAgent: systemInfo.userAgent,
    platform: systemInfo.platform,
    language: systemInfo.language,
    screenResolution: systemInfo.screenResolution,
    viewport: systemInfo.viewport,
    url: systemInfo.url,
    referrer: systemInfo.referrer,
    timezone: systemInfo.timezone,
    
    // Timestamp
    timestamp: systemInfo.timestamp,
    clientTimestamp: Date.now(),
  };
  
  // Log locally
  console.error('[ErrorHandler] Captured error:', errorData);
  
  // Send to backend
  await sendToBackend(errorData);
  
  return errorData;
}

/**
 * Initialize global error handlers
 */
export function initErrorHandlers() {
  // Global error handler
  window.addEventListener('error', (event) => {
    event.preventDefault();
    captureError(event.error || new Error(event.message), {
      component: event.filename,
      action: 'global_error',
      data: {
        line: event.lineno,
        col: event.colno,
        filename: event.filename,
      },
    });
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    captureError(error, {
      action: 'unhandled_promise_rejection',
    });
  });
  
  // React error handler (will be set up by ErrorBoundary)
  window.__REACT_ERROR_HANDLER__ = (error, errorInfo) => {
    captureError(error, {
      component: errorInfo?.componentStack,
      action: 'react_error_boundary',
      data: errorInfo,
    });
  };
  
  console.log('[ErrorHandler] Global error handlers initialized');
}

/**
 * Manual error reporting
 */
export function reportError(message, context = {}) {
  const error = new Error(message);
  return captureError(error, context);
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      await captureError(error, {
        ...context,
        action: fn.name || 'anonymous_function',
        data: { args },
      });
      throw error;
    }
  };
}

export default {
  captureError,
  initErrorHandlers,
  reportError,
  withErrorHandling,
};
