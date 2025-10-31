/**
 * Error utility functions for user-friendly error messages
 */

/**
 * Convert technical error messages to user-friendly ones
 */
export function getUserFriendlyError(error: any): string {
  const errorMessage = error?.message || String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (lowerMessage.includes('timeout')) {
    return 'The request took too long. Please try again.';
  }

  // Authentication errors
  if (lowerMessage.includes('invalid login') || lowerMessage.includes('invalid credentials')) {
    return 'Invalid email or password. Please try again.';
  }

  if (lowerMessage.includes('user not found')) {
    return 'No account found with this email. Please sign up first.';
  }

  if (lowerMessage.includes('email already registered')) {
    return 'This email is already registered. Please sign in instead.';
  }

  if (lowerMessage.includes('weak password')) {
    return 'Password must be at least 6 characters long.';
  }

  if (lowerMessage.includes('email not confirmed')) {
    return 'Email not verified. Please check your inbox and verify your email address.';
  }

  // File upload errors
  if (lowerMessage.includes('invalid file type')) {
    return 'This file type is not supported. Please upload a PDF or image.';
  }

  if (lowerMessage.includes('file too large')) {
    return 'File is too large. Maximum size is 20MB. Please compress your file.';
  }

  if (lowerMessage.includes('file size')) {
    return 'File is too large. Please use a smaller file.';
  }

  // API errors
  if (lowerMessage.includes('503') || lowerMessage.includes('unavailable')) {
    return 'Service is temporarily unavailable. Please try again in a few minutes.';
  }

  if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
    return 'Authentication failed. Please log in again.';
  }

  if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
    return 'Access denied. You don\'t have permission to perform this action.';
  }

  if (lowerMessage.includes('429') || lowerMessage.includes('quota exceeded')) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }

  // Unknown errors
  return 'Something went wrong. Please try again.';
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
  const errorMessage = String(error?.message || error).toLowerCase();
  return errorMessage.includes('network') || 
         errorMessage.includes('fetch failed') || 
         errorMessage.includes('timeout');
}

/**
 * Check if error requires user action (like retry)
 */
export function isRetryableError(error: any): boolean {
  const errorMessage = String(error?.message || error).toLowerCase();
  return isNetworkError(error) || 
         errorMessage.includes('503') || 
         errorMessage.includes('timeout');
}

