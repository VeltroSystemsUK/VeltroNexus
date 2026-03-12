import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";

const router = Router();

// Get income summary — monthly chart data + totals from paid invoices
router.get("/income/summary", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const invoices = await storage.listInvoices(userId);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Build 12-month buckets (rolling, starting 11 months ago)
    const months: {
      month: string;
      label: string;
      income: number;
      invoiceCount: number;
    }[] = [];

    for (let i = -11; i <= 0; i++) {
      const m = (currentMonth + i + 12) % 12;
      const y = currentYear + Math.floor((currentMonth + i) / 12);
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = new Date(y, m).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      months.push({ month: monthStr, label, income: 0, invoiceCount: 0 });
    }

    let totalYTD = 0;
    let thisMonth = 0;
    let lastMonth = 0;
    let outstanding = 0;

    const paidInvoices: typeof invoices = [];

    for (const inv of invoices) {
      if (inv.status === "paid" && inv.paidDate) {
        const pd = new Date(inv.paidDate);
        const amountGBP = (inv.amount || 0) / 100;

        paidInvoices.push(inv);

        // Bucket into monthly chart
        const monthKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`;
        const bucket = months.find((m) => m.month === monthKey);
        if (bucket) {
          bucket.income += amountGBP;
          bucket.invoiceCount++;
        }

        // YTD calculation
        if (pd.getFullYear() === currentYear) {
          totalYTD += amountGBP;
        }

        // This month
        if (pd.getFullYear() === currentYear && pd.getMonth() === currentMonth) {
          thisMonth += amountGBP;
        }

        // Last month
        const lastM = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastY = currentMonth === 0 ? currentYear - 1 : currentYear;
        if (pd.getFullYear() === lastY && pd.getMonth() === lastM) {
          lastMonth += amountGBP;
        }
      }

      // Outstanding = sent but unpaid
      if (inv.status === "sent") {
        outstanding += (inv.amount || 0) / 100;
      }
    }

    // Round values
    for (const m of months) {
      m.income = Math.round(m.income * 100) / 100;
    }

    res.json({
      months,
      thisMonth: Math.round(thisMonth * 100) / 100,
      lastMonth: Math.round(lastMonth * 100) / 100,
      yearToDate: Math.round(totalYTD * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      paidInvoices: paidInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        amount: (inv.amount || 0) / 100,
        paidDate: inv.paidDate,
      })),
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
