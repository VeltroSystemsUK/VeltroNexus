import { describe, expect, it } from "vitest";
import {
  buildReferRecord,
  classifyIntroducer,
  validateReferRecord,
} from "@shared/slfRefer";
import { GOLD_REFER, acceptRefer, createSlfStore, ingestRefer } from "@shared/slfRuntime";
import { MemoryDealBook } from "@shared/slfDealBook";

describe("classifyIntroducer", () => {
  it("accepts accountancy and turnaround firms", () => {
    expect(classifyIntroducer({ name: "Hartley Accountants Ltd", sicCodes: ["69201"] }).type).toBe("accountant");
    expect(classifyIntroducer({ name: "Oak Turnaround LLP", sicCodes: ["70229"] }).type).toBe("ip");
  });

  it("rejects commercial finance brokers as not_an_introducer", () => {
    const result = classifyIntroducer({ name: "Midlands Finance Brokers Ltd", sicCodes: ["64921"] });
    expect(result.type).toBeNull();
    expect(result.holdReason).toBe("not_an_introducer");
  });
});

describe("isReferReachable / buildReferRecord", () => {
  const base = {
    introducerName: "Hartley Accountants Ltd",
    introducerNumber: "04440000",
    domain: "hartleyaccountants.co.uk",
    mailbox: "enquiries@hartleyaccountants.co.uk",
    mailboxType: "role" as const,
    listGrade: "A-role" as const,
    pecrCategory: "corporate_subscriber" as const,
    resolutionConfidence: 1,
    relatedSme: [] as string[],
    ownNumbers: [] as string[],
    dnc: false,
  };

  it("marks a grade A-role corporate mailbox reachable", () => {
    const record = buildReferRecord(base);
    expect(record.reachable_corporate_contact).toBe(true);
    expect(record.pipeline).toBe("introducer");
    expect(record.hold_reason).toBeNull();
    expect(validateReferRecord(record).ok).toBe(true);
  });

  it("holds catch-all / grade C", () => {
    const record = buildReferRecord({ ...base, listGrade: "C" });
    expect(record.reachable_corporate_contact).toBe(false);
    expect(record.hold_reason).toBe("catch_all_only");
  });

  it("holds gmail", () => {
    const record = buildReferRecord({
      ...base,
      mailbox: "dave@gmail.com",
      mailboxType: "named_work",
      listGrade: "F",
    });
    expect(record.reachable_corporate_contact).toBe(false);
    expect(record.hold_reason).toBe("personal_webmail");
  });

  it("rejects the same entity as the related SME", () => {
    const record = buildReferRecord({ ...base, relatedSme: ["04440000"] });
    expect(record.reachable_corporate_contact).toBe(false);
    expect(record.hold_reason).toBe("same_entity_as_sme");
  });

  it("rejects own firm", () => {
    const record = buildReferRecord({ ...base, ownNumbers: ["04440000"] });
    expect(record.hold_reason).toBe("own_firm");
    expect(record.reachable_corporate_contact).toBe(false);
  });

  it("fails schema if SME hypothesis fields leak onto the record", () => {
    const record = buildReferRecord(base);
    expect(
      validateReferRecord({ ...record, opening_line: "we saw your petition", hypothesis: "distress" } as any).ok
    ).toBe(false);
  });

  it("accepts a reachable accountant onto the introducer pipeline, not SME", async () => {
    const store = createSlfStore();
    ingestRefer(store, GOLD_REFER["04440000"]);
    const book = new MemoryDealBook();
    const result = await acceptRefer(store, "04440000", book);
    expect(result.ok).toBe(true);
    expect(book.deals).toHaveLength(1);
    expect(book.deals[0].stream).toBe("introducer");
    expect(book.deals[0].reachableCorporateContact).toBe(true);
    expect(book.deals[0].hopper).not.toBe("gated");
    expect(book.deals[0].email).toBe("enquiries@hartleyaccountants.co.uk");
  });

  it("fails flag true without a mailbox", () => {
    const record = buildReferRecord({ ...base, mailbox: "" });
    expect(record.reachable_corporate_contact).toBe(false);
    expect(validateReferRecord({ ...record, reachable_corporate_contact: true }).ok).toBe(false);
  });
});
