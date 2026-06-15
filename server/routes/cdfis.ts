import { Router } from "express";
import { db } from "../db/index.js";
import { cdfis } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { CDFI, InsertCDFI, UpdateCDFI, cdfiSchema, insertCdfiSchema, updateCdfiSchema } from "../../shared/schema.js";
import { isAuthenticated } from "../auth.js";
import { ukCdfis } from "../data/cdfis.js";

const router = Router();

// Initialize database tables
router.post("/init", async (req, res) => {
  try {
    // Create tables if they don't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS cdfis (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        website TEXT,
        contact_name TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        postal_address TEXT,
        lending_min_quantum INTEGER,
        lending_max_quantum INTEGER,
        geographical_scope TEXT,
        preferred_client_types TEXT,
        background_info TEXT,
        last_contacted INTEGER,
        contact_outcome TEXT DEFAULT 'not_contacted',
        agreement_status TEXT DEFAULT 'unsigned',
        agreement_signed_date INTEGER,
        notes TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    res.json({ success: true, message: "Database initialized" });
  } catch (error) {
    console.error("Error initializing database:", error);
    res.status(500).json({ error: "Failed to initialize database" });
  }
});

// Seed database with UK CDFIs (public endpoint for initialization)
router.post("/seed", async (req, res) => {
  try {
    const userId = req.body.userId || "system";

    // Check if already seeded
    const existing = await db.select().from(cdfis).limit(1);
    if (existing.length > 0) {
      return res.json({ message: "CDFIs already seeded", count: existing.length });
    }

    // Insert all CDFIs
    const insertedCdfis = await Promise.all(
      ukCdfis.map(async (cdfi) => {
        const id = uuidv4();
        const newCdfi = {
          id,
          userId,
          name: cdfi.name,
          website: cdfi.website || null,
          contactName: cdfi.contactName || null,
          contactPhone: cdfi.contactPhone || null,
          contactEmail: cdfi.contactEmail || null,
          postalAddress: cdfi.postalAddress || null,
          lendingMinQuantum: cdfi.lendingMinQuantum || null,
          lendingMaxQuantum: cdfi.lendingMaxQuantum || null,
          geographicalScope: JSON.stringify(cdfi.geographicalScope || []),
          preferredClientTypes: JSON.stringify(cdfi.preferredClientTypes || []),
          backgroundInfo: cdfi.backgroundInfo || null,
          lastContacted: null,
          contactOutcome: "not_contacted",
          agreementStatus: "unsigned",
          agreementSignedDate: null,
          notes: null,
        };
        await db.insert(cdfis).values(newCdfi as any);
        return newCdfi;
      })
    );

    res.json({
      success: true,
      message: `Seeded ${insertedCdfis.length} CDFIs`,
      count: insertedCdfis.length,
    });
  } catch (error) {
    console.error("Error seeding CDFIs:", error);
    res.status(500).json({ error: "Failed to seed CDFIs" });
  }
});

// Get all CDFIs for the user
router.get("/", async (req, res) => {
  try {
    const userId = "system"; // Public endpoint during init phase

    const result = await db
      .select()
      .from(cdfis)
      .where(eq(cdfis.userId, userId));

    const cdfiList = result.map((cdfi) => ({
      ...cdfi,
      geographicalScope: cdfi.geographicalScope ? JSON.parse(cdfi.geographicalScope) : [],
      preferredClientTypes: cdfi.preferredClientTypes ? JSON.parse(cdfi.preferredClientTypes) : [],
    }));

    res.json(cdfiList);
  } catch (error) {
    console.error("Error fetching CDFIs:", error);
    res.status(500).json({ error: "Failed to fetch CDFIs" });
  }
});

