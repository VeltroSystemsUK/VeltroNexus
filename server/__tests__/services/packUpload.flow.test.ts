import fs from "fs";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { storage } from "../../storage";
import { getPublicPack, saveFundingReason, savePackFiles } from "../../services/packUpload";

const tmpDir = path.join(process.cwd(), "uploads", "deal-packs", "test-flow");

describe("customer pack upload flow", () => {
  let token = "";

  it("stores files and the funding reason on the deal", async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, "june-statement.pdf");
    fs.writeFileSync(filePath, "%PDF-1.4 test bank statement");

    const deal = await storage.createAgenticDeal({
      source: "strata_inbound",
      stage: "fulfilment",
      status: "waiting_timer",
      ownerUserId: "pack-upload-test",
      companyName: "Pack Upload Test Ltd",
      contactName: "Test Director",
    });
    token = deal.uploadToken || "";
    expect(token.length).toBeGreaterThan(10);

    const afterFiles = await savePackFiles(token, "bank_statements", [
      {
        originalname: "june-statement.pdf",
        mimetype: "application/pdf",
        size: 24,
        path: filePath,
      },
    ]);
    expect(afterFiles.hasBankStatements).toBe(true);
    expect(afterFiles.documents[0].fileName).toBe("june-statement.pdf");
    expect(afterFiles.companyName).toBe("Pack Upload Test Ltd");

    const afterReason = await saveFundingReason(token, "Refinance stacked short-term loans.");
    expect(afterReason.hasReason).toBe(true);

    const loaded = await getPublicPack(token);
    expect(loaded?.hasBankStatements).toBe(true);
    expect(loaded?.fundingReason).toMatch(/stacked short-term/);
  });

  it("rejects a missing token", async () => {
    expect(await getPublicPack("does-not-exist")).toBeNull();
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });
});
