import { Router, type NextFunction, type Request, type Response } from "express";
import {
  asOpenerQuality,
  canDragOpenerTo,
  daysSitting,
  isDoNotContactOpener,
  OPENER_STATUSES,
  openerBelongsToDesk,
  openerOnOpenersBoard,
  openerOnPipeline,
  withDerivedNurture,
  normalizeEmail,
  type OpenerDesk,
  type OpenerRecord,
  type OpenerStatus,
} from "@shared/openers";
import { lastMailOpenAt } from "@shared/mailTracking";
import { isAuthenticated } from "../auth";
import { isSterlingPortalRole } from "@shared/sterlingPortal";
import { handleApiError } from "../utils/errorHandler";
import { listAgentMail, type AgentMailItem } from "../services/agentMailLog";
import {
  briefingPublicUrl,
  fetchOpenerBriefingSite,
  generateOpenerBriefing,
  openerBriefingBind,
  openerBriefingIsDesigned,
  previewOpenerBriefingHtml,
  previewOpenerBriefingSend,
  publishOpenerBriefingPage,
  renderBriefingHtml,
  saveOpenerBriefingHtml,
  sendOpenerBriefing,
  updateOpenerBriefing,
  type BriefingRecord,
} from "../services/briefings";
import { mergeFieldsFromBind } from "@shared/briefingCraft";
import { loadSuppression } from "../services/mailSuppression";
import {
  attachCompanyNumber,
  checkOpenerCreditsafe,
  currentOpenerPipelineCompanyNumbers,
  enrichOpener,
  getOpener,
  hydrateFromAgentMail,
  listOpeners,
  listOpenerPipelineCompanyNumbers,
  logOpenerCall,
  onOpenerUnsubscribed,
  patchOpener,
  promoteOpener,
  demoteOpener,
  refreshOpenerIdentitySnapshot,
  resumeOpenerFromDirectOutreach,
  runNurtureAction,
  sendOpenerWhatsApp,
} from "../services/openers";

const router = Router();

const NURTURE_ACTIONS = ["start", "approve", "skip", "stop", "touch2", "closer"] as const;
type NurtureAction = (typeof NURTURE_ACTIONS)[number];

