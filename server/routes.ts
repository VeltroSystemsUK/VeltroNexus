import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertCompanySchema,
  insertProspectSchema,
  updateProspectStageSchema,
  insertContactSchema,
  insertActivitySchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication - Required for Replit Auth
  await setupAuth(app);

  // Auth routes - Required for Replit Auth
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // Companies House Search API - Protected route
  app.get("/api/companies-house/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
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
      
      console.log(`Searching Companies House for: "${query}"`);
      
      const response = await fetch(
        `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=20`,
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
      console.log(`Found ${data.items?.length || 0} companies`);
      res.json(data);
    } catch (error: any) {
      console.error("Error searching Companies House:", error);
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
      const company = await storage.createCompany(result.data);
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

  // Activities API - Protected routes
  app.get("/api/prospects/:prospectId/activities", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const activities = await storage.listActivities(prospectId);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prospects/:prospectId/activities", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const result = insertActivitySchema.safeParse({ ...req.body, prospectId });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const activity = await storage.createActivity(result.data);
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
      const mergedData = existing 
        ? { ...existing.data, ...req.body }
        : req.body;
      const dueDiligence = await storage.upsertDueDiligence(prospectId, mergedData);
      res.json(dueDiligence);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
