/**
 * Redis Configuration
 * 
 * Provides Redis client with proper error handling and fallback for development.
 * In production, Redis is required for distributed rate limiting.
 */

import Redis from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Create and configure Redis client
 */
export function createRedisClient(): Redis | null {
  // Skip if already created
  if (redisClient !== null) {
    return redisClient;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check if Redis URL is provided
  if (!process.env.REDIS_URL) {
    console.warn(
      '\n⚠️  REDIS_URL not set - using in-memory rate limiting\n' +
      '   This is acceptable for development but NOT suitable for production\n' +
      '   with multiple instances.\n'
    );
    
    if (isProduction) {
      throw new Error(
        'REDIS_URL is required in production for distributed rate limiting.\n' +
        'Please set REDIS_URL environment variable.'
      );
    }
    
    return null;
  }

  try {
    // Create Redis client with optimized settings
    redisClient = new Redis(process.env.REDIS_URL, {
      // Connection settings
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      
      // Retry strategy
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.error('❌ Redis connection failed after 10 retries');
          return null; // Stop retrying
        }
        
        // Exponential backoff: 50ms, 100ms, 200ms, 400ms, ...
        const delay = Math.min(times * 50, 2000);
        console.warn(`⚠️  Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      
      // Reconnect on error
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect on READONLY errors (Redis replica promoted to master)
          return true;
        }
        return false;
      },
      
      // Timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Keep connection alive
      keepAlive: 30000,
    });

    // Event handlers
    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready to accept commands');
    });

    redisClient.on('error', (err: Error) => {
      console.error('❌ Redis error:', err.message);
      
      // In production, we might want to alert/monitor this
      if (isProduction) {
        // TODO: Send to monitoring service (e.g., Sentry, DataDog)
        console.error('🚨 PRODUCTION REDIS ERROR - immediate attention required');
      }
    });

    redisClient.on('close', () => {
      console.warn('⚠️  Redis connection closed');
    });

    redisClient.on('reconnecting', (timeToReconnect: number) => {
      console.log(`🔄 Redis reconnecting in ${timeToReconnect}ms`);
    });

    redisClient.on('end', () => {
      console.warn('⚠️  Redis connection ended - no more reconnect attempts');
    });

    return redisClient;
    
  } catch (error) {
    console.error('❌ Failed to create Redis client:', error);
    
    if (isProduction) {
      throw new Error('Redis initialization failed in production');
    }
    
    console.warn('⚠️  Falling back to in-memory rate limiting for development');
    return null;
  }
}

/**
 * Get existing Redis client or create new one
 */
export function getRedisClient(): Redis | null {
  if (redisClient === null) {
    return createRedisClient();
  }
  return redisClient;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    console.log('🔒 Closing Redis connection...');
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed gracefully');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
      // Force disconnect if graceful quit fails
      redisClient.disconnect();
    }
    redisClient = null;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  if (!redisClient) {
    return {
      healthy: false,
      error: 'Redis client not initialized'
    };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    
    return {
      healthy: true,
      latency
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
