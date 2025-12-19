/**
 * App Factory for Testing
 * 
 * Creates a testable Express app with dependency injection for:
 * - Database/storage mocking
 * - Redis mocking
 * - Object storage mocking
 * - Authentication mocking
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server } from 'http';

export interface MockUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'broker_user' | 'underwriter' | 'sales_admin' | 'super_admin';
}

export interface TestAppOptions {
  /** Mock authenticated user (null = unauthenticated) */
  authenticatedUser?: MockUser | null;
  /** Skip CSRF protection */
  skipCsrf?: boolean;
  /** Skip rate limiting */
  skipRateLimit?: boolean;
  /** Custom storage mock */
  storage?: Partial<TestStorageMock>;
}

export interface TestStorageMock {
  getUser: (id: string) => Promise<any>;
  upsertUser: (user: any) => Promise<any>;
  getProspects: (userId: string) => Promise<any[]>;
  getProspect: (id: number) => Promise<any>;
  createProspect: (data: any) => Promise<any>;
  updateProspect: (id: number, data: any) => Promise<any>;
  deleteProspect: (id: number) => Promise<void>;
  getCompanies: (userId: string) => Promise<any[]>;
  getCompany: (id: number) => Promise<any>;
  createCompany: (data: any) => Promise<any>;
}

/**
 * Creates a minimal test Express app with mocked dependencies
 */
export function createTestApp(options: TestAppOptions = {}): Express {
  const app = express();
  
  // Body parsing
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false, limit: '5mb' }));
  
  // Mock authentication middleware
  app.use((req: any, res, next) => {
    if (options.authenticatedUser) {
      req.user = {
        claims: {
          sub: options.authenticatedUser.id,
          email: options.authenticatedUser.email || 'test@example.com',
          first_name: options.authenticatedUser.firstName || 'Test',
          last_name: options.authenticatedUser.lastName || 'User',
        }
      };
      req.isAuthenticated = () => true;
    } else {
      req.isAuthenticated = () => false;
    }
    next();
  });
  
  // Mock CSRF protection (skip if disabled)
  if (!options.skipCsrf) {
    app.use((req: any, res, next) => {
      // Simplified CSRF check for testing
      const method = req.method.toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const origin = req.headers['origin'];
        const referer = req.headers['referer'];
        const host = req.headers['host'];
        
        if (!origin && !referer) {
          return res.status(403).json({ error: 'CSRF check failed' });
        }
        
        const sourceHost = origin 
          ? new URL(origin).hostname 
          : referer 
            ? new URL(referer).hostname 
            : null;
            
        if (sourceHost && host && !host.includes(sourceHost)) {
          return res.status(403).json({ error: 'CSRF check failed' });
        }
      }
      next();
    });
  }
  
  // Mock rate limiting (skip if disabled)
  if (!options.skipRateLimit) {
    const rateLimitCounts = new Map<string, number>();
    app.use((req: any, res, next) => {
      const key = `${req.ip}:${req.path}`;
      const count = rateLimitCounts.get(key) || 0;
      
      // Simple rate limit: 100 requests per path
      if (count >= 100) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      
      rateLimitCounts.set(key, count + 1);
      res.setHeader('X-RateLimit-Remaining', String(100 - count - 1));
      next();
    });
  }
  
  return app;
}

/**
 * Creates a test app with a simple authenticated route for testing auth/CSRF/rate limiting
 */
export function createTestAppWithRoutes(options: TestAppOptions = {}): Express {
  const app = createTestApp(options);
  
  // Test routes for exercising middleware
  app.get('/api/test', (req: any, res) => {
    res.json({ 
      authenticated: req.isAuthenticated?.() ?? false,
      userId: req.user?.claims?.sub || null 
    });
  });
  
  app.post('/api/test', (req: any, res) => {
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ success: true, body: req.body });
  });
  
  app.put('/api/test/:id', (req: any, res) => {
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ success: true, id: req.params.id, body: req.body });
  });
  
  app.delete('/api/test/:id', (req: any, res) => {
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ success: true, deleted: req.params.id });
  });
  
  // Webhook test route (bypasses CSRF but requires API key)
  app.post('/api/webhooks/test', (req: any, res) => {
    const apiKey = req.headers['x-flowloan-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    res.json({ success: true, received: req.body });
  });
  
  return app;
}

/**
 * Default mock storage for testing
 */
export function createMockStorage(): TestStorageMock {
  const users = new Map<string, any>();
  const prospects = new Map<number, any>();
  const companies = new Map<number, any>();
  let prospectIdCounter = 1;
  let companyIdCounter = 1;
  
  return {
    getUser: async (id: string) => users.get(id) || null,
    upsertUser: async (user: any) => {
      users.set(user.id, user);
      return user;
    },
    getProspects: async (userId: string) => {
      return Array.from(prospects.values()).filter(p => p.userId === userId);
    },
    getProspect: async (id: number) => prospects.get(id) || null,
    createProspect: async (data: any) => {
      const id = prospectIdCounter++;
      const prospect = { ...data, id };
      prospects.set(id, prospect);
      return prospect;
    },
    updateProspect: async (id: number, data: any) => {
      const existing = prospects.get(id);
      if (!existing) throw new Error('Prospect not found');
      const updated = { ...existing, ...data };
      prospects.set(id, updated);
      return updated;
    },
    deleteProspect: async (id: number) => {
      prospects.delete(id);
    },
    getCompanies: async (userId: string) => {
      return Array.from(companies.values()).filter(c => c.userId === userId);
    },
    getCompany: async (id: number) => companies.get(id) || null,
    createCompany: async (data: any) => {
      const id = companyIdCounter++;
      const company = { ...data, id };
      companies.set(id, company);
      return company;
    },
  };
}

/**
 * Helper to make authenticated test requests
 */
export function withAuth(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    'Origin': 'http://localhost:5000',
    'Host': 'localhost:5000',
  };
}

/**
 * Helper to make webhook test requests
 */
export function withWebhookAuth(apiKey: string, headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    'X-FlowLoan-Api-Key': apiKey,
    'Content-Type': 'application/json',
  };
}
