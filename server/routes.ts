import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertCompanySchema,
  insertProspectSchema,
  updateProspectStageSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Prospects API
  app.get("/api/prospects", async (_req, res) => {
    try {
      const prospects = await storage.listProspects();
      res.json(prospects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prospects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const prospect = await storage.getProspect(id);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prospects", async (req, res) => {
    try {
      const result = insertProspectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const prospect = await storage.createProspect(result.data);
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/prospects/:id/stage", async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      const result = updateProspectStageSchema.safeParse({ 
        prospectId, 
        stage: req.body.stage 
      });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const prospect = await storage.updateProspectStage(prospectId, result.data.stage);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/prospects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate updates using a partial schema
      const updateSchema = insertProspectSchema.pick({
        loanAmount: true,
        priority: true,
        notes: true,
      }).partial();
      
      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      
      const prospect = await storage.updateProspect(id, result.data);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Companies API
  app.get("/api/companies/:number", async (req, res) => {
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

  app.post("/api/companies", async (req, res) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