// Get a single CDFI by ID
router.get("/:id", async (req, res) => {
  try {
    const userId = "system";
    const { id } = req.params;

    const result = await db
      .select()
      .from(cdfis)
      .where(and(eq(cdfis.id, id), eq(cdfis.userId, userId)))
      .limit(1);

    if (!result.length) {
      return res.status(404).json({ error: "CDFI not found" });
    }

    const cdfi = result[0];
    const formatted = {
      ...cdfi,
      geographicalScope: cdfi.geographicalScope ? JSON.parse(cdfi.geographicalScope) : [],
      preferredClientTypes: cdfi.preferredClientTypes ? JSON.parse(cdfi.preferredClientTypes) : [],
    };

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching CDFI:", error);
    res.status(500).json({ error: "Failed to fetch CDFI" });
  }
});

// Create a new CDFI
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;

    const validated = insertCdfiSchema.parse({
      ...body,
      userId,
    });

    const id = validated.id || uuidv4();

    const newCdfi: typeof cdfis.$inferInsert = {
      id,
      userId,
      name: validated.name,
      website: validated.website || null,
      contactName: validated.contactName || null,
      contactPhone: validated.contactPhone || null,
      contactEmail: validated.contactEmail || null,
      postalAddress: validated.postalAddress || null,
      lendingMinQuantum: validated.lendingMinQuantum || null,
      lendingMaxQuantum: validated.lendingMaxQuantum || null,
      geographicalScope: validated.geographicalScope ? JSON.stringify(validated.geographicalScope) : "[]",
      preferredClientTypes: validated.preferredClientTypes ? JSON.stringify(validated.preferredClientTypes) : "[]",
      backgroundInfo: validated.backgroundInfo || null,
      lastContacted: validated.lastContacted ? new Date(validated.lastContacted) : null,
      contactOutcome: validated.contactOutcome || "not_contacted",
      agreementStatus: validated.agreementStatus || "unsigned",
      agreementSignedDate: validated.agreementSignedDate ? new Date(validated.agreementSignedDate) : null,
      notes: validated.notes || null,
    };

    await db.insert(cdfis).values(newCdfi);

    const created = await db
      .select()
      .from(cdfis)
      .where(eq(cdfis.id, id))
      .limit(1);

    if (!created.length) {
      return res.status(500).json({ error: "Failed to create CDFI" });
    }

    const cdfi = created[0];
    const formatted = {
      ...cdfi,
      geographicalScope: cdfi.geographicalScope ? JSON.parse(cdfi.geographicalScope) : [],
      preferredClientTypes: cdfi.preferredClientTypes ? JSON.parse(cdfi.preferredClientTypes) : [],
    };

    res.status(201).json(formatted);
  } catch (error: any) {
    console.error("Error creating CDFI:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create CDFI" });
  }
});

// Update a CDFI
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const body = req.body;

    // Verify ownership
    const existing = await db
      .select()
      .from(cdfis)
      .where(and(eq(cdfis.id, id), eq(cdfis.userId, userId)))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: "CDFI not found" });
    }

    const validated = updateCdfiSchema.parse(body);

    const updates: Partial<typeof cdfis.$inferInsert> = {
      name: validated.name,
      website: validated.website || null,
      contactName: validated.contactName || null,
      contactPhone: validated.contactPhone || null,
      contactEmail: validated.contactEmail || null,
      postalAddress: validated.postalAddress || null,
      lendingMinQuantum: validated.lendingMinQuantum || null,
      lendingMaxQuantum: validated.lendingMaxQuantum || null,
      geographicalScope: validated.geographicalScope ? JSON.stringify(validated.geographicalScope) : undefined,
      preferredClientTypes: validated.preferredClientTypes ? JSON.stringify(validated.preferredClientTypes) : undefined,
      backgroundInfo: validated.backgroundInfo || null,
      lastContacted: validated.lastContacted ? new Date(validated.lastContacted) : undefined,
      contactOutcome: validated.contactOutcome,
      agreementStatus: validated.agreementStatus,
      agreementSignedDate: validated.agreementSignedDate ? new Date(validated.agreementSignedDate) : null,
      notes: validated.notes || null,
    };

    // Remove undefined values
    Object.keys(updates).forEach((key) => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]);

    await db.update(cdfis).set(updates).where(eq(cdfis.id, id));

    const updated = await db
      .select()
      .from(cdfis)
      .where(eq(cdfis.id, id))
      .limit(1);

    if (!updated.length) {
      return res.status(500).json({ error: "Failed to update CDFI" });
    }

    const cdfi = updated[0];
    const formatted = {
      ...cdfi,
      geographicalScope: cdfi.geographicalScope ? JSON.parse(cdfi.geographicalScope) : [],
      preferredClientTypes: cdfi.preferredClientTypes ? JSON.parse(cdfi.preferredClientTypes) : [],
    };

    res.json(formatted);
  } catch (error: any) {
    console.error("Error updating CDFI:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update CDFI" });
  }
});

