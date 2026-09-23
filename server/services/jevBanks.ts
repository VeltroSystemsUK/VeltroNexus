import type { JevStakes } from "@shared/jevTriage";
import type { JevQuestion } from "./jevClient";

export type FrozenQuestion = JevQuestion & { stakes: JevStakes };

export const INBOUND_CONTACT_BANK_VERSION = "inbound.contact.v1";

export const INBOUND_CONTACT_BANK: Record<string, FrozenQuestion> = {
  fit: {
    type: "choice",
    stakes: "route",
    instructions: "What is the primary fit for this enquiry?",
    criteria: {
      refinance: "Replace or restructure existing commercial debt",
      time_to_pay: "HMRC arrears or Time to Pay",
      cdfs: "CDFI / patient capital, not high-cost short-term",
      not_a_fit: "Consumer, property speculation, personal debt, or wants a new high-cost loan",
    },
  },
  distress: {
    type: "score",
    stakes: "read",
    instructions: "How distressed does the business appear from the text and figures?",
    criteria: [
      "Stable, shopping rates",
      "Stressed but trading",
      "Acute pressure — stacked cost, HMRC, or missed-payroll risk",
    ],
  },
  stacked_debt: {
    type: "noul",
    stakes: "read",
    instructions: "Does the enquiry describe stacked or high-cost short-term lending?",
    criteria: {
      true: "Multiple overlapping facilities or very high monthly cost relative to debt",
      false: "A single conventional facility or no debt mentioned",
    },
  },
  ready_to_talk: {
    type: "noul",
    stakes: "write",
    instructions: "Is the sender ready for a diagnostic conversation rather than a brochure?",
    criteria: {
      true: "Named facts, a decision-maker, a concrete problem",
      false: "Vague shopping or a third party with no mandate",
    },
  },
  regulated_risk: {
    type: "noul",
    stakes: "irreversible",
    instructions: "Is this likely regulated consumer credit, personal debt, or mortgage territory?",
    criteria: {
      true: "Personal, sole-trader consumer, BTL, or residential",
      false: "Clearly commercial B2B",
    },
  },
  queue: {
    type: "choice",
    stakes: "route",
    instructions: "Which desk should own the next action?",
    criteria: {
      diagnostic: "Run a structured diagnostic with the director (James Class A)",
      hmrc_first: "HMRC / Time to Pay is the first move",
      introducer: "Work through an introducer, do not contact the SME yet (James Class C)",
      decline_educate: "Not a fit — education only, do not pitch (James Class F/G)",
      distress_human: "Human-first, Shaun same day (James Class H)",
      compliance_hold: "Possible regulated or conflicted case — hold (James Class G/I)",
    },
  },
};

export function questionsWithoutStakes(bank: Record<string, FrozenQuestion>): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {};
  for (const [id, question] of Object.entries(bank)) {
    questions[id] = {
      type: question.type,
      instructions: question.instructions,
      ...(question.criteria !== undefined ? { criteria: question.criteria } : {}),
    };
  }
  return questions;
}
