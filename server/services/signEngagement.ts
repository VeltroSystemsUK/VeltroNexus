import { firstName } from "@shared/strataOutreach";
import {
  ENGAGEMENT_PACK_VERSION,
  applySignature,
  fillFromDeal,
  isLiveSigned,
  validateSignPayload,
  type EngagementFill,
  type SignPayload,
} from "@shared/engagementPack";
import { storage } from "../storage";

export type PublicSignState = {
  companyName: string;
  contactFirstName: string;
  version: string;
  signed: boolean;
  signedName?: string;
  signedAt?: string;
  fill: EngagementFill;
};

function publicState(deal: {
  companyName: string;
  contactName?: string;
  placeAddress?: string;
  loanAmount?: number | null;
  fundingReason?: string;
  engagement?: import("@shared/engagementPack").EngagementState;
}): PublicSignState {
  const fill = fillFromDeal(deal);
  const signed = isLiveSigned(deal.engagement);
  return {
    companyName: deal.companyName,
    contactFirstName: firstName(deal.contactName),
    version: ENGAGEMENT_PACK_VERSION,
    signed,
    signedName: signed ? deal.engagement?.signedName : undefined,
    signedAt: signed ? deal.engagement?.signedAt : undefined,
    fill,
  };
}

export async function getPublicSign(token: string): Promise<PublicSignState | null> {
  const deal = await storage.getAgenticDealByUploadToken(token);
  return deal ? publicState(deal) : null;
}

export async function submitPublicSign(
  token: string,
  payload: SignPayload,
  ip?: string,
): Promise<PublicSignState> {
  const deal = await storage.getAgenticDealByUploadToken(token);
  if (!deal) throw Object.assign(new Error("This signing link is not valid."), { status: 404 });

  if (isLiveSigned(deal.engagement) && deal.engagement?.version === ENGAGEMENT_PACK_VERSION) {
    return publicState(deal);
  }

  const check = validateSignPayload(payload);
  if (!check.ok) throw Object.assign(new Error(check.error), { status: 400 });

  const engagement = applySignature(deal.engagement || { status: "sent", version: ENGAGEMENT_PACK_VERSION }, payload, {
    at: new Date().toISOString(),
    ip,
  });
  const updated = await storage.updateAgenticDeal(deal.id, {
    engagement,
    events: [
      ...(deal.events || []),
      {
        at: engagement.signedAt || new Date().toISOString(),
        stage: deal.stage,
        agent: "inbound-intake",
        message: `Engagement pack signed by ${engagement.signedName}`,
      },
    ],
  });
  return publicState(updated);
}
