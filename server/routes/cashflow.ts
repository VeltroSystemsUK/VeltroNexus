import { Router } from "express";
import type { Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import {
  isRevolutConfigured,
  getAccounts,
  getTransactions,
} from "../utils/revolutClient";

const router = Router();

// Check if Revolut is connected
router.get("/cashflow/status", isAuthenticated, (_req: Request, res: Response) => {
  res.json({ connected: isRevolutConfigured() });
});

// Get all accounts with balances
router.get("/cashflow/accounts", isAuthenticated, async (_req: Request, res: Response) => {
  try {
    if (!isRevolutConfigured()) {
      return res.status(400).json({ error: "Revolut API not configured" });
    }
    const accounts = await getAccounts();
    res.json(accounts);
  } catch (error) {
    handleApiError(res, error, "cashflow-accounts");
  }
});

// Get transactions with optional date range
router.get("/cashflow/transactions", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isRevolutConfigured()) {
      return res.status(400).json({ error: "Revolut API not configured" });
    }
    const { from, to, count } = req.query;
    const transactions = await getTransactions(
      from as string | undefined,
      to as string | undefined,
      count ? parseInt(count as string, 10) : 100
    );
    res.json(transactions);
  } catch (error) {
    handleApiError(res, error, "cashflow-transactions");
  }
});

// Aggregated summary — balances + monthly inflows/outflows + category breakdown
router.get("/cashflow/summary", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isRevolutConfigured()) {
      return res.status(400).json({ error: "Revolut API not configured" });
    }

    // Fetch accounts and last 6 months of transactions in parallel
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().split("T")[0];

    const [accounts, transactions] = await Promise.all([
      getAccounts(),
      getTransactions(fromDate, undefined, 1000),
    ]);

    // Total balance across all accounts
    const totalBalance = accounts.reduce(
      (sum: number, acc: any) => sum + (acc.balance || 0),
      0
    );

    // Group accounts by currency
    const accountSummaries = accounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name || acc.currency,
      currency: acc.currency,
      balance: acc.balance || 0,
      state: acc.state,
    }));

    // Monthly inflows/outflows — 6-month buckets
    const now = new Date();
    const monthBuckets: {
      month: string;
      label: string;
      inflows: number;
      outflows: number;
    }[] = [];

    for (let i = -5; i <= 0; i++) {
      const m = (now.getMonth() + i + 12) % 12;
      const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = new Date(y, m).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      monthBuckets.push({ month: monthStr, label, inflows: 0, outflows: 0 });
    }

    // Category breakdown
    const categoryMap: Record<string, { count: number; total: number }> = {};

    for (const tx of transactions) {
      const amount = tx.legs?.[0]?.amount || tx.amount || 0;
      const txDate = new Date(tx.created_at || tx.completed_at);
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;

      const bucket = monthBuckets.find((b) => b.month === monthKey);
      if (bucket) {
        if (amount > 0) {
          bucket.inflows += amount;
        } else {
          bucket.outflows += Math.abs(amount);
        }
      }

      // Category
      const type = tx.type || "other";
      if (!categoryMap[type]) {
        categoryMap[type] = { count: 0, total: 0 };
      }
      categoryMap[type].count++;
      categoryMap[type].total += Math.abs(amount);
    }

    // Round bucket values
    for (const b of monthBuckets) {
      b.inflows = Math.round(b.inflows * 100) / 100;
      b.outflows = Math.round(b.outflows * 100) / 100;
    }

    const categories = Object.entries(categoryMap)
      .map(([type, data]) => ({
        type,
        label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        count: data.count,
        total: Math.round(data.total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    // Recent transactions (latest 50)
    const recentTransactions = transactions.slice(0, 50).map((tx: any) => ({
      id: tx.id,
      date: tx.created_at || tx.completed_at,
      description: tx.reference || tx.legs?.[0]?.description || tx.type || "—",
      amount: tx.legs?.[0]?.amount || tx.amount || 0,
      currency: tx.legs?.[0]?.currency || tx.currency || "GBP",
      type: tx.type,
      state: tx.state,
      counterparty: tx.legs?.[0]?.counterparty?.account_name || null,
    }));

    res.json({
      totalBalance,
      accounts: accountSummaries,
      months: monthBuckets,
      categories,
      recentTransactions,
    });
  } catch (error) {
    handleApiError(res, error, "cashflow-summary");
  }
});

export default router;