function requireOpenersAccess(req: Request, res: Response, next: NextFunction) {
  if (!isSterlingPortalRole((req.user as any)?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function handleOpenerError(res: Response, error: unknown, context: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  const status = (error as { status?: number })?.status;
  if (typeof status === "number") {
    return res.status(status).json({ error: err.message });
  }
  if (/opener not found/i.test(err.message)) {
    return res.status(404).json({ error: "Opener not found" });
  }
  handleApiError(res, error, context);
}

function timelineFor(opener: OpenerRecord, mail: AgentMailItem[]) {
  const emails = new Set(
    [opener.email, ...(opener.emails || [])].map(normalizeEmail).filter(Boolean)
  );
  return mail
    .filter(
      (item) => emails.has(normalizeEmail(item.to)) || emails.has(normalizeEmail(item.from))
    )
    .map((item) => ({
      mailId: item.id,
      subject: item.subject,
      lastOpenAt: lastMailOpenAt(item.opens),
      openCount: item.opens?.length ?? 0,
      clicks: item.clicks || [],
      dwells: item.dwells || [],
    }));
}

function presentOpener(
  opener: OpenerRecord,
  mail?: AgentMailItem[],
  pipelineCompanyNumbers?: Iterable<string>
) {
  const derived = withDerivedNurture(opener);
  return {
    ...derived,
    onPipeline: openerOnPipeline(
      opener,
      pipelineCompanyNumbers ?? currentOpenerPipelineCompanyNumbers()
    ),
    daysSitting: daysSitting(opener),
    briefingPackReady: openerBriefingIsDesigned(opener),
    ...(mail ? { timeline: timelineFor(opener, mail) } : {}),
  };
}

router.get("/api/openers", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    // Snapshot Agent Mail once for hydrate + timeline. Hydrate writes openers.json once.
    await refreshOpenerIdentitySnapshot();
    const mail = listAgentMail(5000);
    const suppression = loadSuppression();
    const optOutEmails = suppression
      .filter((row) => /opt-out/i.test(String(row.reason || "")))
      .map((row) => row.email);
    const bounceEmails = suppression
      .filter((row) => /hard bounce/i.test(String(row.reason || "")))
      .map((row) => row.email);
    hydrateFromAgentMail(mail, undefined, { optOutEmails, bounceEmails });
    const desk: OpenerDesk = req.query.desk === "non_responsive" ? "non_responsive" : "openers";
    let openers = listOpeners().filter((opener) => openerBelongsToDesk(opener, desk));
    if (desk === "openers") openers = openers.filter(openerOnOpenersBoard);
    const pipelineCompanyNumbers = await listOpenerPipelineCompanyNumbers(
      String((req.user as any)?.id || "")
    );
    res.json(openers.map((opener) => presentOpener(opener, mail, pipelineCompanyNumbers)));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.get("/api/openers/unsubscribed", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const mail = listAgentMail(5000);
    const pipelineCompanyNumbers = await listOpenerPipelineCompanyNumbers(String((req.user as any)?.id || ""));
    const rows = listOpeners().filter(isDoNotContactOpener);
    res.json(rows.map((opener) => presentOpener(opener, mail, pipelineCompanyNumbers)));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.get("/api/openers/:id", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const opener = getOpener(req.params.id);
    if (!opener) return res.status(404).json({ error: "Opener not found" });
    const pipelineCompanyNumbers = await listOpenerPipelineCompanyNumbers(
      String((req.user as any)?.id || "")
    );
    res.json(presentOpener(opener, listAgentMail(5000), pipelineCompanyNumbers));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.patch("/api/openers/:id", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const { status, notes, companyNumber, quality, industryOverride } = req.body || {};
    if (status === "promoted") {
      return res.status(400).json({ error: "Use POST /api/openers/:id/promote" });
    }
    if (status === "direct_outreach") {
      return res.status(400).json({ error: "Cannot move opener to that status" });
    }
    const current = getOpener(req.params.id);
    if (!current) return res.status(404).json({ error: "Opener not found" });
    if (status != null) {
      if (!OPENER_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (!canDragOpenerTo(current, status as OpenerStatus)) {
        return res.status(400).json({ error: "Cannot move opener to that status" });
      }
    }

    let opener = current;
    if (typeof companyNumber === "string" && companyNumber.trim()) {
      opener = await attachCompanyNumber(opener.id, companyNumber);
    }
    if (current.status === "promoted" && status && status !== "promoted") {
      opener = await demoteOpener(
        opener.id,
        String((req.user as any)?.id || ""),
        status as "new" | "nurturing" | "not_now"
      );
    }
    if (current.status === "direct_outreach" && status === "nurturing") {
      opener = resumeOpenerFromDirectOutreach(current.id) ?? opener;
    }
    const updates: Partial<OpenerRecord> = {};
    if (typeof notes === "string") updates.notes = notes;
    if (typeof industryOverride === "string") {
      updates.industryOverride = industryOverride.trim();
      if (opener.briefingHold?.reason === "industry_unknown") updates.briefingHold = undefined;
    }
    if (quality !== undefined) {
      const nextQuality = asOpenerQuality(quality);
      if (!nextQuality) return res.status(400).json({ error: "Invalid quality" });
      updates.quality = nextQuality;
    }
    if (status && opener.status !== status) updates.status = status as OpenerStatus;
    if (status === "not_now" && opener.status !== "not_now") {
      updates.status = "not_now";
      if (opener.nurture.stopReason !== "opt_out") {
        updates.nurture = { ...opener.nurture, stopReason: "manual" };
      }
    }
    if (Object.keys(updates).length) {
      opener = patchOpener(opener.id, updates) ?? opener;
    }
    if (status === "not_now" && current.status !== "not_now") {
      onOpenerUnsubscribed(opener.id);
    }
    res.json(presentOpener(opener));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/creditsafe-check", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(presentOpener(await checkOpenerCreditsafe(req.params.id)));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/enrich", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(presentOpener(await enrichOpener(req.params.id)));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/nurture", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const action = req.body?.action as NurtureAction;
    if (!NURTURE_ACTIONS.includes(action)) {
      return res.status(400).json({ error: "Invalid nurture action" });
    }
    const channel = req.body?.channel as "whatsapp" | "call" | "skip" | undefined;
    res.json(presentOpener(await runNurtureAction(req.params.id, action, { channel, agentId: req.body?.agentId })));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/promote", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const result = await promoteOpener(req.params.id, String((req.user as any)?.id || ""));
    res.json({ ...result, opener: presentOpener(result.opener) });
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/demote", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const status = (req.body?.status || "nurturing") as "new" | "nurturing" | "not_now";
    const opener = await demoteOpener(
      req.params.id,
      String((req.user as any)?.id || ""),
      status
    );
    res.json(presentOpener(opener));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/whatsapp", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const message = String(req.body?.message || "");
    if (!message) return res.status(400).json({ error: "message required" });
    res.json(presentOpener(await sendOpenerWhatsApp(req.params.id, message)));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/call", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(presentOpener(await logOpenerCall(req.params.id, String(req.body?.note || ""))));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

function presentGeneratedBriefing(briefing: BriefingRecord) {
  return {
    briefing,
    cover: briefing.cover,
    previewHtml: renderBriefingHtml(briefing, { live: false }),
  };
}

router.post("/api/openers/:id/briefing/generate", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(presentGeneratedBriefing(await generateOpenerBriefing(req.params.id)));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.get("/api/openers/:id/briefing/preview", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const html = previewOpenerBriefingHtml(req.params.id);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.patch("/api/openers/:id/briefing", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const { coverSubject, coverHtml, slides } = req.body || {};
    res.json(
      presentGeneratedBriefing(
        updateOpenerBriefing(req.params.id, { coverSubject, coverHtml, slides })
      )
    );
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.get("/api/openers/:id/briefing/craft", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const briefing = await generateOpenerBriefing(req.params.id);
    const opener = getOpener(req.params.id);
    if (!opener) return res.status(404).json({ error: "Opener not found" });
    const bind = openerBriefingBind(opener);
    res.json({
      briefing,
      bind,
      merge: mergeFieldsFromBind(bind),
      pageUrl: briefing.status === "live" ? briefingPublicUrl(briefing.token) : null,
    });
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/briefing/site", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(await fetchOpenerBriefingSite(req.params.id, String(req.body?.url || "")));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/briefing/html", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(presentGeneratedBriefing(saveOpenerBriefingHtml(req.params.id, String(req.body?.html || ""))));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/briefing/page", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(publishOpenerBriefingPage(req.params.id));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.get("/api/openers/:id/briefing/send-preview", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    res.json(previewOpenerBriefingSend(req.params.id));
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

router.post("/api/openers/:id/briefing/send", isAuthenticated, requireOpenersAccess, async (req, res) => {
  try {
    const briefing = await sendOpenerBriefing(req.params.id);
    res.json({ briefing });
  } catch (error) {
    handleOpenerError(res, error, "api-error");
  }
});

export default router;
