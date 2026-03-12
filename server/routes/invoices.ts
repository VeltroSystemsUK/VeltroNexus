import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { insertInvoiceSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// List all invoices for the current user
router.get("/invoices", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const invoices = await storage.listInvoices(userId);
    res.json(invoices);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Get a single invoice
router.get("/invoices/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid invoice ID" });

    const userId = req.user!.id;
    const invoice = await storage.getInvoice(id, userId);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    res.json(invoice);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Generate next invoice number
router.get("/invoices/next-number", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const invoiceNumber = await storage.getNextInvoiceNumber(userId);
    res.json({ invoiceNumber });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Create a new invoice
router.post("/invoices", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = insertInvoiceSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: fromZodError(result.error).toString() });
    }

    const invoice = await storage.createInvoice(result.data, userId);
    res.json(invoice);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Update an invoice
router.patch("/invoices/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid invoice ID" });

    const userId = req.user!.id;
    const existing = await storage.getInvoice(id, userId);
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const invoice = await storage.updateInvoice(id, userId, req.body);
    res.json(invoice);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Delete an invoice (drafts only)
router.delete("/invoices/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid invoice ID" });

    const userId = req.user!.id;
    const existing = await storage.getInvoice(id, userId);
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.status !== "draft") {
      return res.status(400).json({ error: "Only draft invoices can be deleted" });
    }

    await storage.deleteInvoice(id, userId);
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Mark invoice as sent
router.post("/invoices/:id/send", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid invoice ID" });

    const userId = req.user!.id;
    const existing = await storage.getInvoice(id, userId);
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.status !== "draft") {
      return res.status(400).json({ error: "Only draft invoices can be sent" });
    }

    const invoice = await storage.updateInvoice(id, userId, { status: "sent" } as any);
    res.json(invoice);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Mark invoice as paid
router.post("/invoices/:id/mark-paid", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid invoice ID" });

    const userId = req.user!.id;
    const existing = await storage.getInvoice(id, userId);
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.status === "paid") {
      return res.status(400).json({ error: "Invoice is already paid" });
    }

    const invoice = await storage.updateInvoice(id, userId, {
      status: "paid",
      paidDate: new Date(),
    } as any);
    res.json(invoice);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
