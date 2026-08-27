import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";

const router = Router();

// Stage-based probability of a deal closing (weighted forecast)
const STAGE_PROBABILITY: Record<string, number> = {
  lead: 0.05,
  contacted: 0.10,
  qualified: 0.25,
  packaging: 0.40,
  proposal: 0.40,
  "due-diligence": 0.60,
  due_diligence: 0.60,
  submission: 0.70,
  "further-information": 0.80,
  approval: 0.80,
  approved: 1.0,
  declined: 0,
  withdrawn: 0,
};

// How many months from now a deal at each stage is expected to close
const STAGE_MONTH_OFFSET: Record<string, number> = {
  lead: 4,
  contacted: 3,
  qualified: 2,
  packaging: 2,
  proposal: 2,
  "due-diligence": 1,
  due_diligence: 1,
  submission: 1,
  "further-information": 1,
  approval: 1,
  approved: 0,
  declined: 0,
  withdrawn: 0,
};

// Default commission rate (1%)
const DEFAULT_COMMISSION_RATE = 0.01;

router.get("/forecasts/revenue", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const prospects = await storage.listProspects(userId);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Build 12-month bucket structure
    const months: {
      month: string;
      label: string;
      forecast: number;
      approved: number;
      pipeline: number;
      dealCount: number;
    }[] = [];

    for (let i = 0; i < 12; i++) {
      const m = (currentMonth + i) % 12;
      const y = currentYear + Math.floor((currentMonth + i) / 12);
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = new Date(y, m).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      months.push({ month: monthStr, label, forecast: 0, approved: 0, pipeline: 0, dealCount: 0 });
    }

    let totalApproved = 0;
    let totalPipeline = 0;
    let dealCount = 0;
    let totalLoanValue = 0;

    for (const prospect of prospects) {
      const stage = (prospect.stage || "lead").toLowerCase();
      const probability = STAGE_PROBABILITY[stage] ?? 0;
      if (probability === 0) continue; // skip declined/withdrawn

      const loanAmount = prospect.loanAmount ? Number(prospect.loanAmount) / 100 : 0;
      if (loanAmount <= 0) continue;

      const commission = loanAmount * DEFAULT_COMMISSION_RATE;
      const weighted = commission * probability;
      const monthOffset = STAGE_MONTH_OFFSET[stage] ?? 2;

      // Clamp to 0–11 range
      const bucketIndex = Math.min(monthOffset, 11);

      dealCount++;
      totalLoanValue += loanAmount;

      if (stage === "approved") {
        months[bucketIndex].approved += weighted;
        totalApproved += weighted;
      } else {
        months[bucketIndex].pipeline += weighted;
        totalPipeline += weighted;
      }

      months[bucketIndex].forecast += weighted;
      months[bucketIndex].dealCount++;
    }

    // Round all values to 2 decimal places
    for (const m of months) {
      m.forecast = Math.round(m.forecast * 100) / 100;
      m.approved = Math.round(m.approved * 100) / 100;
      m.pipeline = Math.round(m.pipeline * 100) / 100;
    }

    const totalForecast = Math.round((totalApproved + totalPipeline) * 100) / 100;
    const approvedCount = prospects.filter((p) => (p.stage || "").toLowerCase() === "approved").length;
    const activeCount = prospects.filter((p) => {
      const s = (p.stage || "").toLowerCase();
      return s !== "declined" && s !== "withdrawn";
    }).length;

    res.json({
      months,
      totalForecast,
      totalApproved: Math.round(totalApproved * 100) / 100,
      totalPipeline: Math.round(totalPipeline * 100) / 100,
      summary: {
        avgDealSize: dealCount > 0 ? Math.round(totalLoanValue / dealCount) : 0,
        avgCommission: dealCount > 0 ? Math.round((totalForecast / dealCount) * 100) / 100 : 0,
        conversionRate: activeCount > 0 ? Math.round((approvedCount / activeCount) * 100) / 100 : 0,
        totalDeals: dealCount,
        commissionRate: DEFAULT_COMMISSION_RATE,
      },
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
