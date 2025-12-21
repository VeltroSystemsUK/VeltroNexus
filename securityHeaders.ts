/**
 * Security Headers Middleware
 * 
 * Applies comprehensive security headers to all HTTP responses to protect against
 * common web vulnerabilities including XSS, clickjacking, MIME sniffing, etc.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Content Security Policy configuration
 * Adjust based on your application's specific needs
 */
function getCSPHeader(isDevelopment: boolean): string {
  // Development CSP - more permissive for hot reload, devtools, etc.
  if (isDevelopment) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Vite dev
      "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Vite dev
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:", // WebSocket for HMR
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  // Production CSP - strict security
  return [
    "default-src 'self'",
    "script-src 'self'", // No inline scripts in production
    "style-src 'self' 'unsafe-inline'", // Some CSS-in-JS libraries need this
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'", // Prevent clickjacking
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests", // Force HTTPS
    "block-all-mixed-content", // No HTTP resources on HTTPS pages
  ].join('; ');
}

/**
 * Permissions Policy configuration
 * Disables unnecessary browser features
 */
function getPermissionsPolicy(): string {
  return [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()', // Disable FLoC tracking
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()',
  ].join(', ');
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable browser XSS protection (legacy, but doesn't hurt)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable browser features and APIs
  res.setHeader('Permissions-Policy', getPermissionsPolicy());

  // Content Security Policy
  res.setHeader('Content-Security-Policy', getCSPHeader(isDevelopment));

  // Strict Transport Security (HTTPS only, production only)
  if (!isDevelopment) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Remove server identification
  res.removeHeader('X-Powered-By');

  // DNS Prefetch Control - prevent browsers from DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Download options - prevent IE from executing downloads
  res.setHeader('X-Download-Options', 'noopen');

  // Expect-CT header (deprecated but some older browsers still use it)
  if (!isDevelopment) {
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }

  next();
}

/**
 * Additional security headers for API endpoints
 * Use this for JSON API routes
 */
export function apiSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent caching of sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Ensure JSON content type
  if (res.getHeader('Content-Type') === undefined) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  next();
}

/**
 * CORS configuration middleware
 * Use this before your routes
 */
export function corsHeaders(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  const origin = req.headers.origin;

  // Allow requests with no origin (mobile apps, Postman, curl, etc.)
  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } 
  // Check if origin is in allowed list
  else if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); // Important for caching
  }
  // In development, allow localhost
  else if (process.env.NODE_ENV === 'development' && 
           (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  // Otherwise, don't set CORS headers (request will be blocked)

  // Allow credentials
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Allowed methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  // Allowed headers
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, X-FlowLoan-Api-Key, X-Request-Id'
  );

  // Expose custom headers to browser
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'
  );

  // Max age for preflight requests (24 hours)
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}

/**
 * Combine all security headers
 */
export function allSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  securityHeaders(req, res, () => {
    corsHeaders(req, res, next);
  });
}
