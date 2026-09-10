import { describe, expect, it } from "vitest";
import {
  ENGAGEMENT_PACK_VERSION,
  applySignature,
  fillFromDeal,
  isLiveSigned,
  populateBlocks,
  populateText,
  privacyNoticeBlocks,
  engagementLetterBlocks,
  validateSignPayload,
} from "@shared/engagementPack";
import { FACTORY_EDGES, FACTORY_NODES, nodeForDeal } from "@shared/factoryGraph";

const sampleFill = fillFromDeal({
  companyName: "Hartley Joinery Ltd",
  placeAddress: "14 Mill Lane, Nottingham, NG1 1AA",
  loanAmount: 250000,
  fundingReason: "Refinance stacked MCA",
  contactName: "Jane Hartley",
});

describe("engagement pack populate", () => {
  it("fills client name, address and amount and never leaves XXX placeholders", () => {
    expect(sampleFill.clientName).toBe("Hartley Joinery Ltd");
    expect(sampleFill.clientAddress).toMatch(/14 Mill Lane/);
    expect(sampleFill.amount).toMatch(/£250,000/);
    expect(sampleFill.purpose).toMatch(/Refinance stacked MCA/i);
    const letter = populateText("The Client is {{clientName}} of {{clientAddress}} seeking {{amount}}.", sampleFill);
    expect(letter).toContain("Hartley Joinery Ltd");
    expect(letter).not.toMatch(/XXX/i);
  });

  it("keeps labeled blanks when a deal field is missing, instead of inventing figures", () => {
    const fill = fillFromDeal({ companyName: "Oak & Ash Ltd" });
    expect(fill.clientName).toBe("Oak & Ash Ltd");
    expect(fill.amount).toBe("To be confirmed");
    expect(fill.clientAddress).toBe("As on file");
    expect(fill.purpose).toBe("Business Loan");
    expect(fill.term).toBe("Up to 5 years");
    expect(fill.rate).toBe("To be confirmed");
    expect(fill.security).toMatch(/Directors Personal Guarantees/i);
  });

  it("versions the live pack as 2026-09-v1 and both documents carry the legal source wording", () => {
    expect(ENGAGEMENT_PACK_VERSION).toBe("2026-09-v1");
    const flatten = (blocks: ReturnType<typeof privacyNoticeBlocks>) =>
      populateBlocks(blocks, sampleFill)
        .map((block) => {
          if (block.type === "kv") return block.rows.map((row) => `${row.label} ${row.value}`).join(" ");
          if (block.type === "list") return block.items.join(" ");
          if (block.type === "callout") return `${block.title} ${block.body}`;
          if ("text" in block) return block.text;
          return "";
        })
        .join(" ");
    const privacy = flatten(privacyNoticeBlocks());
    const letter = flatten(engagementLetterBlocks());
    expect(privacy).toMatch(/Z7480727/);
    expect(privacy).toMatch(/FRN 733615/);
    expect(privacy).toMatch(/share your details with Lenders/i);
    expect(letter).toMatch(/£5,000 for the first £100,000/);
    expect(letter).toMatch(/Forecast Fee is £1,000/);
    expect(letter).toMatch(/typically £2,750/);
    expect(letter).toMatch(/Hartley Joinery Ltd/);
    expect(letter).toMatch(/NACFB/);
  });
});

describe("engagement pack e-sign", () => {
  it("rejects a signature without a typed name or both document ticks", () => {
    expect(validateSignPayload({ name: "", privacyAccepted: true, termsAccepted: true }).ok).toBe(false);
    expect(validateSignPayload({ name: "Jane Hartley", privacyAccepted: false, termsAccepted: true }).ok).toBe(false);
    expect(validateSignPayload({ name: "Jane Hartley", privacyAccepted: true, termsAccepted: false }).ok).toBe(false);
    expect(validateSignPayload({ name: "Jane Hartley", privacyAccepted: true, termsAccepted: true }).ok).toBe(true);
  });

  it("records a live signature and voids it when the pack version changes", () => {
    const signed = applySignature(
      { status: "sent", version: ENGAGEMENT_PACK_VERSION },
      { name: "Jane Hartley", privacyAccepted: true, termsAccepted: true },
      { at: "2026-09-08T10:00:00.000Z", ip: "1.2.3.4" },
    );
    expect(isLiveSigned(signed)).toBe(true);
    expect(signed.signedName).toBe("Jane Hartley");
    expect(signed.privacyAccepted).toBe(true);
    expect(signed.termsAccepted).toBe(true);
    expect(isLiveSigned({ ...signed, version: "placeholder-v1" })).toBe(false);
    expect(isLiveSigned({ status: "signed", version: ENGAGEMENT_PACK_VERSION })).toBe(false);
  });
});

describe("factory graph engagement gate", () => {
  it("puts engagement between credit and sterling on the path to David", () => {
    const ids = new Set(FACTORY_NODES.map((node) => node.id));
    expect(ids.has("engagement")).toBe(true);
    expect(FACTORY_NODES.find((node) => node.id === "engagement")?.desk).toBe("Customer");
    expect(FACTORY_EDGES.some((edge) => edge.source === "credit" && edge.target === "engagement")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "engagement" && edge.target === "sterling")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "sterling" && edge.target === "david")).toBe(true);
    expect(FACTORY_EDGES.some((edge) => edge.source === "credit" && edge.target === "sterling")).toBe(false);
  });

  it("holds a completed file on engagement until the live pack is signed", () => {
    expect(
      nodeForDeal({
        stage: "complete",
        status: "complete",
        source: "strata_inbound",
      }),
    ).toBe("engagement");
    expect(
      nodeForDeal({
        stage: "complete",
        status: "complete",
        source: "strata_inbound",
        engagement: {
          status: "signed",
          version: ENGAGEMENT_PACK_VERSION,
          signedName: "Jane Hartley",
          privacyAccepted: true,
          termsAccepted: true,
        },
      }),
    ).toBe("sterling");
    expect(
      nodeForDeal({
        stage: "complete",
        status: "complete",
        source: "strata_inbound",
        sterlingHandoffId: 9,
        engagement: {
          status: "signed",
          version: ENGAGEMENT_PACK_VERSION,
          signedName: "Jane Hartley",
          privacyAccepted: true,
          termsAccepted: true,
        },
      }),
    ).toBe("david");
    expect(
      nodeForDeal({
        stage: "human_review",
        status: "waiting_human",
        source: "strata_inbound",
        sfp: { status: "COMPLETE" } as any,
      }),
    ).toBe("credit");
    expect(
      nodeForDeal({
        stage: "complete",
        status: "complete",
        source: "distress_scan",
        stream: "introducer",
        email: "partner@hartleyaccountants.co.uk",
      }),
    ).toBe("introducer-pipeline");
  });
});
