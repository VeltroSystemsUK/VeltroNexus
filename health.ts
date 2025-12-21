/**
 * Health Check Endpoint
 * 
 * Provides a comprehensive health check for all system components:
 * - Database connectivity
 * - Redis connectivity (if configured)
 * - Object storage (if configured)
 * 
 * Returns HTTP 200 when all components are healthy
 * Returns HTTP 503 (Service Unavailable) when any component is degraded
 */

import { Request, Response } from 'express';
import { db } from '../db'; // Adjust import path as needed
import { checkRedisHealth } from '../config/redis';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    objectStorage?: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  message?: string;
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    
    // Simple query to check database connectivity
    await db.execute('SELECT 1');
    
    const latency = Date.now() - start;
    
    // Warn if database is slow
    if (latency > 1000) {
      return {
        status: 'degraded',
        latency,
        message: 'Database responding slowly',
      };
    }
    
    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check object storage health (if configured)
 */
async function checkObjectStorageHealth(): Promise<ComponentHealth> {
  try {
    // If you have object storage configured, add check here
    // For now, just return healthy if the module loads
    return {
      status: 'healthy',
      message: 'Object storage not monitored',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
}

/**
 * Main health check handler
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  // Check all components in parallel
  const [databaseHealth, redisHealth, storageHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkObjectStorageHealth(),
  ]);

  // Determine overall status
  const components = {
    database: databaseHealth,
    redis: redisHealth,
    objectStorage: storageHealth,
  };

  const hasUnhealthy = Object.values(components).some((c) => c.status === 'unhealthy');
  const hasDegraded = Object.values(components).some((c) => c.status === 'degraded');

  const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    components,
  };

  // Set appropriate HTTP status code
  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  // Add response headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/json');

  // Log if unhealthy
  if (overallStatus !== 'healthy') {
    console.error('🚨 Health check failed:', JSON.stringify(result, null, 2));
  }

  res.status(statusCode).json(result);
}

/**
 * Simple liveness probe (always returns 200 if app is running)
 */
export function livenessProbe(req: Request, res: Response): void {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Readiness probe (checks if app is ready to receive traffic)
 */
export async function readinessProbe(req: Request, res: Response): Promise<void> {
  try {
    // Quick database check only
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.status === 'unhealthy') {
      res.status(503).json({
        status: 'not_ready',
        reason: 'Database unhealthy',
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
