/**
 * Error response utilities for secure error handling.
 * Prevents internal error details from leaking in production.
 */

const isProduction = process.env.NODE_ENV === "production";

// Generic safe error messages for production
const SAFE_ERROR_MESSAGES: Record<number, string> = {
  400: "Invalid request",
  401: "Unauthorized",
  403: "Access denied",
  404: "Not found",
  409: "Conflict",
  413: "Request too large",
  429: "Too many requests",
  500: "Internal server error",
};

/**
 * Sanitize an error message for client response.
 * In production, returns a generic message unless explicitly marked as safe.
 * In development, returns the full error message for debugging.
 */
export function sanitizeErrorMessage(
  error: Error | string,
  statusCode: number = 500,
  safeMessage?: string
): string {
  // If a safe message is explicitly provided, always use it
  if (safeMessage) {
    return safeMessage;
  }

  const errorMessage = typeof error === "string" ? error : error.message;

  // In development, return the full error message
  if (!isProduction) {
    return errorMessage || SAFE_ERROR_MESSAGES[statusCode] || "An error occurred";
  }

  // In production, sanitize error messages
  // Only return the error message if it doesn't contain potentially sensitive patterns
  const sensitivePatterns = [
    /database/i,
    /sql/i,
    /postgres/i,
    /connection/i,
    /timeout/i,
    /undefined/i,
    /null/i,
    /cannot read/i,
    /is not a function/i,
    /econnrefused/i,
    /enotfound/i,
    /memory/i,
    /stack/i,
    /at \w+/, // Stack trace patterns
    /node_modules/i,
    /internal/i,
    /secret/i,
    /key/i,
    /token/i,
    /password/i,
    /auth/i,
  ];

  // Check if error message contains sensitive information
  for (const pattern of sensitivePatterns) {
    if (pattern.test(errorMessage)) {
      return SAFE_ERROR_MESSAGES[statusCode] || "An error occurred";
    }
  }

  // If the error message is short and doesn't match sensitive patterns, it's likely safe
  if (errorMessage.length <= 100) {
    return errorMessage;
  }

  // Long error messages might contain sensitive info, use generic message
  return SAFE_ERROR_MESSAGES[statusCode] || "An error occurred";
}

/**
 * Create a standardized error response object.
 * Includes request ID for correlation when available.
 */
export function createErrorResponse(
  error: Error | string,
  statusCode: number = 500,
  requestId?: string,
  safeMessage?: string
): { error: string; requestId?: string } {
  const response: { error: string; requestId?: string } = {
    error: sanitizeErrorMessage(error, statusCode, safeMessage),
  };

  // Include request ID in error response for debugging/support correlation
  if (requestId) {
    response.requestId = requestId;
  }

  return response;
}
