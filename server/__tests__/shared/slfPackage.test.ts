import { describe, expect, it } from "vitest";
import { buildLeadPackage, validateLeadPackage } from "@shared/slfPackage";
import { scoreCompanySnapshot } from "@shared/slfScore";

const NOW = new Date("2026-09-07T12:00:00Z");

describe("slf.lead_package.v1", () => {
  it("builds a grounded Stream A package for a petition", () => {
    const scored = scoreCompanySnapshot(
      {
        companyName: "Oxbow Coldstores Limited",
        companyNumber: "09876543",
        companyStatus: "active",
        dateOfCreation: "2014-02-01",
        sicCodes: ["52103"],
        hasPetition: true,
        petitionAt: "2026-09-06",
        resolutionConfidence: 1,
        charges: [],
      },
      NOW
    );
    const pkg = buildLeadPackage({
      scored,
      companyName: "Oxbow Coldstores Limited",
      companyNumber: "09876543",
      jurisdiction: "england-wales",
      action: "create",
      bookLane: "net_new",
      evidence: [
        {
          signalType: "gazette.winding_up_petition",
          title: "Gazette petition",
          eventAt: "2026-09-06",
          url: "https://www.thegazette.co.uk/notice/oxbow",
          excerpt: "Winding-up petition presented against Oxbow Coldstores Limited",
        },
      ],
      hypothesis:
        "Oxbow Coldstores Limited has a Gazette winding-up petition published 6 September 2026. The company is still on the register. Highest-probability need is a refinance or standstill conversation while the petition is live, not a fire-sale pitch.",
      whyUsNow: "HMRC petition published yesterday.",
      openingLine:
        "Wanted to check whether you are running a refinance or standstill conversation on the cold store while the petition is live — happy to look at options if useful.",
      questionsToAsk: ["Is the petition being defended?", "What facilities are live?"],
      generatedAt: "2026-09-07T12:00:00.000Z",
    });
    const check = validateLeadPackage(pkg);
    expect(check.ok).toBe(true);
    expect(pkg.fit.primary_product).toBe("hmrc_distress");
    expect(pkg.fit.priority).toBe("hot");
    expect(pkg.action).toBe("create");
    expect(pkg.outreach_brief.opening_line.toLowerCase()).not.toMatch(/desperate|collapse/);
  });

  it("rejects a hypothesis that cites a date not in evidence", () => {
    const scored = scoreCompanySnapshot(
      {
        companyName: "Acme Joinery Limited",
        companyNumber: "01234567",
        companyStatus: "active",
        dateOfCreation: "2019-04-01",
        sicCodes: ["43320"],
        charges: [{ status: "outstanding", createdOn: "2025-01-15", personsEntitled: ["IWOCA LIMITED"] }],
        resolutionConfidence: 1,
      },
      NOW
    );
    const pkg = buildLeadPackage({
      scored,
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
      action: "create",
      bookLane: "net_new",
      evidence: [
        {
          signalType: "charge.created",
          title: "Iwoca charge",
          eventAt: "2025-01-15",
          url: "https://find-and-update.company-information.service.gov.uk/company/01234567/charges",
          excerpt: "Person entitled: IWOCA LIMITED",
        },
      ],
      hypothesis:
        "Acme Joinery still has an outstanding Iwoca charge created 15 January 2025 and also refinanced on 4 July 2018 according to a private memo.",
      whyUsNow: "Live MCA.",
      openingLine: "Saw the January 2025 Iwoca charge — are you looking at a term refinance?",
      questionsToAsk: ["What is outstanding on the MCA?", "Any HMRC Time to Pay?"],
      generatedAt: "2026-09-07T12:00:00.000Z",
    });
    const check = validateLeadPackage(pkg);
    expect(check.ok).toBe(false);
    expect(check.errors.join(" ")).toMatch(/grounding|2018/i);
  });

  it("blocks email as a channel when only a personal gmail is on file", () => {
    const scored = scoreCompanySnapshot(
      {
        companyName: "Acme Joinery Limited",
        companyNumber: "01234567",
        companyStatus: "active",
        dateOfCreation: "2019-04-01",
        sicCodes: ["43320"],
        charges: [{ status: "outstanding", createdOn: "2025-01-15", personsEntitled: ["IWOCA LIMITED"] }],
        resolutionConfidence: 1,
      },
      NOW
    );
    const pkg = buildLeadPackage({
      scored,
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
      action: "create",
      bookLane: "net_new",
      people: [{ role: "director", name: "Jane Ellis", email: "jane.ellis@gmail.com" }],
      evidence: [
        {
          signalType: "charge.created",
          title: "Iwoca charge",
          eventAt: "2025-01-15",
          url: "https://find-and-update.company-information.service.gov.uk/company/01234567/charges",
          excerpt: "Person entitled: IWOCA LIMITED",
        },
      ],
      hypothesis:
        "Acme Joinery Limited still has an outstanding Iwoca charge created 15 January 2025. That is a live non-bank facility and a Stream A timing signal for a CDFI refinance conversation now.",
      whyUsNow: "Live MCA.",
      openingLine: "Saw the January 2025 Iwoca charge — are you looking at a term refinance?",
      questionsToAsk: ["What is outstanding on the MCA?", "Any HMRC Time to Pay?"],
      generatedAt: "2026-09-07T12:00:00.000Z",
    });
    expect(pkg.outreach_brief.channel_recommendation).not.toContain("email");
    expect(pkg.outreach_brief.compliance.pecr_category).not.toBe("corporate_subscriber");
  });

  it("requires nexus_candidate_id on book-lane packages", () => {
    const scored = scoreCompanySnapshot(
      {
        companyName: "Acme Joinery Limited",
        companyNumber: "01234567",
        companyStatus: "active",
        dateOfCreation: "2019-04-01",
        sicCodes: ["43320"],
        hasPetition: true,
        petitionAt: "2026-09-06",
        charges: [],
        resolutionConfidence: 1,
      },
      NOW
    );
    const pkg = buildLeadPackage({
      scored,
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
      action: "promote",
      bookLane: "existing_queue",
      evidence: [
        {
          signalType: "gazette.winding_up_petition",
          title: "Petition",
          eventAt: "2026-09-06",
          url: "https://www.thegazette.co.uk/notice/1",
          excerpt: "Winding-up petition",
        },
      ],
      hypothesis:
        "Acme Joinery Limited has a Gazette winding-up petition published 6 September 2026. The company is still trading on the register, so this is a Stream A distress conversation, not a new-name create.",
      whyUsNow: "Petition yesterday.",
      openingLine: "Wanted to check whether a refinance conversation is already running while the petition is live.",
      questionsToAsk: ["Is the petition being defended?", "What facilities are live?"],
      generatedAt: "2026-09-07T12:00:00.000Z",
    });
    expect(validateLeadPackage(pkg).ok).toBe(false);
  });
});
