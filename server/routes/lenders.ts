import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { researchLender } from "../services/lenderResearch";
import { lenderEnrichmentService, EnrichmentModule } from "../services/lenderEnrichmentService";
import {
    generateRecommendations,
    getTopRecommendations,
} from "../services/lenderRecommendationEngine";
import { lenderNoteSchema, insertLenderNoteSchema, insertLenderSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import busboy from "busboy";
import * as fs from "fs";
import * as path from "path";

const router = Router();


  // Logo Upload Endpoint
  router.post("/api/lenders/upload-logo", isAuthenticated, (req, res) => {
    const busboyInstance = busboy({ headers: req.headers });
    const logosDir = path.resolve("client/public/logos");

    // Ensure directory (should exist from migration, but be safe)
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }

    let fileUploaded = false;

    busboyInstance.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;

      // Basic validation
      if (!mimeType.startsWith("image/")) {
        file.resume(); // discard
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      const ext = path.extname(filename) || ".png";
      const newFilename = `upload-${Date.now()}-${Math.round(Math.random() * 1000)}${ext}`;
      const saveTo = path.join(logosDir, newFilename);

      const writeStream = fs.createWriteStream(saveTo);
      file.pipe(writeStream);

      writeStream.on("finish", () => {
        fileUploaded = true;
        res.json({ logoUrl: `/logos/${newFilename}` });
      });

      writeStream.on("error", (err) => {
        console.error("Upload write error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Failed to save file" });
      });
    });

    busboyInstance.on("error", (err) => {
      console.error("Busboy error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Upload failed" });
    });

    busboyInstance.on("finish", () => {
      if (!fileUploaded && !res.headersSent) {
        res.status(400).json({ error: "No file uploaded" });
      }
    });

    req.pipe(busboyInstance);
  });


  // AI Lender Research Endpoint
  router.post("/api/lenders/:id/research", isAuthenticated, async (req, res) => {
    try {
      const lenderId = parseInt(req.params.id);
      if (isNaN(lenderId)) return res.status(400).json({ error: "Invalid lender ID" });

      const { targetField } = req.body;
      const result = await researchLender(lenderId, req.user!.id, { targetField });
      res.json(result);
    } catch (err: any) {
      console.error("AI Research Error:", err);
      res.status(500).json({ error: err.message || "Financial intelligence gathering failed" });
    }
  });

  router.post("/api/lenders/research-prospect", isAuthenticated, async (req, res) => {
    try {
      const { name, website, targetField } = req.body;
      if (!name) return res.status(400).json({ error: "Lender name is required" });

      const result = await researchLender(null, req.user!.id, {
        name,
        website,
        targetField,
      });
      res.json(result);
    } catch (err: any) {
      console.error("AI Prospect Research Error:", err);
      res.status(500).json({ error: err.message || "Financial intelligence gathering failed" });
    }
  });

  // Modular Lender Enrichment Agent
  router.post(
    "/api/lenders/:id/enrich/:module",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const lenderId = parseInt(req.params.id);
        const module = req.params.module as EnrichmentModule;
        const userId = req.user!.id;
        const { name, website } = req.body;

        const result = await lenderEnrichmentService.enrichLenderModule(lenderId, userId, module, {
          name,
          website,
        });

        // Return the proposed updates for Managed Autonomy (frontend review)
        res.json(result);
      } catch (error: any) {
        console.error(`[Lender Agent] Enrichment failed for ${req.params.module}:`, error);
        res.status(500).json({ message: error.message || "Enrichment failed" });
      }
    }
  );

  router.post("/api/lenders/bulk-upload", isAuthenticated, async (req, res) => {
    try {
      const { lenders } = req.body;
      if (!Array.isArray(lenders)) {
        return res.status(400).json({ error: "Expected an array of lenders" });
      }

      const results = [];
      const userId = req.user!.id;

      for (const lenderData of lenders) {
        // Basic validation and default values

        const lender = {

          ...lenderData,
          isFavourite: 0,
          introducerAgreementSigned: 0,
          isGlobal: 0,
          panelStatus: lenderData.panelStatus || "market",
          lenderType: lenderData.lenderType || "specialist_lender",
        };
        const created = await storage.createLender(lender, userId);
        results.push(created);
      }

      res.status(201).json({ count: results.length, lenders: results });
    } catch (err: any) {
      console.error("Bulk Upload Error:", err);
      res.status(500).json({ error: err.message || "Bulk upload failed" });
    }
  });

  // Lenders API - Protected routes
  router.get("/api/lenders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const lenders = await storage.listLenders({
        userId: req.user!.id,
        includeGlobal: true,
      });
      res.json(lenders);
    } catch (error) {
      console.error("Error fetching lenders:", error);
      res.status(500).json({ message: "Failed to fetch lenders" });
    }
  });

  router.get("/api/lenders/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const lenderId = parseInt(req.params.id);
      const lender = await storage.getLender(lenderId);

      if (!lender) {
        return res.status(404).json({ message: "Lender not found" });
      }

      res.json(lender);
    } catch (error) {
      console.error("Error fetching lender:", error);
      res.status(500).json({ message: "Failed to fetch lender" });
    }
  });

  // Fetch a logo for a lender based on website or name
  router.post(
    "/api/lenders/lookup-logo",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { website, name } = req.body;
        const { findLogoUrl } = await import("../utils/logoFetcher");

        const result = await findLogoUrl({ website, name });

        res.json(result);
      } catch (error) {
        console.error("Error fetching logo:", error);
        res.status(500).json({ error: "Failed to fetch logo" });
      }
    }
  );

  router.post("/api/lenders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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

  router.patch(
    "/api/lenders/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const lenderId = parseInt(req.params.id);
        const action = req.query.action as string;
        const redirect = req.query.redirect as string | undefined;
        const message = req.query.message as string | undefined;
        const result = insertLenderSchema.partial().safeParse(req.body);

        if (!result.success) {
          const validationError = fromZodError(result.error);
          return res.status(400).json({ message: validationError.toString() });
        }

        const isAdmin = req.user!.role === "super_admin";
        const lender = await storage.updateLender(lenderId, userId, result.data, isAdmin);

        if (!lender) {
          return res.status(404).json({ message: "Lender not found" });
        }

        res.json(lender);
      } catch (error) {
        console.error("Error updating lender:", error);
        res.status(500).json({ message: "Failed to update lender" });
      }
    }
  );

  router.delete(
    "/api/lenders/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const lenderId = parseInt(req.params.id);
        const isAdmin = req.user!.role === "super_admin";

        await storage.deleteLender(lenderId, userId, isAdmin);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting lender:", error);
        res.status(500).json({ message: "Failed to delete lender" });
      }
    }
  );

  // Lender Search with filters
  router.get(
    "/api/lenders/search",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const filters = {
          search: req.query.search as string,
          lenderType: req.query.lenderType as string,
          productType: req.query.productType as string,
          minLoanAmount: req.query.minLoanAmount
            ? parseInt(req.query.minLoanAmount as string)
            : undefined,
          maxLoanAmount: req.query.maxLoanAmount
            ? parseInt(req.query.maxLoanAmount as string)
            : undefined,
          sector: req.query.sector as string,
          region: req.query.region as string,
          panelStatus: req.query.panelStatus as string,
        };
        const lenders = await storage.listLenders({ ...filters });
        res.json(lenders);
      } catch (error) {
        console.error("Error searching lenders:", error);
        res.status(500).json({ message: "Failed to search lenders" });
      }
    }
  );

  // Lender Recommendations for a Prospect
  router.get(
    "/api/prospects/:prospectId/recommendations",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
        const includeDisqualified = req.query.includeDisqualified === "true";

        if (isNaN(prospectId)) {
          return res.status(400).json({ message: "Invalid prospect ID" });
        }

        let result;
        if (includeDisqualified) {
          result = await generateRecommendations(userId, prospectId);
        } else {
          result = await getTopRecommendations(userId, prospectId, limit);
        }

        res.json(result);
      } catch (error: any) {
        console.error("Error generating lender recommendations:", error);
        if (error.message === "Prospect not found") {
          return res.status(404).json({ message: "Prospect not found" });
        }
        res.status(500).json({ message: "Failed to generate lender recommendations" });
      }
    }
  );

  // Get lender with products
  router.get(
    "/api/lenders/:id/full",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const lenderId = parseInt(req.params.id);
        const lender = await storage.getLenderWithProducts(lenderId);

        if (!lender) {
          return res.status(404).json({ message: "Lender not found" });
        }

        // Also get interactions (user-scoped)
        const interactions = await storage.listLenderInteractions(lenderId, userId);

        res.json({ ...lender, interactions });
      } catch (error) {
        console.error("Error fetching lender details:", error);
        res.status(500).json({ message: "Failed to fetch lender details" });
      }
    }
  );

  // Lender Products API (user-scoped via lender ownership)
  router.get(
    "/api/lenders/:lenderId/products",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const lenderId = parseInt(req.params.lenderId);
        const userId = req.user!.id;
        const products = await storage.listLenderProducts(lenderId);
        res.json(products);
      } catch (error) {
        console.error("Error fetching lender products:", error);
        res.status(500).json({ message: "Failed to fetch lender products" });
      }
    }
  );

  router.post(
    "/api/lenders/:lenderId/products",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const lenderId = parseInt(req.params.lenderId);
        const userId = req.user!.id;
        const productData = { ...req.body, lenderId };
        const product = await storage.createLenderProduct(productData);
        if (!product) {
          return res
            .status(403)
            .json({ message: "Access denied - lender not found or not owned by user" });
        }
        res.status(201).json(product);
      } catch (error) {
        console.error("Error creating lender product:", error);
        res.status(500).json({ message: "Failed to create lender product" });
      }
    }
  );

  router.patch(
    "/api/lender-products/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const productId = parseInt(req.params.id);
        const userId = req.user!.id;
        const product = await storage.updateLenderProduct(productId, userId, req.body);

        if (!product) {
          return res.status(404).json({ message: "Product not found or access denied" });
        }

        res.json(product);
      } catch (error) {
        console.error("Error updating lender product:", error);
        res.status(500).json({ message: "Failed to update lender product" });
      }
    }
  );

  router.delete(
    "/api/lender-products/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const productId = parseInt(req.params.id);
        const userId = req.user!.id;
        const deleted = await storage.deleteLenderProduct(productId, userId);
        if (!deleted) {
          return res.status(404).json({ message: "Product not found or access denied" });
        }
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting lender product:", error);
        res.status(500).json({ message: "Failed to delete lender product" });
      }
    }
  );

  // Lender Interactions API (user-scoped via lender ownership)
  router.get(
    "/api/lenders/:lenderId/interactions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const lenderId = parseInt(req.params.lenderId);
        const userId = req.user!.id;
        const interactions = await storage.listLenderInteractions(lenderId, userId);
        res.json(interactions);
      } catch (error) {
        console.error("Error fetching lender interactions:", error);
        res.status(500).json({ message: "Failed to fetch lender interactions" });
      }
    }
  );

  router.get(
    "/api/lender-interactions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const interactions = await storage.listUserLenderInteractions(userId);
        res.json(interactions);
      } catch (error) {
        console.error("Error fetching user lender interactions:", error);
        res.status(500).json({ message: "Failed to fetch lender interactions" });
      }
    }
  );

  router.post(
    "/api/lender-interactions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const { sentAt, respondedAt, ...rest } = req.body;
        const interactionData = {
          ...rest,
          sentAt: sentAt ? new Date(sentAt) : new Date(),
          respondedAt: respondedAt ? new Date(respondedAt) : undefined,
        };
        const interaction = await storage.createLenderInteraction(interactionData, userId);
        if (!interaction) {
          return res
            .status(403)
            .json({ message: "Access denied - lender not found or not owned by user" });
        }

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
    }
  );

  router.patch(
    "/api/lender-interactions/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const interactionId = parseInt(req.params.id);
        const userId = req.user!.id;
        const interaction = await storage.updateLenderInteraction(interactionId, req.body, userId);

        if (!interaction) {
          return res.status(404).json({ message: "Interaction not found or access denied" });
        }

        res.json(interaction);
      } catch (error) {
        console.error("Error updating lender interaction:", error);
        res.status(500).json({ message: "Failed to update lender interaction" });
      }
    }
  );

  router.delete(
    "/api/lender-interactions/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const interactionId = parseInt(req.params.id);
        const userId = req.user!.id;
        const deleted = await storage.deleteLenderInteraction(interactionId, userId);
        if (!deleted) {
          return res.status(404).json({ message: "Interaction not found or access denied" });
        }
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting lender interaction:", error);
        res.status(500).json({ message: "Failed to delete lender interaction" });
      }
    }
  );

  router.get(
    "/api/lenders/:id/notes",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const lenderId = parseInt(req.params.id);
        if (isNaN(lenderId)) return res.status(400).json({ error: "Invalid lender ID" });
        const notes = await storage.listLenderNotes(lenderId);
        res.json(notes);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.post(
    "/api/lenders/:id/notes",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const lenderId = parseInt(req.params.id);
        const userId = req.user!.id;
        if (isNaN(lenderId)) return res.status(400).json({ error: "Invalid lender ID" });

        const result = insertLenderNoteSchema.safeParse({ ...req.body, lenderId, userId });
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).message });
        }

        const note = await storage.createLenderNote(result.data);
        res.status(201).json(note);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.delete(
    "/api/lenders/notes/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
        if (isNaN(id)) return res.status(400).json({ error: "Invalid note ID" });

        const success = await storage.deleteLenderNote(id, userId);
        if (!success) return res.status(404).json({ error: "Note not found or unauthorized" });
        res.sendStatus(200);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );


export default router;
