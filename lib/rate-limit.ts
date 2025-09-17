/**
 * Rate limiting utility for API endpoints
 * Prevents abuse and DoS attacks
 */

import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

// In-memory rate limit store (for production, use Redis or similar)
const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  limit: number;        // Number of requests allowed
  windowMs: number;     // Time window in milliseconds
  blockDurationMs?: number; // How long to block after limit exceeded
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const ip = getClientIP(request);
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const blockDuration = config.blockDurationMs || config.windowMs;
  
  const current = rateLimitMap.get(ip);
  
  // If no entry exists or window has expired, create new entry
  if (!current || current.resetTime < windowStart) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
      blocked: false
    };
    rateLimitMap.set(ip, newEntry);
    
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime
    };
  }
  
  // If currently blocked, check if block period has expired
  if (current.blocked && current.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
      blocked: false
    };
    rateLimitMap.set(ip, newEntry);
    
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime
    };
  }
  
  // If blocked, return block status
  if (current.blocked) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      retryAfter: Math.ceil((current.resetTime - now) / 1000)
    };
  }
  
  // Check if limit exceeded
  if (current.count >= config.limit) {
    current.blocked = true;
    current.resetTime = now + blockDuration;
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      retryAfter: Math.ceil(blockDuration / 1000)
    };
  }
  
  // Increment counter
  current.count++;
  
  return {
    allowed: true,
    remaining: config.limit - current.count,
    resetTime: current.resetTime
  };
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to connection IP (may not work in all environments)
  return (request as any).ip || 'unknown';
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Strict rate limit for token generation
  TOKEN_GENERATION: {
    limit: 5,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000 // Block for 5 minutes
  },
  
  // Moderate rate limit for webhook endpoints
  WEBHOOK: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 60 * 1000 // Block for 1 minute
  },
  
  // Lenient rate limit for general API endpoints
  GENERAL: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 60 * 1000 // Block for 1 minute
  },
  
  // Very strict rate limit for authentication
  AUTH: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000 // Block for 15 minutes
  }
};

/**
 * Middleware function for rate limiting API routes
 */
export function withRateLimit(config: RateLimitConfig) {
  return function rateLimitMiddleware(request: NextRequest) {
    const result = checkRateLimit(request, config);
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetTime: new Date(result.resetTime).toISOString()
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': result.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
          }
        }
      );
    }
    
    return null; // No error, continue processing
  };
}