// Delete a CDFI
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership
    const existing = await db
      .select()
      .from(cdfis)
      .where(and(eq(cdfis.id, id), eq(cdfis.userId, userId)))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: "CDFI not found" });
    }

    await db.delete(cdfis).where(eq(cdfis.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting CDFI:", error);
    res.status(500).json({ error: "Failed to delete CDFI" });
  }
});

// Bulk update contact outcome (mark as contacted, interested, etc.)
router.post("/:id/contact", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { outcome, notes } = req.body;

    const existing = await db
      .select()
      .from(cdfis)
      .where(and(eq(cdfis.id, id), eq(cdfis.userId, userId)))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: "CDFI not found" });
    }

    const updates = {
      contactOutcome: outcome,
      lastContacted: new Date(),
      notes: notes || existing[0].notes,
    };

    await db.update(cdfis).set(updates).where(eq(cdfis.id, id));

    const updated = await db
      .select()
      .from(cdfis)
      .where(eq(cdfis.id, id))
      .limit(1);

    if (!updated.length) {
      return res.status(500).json({ error: "Failed to update contact info" });
    }

    const cdfi = updated[0];
    const formatted = {
      ...cdfi,
      geographicalScope: cdfi.geographicalScope ? JSON.parse(cdfi.geographicalScope) : [],
      preferredClientTypes: cdfi.preferredClientTypes ? JSON.parse(cdfi.preferredClientTypes) : [],
    };

    res.json(formatted);
  } catch (error) {
    console.error("Error updating contact info:", error);
    res.status(500).json({ error: "Failed to update contact info" });
  }
});

// --- Firecrawl enrichment ---
// Scrapes each CDFI's live website to verify/refresh contact + lending details.
// Runs in the background because scraping all sites exceeds a single request's timeout.
let enrichmentRunning = false;

async function scrapeCdfiSite(url: string, firecrawlApiKey: string): Promise<any | null> {
  const schema = {
    type: "object",
    properties: {
      email: { type: "string", description: "Primary contact email address" },
      phone: { type: "string", description: "Primary contact phone number" },
      address: { type: "string", description: "Postal address" },
      description: { type: "string", description: "Short description of their lending services" },
      minLoan: { type: "number", description: "Minimum loan amount in GBP" },
      maxLoan: { type: "number", description: "Maximum loan amount in GBP" },
    },
  };

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["json"],
      jsonOptions: {
        prompt:
          "Extract the lender's primary contact email, contact phone, postal address, a short description of their lending services, and minimum/maximum loan amounts in GBP. " +
          "CRITICAL: Only use information that is explicitly present on the page. If a value is not shown, leave that field empty. " +
          "Never invent, guess, or fill fields with placeholder or example values such as '123-456-7890', '123 Main Street', '123 Business Lane', or 'example@example.com'.",
        schema,
      },
    }),
  });

  if (!resp.ok) {
    console.warn(`[CDFI Enrich] Scrape failed for ${url}: ${resp.status}`);
    return null;
  }
  const data = await resp.json();
  return data?.data?.json || null;
}

// Guard against LLM-hallucinated placeholder values (e.g. "123-456-7890", "123 Main St").
function isFakePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return true;
  if (/^(1234567890|0123456789|1234567|0000000|1111111)/.test(digits)) return true;
  if (/^(\d)\1+$/.test(digits)) return true; // all same digit
  return false;
}

