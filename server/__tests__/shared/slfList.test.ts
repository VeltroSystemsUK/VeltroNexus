import { describe, expect, it } from "vitest";
import {
  decideListAttach,
  gradeListRow,
  refuseListFile,
  normaliseEmail,
} from "@shared/slfList";

describe("refuseListFile", () => {
  it("refuses a dump-shaped file with webmail majority and no company numbers", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      email: `person${i}@gmail.com`,
      name: `Person ${i}`,
    }));
    const result = refuseListFile("uk_emails_10m.csv", rows);
    expect(result.refused).toBe(true);
    expect(result.blockedClass).toBe("scrape_shop");
  });

  it("accepts an operator file with company numbers and corporate domains", () => {
    const result = refuseListFile("operator_book.csv", [
      { email: "jane.ellis@acme.co.uk", companyNumber: "01234567" },
      { email: "info@joinery.co.uk", companyNumber: "09876543" },
    ]);
    expect(result.refused).toBe(false);
  });
});

describe("gradeListRow", () => {
  it("grades a director mailbox as A and attachable", () => {
    const row = gradeListRow({
      email: "jane.ellis@acme.co.uk",
      companyNumber: "01234567",
      contactName: "Jane Ellis",
      directorNames: ["Jane Ellis"],
      verificationStatus: "deliverable",
      catchAll: false,
      guessed: false,
    });
    expect(row.grade).toBe("A");
    expect(row.mailboxType).toBe("director");
    expect(row.attach).toBe(true);
    expect(row.isPrimary).toBe(true);
  });

  it("grades a published role mailbox as A-role, attachable, not primary when a director exists", () => {
    const row = gradeListRow({
      email: "info@acme.co.uk",
      companyNumber: "01234567",
      contactName: "Jane Ellis",
      directorNames: ["Jane Ellis"],
      verificationStatus: "deliverable",
      catchAll: false,
      guessed: false,
      hasDirectorMailbox: true,
    });
    expect(row.grade).toBe("A-role");
    expect(row.mailboxType).toBe("role");
    expect(row.attach).toBe(true);
    expect(row.isPrimary).toBe(false);
  });

  it("never attaches a guessed info@ even on a catch-all", () => {
    const row = gradeListRow({
      email: "info@acme.co.uk",
      companyNumber: "01234567",
      verificationStatus: "catch_all",
      catchAll: true,
      guessed: true,
    });
    expect(row.attach).toBe(false);
    expect(["C", "F"]).toContain(row.grade);
  });

  it("keeps personal gmail out of ready-to-import", () => {
    const row = gradeListRow({
      email: "jane.ellis@gmail.com",
      companyNumber: "01234567",
      contactName: "Jane Ellis",
      directorNames: ["Jane Ellis"],
      verificationStatus: "deliverable",
      guessed: false,
    });
    expect(row.grade).toBe("F");
    expect(row.attach).toBe(false);
  });
});

describe("decideListAttach", () => {
  it("stores net-new A rows in the product only", () => {
    expect(decideListAttach({ onBook: false, grade: "A" })).toBe("store_in_list_product_only");
  });

  it("attaches A-grade book hits", () => {
    expect(decideListAttach({ onBook: true, grade: "A" })).toBe("attach_mailbox");
  });
});

describe("normaliseEmail", () => {
  it("strips mailto and trailing punctuation", () => {
    expect(normaliseEmail("mailto:Jane.Ellis@Acme.co.uk.")).toBe("jane.ellis@acme.co.uk");
    expect(normaliseEmail("noreply@acme.co.uk")).toBeNull();
  });
});
