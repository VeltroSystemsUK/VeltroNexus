import type { Express } from "express";
import { createServer, type Server } from "http";
import busboy from "busboy";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, csrfProtection } from "./replitAuth";
import {
  insertCompanySchema,
  insertProspectSchema,
  updateProspectStageSchema,
  insertContactSchema,
  insertActivitySchema,
  insertLenderSchema,
  insertApplicationSubmissionSchema,
  queryResponseSchema,
  webhookProspectPayloadSchema,
  type InsertApplicationSubmission,
  type UnderwritingAttachment,
  type DueDiligenceData,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import { createRequire } from 'module';
import { generateProspectReport } from "./utils/pdfGenerator";
import { generatePipelineExcel } from "./utils/excelExporter";
import { getUncachableResendClient } from "./utils/resendClient";
import { getSicDescription } from "./utils/sicCodeLookup";
import { createErrorResponse } from "./utils/errorResponse";
import { rateLimitMiddleware } from "./utils/rateLimit";
import { 
  wrapAiRequest, 
  requirePremiumAndConsent, 
  AI_GOVERNANCE_CONFIG,
  redactSensitiveData
} from "./utils/aiGovernance";
import { Client as ObjectStorageClient } from "@replit/object-storage";
const require = createRequire(import.meta.url);

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint - checks DB, Redis, and object storage
  // Must be registered BEFORE auth middleware so it's always accessible
  app.get('/healthz', async (req, res) => {
    const checks: Record<string, { status: 'ok' | 'error'; latency?: number; error?: string }> = {};
    let allHealthy = true;
    
    // Check database
    const dbStart = Date.now();
    try {
      await storage.getUser('health-check-probe');
      checks.database = { status: 'ok', latency: Date.now() - dbStart };
    } catch (error: any) {
      checks.database = { status: 'error', error: error.message, latency: Date.now() - dbStart };
      allHealthy = false;
    }
    
    // Check Redis (if configured)
    const { getRateLimitStatus } = await import('./utils/rateLimit');
    const rateLimitStatus = getRateLimitStatus();
    if (rateLimitStatus.backend === 'redis') {
      checks.redis = { status: 'ok' };
    } else if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
      checks.redis = { status: 'error', error: 'Redis configured but not connected' };
      allHealthy = false;
    } else {
      checks.redis = { status: 'ok' }; // Memory fallback acceptable in dev
    }
    
    // Check object storage
    const storageStart = Date.now();
    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId) {
        const client = new ObjectStorageClient({ bucketId });
        await client.list({ prefix: 'health-check/', maxKeys: 1 });
        checks.objectStorage = { status: 'ok', latency: Date.now() - storageStart };
      } else {
        checks.objectStorage = { status: 'error', error: 'Bucket not configured' };
        allHealthy = false;
      }
    } catch (error: any) {
      checks.objectStorage = { status: 'error', error: error.message, latency: Date.now() - storageStart };
      allHealthy = false;
    }
    
    const status = allHealthy ? 200 : 503;
    res.status(status).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
  
  // Setup authentication - Required for Replit Auth
  await setupAuth(app);
  
  // CSRF protection for all state-changing requests
  app.use(csrfProtection);
  
  // Rate limiting middleware (Redis-backed with memory fallback)
  // Applied after auth so req.user is available for user-keyed limits
  app.use(rateLimitMiddleware());

  // Get object storage client - memoized to avoid repeated initialization and logging
  let objectStorageClient: ObjectStorageClient | null = null;
  const getObjectStorage = () => {
    if (objectStorageClient) {
      return objectStorageClient;
    }
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error("Object storage bucket not configured");
    }
    console.info("Object storage initialized with bucket:", bucketId);
    objectStorageClient = new ObjectStorageClient({ bucketId });
    return objectStorageClient;
  };

  // Auth routes - Required for Replit Auth
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      // Add no-store cache header for sensitive auth data
      res.setHeader('Cache-Control', 'no-store');
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json(createErrorResponse(error as Error, 500, req.requestId, "Failed to fetch user"));
    }
  });

  // User settings API
  const updateUserSettingsSchema = z.object({
    currency: z.string().optional(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    theme: z.string().optional(),
    pipelineStageNames: z.record(z.string()).optional(),
    pdfLayoutPreferences: z.object({
      sections: z.array(z.object({
        id: z.string(),
        label: z.string(),
        enabled: z.boolean(),
      })),
    }).optional(),
    brandingPrimaryColor: z.string().optional().nullable(),
    brandingAccentColor: z.string().optional().nullable(),
    brandingLogoUrl: z.string().optional().nullable(),
    aiDataConsent: z.number().int().min(0).max(1).optional(),
  });

  app.patch('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = updateUserSettingsSchema.safeParse(req.body);
      
      if (!result.success) {
        const humanError = fromZodError(result.error);
        return res.status(400).json({ error: humanError.message });
      }

      const updateData: any = { ...result.data };
      
      // Track consent timestamp when AI consent is granted
      if (result.data.aiDataConsent === 1) {
        const currentUser = await storage.getUser(userId);
        if (currentUser && (currentUser as any).aiDataConsent !== 1) {
          updateData.aiDataConsentAt = new Date();
          console.info(JSON.stringify({
            type: "ai_consent_granted",
            userId,
            timestamp: new Date().toISOString(),
          }));
        }
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json(createErrorResponse("User not found", 404, req.requestId));
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user settings:", error);
      res.status(500).json(createErrorResponse(error, 500, req.requestId, "Failed to update settings"));
    }
  });

  // Upload branding logo - uses busboy + streaming upload to object storage
  // No RAM buffering: files stream directly to storage via uploadFromStream
  const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB limit
  
  app.post('/api/user/branding/logo', isAuthenticated, (req: any, res) => {
    const userId = req.user.claims.sub;
    
    const contentType = req.headers['content-type'];
    if (!contentType?.startsWith('multipart/form-data')) {
      return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
    }
    
    let uploadPromise: Promise<string> | null = null;
    let validationError: string | null = null;
    
    try {
      const bb = busboy({ 
        headers: req.headers,
        limits: { fileSize: MAX_LOGO_SIZE, files: 1 }
      });
      
      bb.on('file', (fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        
        // Early MIME type validation - drain stream immediately if invalid
        if (!mimeType.startsWith('image/')) {
          validationError = "Only image files are allowed for logos";
          fileStream.resume();
          return;
        }
        
        const timestamp = Date.now();
        const extension = filename.split('.').pop() || 'png';
        const logoFileName = `${userId}_logo_${timestamp}.${extension}`;
        const storagePath = `public/branding/${logoFileName}`;
        
        // Stream directly to storage - no RAM buffering
        uploadPromise = (async () => {
          // Create a PassThrough to handle limit event properly
          const { PassThrough } = await import('stream');
          const passThrough = new PassThrough();
          let limitExceeded = false;
          
          fileStream.on('limit', () => {
            limitExceeded = true;
            validationError = "Logo file must be under 2MB";
            passThrough.destroy(new Error("File size limit exceeded"));
          });
          
          fileStream.pipe(passThrough);
          
          try {
            await getObjectStorage().uploadFromStream(storagePath, passThrough);
            
            if (limitExceeded) {
              // Clean up partial upload
              try { await getObjectStorage().delete(storagePath); } catch {}
              throw new Error("File size limit exceeded");
            }
            
            const logoUrl = `/public-objects/branding/${logoFileName}`;
            await storage.updateUser(userId, { brandingLogoUrl: logoUrl });
            return logoUrl;
          } catch (err: any) {
            if (limitExceeded) throw new Error("Logo file must be under 2MB");
            throw err;
          }
        })();
      });
      
      bb.on('close', async () => {
        try {
          if (validationError) {
            return res.status(400).json({ error: validationError });
          }
          
          if (!uploadPromise) {
            return res.status(400).json({ error: "No logo file uploaded" });
          }
          
          const logoUrl = await uploadPromise;
          res.json({ logoUrl, message: "Logo uploaded successfully" });
        } catch (error: any) {
          console.error("Error completing logo upload:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: error.message });
          }
        }
      });
      
      bb.on('error', (error: any) => {
        console.error("Busboy error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message });
        }
      });
      
      req.pipe(bb);
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Delete branding logo
  app.delete('/api/user/branding/logo', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Clear the logo URL from user settings
      await storage.updateUser(userId, { brandingLogoUrl: null });
      
      res.json({ message: "Logo removed successfully" });
    } catch (error: any) {
      console.error("Error deleting logo:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve public objects from object storage - restricted to allowed prefixes only
  // Security: Only serve from allowlisted directories to prevent arbitrary file access
  const ALLOWED_PUBLIC_PREFIXES = ['branding/'];
  
  app.get('/public-objects/*', async (req, res) => {
    try {
      const filePath = req.params[0];
      
      // Security: Validate path is within allowed prefixes
      const isAllowed = ALLOWED_PUBLIC_PREFIXES.some(prefix => filePath.startsWith(prefix));
      if (!isAllowed) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Security: Prevent path traversal attacks
      if (filePath.includes('..') || filePath.includes('//')) {
        return res.status(400).json({ error: "Invalid path" });
      }
      
      const storagePath = `public/${filePath}`;
      
      const objectStorage = getObjectStorage();
      const { data } = await objectStorage.downloadAsBytes(storagePath);
      
      // Set appropriate content type based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
      };
      const contentType = contentTypes[ext || ''] || 'application/octet-stream';
      
      // Set response headers for serving public objects
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Allow cross-origin embedding of images (important for logo display)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(Buffer.from(data));
    } catch (error: any) {
      console.error("Error serving public object:", error);
      res.status(404).json({ error: "File not found" });
    }
  });

  // Prospects API - Protected routes
  app.get("/api/prospects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospects = await storage.listProspects(userId);
      res.json(prospects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prospects/export/excel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospects = await storage.listProspects(userId);
      const user = await storage.getUser(userId);
      
      const excelBuffer = await generatePipelineExcel(prospects, user);
      
      const filename = `pipeline-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error: any) {
      console.error("Error generating Excel export:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prospects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const prospect = await storage.getProspect(id, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prospects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check prospect limit based on subscription tier
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const prospectCount = await storage.countProspects(userId);
      if (prospectCount >= user.prospectLimit) {
        return res.status(403).json({ 
          error: `Prospect limit reached. You have ${prospectCount} prospects and your ${user.subscriptionTier} plan allows ${user.prospectLimit}. Please upgrade your subscription to add more prospects.`,
          prospectCount,
          prospectLimit: user.prospectLimit,
          subscriptionTier: user.subscriptionTier
        });
      }
      
      const result = insertProspectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const prospect = await storage.createProspect(result.data, userId);
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/prospects/:id/stage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.id);
      const result = updateProspectStageSchema.safeParse({ 
        prospectId, 
        stage: req.body.stage 
      });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const prospect = await storage.updateProspectStage(prospectId, userId, result.data.stage);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prospects/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { stage, orderedIds } = req.body;
      
      if (!stage || !Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "Stage and orderedIds array are required" });
      }
      
      await storage.reorderProspects(userId, stage, orderedIds);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/prospects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const prospect = await storage.updateProspect(id, userId, req.body);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/prospects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      await storage.deleteProspect(id, userId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prospects/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const prospect = await storage.getProspect(id, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }

      const contacts = await storage.listContacts(id);
      const activities = await storage.listActivities(id);
      const dueDiligence = await storage.getDueDiligence(id);

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      let companiesHouseData = null;
      
      if (apiKey && prospect.company.companyNumber) {
        try {
          const trimmedApiKey = apiKey.trim();
          const authString = `${trimmedApiKey}:`;
          const base64Auth = Buffer.from(authString).toString('base64');
          const companyNumber = prospect.company.companyNumber;
          
          const [officersRes, pscRes, chargesRes] = await Promise.all([
            fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`, {
              headers: { 'Authorization': `Basic ${base64Auth}` }
            }).catch(() => null),
            fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`, {
              headers: { 'Authorization': `Basic ${base64Auth}` }
            }).catch(() => null),
            fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`, {
              headers: { 'Authorization': `Basic ${base64Auth}` }
            }).catch(() => null)
          ]);

          companiesHouseData = {
            officers: officersRes && officersRes.ok ? await officersRes.json() : null,
            psc: pscRes && pscRes.ok ? await pscRes.json() : null,
            charges: chargesRes && chargesRes.ok ? await chargesRes.json() : null
          };
        } catch (error) {
          console.error("Error fetching Companies House data for report:", error);
        }
      }

      const user = await storage.getUser(userId);
      
      const doc = generateProspectReport({
        prospect,
        contacts,
        activities,
        dueDiligence,
        companiesHouseData,
        pdfLayoutPreferences: user?.pdfLayoutPreferences || null,
      });

      const filename = `${prospect.company.companyName.replace(/[^a-z0-9]/gi, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Error generating prospect report:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies House Search API - Protected route
  app.get("/api/companies-house/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per API
      const activeOnly = req.query.active_only === "true";
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        console.error("COMPANIES_HOUSE_API_KEY environment variable not set");
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      // Trim any whitespace from API key
      const trimmedApiKey = apiKey.trim();
      
      // Call Companies House API
      // API key is used as username with empty password in Basic Auth
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      console.log(`Searching Companies House for: "${query}" (limit: ${limit}, activeOnly: ${activeOnly})`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`,
        {
          headers: {
            'Authorization': `Basic ${base64Auth}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}` 
        });
      }

      const data = await response.json();
      
      // Filter out dissolved companies if activeOnly is true
      if (activeOnly && data.items) {
        data.items = data.items.filter((company: any) => 
          company.company_status !== "dissolved" && 
          company.company_status !== "removed" &&
          company.company_status !== "closed"
        );
      }
      
      console.log(`Found ${data.items?.length || 0} companies`);
      res.json(data);
    } catch (error: any) {
      console.error("Error searching Companies House:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies House Advanced Search API - Search by SIC, location, postcode
  app.get("/api/companies-house/advanced-search", isAuthenticated, async (req, res) => {
    try {
      const { sic_codes, location, postcode } = req.query;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const activeOnly = req.query.active_only === "true";
      
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const base64Auth = Buffer.from(`${trimmedApiKey}:`).toString('base64');

      // Use Advanced Search API which supports proper filtering
      // Documentation: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search
      const params = new URLSearchParams();
      params.append('size', limit.toString());
      
      if (sic_codes) {
        // Filter by SIC code
        params.append('sic_codes', sic_codes as string);
        console.log(`Advanced search by SIC code: ${sic_codes} (limit: ${limit})`);
      } else if (location) {
        // Filter by location (town/city in registered address)
        params.append('location', location as string);
        console.log(`Advanced search by location: ${location} (limit: ${limit})`);
      } else if (postcode) {
        // Filter by postcode (registered office address)
        // Format postcode: remove spaces and convert to uppercase
        const formattedPostcode = (postcode as string).replace(/\s+/g, '').toUpperCase();
        params.append('location', formattedPostcode);
        console.log(`Advanced search by postcode: ${formattedPostcode} (limit: ${limit})`);
      } else {
        return res.status(400).json({ error: "At least one search parameter required" });
      }

      // Only search active companies if filter is enabled
      if (activeOnly) {
        params.append('company_status', 'active');
      }
      
      const url = `https://api.company-information.service.gov.uk/advanced-search/companies?${params.toString()}`;
      console.log(`Advanced search URL: ${url}`);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Basic ${base64Auth}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House Advanced Search API error:", response.status, errorText);
        
        // If advanced search fails (e.g., not available on free tier), fall back to basic search
        if (response.status === 403 || response.status === 401) {
          console.log("Falling back to basic company search...");
          const fallbackQuery = postcode || location || sic_codes;
          const fallbackResponse = await fetch(
            `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(fallbackQuery as string)}&items_per_page=20`,
            {
              headers: { 'Authorization': `Basic ${base64Auth}` },
            }
          );
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log(`Fallback search found ${fallbackData.items?.length || 0} companies`);
            return res.json(fallbackData);
          }
        }
        
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}` 
        });
      }

      const data = await response.json();
      // Advanced search returns slightly different format, normalize it
      const normalizedData = {
        items: data.items?.map((item: any) => {
          const addr = item.registered_office_address;
          return {
            title: item.company_name,
            company_number: item.company_number,
            company_status: item.company_status,
            company_type: item.company_type,
            address_snippet: addr ? 
              [
                addr.premises,
                addr.address_line_1,
                addr.address_line_2,
                addr.locality,
                addr.region,
                addr.postal_code,
                addr.country
              ].filter(Boolean).join(', ') : undefined,
            address: addr,
            date_of_creation: item.date_of_creation,
            sic_codes: item.sic_codes
          };
        }) || [],
        total_results: data.total_results || data.hits
      };
      
      console.log(`Advanced search found ${normalizedData.items.length} companies`);
      res.json(normalizedData);
    } catch (error: any) {
      console.error("Error in advanced search:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies House Officers Search API - Search for directors/officers
  app.get("/api/companies-house/search-officers", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const base64Auth = Buffer.from(`${trimmedApiKey}:`).toString('base64');

      console.log(`Searching officers for: "${query}"`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/search/officers?q=${encodeURIComponent(query)}&items_per_page=20`,
        {
          headers: { 'Authorization': `Basic ${base64Auth}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}` 
        });
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} officers`);
      res.json(data);
    } catch (error: any) {
      console.error("Error searching officers:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get officer appointments (companies they are a director of)
  app.get("/api/companies-house/officer-appointments", isAuthenticated, async (req, res) => {
    try {
      const officerId = req.query.officer_id as string;
      if (!officerId) {
        return res.status(400).json({ error: "Officer ID is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const base64Auth = Buffer.from(`${trimmedApiKey}:`).toString('base64');

      console.log(`Fetching appointments for officer: "${officerId}"`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/officers/${encodeURIComponent(officerId)}/appointments`,
        {
          headers: { 'Authorization': `Basic ${base64Auth}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}` 
        });
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} appointments`);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching officer appointments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies House Company Profile API - Protected route
  app.get("/api/companies-house/company/:companyNumber", isAuthenticated, async (req, res) => {
    try {
      const companyNumber = req.params.companyNumber;
      if (!companyNumber || companyNumber.trim().length === 0) {
        return res.status(400).json({ error: "Company number is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        console.error("COMPANIES_HOUSE_API_KEY environment variable not set");
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      // Trim any whitespace from API key
      const trimmedApiKey = apiKey.trim();
      
      // API key is used as username with empty password in Basic Auth
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      console.log(`Fetching company profile for: "${companyNumber}"`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`,
        {
          headers: {
            'Authorization': `Basic ${base64Auth}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        if (response.status === 404) {
          return res.status(404).json({ error: "Company not found" });
        }
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}` 
        });
      }

      const data = await response.json();
      console.log(`Retrieved company profile for ${companyNumber}`);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies House Officers API - Protected route
  app.get("/api/companies-house/company/:companyNumber/officers", isAuthenticated, async (req, res) => {
    try {
      const companyNumber = req.params.companyNumber;
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      console.log(`Fetching officers for: "${companyNumber}"`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
        {
          headers: {
            'Authorization': `Basic ${base64Auth}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: "Officers not found" });
        }
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}` 
        });
      }

      const data = await response.json();
      console.log(`Retrieved ${data.items?.length || 0} officers for ${companyNumber}`);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching officers:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies House PSC API - Protected route
  app.get("/api/companies-house/company/:companyNumber/persons-with-significant-control", isAuthenticated, async (req, res) => {
    try {
      const companyNumber = req.params.companyNumber;
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      console.log(`Fetching PSC for: "${companyNumber}"`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
        {
          headers: {
            'Authorization': `Basic ${base64Auth}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: "PSC data not found" });
        }
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}` 
        });
      }

      const data = await response.json();
      console.log(`Retrieved ${data.items?.length || 0} PSCs for ${companyNumber}`);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching PSC:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies House Charges API - Protected route
  app.get("/api/companies-house/company/:companyNumber/charges", isAuthenticated, async (req, res) => {
    try {
      const companyNumber = req.params.companyNumber;
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      console.log(`Fetching charges for: "${companyNumber}"`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`,
        {
          headers: {
            'Authorization': `Basic ${base64Auth}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // 404 means no charges, return empty data
          return res.json({ total_count: 0, items: [] });
        }
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({ 
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}` 
        });
      }

      const data = await response.json();
      console.log(`Retrieved ${data.total_count || 0} charges for ${companyNumber}`);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching charges:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Associated companies search - Premium feature
  app.get("/api/prospects/:prospectId/associated-companies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      
      // Check user subscription - Premium only
      const user = await storage.getUser(userId);
      if (!user || user.subscriptionTier !== 'premium') {
        return res.status(403).json({ error: "This feature is only available for Premium users" });
      }
      
      // Get prospect and company info
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const companyNumber = prospect.company.companyNumber;
      if (!companyNumber) {
        return res.json({ officers: [], psc: [], sameAddress: [] });
      }
      
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }
      
      const trimmedApiKey = apiKey.trim();
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      // Fetch officers and PSC for the company
      const [officersRes, pscRes] = await Promise.all([
        fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`, {
          headers: { 'Authorization': `Basic ${base64Auth}` }
        }).catch(() => null),
        fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`, {
          headers: { 'Authorization': `Basic ${base64Auth}` }
        }).catch(() => null)
      ]);
      
      const officers = officersRes && officersRes.ok ? await officersRes.json() : { items: [] };
      const psc = pscRes && pscRes.ok ? await pscRes.json() : { items: [] };
      
      // Find companies with common officers
      const officerNames = officers.items?.filter((o: any) => !o.resigned_on).map((o: any) => o.name) || [];
      const companiesViaOfficers: any[] = [];
      
      for (const officerName of officerNames.slice(0, 5)) { // Limit to prevent too many API calls
        try {
          const searchRes = await fetch(
            `https://api.company-information.service.gov.uk/search/officers?q=${encodeURIComponent(officerName)}&items_per_page=5`,
            { headers: { 'Authorization': `Basic ${base64Auth}` } }
          );
          
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            for (const item of searchData.items || []) {
              if (item.links?.officer?.appointments) {
                const appointmentsRes = await fetch(
                  `https://api.company-information.service.gov.uk${item.links.officer.appointments}`,
                  { headers: { 'Authorization': `Basic ${base64Auth}` } }
                );
                
                if (appointmentsRes.ok) {
                  const appointments = await appointmentsRes.json();
                  for (const appointment of appointments.items || []) {
                    if (appointment.appointed_to?.company_number !== companyNumber && !appointment.resigned_on) {
                      companiesViaOfficers.push({
                        company_number: appointment.appointed_to?.company_number,
                        company_name: appointment.appointed_to?.company_name,
                        company_status: appointment.appointed_to?.company_status,
                        officer_name: officerName,
                        officer_role: appointment.officer_role,
                        appointed_on: appointment.appointed_on
                      });
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error searching for officer ${officerName}:`, err);
        }
      }
      
      // Find companies with common PSC
      const pscNames = psc.items?.filter((p: any) => !p.ceased_on).map((p: any) => p.name) || [];
      const companiesViaPSC: any[] = [];
      
      for (const pscName of pscNames.slice(0, 3)) {
        try {
          const searchRes = await fetch(
            `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(pscName)}&items_per_page=10`,
            { headers: { 'Authorization': `Basic ${base64Auth}` } }
          );
          
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            for (const company of searchData.items || []) {
              if (company.company_number !== companyNumber) {
                companiesViaPSC.push({
                  company_number: company.company_number,
                  company_name: company.title,
                  company_status: company.company_status,
                  psc_name: pscName,
                  address_snippet: company.address_snippet
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error searching for PSC ${pscName}:`, err);
        }
      }
      
      // Find companies at same registered address
      const companiesSameAddress: any[] = [];
      const address = prospect.company.registeredAddress;
      if (address) {
        try {
          const addressQuery = `${address}`.substring(0, 100);
          const searchRes = await fetch(
            `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(addressQuery)}&items_per_page=10`,
            { headers: { 'Authorization': `Basic ${base64Auth}` } }
          );
          
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            for (const company of searchData.items || []) {
              if (company.company_number !== companyNumber && company.address_snippet?.includes(addressQuery.substring(0, 20))) {
                companiesSameAddress.push({
                  company_number: company.company_number,
                  company_name: company.title,
                  company_status: company.company_status,
                  address_snippet: company.address_snippet
                });
              }
            }
          }
        } catch (err) {
          console.error("Error searching for companies at same address:", err);
        }
      }
      
      // Remove duplicates and limit results
      const uniqueOfficers = Array.from(new Map(companiesViaOfficers.map(c => [c.company_number, c])).values()).slice(0, 10);
      const uniquePSC = Array.from(new Map(companiesViaPSC.map(c => [c.company_number, c])).values()).slice(0, 10);
      const uniqueAddress = Array.from(new Map(companiesSameAddress.map(c => [c.company_number, c])).values()).slice(0, 10);
      
      res.json({
        officers: uniqueOfficers,
        psc: uniquePSC,
        sameAddress: uniqueAddress
      });
    } catch (error: any) {
      console.error("Error finding associated companies:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI web search for company - Premium feature
  app.post("/api/prospects/:prospectId/web-search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      
      // Check user subscription - Premium only
      const user = await storage.getUser(userId);
      if (!user || user.subscriptionTier !== 'premium') {
        return res.status(403).json({ error: "This feature is only available for Premium users" });
      }
      
      // Get prospect and company info
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const tavilyApiKey = process.env.TAVILY_API_KEY;
      if (!tavilyApiKey) {
        return res.status(500).json({ error: "Tavily API key not configured" });
      }
      
      const companyName = prospect.company.companyName;
      const searchQuery = `${companyName} UK company news information`;
      
      console.log(`Searching web for company: ${companyName}`);
      
      const tavilyResponse = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: searchQuery,
          search_depth: 'basic',
          include_answer: true,
          include_raw_content: false,
          max_results: 10,
          include_domains: [],
          exclude_domains: []
        })
      });
      
      if (!tavilyResponse.ok) {
        const errorText = await tavilyResponse.text();
        console.error("Tavily API error:", tavilyResponse.status, errorText);
        return res.status(tavilyResponse.status).json({ 
          error: `Tavily API returned ${tavilyResponse.status}: ${errorText || tavilyResponse.statusText}` 
        });
      }
      
      const data = await tavilyResponse.json();
      console.log(`Found ${data.results?.length || 0} web results for ${companyName}`);
      
      res.json({
        answer: data.answer || '',
        results: data.results || [],
        query: searchQuery
      });
    } catch (error: any) {
      console.error("Error searching web for company:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save selected associations
  app.post("/api/prospects/:prospectId/save-associations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      const { associations } = req.body;
      
      // Validate associations is an array
      if (!Array.isArray(associations)) {
        return res.status(400).json({ error: "Associations must be an array" });
      }
      
      // Limit to 50 associations maximum
      if (associations.length > 50) {
        return res.status(400).json({ error: "Maximum 50 associations allowed" });
      }
      
      // Verify prospect ownership
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      // Update prospect with saved associations
      const updated = await storage.updateProspect(prospectId, userId, {
        savedAssociations: associations
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error saving associations:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Companies API - Protected routes
  app.get("/api/companies/:number", isAuthenticated, async (req, res) => {
    try {
      const company = await storage.getCompanyByNumber(req.params.number);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const result = insertCompanySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      
      const existingCompany = await storage.getCompanyByNumber(result.data.companyNumber);
      if (existingCompany) {
        return res.json(existingCompany);
      }
      
      // Add SIC description if sicCode is provided
      const companyData = {
        ...result.data,
        sicDescription: result.data.sicCode ? getSicDescription(result.data.sicCode) : null,
      };
      
      const company = await storage.createCompany(companyData);
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update company details (e.g., sync incorporation date from Companies House)
  app.patch("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Invalid company ID" });
      }

      const { incorporationDate, companyStatus, registeredAddress, postcode, sicCode, sicDescription } = req.body;
      
      // Build update object with only provided fields
      const updates: Partial<{ incorporationDate: string; companyStatus: string; registeredAddress: string; postcode: string; sicCode: string; sicDescription: string }> = {};
      if (incorporationDate !== undefined) updates.incorporationDate = incorporationDate;
      if (companyStatus !== undefined) updates.companyStatus = companyStatus;
      if (registeredAddress !== undefined) updates.registeredAddress = registeredAddress;
      if (postcode !== undefined) updates.postcode = postcode;
      if (sicCode !== undefined) updates.sicCode = sicCode;
      if (sicDescription !== undefined) updates.sicDescription = sicDescription;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const company = await storage.updateCompany(companyId, updates);
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Sync company data from Companies House (SIC codes, postcode, etc.)
  app.post("/api/companies/:id/sync-companies-house", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Invalid company ID" });
      }
      
      // Get the company to find the company number
      const companyRecord = await storage.getCompanyById(companyId);
      if (!companyRecord) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Skip non-registered companies
      if (companyRecord.companyNumber.startsWith('UNREG-')) {
        return res.status(400).json({ error: "Cannot sync unregistered companies" });
      }
      
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }
      
      // Fetch company profile from Companies House
      const trimmedApiKey = apiKey.trim();
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyRecord.companyNumber)}`,
        { headers: { 'Authorization': `Basic ${base64Auth}` } }
      );
      
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch company data from Companies House" });
      }
      
      const chData = await response.json();
      
      // Build update object
      const updates: Partial<{ sicCode: string; sicDescription: string; postcode: string; registeredAddress: string; companyStatus: string; incorporationDate: string }> = {};
      
      // Extract SIC code
      if (chData.sic_codes && chData.sic_codes.length > 0) {
        updates.sicCode = chData.sic_codes[0];
        updates.sicDescription = getSicDescription(chData.sic_codes[0]);
      }
      
      // Extract postcode and address
      if (chData.registered_office_address) {
        const addr = chData.registered_office_address;
        if (addr.postal_code) {
          updates.postcode = addr.postal_code;
        }
        // Build full address
        const addressParts = [
          addr.premises,
          addr.address_line_1,
          addr.address_line_2,
          addr.locality,
          addr.region,
          addr.postal_code,
          addr.country,
        ].filter(Boolean);
        if (addressParts.length > 0) {
          updates.registeredAddress = addressParts.join(", ");
        }
      }
      
      // Extract status and incorporation date
      if (chData.company_status) {
        updates.companyStatus = chData.company_status;
      }
      if (chData.date_of_creation) {
        updates.incorporationDate = chData.date_of_creation;
      }
      
      if (Object.keys(updates).length === 0) {
        return res.json({ message: "No updates available", company: companyRecord });
      }
      
      const updatedCompany = await storage.updateCompany(companyId, updates);
      res.json(updatedCompany);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to format officer name from "SURNAME, First Middle" to "First Middle Surname"
  function formatOfficerName(name: string): string {
    if (!name) return name;
    
    // Check if name contains a comma (Companies House format: "SURNAME, First Middle")
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const surname = parts[0];
        const firstNames = parts.slice(1).join(' ');
        // Convert to proper case
        const formatWord = (word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        
        const formattedSurname = surname.split(/[\s-]+/).map(formatWord).join(surname.includes('-') ? '-' : ' ');
        const formattedFirstNames = firstNames.split(/\s+/).map(formatWord).join(' ');
        
        return `${formattedFirstNames} ${formattedSurname}`.trim();
      }
    }
    return name;
  }

  // Contacts API - Protected routes
  app.get("/api/prospects/:prospectId/contacts", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const contacts = await storage.listContacts(prospectId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto-sync officers from Companies House to contacts
  app.post("/api/prospects/:prospectId/sync-officers", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const userId = req.user.claims.sub;
      
      // Get the prospect to find the company number
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const companyNumber = prospect.company.companyNumber;
      if (!companyNumber) {
        return res.status(400).json({ error: "No company number available" });
      }
      
      // Fetch officers from Companies House
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }
      
      const officersResponse = await fetch(
        `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
          },
        }
      );
      
      if (!officersResponse.ok) {
        return res.status(officersResponse.status).json({ error: "Failed to fetch officers" });
      }
      
      const officersData = await officersResponse.json();
      const activeOfficers = officersData.items?.filter((o: any) => !o.resigned_on) || [];
      
      // Get existing contacts
      const existingContacts = await storage.listContacts(prospectId);
      const existingNames = new Set(existingContacts.map(c => c.name.toLowerCase().trim()));
      
      // Create contacts for officers not already in contacts
      const newContacts = [];
      for (const officer of activeOfficers) {
        const formattedName = formatOfficerName(officer.name);
        if (!existingNames.has(formattedName.toLowerCase().trim())) {
          const role = officer.officer_role?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Officer';
          const contact = await storage.createContact({
            prospectId,
            name: formattedName,
            role,
          });
          newContacts.push(contact);
        }
      }
      
      // Return all contacts
      const allContacts = await storage.listContacts(prospectId);
      res.json({ 
        contacts: allContacts, 
        synced: newContacts.length,
        message: newContacts.length > 0 
          ? `Synced ${newContacts.length} officer(s)` 
          : "All officers already synced"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prospects/:prospectId/contacts", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const result = insertContactSchema.safeParse({ ...req.body, prospectId });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const contact = await storage.createContact(result.data);
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const contact = await storage.updateContact(id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContact(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Contact enrichment - search web and email inbox for contact info
  app.post("/api/contacts/:id/enrich", isAuthenticated, async (req: any, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Get the contact
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      // Get the prospect and verify ownership (security check)
      const prospect = await storage.getProspect(contact.prospectId, userId);
      if (!prospect) {
        // Either prospect doesn't exist or doesn't belong to user
        return res.status(403).json({ error: "Access denied - you don't have permission to access this contact" });
      }
      
      // Get company name for search context
      const company = await storage.getCompany(prospect.companyId);
      const companyName = company?.companyName || '';
      
      // Search the web for contact info using Tavily
      const { searchContactInfo } = await import("./utils/tavilyClient");
      const webResults = await searchContactInfo(contact.name, companyName);
      
      // Search email inbox for related emails
      let emailResults: any[] = [];
      try {
        const inbox = await storage.getEmailInbox(userId);
        if (inbox) {
          // Search for emails that mention the contact name or existing email
          const searchTerms = [contact.name];
          if (contact.email) {
            searchTerms.push(contact.email);
          }
          
          const messages = await storage.getEmailMessagesByInbox(inbox.id);
          emailResults = messages.filter((msg: any) => {
            const content = `${msg.subject} ${msg.textBody || ''} ${msg.fromAddress} ${msg.toAddresses?.join(' ') || ''}`.toLowerCase();
            return searchTerms.some(term => content.includes(term.toLowerCase()));
          }).map((msg: any) => ({
            subject: msg.subject,
            from: msg.fromAddress,
            to: msg.toAddresses,
            date: msg.sentAt,
            snippet: msg.textBody?.substring(0, 200) || ''
          }));
        }
      } catch (emailError) {
        console.log("Could not search email inbox:", emailError);
      }
      
      // Build search notes from all results
      const searchDate = new Date().toISOString().split('T')[0];
      let searchNotes = `--- Web Search Results (${searchDate}) ---\n`;
      searchNotes += `Search: "${contact.name}" at "${companyName}"\n\n`;
      
      if (webResults.emails.length > 0) {
        searchNotes += `Found Emails:\n${webResults.emails.map(e => `  - ${e}`).join('\n')}\n\n`;
      }
      if (webResults.phones.length > 0) {
        searchNotes += `Found Phone Numbers:\n${webResults.phones.map(p => `  - ${p}`).join('\n')}\n\n`;
      }
      if (webResults.linkedinUrls.length > 0) {
        searchNotes += `LinkedIn Profiles:\n${webResults.linkedinUrls.map(l => `  - ${l}`).join('\n')}\n\n`;
      }
      if (webResults.sources.length > 0) {
        searchNotes += `Sources:\n${webResults.sources.slice(0, 5).map(s => `  - ${s.title}: ${s.url}`).join('\n')}\n\n`;
      }
      if (emailResults.length > 0) {
        searchNotes += `Related Emails in Inbox:\n${emailResults.slice(0, 5).map(e => `  - ${e.subject} (from: ${e.from})`).join('\n')}\n`;
      }
      
      res.json({
        contact: {
          id: contact.id,
          name: contact.name,
          currentEmail: contact.email,
          currentPhone: contact.phone,
          currentProfilePicture: contact.profilePicture,
          currentNotes: contact.notes
        },
        companyName: companyName,
        searchNotes: searchNotes,
        webSearch: {
          emails: webResults.emails,
          phones: webResults.phones,
          linkedinUrls: webResults.linkedinUrls,
          profileImages: webResults.profileImages,
          sources: webResults.sources
        },
        emailSearch: {
          relatedEmails: emailResults.slice(0, 10)
        }
      });
    } catch (error: any) {
      console.error("Contact enrichment error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Activities API - Protected routes
  app.get("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activities = await storage.listAllUserActivities(userId);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertActivitySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const activity = await storage.createActivity({ ...result.data, userId });
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prospects/:prospectId/activities", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const activities = await storage.listActivities(prospectId);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prospects/:prospectId/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      const result = insertActivitySchema.safeParse({ ...req.body, prospectId });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const activity = await storage.createActivity({ ...result.data, userId });
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const activity = await storage.updateActivity(id, req.body);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteActivity(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prospects/:prospectId/due-diligence", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const dueDiligence = await storage.getDueDiligence(prospectId);
      res.json(dueDiligence || { prospectId, data: {} });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/prospects/:prospectId/due-diligence", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const existing = await storage.getDueDiligence(prospectId);
      const mergedData = (existing && existing.data) 
        ? { ...(existing.data as object), ...req.body }
        : req.body;
      const dueDiligence = await storage.upsertDueDiligence(prospectId, mergedData);
      res.json(dueDiligence);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Credit Underwriting Routes (Premium Only)
  // Note: These endpoints process financial documents via AI - requires user consent and audit logging
  // Size limits are now managed by AI_GOVERNANCE_CONFIG
  
  app.post("/api/prospects/:prospectId/underwriting/analyze-csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      const { csvData, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;
      
      if (!csvData || !loanAmount || !monthlyRepayment) {
        return res.status(400).json({ error: "Missing required fields: csvData, loanAmount, monthlyRepayment" });
      }
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      // Use governance wrapper for consent, redaction, size limits, and audit logging
      const { analyzeFinancials } = await import("./utils/geminiClient");
      
      const result = await wrapAiRequest(
        {
          userId,
          prospectId,
          operation: "analyze_csv",
          dataType: "csv",
          consentToAiProcessing: !!consentToAiProcessing,
        },
        csvData,
        async (processedData) => analyzeFinancials(processedData, loanAmount, monthlyRepayment),
        { maxSize: AI_GOVERNANCE_CONFIG.maxCsvSize }
      );
      
      if ('error' in result) {
        return res.status(result.code).json({ 
          error: result.error,
          requiresConsent: result.code === 403
        });
      }
      
      // Save to due diligence
      const existing = await storage.getDueDiligence(prospectId);
      const existingData = (existing?.data || {}) as Record<string, any>;
      const mergedData = {
        ...existingData,
        underwriting: {
          ...(existingData.underwriting || {}),
          financialAnalysis: result.result,
          analyzedAt: new Date().toISOString()
        }
      };
      await storage.upsertDueDiligence(prospectId, mergedData);
      
      res.json(result.result);
    } catch (error: any) {
      console.error("CSV analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze CSV" });
    }
  });

  // Analyze bank statement PDFs (alternative to CSV)
  app.post("/api/prospects/:prospectId/underwriting/analyze-bank-pdfs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      const { pdfTexts, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;
      
      if (!pdfTexts || !Array.isArray(pdfTexts) || pdfTexts.length === 0) {
        return res.status(400).json({ error: "At least one bank statement PDF is required" });
      }
      
      if (pdfTexts.length > AI_GOVERNANCE_CONFIG.maxPdfFiles) {
        return res.status(400).json({ error: `Maximum ${AI_GOVERNANCE_CONFIG.maxPdfFiles} bank statement PDFs allowed` });
      }
      
      if (!loanAmount || !monthlyRepayment) {
        return res.status(400).json({ error: "Missing required fields: loanAmount, monthlyRepayment" });
      }
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      // Validate size and apply redaction to each PDF text
      const processedPdfTexts: typeof pdfTexts = [];
      for (const pdfText of pdfTexts) {
        if (pdfText.text && Buffer.byteLength(pdfText.text, 'utf8') > AI_GOVERNANCE_CONFIG.maxPdfTextSize) {
          return res.status(413).json({ error: `PDF "${pdfText.fileName}" exceeds ${Math.round(AI_GOVERNANCE_CONFIG.maxPdfTextSize / 1024)}KB text limit.` });
        }
        const { redacted } = redactSensitiveData(pdfText.text || '');
        processedPdfTexts.push({ ...pdfText, text: redacted });
      }
      
      // Combine all text for governance wrapper
      const combinedText = processedPdfTexts.map(p => p.text).join('\n---\n');
      
      // Use governance wrapper for consent, audit logging
      const { analyzeFinancialsFromPdf } = await import("./utils/geminiClient");
      
      const result = await wrapAiRequest(
        {
          userId,
          prospectId,
          operation: "analyze_bank_pdfs",
          dataType: "pdf",
          consentToAiProcessing: !!consentToAiProcessing,
        },
        combinedText,
        async () => analyzeFinancialsFromPdf(processedPdfTexts, loanAmount, monthlyRepayment),
        { skipRedaction: true } // Already redacted above
      );
      
      if ('error' in result) {
        return res.status(result.code).json({ 
          error: result.error,
          requiresConsent: result.code === 403
        });
      }
      
      // Save to due diligence with bank PDF file metadata
      const existing = await storage.getDueDiligence(prospectId);
      const existingData = (existing?.data || {}) as Record<string, any>;
      const mergedData = {
        ...existingData,
        underwriting: {
          ...(existingData.underwriting || {}),
          financialAnalysis: result.result,
          analyzedAt: new Date().toISOString(),
          bankPdfFiles: pdfTexts.map((p: { fileName: string; pages?: number }) => ({
            fileName: p.fileName,
            pages: p.pages || 0
          })),
          analysisSource: 'pdf'
        }
      };
      await storage.upsertDueDiligence(prospectId, mergedData);
      
      res.json(result.result);
    } catch (error: any) {
      console.error("Bank PDF analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze bank statement PDFs" });
    }
  });

  // Analyze audited accounts PDFs
  app.post("/api/prospects/:prospectId/underwriting/analyze-accounts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      const { pdfTexts, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;
      
      if (!pdfTexts || !Array.isArray(pdfTexts) || pdfTexts.length === 0) {
        return res.status(400).json({ error: "At least one PDF text with year is required" });
      }
      
      if (!loanAmount || !monthlyRepayment) {
        return res.status(400).json({ error: "Missing required fields: loanAmount, monthlyRepayment" });
      }
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      // Validate size and apply redaction to each PDF text
      const processedPdfTexts: typeof pdfTexts = [];
      for (const pdfText of pdfTexts) {
        if (pdfText.text && Buffer.byteLength(pdfText.text, 'utf8') > AI_GOVERNANCE_CONFIG.maxPdfTextSize) {
          return res.status(413).json({ error: `Accounts PDF exceeds ${Math.round(AI_GOVERNANCE_CONFIG.maxPdfTextSize / 1024)}KB text limit.` });
        }
        const { redacted } = redactSensitiveData(pdfText.text || '');
        processedPdfTexts.push({ ...pdfText, text: redacted });
      }
      
      // Combine all text for governance wrapper
      const combinedText = processedPdfTexts.map(p => p.text).join('\n---\n');
      
      // Use governance wrapper for consent, audit logging
      const { analyzeAuditedAccounts } = await import("./utils/geminiClient");
      
      const result = await wrapAiRequest(
        {
          userId,
          prospectId,
          operation: "analyze_accounts",
          dataType: "pdf",
          consentToAiProcessing: !!consentToAiProcessing,
        },
        combinedText,
        async () => analyzeAuditedAccounts(processedPdfTexts, loanAmount, monthlyRepayment),
        { skipRedaction: true } // Already redacted above
      );
      
      if ('error' in result) {
        return res.status(result.code).json({ 
          error: result.error,
          requiresConsent: result.code === 403
        });
      }
      
      // Save to due diligence
      const existing = await storage.getDueDiligence(prospectId);
      const existingData = (existing?.data || {}) as Record<string, any>;
      const mergedData = {
        ...existingData,
        underwriting: {
          ...(existingData.underwriting || {}),
          accountsAnalysis: result.result,
          accountsAnalyzedAt: new Date().toISOString()
        }
      };
      await storage.upsertDueDiligence(prospectId, mergedData);
      
      res.json(result.result);
    } catch (error: any) {
      console.error("Accounts analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze accounts" });
    }
  });

  // Parse PDF file to text
  // Note: 7.5MB decoded limit (base64 encoded ~10MB represents ~7.5MB binary)
  const MAX_PDF_DECODED_SIZE = 7.5 * 1024 * 1024; // 7.5MB decoded binary limit
  
  app.post("/api/parse-pdf", isAuthenticated, async (req: any, res) => {
    try {
      const { pdfBase64 } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      // Import pdf-parse
      const { PDFParse } = await import("pdf-parse");
      
      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      
      // Enforce size limit on decoded buffer (not base64 string)
      if (pdfBuffer.length > MAX_PDF_DECODED_SIZE) {
        return res.status(413).json({ error: "PDF exceeds 7.5MB limit. Please use a smaller file." });
      }
      
      // Parse PDF using v2 API
      const parser = new PDFParse({ data: pdfBuffer });
      const result = await parser.getText();
      
      res.json({ 
        text: result.text,
        pages: result.totalPages,
        info: {}
      });
    } catch (error: any) {
      console.error("PDF parsing error:", error);
      res.status(500).json({ error: error.message || "Failed to parse PDF" });
    }
  });

  // Generate SWOT analysis
  app.post("/api/prospects/:prospectId/underwriting/swot-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      
      const { 
        companyName, 
        sector, 
        loanAmount, 
        loanPurpose, 
        financialSummary,
        companiesHouseData,
        bankAnalysisSummary,
        eligibilityNotes,
        consentToAiProcessing
      } = req.body;
      
      if (!companyName || !loanAmount) {
        return res.status(400).json({ error: "Missing required fields: companyName, loanAmount" });
      }
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      // Build context string for governance wrapper (no sensitive raw data)
      const contextData = JSON.stringify({
        companyName,
        sector: sector || '',
        loanAmount,
        loanPurpose: loanPurpose || '',
        hasFinancialSummary: !!financialSummary,
        hasCompaniesHouseData: !!companiesHouseData,
        hasBankAnalysis: !!bankAnalysisSummary,
      });
      
      // Use governance wrapper for consent, audit logging
      const { generateSwotAnalysis } = await import("./utils/geminiClient");
      
      const result = await wrapAiRequest(
        {
          userId,
          prospectId,
          operation: "swot_analysis",
          dataType: "structured",
          consentToAiProcessing: !!consentToAiProcessing,
        },
        contextData,
        async () => generateSwotAnalysis(
          companyName,
          sector || '',
          loanAmount,
          loanPurpose || '',
          financialSummary || '',
          companiesHouseData,
          bankAnalysisSummary,
          eligibilityNotes
        ),
        { skipRedaction: true } // Context data is already structured
      );
      
      if ('error' in result) {
        return res.status(result.code).json({ 
          error: result.error,
          requiresConsent: result.code === 403
        });
      }
      
      // Save to due diligence
      const existing = await storage.getDueDiligence(prospectId);
      const existingData = (existing?.data || {}) as Record<string, any>;
      const mergedData = {
        ...existingData,
        underwriting: {
          ...(existingData.underwriting || {}),
          swotAnalysis: result.result,
          swotAnalyzedAt: new Date().toISOString()
        }
      };
      await storage.upsertDueDiligence(prospectId, mergedData);
      
      res.json(result.result);
    } catch (error: any) {
      console.error("SWOT analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to generate SWOT analysis" });
    }
  });

  // CAMPARI section AI generation
  app.post("/api/prospects/:prospectId/underwriting/campari-section", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      
      const { 
        sectionKey,
        companyName, 
        sector, 
        loanAmount, 
        loanPurpose, 
        financialSummary,
        companiesHouseData,
        bankAnalysisSummary,
        accountsAnalysisSummary,
        consentToAiProcessing
      } = req.body;
      
      if (!sectionKey || !companyName || !loanAmount) {
        return res.status(400).json({ error: "Missing required fields: sectionKey, companyName, loanAmount" });
      }
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      // Fetch uploaded documents for the prospect
      const documents = await storage.listProspectDocuments(prospectId);
      
      // Filter relevant document categories for CAMPARI analysis
      const relevantCategories = ['business', 'financial', 'legal', 'identity', 'correspondence', 'general', 'other'];
      const relevantDocs = documents.filter(doc => relevantCategories.includes(doc.category || 'general'));
      
      // Parse document contents with redaction
      const documentSummaries: { fileName: string; category: string; content: string }[] = [];
      const pdfParse = (await import("pdf-parse")).default;
      
      for (const doc of relevantDocs.slice(0, AI_GOVERNANCE_CONFIG.maxDocuments)) {
        try {
          const { data } = await getObjectStorage().downloadAsBytes(doc.storagePath);
          
          if (doc.fileType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf')) {
            const pdfData = await pdfParse(Buffer.from(data));
            const textContent = pdfData.text?.trim() || '';
            if (textContent.length > 100) {
              const truncatedContent = textContent.length > 15000 
                ? textContent.substring(0, 15000) + '\n[... Document truncated ...]' 
                : textContent;
              // Apply redaction to document content
              const { redacted } = redactSensitiveData(truncatedContent);
              documentSummaries.push({
                fileName: doc.fileName,
                category: doc.category || 'general',
                content: redacted
              });
            }
          } else if (doc.fileType === 'text/plain' || doc.fileName.toLowerCase().endsWith('.txt')) {
            const textContent = Buffer.from(data).toString('utf-8').trim();
            if (textContent.length > 50) {
              const truncatedContent = textContent.length > 15000 
                ? textContent.substring(0, 15000) + '\n[... Document truncated ...]' 
                : textContent;
              // Apply redaction to document content
              const { redacted } = redactSensitiveData(truncatedContent);
              documentSummaries.push({
                fileName: doc.fileName,
                category: doc.category || 'general',
                content: redacted
              });
            }
          }
        } catch (docError) {
          console.error(`Error parsing document ${doc.fileName}:`, docError);
        }
      }
      
      // Build context string for governance wrapper
      const contextData = JSON.stringify({
        sectionKey,
        companyName,
        sector: sector || '',
        loanAmount,
        loanPurpose: loanPurpose || '',
        documentCount: documentSummaries.length,
      });
      
      // Use governance wrapper for consent, audit logging
      const { generateCampariSection } = await import("./utils/geminiClient");
      
      const result = await wrapAiRequest(
        {
          userId,
          prospectId,
          operation: `campari_section_${sectionKey}`,
          dataType: "documents",
          consentToAiProcessing: !!consentToAiProcessing,
        },
        contextData,
        async () => generateCampariSection(
          sectionKey,
          companyName,
          sector || '',
          loanAmount,
          loanPurpose || '',
          financialSummary || '',
          companiesHouseData,
          bankAnalysisSummary,
          accountsAnalysisSummary,
          documentSummaries.length > 0 ? documentSummaries : undefined
        ),
        { skipRedaction: true } // Already redacted document content above
      );
      
      if ('error' in result) {
        return res.status(result.code).json({ 
          error: result.error,
          requiresConsent: result.code === 403
        });
      }
      
      // Save to due diligence
      const existing = await storage.getDueDiligence(prospectId);
      const existingData = (existing?.data || {}) as Record<string, any>;
      const existingSections = existingData.underwriting?.adviserSummary?.sections || {};
      const mergedData = {
        ...existingData,
        underwriting: {
          ...(existingData.underwriting || {}),
          adviserSummary: {
            ...(existingData.underwriting?.adviserSummary || {}),
            sections: {
              ...existingSections,
              [sectionKey]: result.result
            }
          }
        }
      };
      await storage.upsertDueDiligence(prospectId, mergedData);
      
      res.json({ sectionKey, content: result.result });
    } catch (error: any) {
      console.error("CAMPARI section generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate CAMPARI section" });
    }
  });

  app.post("/api/prospects/:prospectId/underwriting/adverse-media", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      
      // Check if user is premium
      const user = await storage.getUser(userId);
      if (!user || user.subscriptionTier !== 'premium') {
        return res.status(403).json({ error: "Premium subscription required for Credit Underwriting" });
      }
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const { companyName, companyNumber } = req.body;
      
      if (!companyName) {
        return res.status(400).json({ error: "Company name is required" });
      }
      
      // Import and use tavily client
      const { searchAdverseMedia, assessAdverseMediaRisk } = await import("./utils/tavilyClient");
      const searchResults = await searchAdverseMedia(companyName, companyNumber);
      const assessment = assessAdverseMediaRisk(searchResults.results);
      
      const result = {
        ...searchResults,
        ...assessment
      };
      
      // Save to due diligence
      const existing = await storage.getDueDiligence(prospectId);
      const existingData = (existing?.data || {}) as Record<string, any>;
      const mergedData = {
        ...existingData,
        underwriting: {
          ...(existingData.underwriting || {}),
          adverseMedia: result,
          adverseMediaSearchedAt: new Date().toISOString()
        }
      };
      await storage.upsertDueDiligence(prospectId, mergedData);
      
      res.json(result);
    } catch (error: any) {
      console.error("Adverse media search error:", error);
      res.status(500).json({ error: error.message || "Failed to search adverse media" });
    }
  });

  // Add-On Products API - Marketplace for prospect packs and feature add-ons
  app.get("/api/add-ons", isAuthenticated, async (req: any, res) => {
    try {
      const products = await storage.listAddOnProducts(true);
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching add-on products:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/add-ons/purchases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const purchases = await storage.listUserAddOnPurchases(userId);
      res.json(purchases);
    } catch (error: any) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/add-ons/credits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const credits = await storage.getUserProspectCredits(userId);
      res.json({ credits });
    } catch (error: any) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Purchase an add-on - payment processing temporarily unavailable
  app.post("/api/add-ons/purchase", isAuthenticated, async (req: any, res) => {
    return res.status(503).json({ 
      error: "Payment processing is temporarily unavailable. Please contact support.",
      unavailable: true 
    });
  });

  // Admin: Create add-on product (Super Admin only)
  app.post("/api/add-ons/products", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'super_admin') {
        return res.status(403).json({ error: "Super Admin access required" });
      }

      const { title, description, category, quantityIncluded, featureKey, priceInPence, currency } = req.body;
      
      const product = await storage.createAddOnProduct({
        title,
        description,
        category: category || "prospects",
        quantityIncluded: quantityIncluded || 0,
        featureKey,
        priceInPence,
        currency: currency || "GBP",
        isActive: 1,
        displayOrder: 0,
      });

      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating add-on product:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lenders API - Protected routes
  app.get("/api/lenders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lenders = await storage.listLenders(userId);
      res.json(lenders);
    } catch (error) {
      console.error("Error fetching lenders:", error);
      res.status(500).json({ message: "Failed to fetch lenders" });
    }
  });

  app.get("/api/lenders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lenderId = parseInt(req.params.id);
      const lender = await storage.getLender(lenderId, userId);
      
      if (!lender) {
        return res.status(404).json({ message: "Lender not found" });
      }
      
      res.json(lender);
    } catch (error) {
      console.error("Error fetching lender:", error);
      res.status(500).json({ message: "Failed to fetch lender" });
    }
  });

  app.post("/api/lenders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertLenderSchema.safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.toString() });
      }
      
      const lender = await storage.createLender(result.data, userId);
      res.status(201).json(lender);
    } catch (error) {
      console.error("Error creating lender:", error);
      res.status(500).json({ message: "Failed to create lender" });
    }
  });

  app.patch("/api/lenders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lenderId = parseInt(req.params.id);
      const result = insertLenderSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.toString() });
      }
      
      const lender = await storage.updateLender(lenderId, userId, result.data);
      
      if (!lender) {
        return res.status(404).json({ message: "Lender not found" });
      }
      
      res.json(lender);
    } catch (error) {
      console.error("Error updating lender:", error);
      res.status(500).json({ message: "Failed to update lender" });
    }
  });

  app.delete("/api/lenders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lenderId = parseInt(req.params.id);
      
      await storage.deleteLender(lenderId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lender:", error);
      res.status(500).json({ message: "Failed to delete lender" });
    }
  });

  // Lender Search with filters
  app.get("/api/lenders/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = {
        search: req.query.search as string,
        lenderType: req.query.lenderType as string,
        productType: req.query.productType as string,
        minLoanAmount: req.query.minLoanAmount ? parseInt(req.query.minLoanAmount) : undefined,
        maxLoanAmount: req.query.maxLoanAmount ? parseInt(req.query.maxLoanAmount) : undefined,
        sector: req.query.sector as string,
        region: req.query.region as string,
        panelStatus: req.query.panelStatus as string,
      };
      const lenders = await storage.searchLenders(userId, filters);
      res.json(lenders);
    } catch (error) {
      console.error("Error searching lenders:", error);
      res.status(500).json({ message: "Failed to search lenders" });
    }
  });

  // Get lender with products
  app.get("/api/lenders/:id/full", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lenderId = parseInt(req.params.id);
      const lender = await storage.getLenderWithProducts(lenderId, userId);
      
      if (!lender) {
        return res.status(404).json({ message: "Lender not found" });
      }
      
      // Also get interactions
      const interactions = await storage.listLenderInteractions(lenderId);
      
      res.json({ ...lender, interactions });
    } catch (error) {
      console.error("Error fetching lender details:", error);
      res.status(500).json({ message: "Failed to fetch lender details" });
    }
  });

  // Lender Products API
  app.get("/api/lenders/:lenderId/products", isAuthenticated, async (req: any, res) => {
    try {
      const lenderId = parseInt(req.params.lenderId);
      const products = await storage.listLenderProducts(lenderId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching lender products:", error);
      res.status(500).json({ message: "Failed to fetch lender products" });
    }
  });

  app.post("/api/lenders/:lenderId/products", isAuthenticated, async (req: any, res) => {
    try {
      const lenderId = parseInt(req.params.lenderId);
      const productData = { ...req.body, lenderId };
      const product = await storage.createLenderProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating lender product:", error);
      res.status(500).json({ message: "Failed to create lender product" });
    }
  });

  app.patch("/api/lender-products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.updateLenderProduct(productId, req.body);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error updating lender product:", error);
      res.status(500).json({ message: "Failed to update lender product" });
    }
  });

  app.delete("/api/lender-products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      await storage.deleteLenderProduct(productId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lender product:", error);
      res.status(500).json({ message: "Failed to delete lender product" });
    }
  });

  // Lender Interactions API
  app.get("/api/lenders/:lenderId/interactions", isAuthenticated, async (req: any, res) => {
    try {
      const lenderId = parseInt(req.params.lenderId);
      const interactions = await storage.listLenderInteractions(lenderId);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching lender interactions:", error);
      res.status(500).json({ message: "Failed to fetch lender interactions" });
    }
  });

  app.get("/api/lender-interactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const interactions = await storage.listUserLenderInteractions(userId);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching user lender interactions:", error);
      res.status(500).json({ message: "Failed to fetch lender interactions" });
    }
  });

  app.post("/api/lender-interactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sentAt, respondedAt, ...rest } = req.body;
      const interactionData = {
        ...rest,
        userId,
        sentAt: sentAt ? new Date(sentAt) : new Date(),
        respondedAt: respondedAt ? new Date(respondedAt) : undefined,
      };
      const interaction = await storage.createLenderInteraction(interactionData);
      
      // Update lender's lastContactedAt
      if (interaction.lenderId) {
        await storage.updateLender(interaction.lenderId, userId, {
          lastContactedAt: new Date(),
        } as any);
      }
      
      res.status(201).json(interaction);
    } catch (error) {
      console.error("Error creating lender interaction:", error);
      res.status(500).json({ message: "Failed to create lender interaction" });
    }
  });

  app.patch("/api/lender-interactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      const interaction = await storage.updateLenderInteraction(interactionId, req.body);
      
      if (!interaction) {
        return res.status(404).json({ message: "Interaction not found" });
      }
      
      res.json(interaction);
    } catch (error) {
      console.error("Error updating lender interaction:", error);
      res.status(500).json({ message: "Failed to update lender interaction" });
    }
  });

  app.delete("/api/lender-interactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      await storage.deleteLenderInteraction(interactionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lender interaction:", error);
      res.status(500).json({ message: "Failed to delete lender interaction" });
    }
  });

  // Application Submissions API - Protected routes
  app.get("/api/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissions = await storage.listApplicationSubmissions(userId);
      
      // Enrich submissions with prospect and lender details
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          const [prospect, lender] = await Promise.all([
            storage.getProspect(submission.prospectId, userId),
            storage.getLender(submission.lenderId, userId),
          ]);
          
          return {
            ...submission,
            prospect,
            lender,
          };
        })
      );
      
      res.json(enrichedSubmissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.post("/api/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertApplicationSubmissionSchema.safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.toString() });
      }
      
      // Type-narrow the parsed data
      const submissionInput: InsertApplicationSubmission = result.data;
      
      // Validate that the prospect belongs to the user
      const prospect = await storage.getProspect(submissionInput.prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }
      
      // Validate that the lender belongs to the user
      const lender = await storage.getLender(submissionInput.lenderId, userId);
      if (!lender) {
        console.error("Lender not found");
        return res.status(404).json({ message: "Lender not found" });
      }
      
      // Validate lender email before proceeding
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!lender.email || !emailRegex.test(lender.email)) {
        console.error("Invalid lender email");
        return res.status(400).json({ message: "Lender has invalid email address" });
      }
      
      // Validate Resend configuration before proceeding
      let resendClient, fromEmail;
      try {
        const resendConfig = await getUncachableResendClient();
        resendClient = resendConfig.client;
        fromEmail = resendConfig.fromEmail;
      } catch (resendError: any) {
        const errMessage = (resendError as Error)?.message || 'Unknown error';
        console.error("Resend configuration error");
        return res.status(500).json({ message: `Email service not configured: ${errMessage}` });
      }
      
      // Generate PDF report before creating submission
      let pdfBuffer: Buffer;
      try {
        const [contacts, activities, dueDiligence, user] = await Promise.all([
          storage.listContacts(submissionInput.prospectId),
          storage.listActivities(submissionInput.prospectId),
          storage.getDueDiligence(submissionInput.prospectId).catch(() => null),
          storage.getUser(userId),
        ]);
        
        // Fetch Companies House data (officers, PSC, charges) if available
        let companiesHouseData: any = null;
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (apiKey && prospect.company.companyNumber) {
          try {
            const trimmedApiKey = apiKey.trim();
            const authString = `${trimmedApiKey}:`;
            const base64Auth = Buffer.from(authString).toString('base64');
            const companyNumber = prospect.company.companyNumber;
            
            const [officersRes, pscRes, chargesRes] = await Promise.all([
              fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`, {
                headers: { 'Authorization': `Basic ${base64Auth}` }
              }).catch(() => null),
              fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`, {
                headers: { 'Authorization': `Basic ${base64Auth}` }
              }).catch(() => null),
              fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`, {
                headers: { 'Authorization': `Basic ${base64Auth}` }
              }).catch(() => null)
            ]);

            companiesHouseData = {
              officers: officersRes && officersRes.ok ? await officersRes.json() : null,
              psc: pscRes && pscRes.ok ? await pscRes.json() : null,
              charges: chargesRes && chargesRes.ok ? await chargesRes.json() : null
            };
          } catch (error) {
            console.error("Error fetching Companies House data for submission report");
          }
        }
        
        const reportDoc = generateProspectReport({
          prospect,
          contacts,
          activities,
          dueDiligence: dueDiligence || undefined,
          companiesHouseData: companiesHouseData || undefined,
          pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
        });
        
        const chunks: Buffer[] = [];
        reportDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        await new Promise<void>((resolve, reject) => {
          reportDoc.on('end', () => resolve());
          reportDoc.on('error', reject);
          reportDoc.end();
        });
        pdfBuffer = Buffer.concat(chunks);
      } catch (pdfError: any) {
        const errMessage = (pdfError as Error)?.message || 'Unknown error';
        console.error("PDF generation error");
        return res.status(500).json({ message: `Failed to generate PDF report: ${errMessage}` });
      }
      
      // Send email with PDF attachment
      let emailSent = false;
      let emailError: string | null = null;
      try {
        const commentary = submissionInput.commentary || 'Please find attached the loan application for your review.';
        
        // Log email operation without PII
        console.log(JSON.stringify({ type: 'email_send', lenderId: lender.id, prospectId: submissionInput.prospectId }));
        
        const emailResponse = await resendClient.emails.send({
          from: fromEmail,
          to: lender.email,
          subject: `Loan Application - ${prospect.company.companyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Loan Application Submission</h2>
              <p>Dear ${lender.contactName || 'Lender'},</p>
              <p>${commentary}</p>
              <h3 style="color: #1f2937;">Application Details:</h3>
              <ul style="line-height: 1.8;">
                <li><strong>Company:</strong> ${prospect.company.companyName}</li>
                <li><strong>Loan Amount:</strong> £${prospect.loanAmount ? (prospect.loanAmount / 100).toLocaleString() : 'TBC'}</li>
                <li><strong>Term:</strong> ${prospect.term ? `${prospect.term} months` : 'TBC'}</li>
                ${prospect.interestRate ? `<li><strong>Interest Rate:</strong> ${prospect.interestRate}</li>` : ''}
              </ul>
              <p>Please find the complete application details in the attached PDF report.</p>
              <p style="margin-top: 30px;">Best regards,<br/>FlowLoan Application</p>
            </div>
          `,
          attachments: [
            {
              filename: `application-${prospect.company.companyName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
              content: pdfBuffer.toString('base64'),
            }
          ],
        });
        
        // Log only email ID without sensitive response data
        const emailId = emailResponse.data?.id;
        
        // Check for errors in the response
        if (emailResponse.error) {
          throw new Error(emailResponse.error.message || 'Resend returned an error');
        }
        
        if (!emailResponse.data?.id) {
          throw new Error('No email ID returned from Resend - email may not have been sent');
        }
        
        console.log(JSON.stringify({ type: 'email_sent', emailId }));
        emailSent = true;
      } catch (err: any) {
        const errMessage = (err as Error)?.message || 'Unknown error';
        emailError = errMessage;
        console.error("Email send error:", errMessage);
      }
      
      // Create the submission only after successful PDF generation
      const submission = await storage.createApplicationSubmission(submissionInput, userId);
      
      // Update submission status based on email result
      if (emailSent) {
        await storage.updateApplicationSubmission(submission.id, userId, { emailSent: 1, status: 'sent' });
      }
      
      // Create an activity task to log this submission
      const activity = await storage.createActivity({
        userId,
        activityType: "task",
        title: `Application ${emailSent ? 'sent' : 'submitted'} to ${lender.institutionName}`,
        description: `Loan application for ${prospect.company.companyName} ${emailSent ? 'emailed' : 'submitted'} to ${lender.institutionName}${emailSent ? '' : emailError ? ` (email failed: ${emailError})` : ' (email failed)'}`,
        prospectId: submissionInput.prospectId,
        priority: "high",
        dueDate: null,
        completed: 1,
      });
      
      res.status(201).json({ 
        submission: { ...submission, emailSent: emailSent ? 1 : 0, status: emailSent ? 'sent' : 'pending' }, 
        activity, 
        emailSent,
        emailError: emailError || undefined
      });
    } catch (error) {
      console.error("Error creating submission:", error);
      res.status(500).json({ message: "Failed to create submission" });
    }
  });

  app.delete("/api/submissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }
      
      // Verify submission exists and belongs to user before deleting
      const submission = await storage.getApplicationSubmission(submissionId, userId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      await storage.deleteApplicationSubmission(submissionId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting submission:", error);
      res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  // ====== EMAIL INBOX API (AgentMail Integration) ======
  
  // Get or create user's email inbox
  app.get("/api/email/inbox", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let inbox = await storage.getEmailInbox(userId);
      
      if (!inbox) {
        // Create or retrieve inbox for this user using AgentMail
        try {
          const { getAgentMailClient } = await import("./agentmail");
          const client = await getAgentMailClient();
          
          const user = await storage.getUser(userId);
          const displayName = user?.firstName 
            ? `${user.firstName} ${user.lastName || ''}`.trim() 
            : 'FlowLoan User';
          
          let agentMailInbox: any = null;
          
          // First try to list existing inboxes
          try {
            const listResponse = await client.inboxes.list();
            // The response is pageable - get the data from the body
            const listData = (listResponse as any).body || listResponse;
            
            // Check if it has a data array (paginated response)
            const inboxes = listData.data || listData.items || (Array.isArray(listData) ? listData : []);
            
            if (inboxes.length > 0) {
              // Use the first available inbox
              agentMailInbox = inboxes[0];
              console.log(JSON.stringify({ type: 'agentmail_inbox_reused', inboxId: agentMailInbox.id }));
            }
          } catch (listError) {
            console.log("Could not list inboxes, will try to create:", listError);
          }
          
          // If no existing inbox, try to create one
          if (!agentMailInbox) {
            try {
              const createResponse = await client.inboxes.create({
                name: displayName,
              });
              agentMailInbox = (createResponse as any).body || createResponse;
              console.log(JSON.stringify({ type: 'agentmail_inbox_created', inboxId: agentMailInbox?.id }));
            } catch (createError: any) {
              // If limit exceeded, we already checked for existing inboxes
              console.error("Error creating inbox:", createError);
              return res.status(500).json({ error: "Failed to create email inbox. AgentMail inbox limit may be exceeded." });
            }
          }
          
          // Validate we have the required fields
          if (!agentMailInbox?.id) {
            console.error("AgentMail inbox missing id:", agentMailInbox);
            return res.status(500).json({ error: "Failed to get inbox details from AgentMail." });
          }
          
          // Save inbox to our database
          inbox = await storage.createEmailInbox({
            userId,
            inboxId: agentMailInbox.id,
            emailAddress: agentMailInbox.emailAddress || agentMailInbox.email_address,
            displayName,
          });
        } catch (error) {
          console.error("Error setting up AgentMail inbox:", error);
          return res.status(500).json({ error: "Failed to set up email inbox. Please ensure AgentMail is configured." });
        }
      }
      
      res.json(inbox);
    } catch (error: any) {
      console.error("Error getting inbox:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Check if AgentMail is configured
  app.get("/api/email/status", isAuthenticated, async (req: any, res) => {
    try {
      const { isAgentMailConfigured } = await import("./agentmail");
      const configured = await isAgentMailConfigured();
      res.json({ configured });
    } catch (error: any) {
      res.json({ configured: false });
    }
  });
  
  // Sync messages from AgentMail to local database
  app.post("/api/email/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const inbox = await storage.getEmailInbox(userId);
      
      if (!inbox) {
        return res.status(404).json({ error: "No inbox found. Create one first." });
      }
      
      const { getAgentMailClient } = await import("./agentmail");
      const client = await getAgentMailClient();
      
      // Fetch messages from AgentMail
      const messagesResponse = await client.inboxes.messages.list(inbox.inboxId);
      const messages = messagesResponse.body;
      
      // Sync each message to our database
      let syncedCount = 0;
      for (const message of messages.data || []) {
        // Check if we already have this message
        const existing = await storage.getEmailMessageByMessageId(message.id);
        if (!existing) {
          await storage.createEmailMessage({
            inboxId: inbox.id,
            messageId: message.id,
            threadId: message.threadId || null,
            fromAddress: message.from?.address || 'unknown',
            toAddresses: message.to?.map((t: any) => t.address) || [],
            ccAddresses: message.cc?.map((c: any) => c.address) || [],
            subject: message.subject || '',
            textBody: message.bodyText || null,
            htmlBody: message.bodyHtml || null,
            direction: message.direction || 'inbound',
            isRead: 0,
            attachments: message.attachments || [],
            sentAt: new Date(message.createdAt),
          });
          syncedCount++;
        }
      }
      
      res.json({ synced: syncedCount, total: messages.data?.length || 0 });
    } catch (error: any) {
      console.error("Error syncing messages:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get all messages for user's inbox
  app.get("/api/email/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const inbox = await storage.getEmailInbox(userId);
      
      if (!inbox) {
        return res.json([]);
      }
      
      const messages = await storage.listEmailMessages(inbox.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error listing messages:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get a single message
  app.get("/api/email/messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messageId = parseInt(req.params.id);
      
      const inbox = await storage.getEmailInbox(userId);
      if (!inbox) {
        return res.status(404).json({ error: "No inbox found" });
      }
      
      const message = await storage.getEmailMessage(messageId);
      if (!message || message.inboxId !== inbox.id) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Mark as read
      if (!message.isRead) {
        await storage.markEmailAsRead(messageId);
      }
      
      res.json(message);
    } catch (error: any) {
      console.error("Error getting message:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Send an email
  app.post("/api/email/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { to, cc, subject, body, contactId, prospectId, replyToMessageId } = req.body;
      
      if (!to || !subject) {
        return res.status(400).json({ error: "To address and subject are required" });
      }
      
      const inbox = await storage.getEmailInbox(userId);
      if (!inbox) {
        return res.status(404).json({ error: "No inbox found. Create one first." });
      }
      
      const { getAgentMailClient } = await import("./agentmail");
      const client = await getAgentMailClient();
      
      // Prepare recipients
      const toAddresses = Array.isArray(to) ? to : [to];
      const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
      
      // Send the email via AgentMail
      const sendResponse = await client.inboxes.messages.create(inbox.inboxId, {
        to: toAddresses.map((addr: string) => ({ address: addr })),
        cc: ccAddresses.map((addr: string) => ({ address: addr })),
        subject,
        bodyText: body,
        replyToMessageId: replyToMessageId || undefined,
      });
      const sentMessage = sendResponse.body;
      
      // Save to our database
      const savedMessage = await storage.createEmailMessage({
        inboxId: inbox.id,
        messageId: sentMessage.id,
        threadId: sentMessage.threadId || null,
        contactId: contactId ? parseInt(contactId) : null,
        prospectId: prospectId ? parseInt(prospectId) : null,
        fromAddress: inbox.emailAddress,
        toAddresses,
        ccAddresses,
        subject,
        textBody: body,
        htmlBody: null,
        direction: 'outbound',
        isRead: 1,
        attachments: [],
        sentAt: new Date(),
      });
      
      res.status(201).json(savedMessage);
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Link a message to a contact/prospect
  app.patch("/api/email/messages/:id/link", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messageId = parseInt(req.params.id);
      const { contactId, prospectId } = req.body;
      
      const inbox = await storage.getEmailInbox(userId);
      if (!inbox) {
        return res.status(404).json({ error: "No inbox found" });
      }
      
      const message = await storage.getEmailMessage(messageId);
      if (!message || message.inboxId !== inbox.id) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      const updated = await storage.updateEmailMessageLink(messageId, {
        contactId: contactId ? parseInt(contactId) : null,
        prospectId: prospectId ? parseInt(prospectId) : null,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error linking message:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get messages for a specific contact
  app.get("/api/email/contact/:contactId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = parseInt(req.params.contactId);
      
      const inbox = await storage.getEmailInbox(userId);
      if (!inbox) {
        return res.json([]);
      }
      
      const messages = await storage.getEmailMessagesForContact(inbox.id, contactId);
      res.json(messages);
    } catch (error: any) {
      console.error("Error getting contact messages:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get messages for a specific prospect
  app.get("/api/email/prospect/:prospectId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      
      const inbox = await storage.getEmailInbox(userId);
      if (!inbox) {
        return res.json([]);
      }
      
      const messages = await storage.getEmailMessagesForProspect(inbox.id, prospectId);
      res.json(messages);
    } catch (error: any) {
      console.error("Error getting prospect messages:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============= LEADS API =============
  
  // Get all lead uploads for the user
  app.get("/api/leads/uploads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const uploads = await storage.listLeadUploads(userId);
      res.json(uploads);
    } catch (error: any) {
      console.error("Error fetching lead uploads:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload CSV and parse leads
  app.post("/api/leads/uploads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fileName, csvData } = req.body;
      
      if (!fileName || !csvData) {
        return res.status(400).json({ error: "fileName and csvData are required" });
      }

      // Size limit: 5MB max
      const maxSize = 5 * 1024 * 1024;
      if (csvData.length > maxSize) {
        return res.status(400).json({ error: "CSV file too large. Maximum size is 5MB." });
      }

      // Row limit: 10,000 max
      const lineCount = (csvData.match(/\n/g) || []).length + 1;
      if (lineCount > 10001) {
        return res.status(400).json({ error: "CSV file has too many rows. Maximum is 10,000 rows." });
      }

      // Create the upload record
      const upload = await storage.createLeadUpload({
        userId,
        fileName,
        status: "processing",
        totalRows: 0,
        successRows: 0,
        errorRows: 0,
        errors: [],
      });

      // Parse CSV data
      const lines = csvData.split('\n').filter((line: string) => line.trim());
      if (lines.length < 2) {
        await storage.updateLeadUpload(upload.id, userId, {
          status: "failed",
          errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }],
        });
        return res.status(400).json({ error: "CSV must have a header row and at least one data row" });
      }

      // Parse headers
      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine).map((h: string) => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));
      
      // Map common column names to our schema
      const columnMapping: Record<string, string> = {
        'company_name': 'companyName',
        'companyname': 'companyName',
        'company': 'companyName',
        'name': 'companyName',
        'business_name': 'companyName',
        'businessname': 'companyName',
        'company_number': 'companyNumber',
        'companynumber': 'companyNumber',
        'crn': 'companyNumber',
        'registration_number': 'companyNumber',
        'trading_name': 'tradingName',
        'tradingname': 'tradingName',
        'trading_as': 'tradingName',
        'website': 'website',
        'url': 'website',
        'web': 'website',
        'email': 'email',
        'company_email': 'email',
        'phone': 'phone',
        'telephone': 'phone',
        'tel': 'phone',
        'contact_phone': 'phone',
        'address': 'address',
        'registered_address': 'address',
        'postcode': 'postcode',
        'post_code': 'postcode',
        'zip': 'postcode',
        'zipcode': 'postcode',
        'sic_code': 'sicCode',
        'siccode': 'sicCode',
        'sic': 'sicCode',
        'contact_name': 'contactName',
        'contactname': 'contactName',
        'contact': 'contactName',
        'contact_person': 'contactName',
        'contact_email': 'contactEmail',
        'contactemail': 'contactEmail',
        'contact_phone': 'contactPhone',
        'contactphone': 'contactPhone',
        'notes': 'notes',
        'note': 'notes',
        'comments': 'notes',
      };

      const leadsToCreate: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const rawData: Record<string, any> = {};
        const leadData: Record<string, any> = { uploadId: upload.id };

        // Map values to columns
        for (let j = 0; j < headers.length && j < values.length; j++) {
          const header = headers[j];
          const value = values[j]?.trim() || '';
          rawData[header] = value;

          const mappedKey = columnMapping[header];
          if (mappedKey && value) {
            leadData[mappedKey] = value;
          }
        }

        leadData.rawData = rawData;

        // Validate required field
        if (!leadData.companyName) {
          errors.push({ row: i + 1, message: "Missing company name" });
          continue;
        }

        // Clean up company number (remove spaces, uppercase)
        if (leadData.companyNumber) {
          leadData.companyNumber = leadData.companyNumber.toString().replace(/\s/g, '').toUpperCase();
        }

        leadsToCreate.push(leadData);
      }

      // Bulk create leads
      if (leadsToCreate.length > 0) {
        await storage.createLeadsBulk(leadsToCreate, userId);
      }

      // Update upload record with results
      await storage.updateLeadUpload(upload.id, userId, {
        status: errors.length > 0 && leadsToCreate.length === 0 ? "failed" : "completed",
        totalRows: lines.length - 1,
        successRows: leadsToCreate.length,
        errorRows: errors.length,
        errors,
      });

      const updatedUpload = await storage.getLeadUpload(upload.id, userId);
      res.status(201).json(updatedUpload);
    } catch (error: any) {
      console.error("Error uploading leads CSV:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to parse CSV line (handles quoted values)
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  // Get all leads for the user
  app.get("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { uploadId, matchStatus, search } = req.query;
      
      const filters: { uploadId?: number; matchStatus?: string; search?: string } = {};
      if (uploadId) filters.uploadId = parseInt(uploadId);
      if (matchStatus) filters.matchStatus = matchStatus;
      if (search) filters.search = search;
      
      const leads = await storage.listLeads(userId, filters);
      res.json(leads);
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single lead
  app.get("/api/leads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const lead = await storage.getLead(id, userId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error: any) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update lead
  app.patch("/api/leads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const lead = await storage.updateLead(id, userId, req.body);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error: any) {
      console.error("Error updating lead:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete lead
  app.delete("/api/leads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      await storage.deleteLead(id, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete all leads from an upload
  app.delete("/api/leads/uploads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      // First delete all leads from this upload
      await storage.deleteLeadsByUpload(id, userId);
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting upload leads:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create prospect from lead
  app.post("/api/leads/:id/prospects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const leadId = parseInt(req.params.id);
      const { companyNumber, companyName, companyData } = req.body;
      
      const lead = await storage.getLead(leadId, userId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Check prospect limit
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const prospectCount = await storage.countProspects(userId);
      if (prospectCount >= user.prospectLimit) {
        return res.status(403).json({ 
          error: `Prospect limit reached. Your ${user.subscriptionTier} plan allows ${user.prospectLimit} prospects.`
        });
      }

      // Check if company already exists
      let company = await storage.getCompanyByNumber(companyNumber);
      
      if (!company && companyData) {
        // Create new company from Companies House data
        const sicCode = companyData.sic_codes?.[0] || null;
        const sicDescription = sicCode ? getSicDescription(sicCode) : null;
        company = await storage.createCompany({
          companyName: companyData.company_name || companyName,
          companyNumber: companyNumber,
          registeredAddress: companyData.registered_office_address ? formatAddress(companyData.registered_office_address) : null,
          incorporationDate: companyData.date_of_creation || null,
          companyStatus: companyData.company_status || null,
          companyType: companyData.type || null,
          sicCode: sicCode,
          sicDescription: sicDescription,
        });
      } else if (!company) {
        // Create company with minimal info from lead
        company = await storage.createCompany({
          companyName: companyName || lead.companyName,
          companyNumber: companyNumber,
          registeredAddress: lead.address || null,
          incorporationDate: null,
          companyStatus: null,
          companyType: null,
        });
      }

      // Create prospect
      const prospect = await storage.createProspect({
        companyId: company.id,
        stage: "lead",
      }, userId);

      // Update lead with linked prospect
      await storage.updateLead(leadId, userId, {
        matchStatus: "prospect_created",
        matchedCompanyNumber: companyNumber,
        linkedProspectId: prospect.id,
      });

      res.status(201).json({ prospect, company });
    } catch (error: any) {
      console.error("Error creating prospect from lead:", error);
      if (error.message?.includes("unique constraint")) {
        return res.status(409).json({ error: "A prospect for this company already exists" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Helper to format address
  function formatAddress(address: any): string {
    if (!address) return '';
    const parts = [
      address.premises,
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.region,
      address.postal_code,
      address.country
    ].filter(Boolean);
    return parts.join(', ');
  }

  // ============= UNDERWRITING SUBMISSIONS =============

  // Middleware to check if user is an underwriter
  const isUnderwriter = async (req: any, res: any, next: any) => {
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.user.claims.sub);
    if (!user || user.role !== 'underwriter') {
      return res.status(403).json({ error: "Access denied. Underwriter role required." });
    }
    next();
  };

  // Helper to enrich submissions with prospect and company details (batch loaded)
  async function enrichSubmissions(submissions: any[]) {
    if (submissions.length === 0) return [];
    
    // Collect unique IDs for batch loading
    const prospectIds = [...new Set(submissions.map(s => s.prospectId).filter(Boolean))];
    const brokerIds = [...new Set(submissions.map(s => s.brokerId).filter(Boolean))];
    
    // Batch load all prospects and brokers in single queries
    const [prospectsArr, brokersArr] = await Promise.all([
      storage.getProspectsByIds(prospectIds),
      storage.getUsersByIds(brokerIds),
    ]);
    
    // Create lookup maps
    const prospectsMap = new Map(prospectsArr.map(p => [p.id, p]));
    const brokersMap = new Map(brokersArr.map(b => [b.id, b]));
    
    // Enrich submissions using maps
    return submissions.map(submission => {
      const prospect = prospectsMap.get(submission.prospectId) || null;
      const broker = brokersMap.get(submission.brokerId);
      return {
        ...submission,
        prospect,
        broker: broker ? {
          firstName: broker.firstName,
          lastName: broker.lastName,
          email: broker.email,
        } : null,
      };
    });
  }

  // Get all underwriting submissions (for underwriters)
  app.get("/api/underwriting/submissions", isAuthenticated, isUnderwriter, async (req: any, res) => {
    try {
      const { status, assigned } = req.query;
      const userId = req.user.claims.sub;
      
      const filters: { status?: string; assignedUnderwriterId?: string } = {};
      if (status) filters.status = status;
      if (assigned === 'me') filters.assignedUnderwriterId = userId;
      
      const submissions = await storage.listUnderwritingSubmissions(filters);
      const enrichedSubmissions = await enrichSubmissions(submissions);
      res.json(enrichedSubmissions);
    } catch (error: any) {
      console.error("Error listing underwriting submissions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get broker's own underwriting submissions
  app.get("/api/underwriting/my-submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissions = await storage.listBrokerUnderwritingSubmissions(userId);
      const enrichedSubmissions = await enrichSubmissions(submissions);
      res.json(enrichedSubmissions);
    } catch (error: any) {
      console.error("Error listing broker submissions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get underwriting status for all user's prospects (for pipeline view)
  app.get("/api/underwriting/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissions = await storage.listBrokerUnderwritingSubmissions(userId);
      
      // Return a map of prospectId -> status
      const statusMap: Record<number, { status: string; submittedAt: Date | null }> = {};
      for (const submission of submissions) {
        statusMap[submission.prospectId] = {
          status: submission.status,
          submittedAt: submission.submittedAt,
        };
      }
      res.json(statusMap);
    } catch (error: any) {
      console.error("Error getting underwriting status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single underwriting submission
  app.get("/api/underwriting/submissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid submission ID" });
      }
      const submission = await storage.getUnderwritingSubmission(id);
      
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Brokers can only see their own submissions
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'underwriter' && submission.brokerId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(submission);
    } catch (error: any) {
      console.error("Error getting underwriting submission:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create underwriting submission (broker submits prospect for review)
  app.post("/api/underwriting/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { prospectId, priority, brokerComments } = req.body;
      
      if (!prospectId) {
        return res.status(400).json({ error: "prospectId is required" });
      }
      
      // Check if prospect exists and belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      // Check if there's already an active submission for this prospect
      const existingSubmission = await storage.getUnderwritingSubmissionByProspect(prospectId);
      if (existingSubmission && !['approved', 'declined', 'withdrawn'].includes(existingSubmission.status)) {
        return res.status(409).json({ error: "This prospect already has an active underwriting submission" });
      }
      
      // Create the submission
      const submission = await storage.createUnderwritingSubmission({
        prospectId,
        priority: priority || 'normal',
        brokerComments,
      }, userId);
      
      // Create activity record
      await storage.createUnderwritingActivity({
        submissionId: submission.id,
        activityType: 'submitted',
        content: brokerComments || 'Submitted for underwriting review',
      }, userId);
      
      // Update prospect stage to submission
      await storage.updateProspectStage(prospectId, userId, 'submission');
      
      res.status(201).json(submission);
    } catch (error: any) {
      console.error("Error creating underwriting submission:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Claim a submission (underwriter takes ownership)
  app.post("/api/underwriting/submissions/:id/claim", isAuthenticated, isUnderwriter, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const submission = await storage.getUnderwritingSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      if (submission.status !== 'submitted') {
        return res.status(400).json({ error: "Can only claim submissions with 'submitted' status" });
      }
      
      const updated = await storage.claimUnderwritingSubmission(id, userId);
      
      // Create activity record
      await storage.createUnderwritingActivity({
        submissionId: id,
        activityType: 'claimed',
        content: 'Claimed for review',
      }, userId);
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error claiming submission:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update submission (underwriter actions: approve, decline, query, add notes)
  app.patch("/api/underwriting/submissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const submission = await storage.getUnderwritingSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Only underwriters can update, or brokers can withdraw their own
      const isBroker = user?.role === 'broker';
      const isOwner = submission.brokerId === userId;
      const isUnderwriterRole = user?.role === 'underwriter';
      
      if (!isUnderwriterRole && !(isBroker && isOwner)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { status, underwriterNotes, decisionReason } = req.body;
      
      // Brokers can only withdraw
      if (isBroker && status && status !== 'withdrawn') {
        return res.status(403).json({ error: "Brokers can only withdraw submissions" });
      }
      
      const updates: any = {};
      if (status) updates.status = status;
      if (underwriterNotes) updates.underwriterNotes = underwriterNotes;
      if (decisionReason) updates.decisionReason = decisionReason;
      
      const updated = await storage.updateUnderwritingSubmission(id, updates);
      
      // Create activity record for status changes
      if (status) {
        await storage.createUnderwritingActivity({
          submissionId: id,
          activityType: status,
          content: decisionReason || `Status changed to ${status}`,
        }, userId);
        
        // Update prospect stage based on decision
        if (status === 'approved') {
          await storage.updateProspectStage(submission.prospectId, submission.brokerId, 'approved');
        } else if (status === 'declined') {
          await storage.updateProspectStage(submission.prospectId, submission.brokerId, 'declined');
        } else if (status === 'withdrawn') {
          await storage.updateProspectStage(submission.prospectId, submission.brokerId, 'due-diligence');
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating submission:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add comment to submission
  app.post("/api/underwriting/submissions/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      const submission = await storage.getUnderwritingSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Check access
      const user = await storage.getUser(userId);
      if (user?.role !== 'underwriter' && submission.brokerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Determine if this is a response to a query
      const activityType = user?.role === 'broker' && submission.status === 'queried' ? 'responded' : 'comment';
      
      const activity = await storage.createUnderwritingActivity({
        submissionId: id,
        activityType,
        content,
      }, userId);
      
      // If broker responded to query, update status back to in_review
      if (activityType === 'responded') {
        await storage.updateUnderwritingSubmission(id, { status: 'in_review' });
      }
      
      res.status(201).json(activity);
    } catch (error: any) {
      console.error("Error adding comment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get submission activities
  app.get("/api/underwriting/submissions/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const submission = await storage.getUnderwritingSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Check access
      const user = await storage.getUser(userId);
      if (user?.role !== 'underwriter' && submission.brokerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const activities = await storage.listUnderwritingActivities(id);
      
      // Enrich activities with user info
      const enrichedActivities = await Promise.all(
        activities.map(async (activity) => {
          const activityUser = await storage.getUser(activity.userId);
          return {
            ...activity,
            user: activityUser ? {
              firstName: activityUser.firstName,
              lastName: activityUser.lastName,
              email: activityUser.email,
              role: activityUser.role,
            } : null,
          };
        })
      );
      
      res.json(enrichedActivities);
    } catch (error: any) {
      console.error("Error getting activities:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get underwriting submission for a specific prospect
  app.get("/api/underwriting/prospects/:prospectId/submission", isAuthenticated, async (req: any, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const userId = req.user.claims.sub;
      
      // Check prospect ownership
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        // Also check if user is underwriter
        const user = await storage.getUser(userId);
        if (user?.role !== 'underwriter') {
          return res.status(404).json({ error: "Prospect not found" });
        }
      }
      
      const submission = await storage.getUnderwritingSubmissionByProspect(prospectId);
      if (!submission) {
        return res.status(404).json({ error: "No submission found for this prospect" });
      }
      
      res.json(submission);
    } catch (error: any) {
      console.error("Error getting prospect submission:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user role
  app.get("/api/auth/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      // No-store cache for sensitive auth data
      res.setHeader('Cache-Control', 'no-store');
      res.json({ role: user?.role || 'broker' });
    } catch (error: any) {
      console.error("Error getting user role:", error);
      res.status(500).json(createErrorResponse(error, 500, req.requestId, "Failed to get user role"));
    }
  });

  // Update current user role
  // SECURITY: In production (NODE_ENV !== 'development'), only super_admin can change roles
  // DEVELOPMENT: Self role switching is allowed for testing when NODE_ENV === 'development'
  app.post("/api/auth/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role, targetUserId } = req.body;
      const currentUser = await storage.getUser(userId);
      
      const validRoles = ['super_admin', 'sales_admin', 'broker', 'underwriter'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }
      
      // Check if testing mode is enabled
      const testingModeEnabled = process.env.NODE_ENV === 'development';
      
      // If changing another user's role, must be super_admin
      if (targetUserId && targetUserId !== userId) {
        if (currentUser?.role !== 'super_admin') {
          return res.status(403).json({ error: "Only Super Admin can change other users' roles" });
        }
        await storage.updateUser(targetUserId, { role });
        return res.json({ role, message: `User role updated to ${role}` });
      }
      
      // Self role switching - only allowed for super_admin OR in testing mode
      if (currentUser?.role !== 'super_admin') {
        if (!testingModeEnabled) {
          return res.status(403).json({ error: "Only Super Admin can change roles" });
        }
        // In development mode, allow self-switching with a warning
        console.warn(`[DEV MODE] User ${userId} switching own role to ${role} - disabled in production`);
      }
      
      await storage.updateUser(userId, { role });
      res.json({ role, message: `Role updated to ${role}` });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEAM MANAGEMENT ============

  // Get all users (super_admin only)
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser || currentUser.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can access this endpoint" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error listing users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all teams (super_admin and sales_admin only)
  app.get("/api/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !['super_admin', 'sales_admin'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }
      
      const teams = await storage.getTeams(user.role === 'super_admin' ? undefined : userId);
      res.json(teams);
    } catch (error: any) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new team (super_admin and sales_admin only)
  app.post("/api/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !['super_admin', 'sales_admin'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }
      
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Team name is required" });
      }
      
      const team = await storage.createTeam({ name, description }, userId);
      res.status(201).json(team);
    } catch (error: any) {
      console.error("Error creating team:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get team by ID with members
  app.get("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const teamId = parseInt(req.params.id);
      
      if (!user || !['super_admin', 'sales_admin'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }
      
      const team = await storage.getTeamWithMembers(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Sales admin can only access teams they created or are admin of
      if (user.role === 'sales_admin') {
        const isOwner = team.createdBy === userId;
        const isTeamAdmin = team.members.some(m => m.userId === userId && m.memberRole === 'admin');
        if (!isOwner && !isTeamAdmin) {
          return res.status(403).json({ error: "You don't have permission to view this team" });
        }
      }
      
      res.json(team);
    } catch (error: any) {
      console.error("Error fetching team:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add member to team
  app.post("/api/teams/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const teamId = parseInt(req.params.id);
      
      if (!user || !['super_admin', 'sales_admin'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }
      
      // Verify team ownership for sales_admin
      if (user.role === 'sales_admin') {
        const team = await storage.getTeamWithMembers(teamId);
        if (!team) {
          return res.status(404).json({ error: "Team not found" });
        }
        const isOwner = team.createdBy === userId;
        const isTeamAdmin = team.members.some(m => m.userId === userId && m.memberRole === 'admin');
        if (!isOwner && !isTeamAdmin) {
          return res.status(403).json({ error: "You don't have permission to modify this team" });
        }
      }
      
      const { userId: memberUserId, memberRole } = req.body;
      if (!memberUserId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const member = await storage.addTeamMember({
        teamId,
        userId: memberUserId,
        memberRole: memberRole || 'member',
      });
      res.status(201).json(member);
    } catch (error: any) {
      console.error("Error adding team member:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove member from team
  app.delete("/api/teams/:teamId/members/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const user = await storage.getUser(currentUserId);
      const teamId = parseInt(req.params.teamId);
      const memberUserId = req.params.userId;
      
      if (!user || !['super_admin', 'sales_admin'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }
      
      // Verify team ownership for sales_admin
      if (user.role === 'sales_admin') {
        const team = await storage.getTeamWithMembers(teamId);
        if (!team) {
          return res.status(404).json({ error: "Team not found" });
        }
        const isOwner = team.createdBy === currentUserId;
        const isTeamAdmin = team.members.some(m => m.userId === currentUserId && m.memberRole === 'admin');
        if (!isOwner && !isTeamAdmin) {
          return res.status(403).json({ error: "You don't have permission to modify this team" });
        }
      }
      
      await storage.removeTeamMember(teamId, memberUserId);
      res.json({ message: "Member removed from team" });
    } catch (error: any) {
      console.error("Error removing team member:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's teams
  app.get("/api/my-teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error: any) {
      console.error("Error fetching user teams:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all users for team management (super_admin and sales_admin only)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !['super_admin', 'sales_admin'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update user role (super_admin only)
  app.patch("/api/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser || currentUser.role !== 'super_admin') {
        return res.status(403).json({ error: "Access denied. Super Admin role required." });
      }
      
      const targetUserId = req.params.id;
      const { role } = req.body;
      
      const validRoles = ['super_admin', 'sales_admin', 'broker', 'underwriter'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }
      
      await storage.updateUser(targetUserId, { role });
      res.json({ message: `User role updated to ${role}` });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // File upload endpoint for underwriting attachments - uses busboy streaming parser
  const MAX_UNDERWRITING_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
  const MAX_UNDERWRITING_FILES = 10; // Maximum 10 files per request
  
  app.post("/api/underwriting/upload/:submissionId", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const submissionId = parseInt(req.params.submissionId);
    
    if (isNaN(submissionId)) {
      return res.status(400).json({ error: "Invalid submission ID" });
    }
    
    try {
      // Verify user role (must be broker or underwriter)
      const user = await storage.getUser(userId);
      if (!user || !['broker', 'underwriter', 'sales_admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Broker or Underwriter role required." });
      }
      
      // Verify submission exists and user has access
      const submission = await storage.getUnderwritingSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Only the broker who created it, assigned underwriter, or admins can upload
      const isOwner = submission.brokerId === userId;
      const isAssignedUnderwriter = submission.underwriterId === userId;
      const isAdmin = ['sales_admin', 'super_admin'].includes(user.role);
      
      if (!isOwner && !isAssignedUnderwriter && !isAdmin) {
        return res.status(403).json({ error: "Access denied. You don't have permission for this submission." });
      }
      
      const contentType = req.headers['content-type'];
      if (!contentType?.startsWith('multipart/form-data')) {
        return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
      }
      
      const uploadedFiles: UnderwritingAttachment[] = [];
      const uploadPromises: Promise<UnderwritingAttachment>[] = [];
      let validationError: string | null = null;
      
      const bb = busboy({
        headers: req.headers,
        limits: { fileSize: MAX_UNDERWRITING_FILE_SIZE, files: MAX_UNDERWRITING_FILES }
      });
      
      bb.on('file', (fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        
        if (!filename) {
          fileStream.resume();
          return;
        }
        
        const timestamp = Date.now();
        const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `.private/underwriting/${submissionId}/${userId}/${timestamp}_${sanitizedFileName}`;
        
        // Stream directly to storage - no RAM buffering
        const uploadPromise = (async (): Promise<UnderwritingAttachment> => {
          const { PassThrough } = await import('stream');
          const passThrough = new PassThrough();
          let limitExceeded = false;
          let bytesWritten = 0;
          
          fileStream.on('limit', () => {
            limitExceeded = true;
            validationError = `File "${filename}" exceeds 5MB limit`;
            passThrough.destroy(new Error("File size limit exceeded"));
          });
          
          fileStream.on('data', (chunk: Buffer) => {
            bytesWritten += chunk.length;
          });
          
          fileStream.pipe(passThrough);
          
          try {
            await getObjectStorage().uploadFromStream(storagePath, passThrough);
            
            if (limitExceeded) {
              try { await getObjectStorage().delete(storagePath); } catch {}
              throw new Error(`File "${filename}" exceeds 5MB limit`);
            }
            
            return {
              fileName: filename,
              fileType: mimeType || 'application/octet-stream',
              fileSize: bytesWritten,
              storagePath,
              uploadedAt: new Date().toISOString(),
            };
          } catch (err: any) {
            if (limitExceeded) throw new Error(`File "${filename}" exceeds 5MB limit`);
            throw err;
          }
        })();
        
        uploadPromises.push(uploadPromise);
      });
      
      bb.on('close', async () => {
        try {
          if (validationError) {
            return res.status(413).json({ error: validationError });
          }
          
          if (uploadPromises.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
          }
          
          const results = await Promise.all(uploadPromises);
          res.json({ files: results });
        } catch (error: any) {
          console.error("Error completing underwriting upload:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: error.message });
          }
        }
      });
      
      bb.on('error', (error: any) => {
        console.error("Busboy error in underwriting upload:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message });
        }
      });
      
      req.pipe(bb);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download attachment endpoint
  app.get("/api/underwriting/download/:submissionId/:activityId/:fileIndex", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissionId = parseInt(req.params.submissionId);
      const activityId = parseInt(req.params.activityId);
      const fileIndex = parseInt(req.params.fileIndex);
      
      // Check submission access
      const submission = await storage.getUnderwritingSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      const user = await storage.getUser(userId);
      if (user?.role !== 'underwriter' && submission.brokerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get the activity and extract attachment
      const activities = await storage.listUnderwritingActivities(submissionId);
      const activity = activities.find(a => a.id === activityId);
      
      if (!activity || !activity.attachments) {
        return res.status(404).json({ error: "Activity not found" });
      }
      
      const attachments = activity.attachments as UnderwritingAttachment[];
      if (fileIndex < 0 || fileIndex >= attachments.length) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const attachment = attachments[fileIndex];
      
      // Download from object storage
      const { data } = await getObjectStorage().downloadAsBytes(attachment.storagePath);
      
      res.setHeader('Content-Type', attachment.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
      res.send(Buffer.from(data));
    } catch (error: any) {
      console.error("Error downloading file:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Broker responds to underwriter query with message and attachments
  app.post("/api/underwriting/submissions/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const submission = await storage.getUnderwritingSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Only the broker who submitted can respond
      if (submission.brokerId !== userId) {
        return res.status(403).json({ error: "Only the submitting broker can respond to queries" });
      }
      
      // Can only respond to queries
      if (submission.status !== 'queried') {
        return res.status(400).json({ error: "Can only respond to submissions with 'queried' status" });
      }
      
      const { message, attachments } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Response message is required" });
      }
      
      // Create activity record with response and attachments
      const activity = await storage.createUnderwritingActivity({
        submissionId: id,
        activityType: 'responded',
        content: message,
        attachments: attachments || [],
      }, userId);
      
      // Update submission status back to in_review
      await storage.updateUnderwritingSubmission(id, { status: 'in_review' });
      
      res.status(201).json({
        activity,
        message: "Response submitted successfully. The underwriter will review your response.",
      });
    } catch (error: any) {
      console.error("Error submitting response:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Underwriter sends message to broker
  app.post("/api/underwriting/submissions/:id/message", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      if (user?.role !== 'underwriter') {
        return res.status(403).json({ error: "Only underwriters can send messages through this endpoint" });
      }
      
      const submission = await storage.getUnderwritingSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Only assigned underwriter can message
      if (submission.assignedUnderwriterId !== userId) {
        return res.status(403).json({ error: "Only the assigned underwriter can send messages" });
      }
      
      const { message, setStatus } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Create activity record
      const activityType = setStatus === 'queried' ? 'queried' : 'comment';
      const activity = await storage.createUnderwritingActivity({
        submissionId: id,
        activityType,
        content: message,
        attachments: [],
      }, userId);
      
      // Update status if requesting a query
      if (setStatus === 'queried') {
        await storage.updateUnderwritingSubmission(id, { 
          status: 'queried',
          decisionReason: message,
        });
      }
      
      res.status(201).json({
        activity,
        message: activityType === 'queried' 
          ? "Query sent to broker. They will be notified to respond."
          : "Message sent successfully.",
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Broker sends a message on their submission
  app.post("/api/underwriting/submissions/:id/broker-message", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const submission = await storage.getUnderwritingSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Only the broker who submitted can send messages
      if (submission.brokerId !== userId) {
        return res.status(403).json({ error: "Only the submitting broker can send messages" });
      }
      
      const { message } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Create activity record as a comment from broker
      const activity = await storage.createUnderwritingActivity({
        submissionId: id,
        activityType: 'comment',
        content: message,
        attachments: [],
      }, userId);
      
      res.status(201).json({
        activity,
        message: "Message sent to underwriter.",
      });
    } catch (error: any) {
      console.error("Error sending broker message:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Prospect Documents - List all documents for a prospect
  app.get("/api/prospects/:prospectId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const documents = await storage.listProspectDocuments(prospectId);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching prospect documents:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload document for a prospect - uses busboy streaming parser
  const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB per document
  
  app.post("/api/prospects/:prospectId/documents", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const prospectId = parseInt(req.params.prospectId);
    
    try {
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const contentType = req.headers['content-type'];
      if (!contentType?.startsWith('multipart/form-data')) {
        return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
      }
      
      let category = 'general';
      let notes = '';
      let uploadPromise: Promise<any> | null = null;
      let validationError: string | null = null;
      
      const bb = busboy({
        headers: req.headers,
        limits: { fileSize: MAX_DOCUMENT_FILE_SIZE, files: 1 }
      });
      
      bb.on('field', (fieldname, value) => {
        if (fieldname === 'category') {
          category = value.trim() || 'general';
        } else if (fieldname === 'notes') {
          notes = value.trim();
        }
      });
      
      bb.on('file', (fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        
        if (!filename) {
          fileStream.resume();
          return;
        }
        
        const timestamp = Date.now();
        const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `.private/documents/${prospectId}/${timestamp}_${sanitizedFileName}`;
        
        // Stream directly to storage - no RAM buffering
        uploadPromise = (async () => {
          const { PassThrough } = await import('stream');
          const passThrough = new PassThrough();
          let limitExceeded = false;
          let bytesWritten = 0;
          
          fileStream.on('limit', () => {
            limitExceeded = true;
            validationError = `File "${filename}" exceeds 10MB limit`;
            passThrough.destroy(new Error("File size limit exceeded"));
          });
          
          fileStream.on('data', (chunk: Buffer) => {
            bytesWritten += chunk.length;
          });
          
          fileStream.pipe(passThrough);
          
          try {
            await getObjectStorage().uploadFromStream(storagePath, passThrough);
            
            if (limitExceeded) {
              try { await getObjectStorage().delete(storagePath); } catch {}
              throw new Error(`File "${filename}" exceeds 10MB limit`);
            }
            
            const document = await storage.createProspectDocument({
              prospectId,
              userId,
              fileName: filename,
              fileType: mimeType || 'application/octet-stream',
              fileSize: bytesWritten,
              storagePath,
              category,
              notes: notes || null,
            });
            
            return document;
          } catch (err: any) {
            if (limitExceeded) throw new Error(`File "${filename}" exceeds 10MB limit`);
            throw err;
          }
        })();
      });
      
      bb.on('close', async () => {
        try {
          if (validationError) {
            return res.status(413).json({ error: validationError });
          }
          
          if (!uploadPromise) {
            return res.status(400).json({ error: "No file uploaded" });
          }
          
          const document = await uploadPromise;
          res.status(201).json(document);
        } catch (error: any) {
          console.error("Error completing document upload:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: error.message });
          }
        }
      });
      
      bb.on('error', (error: any) => {
        console.error("Busboy error in document upload:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message });
        }
      });
      
      req.pipe(bb);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download a prospect document
  app.get("/api/prospects/:prospectId/documents/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      const documentId = parseInt(req.params.id);
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const document = await storage.getProspectDocument(documentId);
      if (!document || document.prospectId !== prospectId) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      const { data } = await getObjectStorage().downloadAsBytes(document.storagePath);
      
      res.setHeader('Content-Type', document.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.send(Buffer.from(data));
    } catch (error: any) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a prospect document
  app.delete("/api/prospects/:prospectId/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospectId = parseInt(req.params.prospectId);
      const documentId = parseInt(req.params.id);
      
      // Verify prospect belongs to user
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      
      const document = await storage.getProspectDocument(documentId);
      if (!document || document.prospectId !== prospectId) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Delete from object storage
      try {
        await getObjectStorage().delete(document.storagePath);
      } catch (storageError) {
        console.error("Error deleting from storage (continuing):", storageError);
      }
      
      // Delete from database
      await storage.deleteProspectDocument(documentId);
      
      res.json({ message: "Document deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // WEBHOOK API ENDPOINTS
  // ============================================

  // Generate or regenerate webhook API key for authenticated user
  app.post("/api/user/webhook-key", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apiKey = await storage.generateWebhookApiKey(userId);
      res.json({ 
        apiKey,
        message: "API key generated successfully. Store this securely - it won't be shown again."
      });
    } catch (error: any) {
      console.error("Error generating webhook API key:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get webhook API key status (not the actual key, only suffix for identification)
  app.get("/api/user/webhook-key", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        hasApiKey: !!user.webhookApiKeyHash,
        suffix: user.webhookApiKeySuffix || null,
        createdAt: user.webhookApiKeyCreatedAt,
        lastUsedAt: user.webhookApiKeyLastUsedAt,
      });
    } catch (error: any) {
      console.error("Error fetching webhook key status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook endpoint to receive prospects from external applications
  app.post("/api/webhooks/prospects", async (req: any, res) => {
    try {
      // Authenticate via API key header using hash comparison
      const apiKey = req.headers["x-flowloan-api-key"];
      if (!apiKey || typeof apiKey !== "string") {
        return res.status(401).json({ error: "Missing API key" });
      }

      // Hash the provided key and look up by hash
      const { hashWebhookApiKey } = await import('./utils/webhookKeyHash');
      const keyHash = hashWebhookApiKey(apiKey);
      const user = await storage.getUserByWebhookApiKeyHash(keyHash);
      if (!user) {
        return res.status(401).json({ error: "Invalid API key" });
      }

      // Update last used timestamp
      await storage.updateWebhookApiKeyLastUsed(user.id);

      // Validate payload
      const validationResult = webhookProspectPayloadSchema.safeParse(req.body);
      if (!validationResult.success) {
        const humanError = fromZodError(validationResult.error);
        return res.status(422).json({ 
          error: "Validation failed",
          details: humanError.message 
        });
      }

      const payload = validationResult.data;

      // Check prospect limits
      const prospectCount = await storage.countProspects(user.id);
      const prospectCredits = await storage.getUserProspectCredits(user.id);
      const totalAllowedProspects = user.prospectLimit + prospectCredits;
      
      if (prospectCount >= totalAllowedProspects) {
        return res.status(403).json({ 
          error: "Prospect limit reached",
          message: "Upgrade your plan or purchase additional prospect credits."
        });
      }

      // Create or find company
      let company;
      if (payload.company.companyNumber) {
        company = await storage.getCompanyByNumber(payload.company.companyNumber);
      }
      
      if (!company) {
        company = await storage.createCompany({
          companyName: payload.company.companyName,
          companyNumber: payload.company.companyNumber || `WEBHOOK-${Date.now()}`,
          registeredAddress: payload.company.registeredAddress || null,
          incorporationDate: payload.company.incorporationDate || null,
          companyStatus: payload.company.companyStatus || null,
          companyType: payload.company.companyType || null,
        });
      }

      // Create prospect
      const prospectData = payload.prospect || {};
      const prospect = await storage.createProspect({
        companyId: company.id,
        stage: prospectData.stage || "lead",
        loanAmount: prospectData.loanAmount || null,
        term: prospectData.term || null,
        interestRate: prospectData.interestRate || null,
        priority: prospectData.priority || null,
        notes: prospectData.notes || null,
        directorsGuarantee: prospectData.directorsGuarantee || null,
        commercialProperty: prospectData.commercialProperty || null,
        homeEquity: prospectData.homeEquity || null,
        propertyOther: prospectData.propertyOther || null,
        debenture: prospectData.debenture || null,
        parentCompanyGuarantee: prospectData.parentCompanyGuarantee || null,
        collateral: prospectData.collateral || null,
        crossCompanyGuarantee: prospectData.crossCompanyGuarantee || null,
        loanRequirementNotes: prospectData.loanRequirementNotes || null,
      }, user.id);

      // Create contacts
      if (payload.contacts && payload.contacts.length > 0) {
        for (const contact of payload.contacts) {
          await storage.createContact({
            prospectId: prospect.id,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            role: contact.role || null,
            isPrimary: contact.isPrimary ? 1 : 0,
            notes: contact.notes || null,
          });
        }
      }

      // Create due diligence if provided
      if (payload.dueDiligence) {
        const dueDiligenceData: DueDiligenceData = {
          checklist: payload.dueDiligence.checklist || [],
          loanCalculator: payload.dueDiligence.loanCalculator,
          dscr: payload.dueDiligence.dscr,
          affordability: payload.dueDiligence.affordability,
          financialRatios: payload.dueDiligence.financialRatios,
          character: payload.dueDiligence.character,
        };
        await storage.upsertDueDiligence(prospect.id, dueDiligenceData);
      }

      // Log the webhook activity
      await storage.createActivity({
        userId: user.id,
        prospectId: prospect.id,
        title: "Prospect created via webhook",
        description: payload.metadata?.sourceApp 
          ? `Created from external app: ${payload.metadata.sourceApp}${payload.metadata.externalId ? ` (ID: ${payload.metadata.externalId})` : ""}`
          : "Created via webhook API",
        activityType: "note",
        priority: "low",
      });

      res.status(201).json({
        success: true,
        prospectId: prospect.id,
        companyId: company.id,
        message: "Prospect created successfully",
      });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
