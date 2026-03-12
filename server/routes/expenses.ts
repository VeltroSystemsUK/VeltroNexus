import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { insertExpenseSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// List expenses (with optional filters)
router.get("/expenses", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let expenses = await storage.listExpenses(userId);

    // Apply optional filters
    const { from, to, category, status } = req.query;
    if (from) {
      const fromDate = new Date(from as string);
      expenses = expenses.filter((e) => new Date(e.date) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      expenses = expenses.filter((e) => new Date(e.date) <= toDate);
    }
    if (category) {
      expenses = expenses.filter((e) => e.category === category);
    }
    if (status) {
      expenses = expenses.filter((e) => e.status === status);
    }

    res.json(expenses);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Expense report — aggregated by category + monthly totals + mileage summary
// NOTE: Must be before /:id route to avoid "report" matching as an id
router.get("/expenses/report", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let expenses = await storage.listExpenses(userId);

    // Date range filter
    const { from, to } = req.query;
    if (from) {
      const fromDate = new Date(from as string);
      expenses = expenses.filter((e) => new Date(e.date) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      expenses = expenses.filter((e) => new Date(e.date) <= toDate);
    }

    // By category
    const byCategory: Record<string, { count: number; total: number }> = {};
    for (const e of expenses) {
      if (!byCategory[e.category]) {
        byCategory[e.category] = { count: 0, total: 0 };
      }
      byCategory[e.category].count++;
      byCategory[e.category].total += e.amount;
    }

    const categories = Object.entries(byCategory)
      .map(([category, data]) => ({
        category,
        count: data.count,
        total: Math.round(data.total) / 100, // convert pence to pounds
      }))
      .sort((a, b) => b.total - a.total);

    // Monthly totals
    const byMonth: Record<string, number> = {};
    for (const e of expenses) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] || 0) + e.amount;
    }

    const months = Object.entries(byMonth)
      .map(([month, total]) => {
        const [y, m] = month.split("-").map(Number);
        return {
          month,
          label: new Date(y, m - 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          total: Math.round(total) / 100,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    // Mileage summary
    const mileageExpenses = expenses.filter((e) => e.mileageDetails);
    const totalMiles = mileageExpenses.reduce((s, e) => s + (e.mileageDetails?.miles || 0), 0);
    const totalMileageCost = mileageExpenses.reduce((s, e) => s + e.amount, 0);

    const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      grandTotal: Math.round(grandTotal) / 100,
      expenseCount: expenses.length,
      categories,
      months,
      mileage: {
        totalMiles: Math.round(totalMiles * 10) / 10,
        totalCost: Math.round(totalMileageCost) / 100,
        claimCount: mileageExpenses.length,
      },
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Get single expense
router.get("/expenses/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid expense ID" });

    const userId = req.user!.id;
    const expense = await storage.getExpense(id, userId);
    if (!expense) return res.status(404).json({ error: "Expense not found" });

    res.json(expense);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Create expense
router.post("/expenses", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = insertExpenseSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: fromZodError(result.error).toString() });
    }

    const expense = await storage.createExpense(result.data, userId);
    res.json(expense);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Update expense
router.patch("/expenses/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid expense ID" });

    const userId = req.user!.id;
    const existing = await storage.getExpense(id, userId);
    if (!existing) return res.status(404).json({ error: "Expense not found" });

    const expense = await storage.updateExpense(id, userId, req.body);
    res.json(expense);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// Delete expense
router.delete("/expenses/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid expense ID" });

    const userId = req.user!.id;
    const existing = await storage.getExpense(id, userId);
    if (!existing) return res.status(404).json({ error: "Expense not found" });

    await storage.deleteExpense(id, userId);
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