function isFakeAddress(addr: string): boolean {
  return /\b123\s+(business|main|sample|example|test|fake|any)\b/i.test(addr) ||
    /\b(example|sample|placeholder|lorem ipsum|your address|street name)\b/i.test(addr);
}

function isFakeEmail(email: string): boolean {
  return /@(example|sample|test|domain|email)\.(com|org|net)$/i.test(email) ||
    /^(your|name|email|info)@(example|domain)/i.test(email);
}

async function runEnrichment(userId: string, firecrawlApiKey: string) {
  enrichmentRunning = true;
  let updated = 0;
  try {
    const rows = await db.select().from(cdfis).where(eq(cdfis.userId, userId));
    console.log(`[CDFI Enrich] Starting enrichment for ${rows.length} CDFIs`);

    for (const row of rows) {
      if (!row.website) continue;
      try {
        const scraped = await scrapeCdfiSite(row.website, firecrawlApiKey);
        if (!scraped) continue;

        // Merge scraped values over existing — only overwrite when scraping found
        // a real value (reject hallucinated placeholders).
        const updates: Record<string, any> = {};
        if (scraped.email && !isFakeEmail(scraped.email)) updates.contactEmail = scraped.email;
        if (scraped.phone && !isFakePhone(scraped.phone)) updates.contactPhone = scraped.phone;
        if (scraped.address && !isFakeAddress(scraped.address)) updates.postalAddress = scraped.address;
        if (scraped.description) updates.backgroundInfo = scraped.description;
        if (typeof scraped.minLoan === "number" && scraped.minLoan > 0) updates.lendingMinQuantum = scraped.minLoan;
        if (typeof scraped.maxLoan === "number" && scraped.maxLoan > 0) updates.lendingMaxQuantum = scraped.maxLoan;

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();
          await db.update(cdfis).set(updates).where(eq(cdfis.id, row.id));
          updated++;
          console.log(`[CDFI Enrich] Updated ${row.name} (${Object.keys(updates).length - 1} fields)`);
        }
      } catch (err) {
        console.warn(`[CDFI Enrich] Error enriching ${row.name}:`, err);
      }
    }
    console.log(`[CDFI Enrich] Complete. Updated ${updated}/${rows.length} CDFIs`);
  } catch (err) {
    console.error("[CDFI Enrich] Fatal error:", err);
  } finally {
    enrichmentRunning = false;
  }
}

// Trigger background Firecrawl enrichment of all CDFIs for the user
router.post("/enrich", isAuthenticated, async (req, res) => {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) {
    return res.status(400).json({ error: "Firecrawl API key not configured" });
  }
  if (enrichmentRunning) {
    return res.json({ message: "Enrichment already in progress", status: "running" });
  }

  // CDFIs are stored under the shared "system" owner (see seed/list routes),
  // so enrich those rather than the logged-in user's (empty) set.
  void runEnrichment("system", firecrawlApiKey);

  res.json({ message: "Firecrawl enrichment started in background", status: "started" });
});

// Sign agreement
router.post("/:id/sign-agreement", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await db
      .select()
      .from(cdfis)
      .where(and(eq(cdfis.id, id), eq(cdfis.userId, userId)))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: "CDFI not found" });
    }

    const updates = {
      agreementStatus: "signed",
      agreementSignedDate: new Date(),
    };

    await db.update(cdfis).set(updates).where(eq(cdfis.id, id));

    const updated = await db
      .select()
      .from(cdfis)
      .where(eq(cdfis.id, id))
      .limit(1);

    if (!updated.length) {
      return res.status(500).json({ error: "Failed to sign agreement" });
    }

    const cdfi = updated[0];
    const formatted = {
      ...cdfi,
      geographicalScope: cdfi.geographicalScope ? JSON.parse(cdfi.geographicalScope) : [],
      preferredClientTypes: cdfi.preferredClientTypes ? JSON.parse(cdfi.preferredClientTypes) : [],
    };

    res.json(formatted);
  } catch (error) {
    console.error("Error signing agreement:", error);
    res.status(500).json({ error: "Failed to sign agreement" });
  }
});

export default router;
