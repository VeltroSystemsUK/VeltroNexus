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
import { createRequire } from 'module';
import { generateProspectReport } from "./utils/pdfGenerator";
const require = createRequire(import.meta.url);
const gocardless = require("gocardless-nodejs");
const { Environments } = require("gocardless-nodejs/constants");

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
      
      // Check prospect limit based on subscription tier
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const currentProspects = await storage.listProspects(userId);
      if (currentProspects.length >= user.prospectLimit) {
        return res.status(403).json({ 
          error: `Prospect limit reached. You have ${currentProspects.length} prospects and your ${user.subscriptionTier} plan allows ${user.prospectLimit}. Please upgrade your subscription to add more prospects.`,
          prospectCount: currentProspects.length,
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

      const doc = generateProspectReport({
        prospect,
        contacts,
        activities,
        dueDiligence,
        companiesHouseData,
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
      const mergedData = (existing && existing.data) 
        ? { ...(existing.data as object), ...req.body }
        : req.body;
      const dueDiligence = await storage.upsertDueDiligence(prospectId, mergedData);
      res.json(dueDiligence);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GoCardless Integration Routes
  const gcClient = gocardless(
    process.env.GOCARDLESS_ACCESS_TOKEN!,
    process.env.GOCARDLESS_ENVIRONMENT === 'live' ? Environments.Live : Environments.Sandbox
  );

  // Create billing request flow for subscription setup
  app.post("/api/gocardless/create-billing-request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { tier } = req.body;
      if (!tier || !['standard', 'premium'].includes(tier)) {
        return res.status(400).json({ error: "Invalid subscription tier" });
      }

      // Create billing request
      const billingRequest = await gcClient.billingRequests.create({
        mandate_request: {
          currency: 'GBP',
          scheme: 'bacs',
        },
        metadata: {
          user_id: userId,
          tier: tier,
        }
      });

      // Create billing request flow to get authorization URL
      const flow = await gcClient.billingRequestFlows.create({
        redirect_uri: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/subscription/complete`,
        exit_uri: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/pricing`,
        links: {
          billing_request: billingRequest.id
        }
      });

      res.json({
        billingRequestId: billingRequest.id,
        authorisationUrl: flow.authorisation_url
      });
    } catch (error: any) {
      console.error("GoCardless billing request error:", error);
      res.status(500).json({ error: error.message || "Failed to create billing request" });
    }
  });

  // Complete subscription after billing request
  app.post("/api/gocardless/complete-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { billingRequestFlowId } = req.body;

      if (!billingRequestFlowId) {
        return res.status(400).json({ error: "Missing billing request flow ID" });
      }

      // Complete the billing request flow
      const completedFlow = await gcClient.billingRequestFlows.complete(billingRequestFlowId);
      
      if (!completedFlow.links?.billing_request) {
        return res.status(400).json({ error: "Billing request flow not completed" });
      }

      // Get the billing request to retrieve mandate and customer
      const billingRequest = await gcClient.billingRequests.find(completedFlow.links.billing_request);
      
      // Validate that the billing request belongs to the authenticated user
      if (billingRequest.metadata?.user_id !== userId) {
        return res.status(403).json({ error: "Unauthorized: Billing request does not belong to this user" });
      }

      // Get the tier from the billing request metadata (server-authoritative)
      const tier = billingRequest.metadata?.tier;
      if (!tier || !['standard', 'premium'].includes(tier)) {
        return res.status(400).json({ error: "Invalid or missing tier in billing request" });
      }
      
      if (!billingRequest.links?.mandate_request) {
        return res.status(400).json({ error: "Billing request not completed" });
      }

      // Get the mandate request to retrieve the mandate ID
      const mandateRequest = await gcClient.mandateRequests.find(billingRequest.links.mandate_request);
      
      if (!mandateRequest.links?.mandate) {
        return res.status(400).json({ error: "Mandate not found" });
      }

      const mandateId = mandateRequest.links.mandate;
      const customerId = billingRequest.links.customer;

      if (!mandateId || !customerId) {
        return res.status(400).json({ error: "Missing mandate or customer ID" });
      }

      // Determine subscription amount based on validated tier from metadata
      const amounts: Record<string, number> = {
        standard: 2900, // £29 in pence
        premium: 4900,  // £49 in pence
      };

      const amount = amounts[tier];
      if (!amount) {
        return res.status(400).json({ error: "Invalid tier" });
      }

      // Create subscription
      const subscription = await gcClient.subscriptions.create({
        amount: amount.toString(),
        currency: 'GBP',
        name: `FlowLoan ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
        interval_unit: 'monthly',
        links: {
          mandate: mandateId
        },
        metadata: {
          user_id: userId,
          tier: tier
        }
      });

      // Update user with GoCardless IDs and new tier
      const prospectLimits: Record<string, number> = {
        standard: 100,
        premium: 500,
      };

      await storage.updateUser(userId, {
        gocardlessCustomerId: customerId,
        gocardlessMandateId: mandateId,
        gocardlessSubscriptionId: subscription.id,
        subscriptionTier: tier,
        prospectLimit: prospectLimits[tier]
      });

      res.json({ 
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          tier: tier
        }
      });
    } catch (error: any) {
      console.error("GoCardless subscription completion error:", error);
      res.status(500).json({ error: error.message || "Failed to complete subscription" });
    }
  });

  // Cancel subscription
  app.post("/api/gocardless/cancel-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.gocardlessSubscriptionId) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      // Cancel the subscription
      await gcClient.subscriptions.cancel(user.gocardlessSubscriptionId);

      // Update user back to free tier
      await storage.updateUser(userId, {
        gocardlessSubscriptionId: null,
        subscriptionTier: 'free',
        prospectLimit: 10
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("GoCardless cancellation error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  // Webhook endpoint for GoCardless events
  app.post("/api/gocardless/webhook", async (req, res) => {
    try {
      const events = req.body.events;

      for (const event of events) {
        console.log(`GoCardless webhook event: ${event.action} for ${event.resource_type}`);

        // Handle subscription cancellation
        if (event.resource_type === 'subscriptions' && event.action === 'cancelled') {
          const subscriptionId = event.links.subscription;
          
          // Find user with this subscription and downgrade them
          const allUsers = await storage.getAllUsers();
          const user = allUsers.find((u: any) => u.gocardlessSubscriptionId === subscriptionId);
          
          if (user) {
            await storage.updateUser(user.id, {
              gocardlessSubscriptionId: null,
              subscriptionTier: 'free',
              prospectLimit: 10
            });
          }
        }

        // Handle payment failures
        if (event.resource_type === 'payments' && event.action === 'failed') {
          console.warn(`Payment failed for payment ${event.links.payment}`);
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("GoCardless webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
