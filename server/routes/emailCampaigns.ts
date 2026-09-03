import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { insertEmailCampaignSchema } from "@shared/schema";
import { prepareCampaignSend } from "@shared/campaignSend";
import { wasEmailDelivered } from "@shared/outreachSend";
import { EmailVerificationService } from "../services/emailVerification";
import { sendEmail } from "../services/email";
import { sendTrackingPixel } from "../utils/trackingPixel";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// List all campaigns
router.get(
  "/email-campaigns",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaigns = await storage.listEmailCampaigns(req.user.id);
      res.json(campaigns);
    } catch (err: any) {
      handleApiError(res, err, "list-email-campaigns");
    }
  }
);

// Get single campaign
router.get(
  "/email-campaigns/:id",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getEmailCampaign(
        parseInt(req.params.id),
        req.user.id
      );
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      res.json(campaign);
    } catch (err: any) {
      handleApiError(res, err, "get-email-campaign");
    }
  }
);

// Create campaign
router.post(
  "/email-campaigns",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = insertEmailCampaignSchema.safeParse(req.body);
      if (!validated.success) {
        console.error("[EmailCampaigns] Validation error:", fromZodError(validated.error).message);
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      const campaign = await storage.createEmailCampaign(validated.data, req.user.id);
      console.log("[EmailCampaigns] Created campaign:", campaign.id);
      res.status(201).json(campaign);
    } catch (err: any) {
      console.error("[EmailCampaigns] Create error:", err);
      handleApiError(res, err, "create-email-campaign");
    }
  }
);

// Update campaign
router.patch(
  "/email-campaigns/:id",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.updateEmailCampaign(
        parseInt(req.params.id),
        req.body
      );
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      res.json(campaign);
    } catch (err: any) {
      handleApiError(res, err, "update-email-campaign");
    }
  }
);

// Delete campaign
router.delete(
  "/email-campaigns/:id",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getEmailCampaign(
        parseInt(req.params.id),
        req.user.id
      );
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      await storage.clearCampaignRecipients(campaign.id!, req.user.id);
      await storage.deleteEmailCampaign(campaign.id!, req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      handleApiError(res, err, "delete-email-campaign");
    }
  }
);

// Send campaign
router.post(
  "/email-campaigns/:id/send",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getEmailCampaign(
        parseInt(req.params.id),
        req.user.id
      );
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      if (campaign.status !== "draft" && campaign.status !== "scheduled") {
        return res.status(400).json({ error: "Campaign must be in draft or scheduled status to send" });
      }

      const recipients = await storage.listCampaignRecipients(campaign.id!, req.user.id);
      if (recipients.length === 0) {
        return res.status(400).json({ error: "Campaign has no recipients" });
      }

      // Check for unverified recipients (unless force flag is set)
      const { force } = req.body || {};
      if (!force) {
        const unverified = recipients.filter(
          (r) => !r.verificationStatus || r.verificationStatus === "unverified"
        );
        if (unverified.length > 0) {
          return res.status(409).json({
            error: "unverified_recipients",
            unverifiedCount: unverified.length,
            totalCount: recipients.length,
            message: `${unverified.length} of ${recipients.length} recipients have not been verified.`,
          });
        }
      }

      await storage.updateEmailCampaign(campaign.id!, {
        status: "sending",
      } as any);

      res.json({
        success: true,
        totalSent: 0,
        message: `Sending campaign to ${recipients.length} recipients from enquiries@stratafinance.co.uk...`,
      });

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

      (async () => {
        let sentCount = 0;
        let failedCount = 0;

        for (const recipient of recipients) {
          if (recipient.status !== "pending" || !recipient.id) continue;

          const prepared = prepareCampaignSend({
            subject: campaign.subject,
            content: campaign.content,
            recipient: {
              id: recipient.id,
              email: recipient.email,
              firstName: recipient.firstName,
              lastName: recipient.lastName,
              companyName: recipient.companyName,
              verificationStatus: recipient.verificationStatus,
              status: recipient.status,
            },
            baseUrl,
          });

          if (prepared.skipReason) {
            await storage.updateCampaignRecipient(recipient.id, {
              status: "failed",
              errorMessage: prepared.skipReason,
            });
            failedCount++;
            continue;
          }

          try {
            const sendResult = await sendEmail(
              prepared.credentials,
              prepared.to,
              prepared.subject,
              prepared.html
            );
            if (!wasEmailDelivered(sendResult)) {
              await storage.updateCampaignRecipient(recipient.id, {
                status: "failed",
                errorMessage: sendResult?.mock
                  ? "SMTP not configured — email was not delivered"
                  : "Send failed",
              });
              failedCount++;
              continue;
            }

            await storage.updateCampaignRecipient(recipient.id, {
              status: "sent",
              sentAt: new Date(),
            });
            sentCount++;
            console.log(`[EmailCampaigns] Sent to ${recipient.email}`);
          } catch (sendErr: any) {
            console.error(`[EmailCampaigns] Failed to send to ${recipient.email}:`, sendErr.message);
            await storage.updateCampaignRecipient(recipient.id, {
              status: "failed",
              errorMessage: sendErr.message || "Send failed",
            });
            failedCount++;
          }
        }

        // Update campaign with final stats
        await storage.updateEmailCampaign(campaign.id!, {
          status: "sent",
          totalSent: sentCount,
          totalDelivered: sentCount,
          totalFailed: failedCount,
        } as any);

        console.log(`[EmailCampaigns] Campaign ${campaign.id} complete: ${sentCount} sent, ${failedCount} failed`);
      })().catch((err) => {
        console.error("[EmailCampaigns] Background send error:", err);
      });
    } catch (err: any) {
      console.error("[EmailCampaigns] Send error:", err);
      handleApiError(res, err, "send-email-campaign");
    }
  }
);

// Verify recipients before sending
router.post(
  "/email-campaigns/:id/verify-recipients",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getEmailCampaign(campaignId, req.user.id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });

      const recipients = await storage.listCampaignRecipients(campaignId, req.user.id);
      const unverified = recipients.filter(
        (r) => !r.verificationStatus || r.verificationStatus === "unverified"
      );

      if (unverified.length === 0) {
        return res.json({
          total: recipients.length,
          verified: 0,
          valid: recipients.filter((r) => r.verificationStatus === "valid").length,
          risky: recipients.filter((r) => r.verificationStatus === "risky").length,
          invalid: recipients.filter((r) => r.verificationStatus === "invalid").length,
          results: [],
        });
      }

      const deepMode = req.body?.deepMode ?? false;
      const verifier = new EmailVerificationService();
      const results: Array<{
        recipientId: number;
        email: string;
        status: string;
        grade: string;
        score: number;
        explanation: string;
      }> = [];

      // Process in batches of 5 to avoid hammering SMTP servers
      const BATCH_SIZE = 5;
      for (let i = 0; i < unverified.length; i += BATCH_SIZE) {
        const batch = unverified.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async (recipient) => {
            const result = await verifier.verify(recipient.email, deepMode);
            await storage.updateCampaignRecipient(recipient.id!, {
              verificationStatus: result.status,
              verificationGrade: result.qualityGrade,
              verificationScore: result.deliverabilityScore,
            } as any);
            return {
              recipientId: recipient.id!,
              email: recipient.email,
              status: result.status,
              grade: result.qualityGrade,
              score: result.deliverabilityScore,
              explanation: result.explanation,
            };
          })
        );

        for (const r of batchResults) {
          if (r.status === "fulfilled") {
            results.push(r.value);
          }
        }
      }

      const valid = results.filter((r) => r.status === "valid").length;
      const risky = results.filter((r) => r.status === "risky").length;
      const invalid = results.filter((r) => r.status === "invalid").length;

      // Include already-verified counts
      const prevValid = recipients.filter(
        (r) => r.verificationStatus === "valid"
      ).length;
      const prevRisky = recipients.filter(
        (r) => r.verificationStatus === "risky"
      ).length;
      const prevInvalid = recipients.filter(
        (r) => r.verificationStatus === "invalid"
      ).length;

      console.log(
        `[EmailCampaigns] Verified ${results.length} recipients for campaign ${campaignId}: ${valid} valid, ${risky} risky, ${invalid} invalid`
      );

      res.json({
        total: recipients.length,
        verified: results.length,
        valid: valid + prevValid,
        risky: risky + prevRisky,
        invalid: invalid + prevInvalid,
        results,
      });
    } catch (err: any) {
      console.error("[EmailCampaigns] Verify recipients error:", err);
      handleApiError(res, err, "verify-campaign-recipients");
    }
  }
);

// Pause campaign
router.post(
  "/email-campaigns/:id/pause",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.updateEmailCampaign(
        parseInt(req.params.id),
        { status: "paused" } as any
      );
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      res.json(campaign);
    } catch (err: any) {
      handleApiError(res, err, "pause-email-campaign");
    }
  }
);

// List campaign recipients
router.get(
  "/email-campaigns/:id/recipients",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recipients = await storage.listCampaignRecipients(
        parseInt(req.params.id),
        req.user.id
      );
      res.json(recipients);
    } catch (err: any) {
      handleApiError(res, err, "list-campaign-recipients");
    }
  }
);

// Add recipients to campaign
router.post(
  "/email-campaigns/:id/recipients",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getEmailCampaign(campaignId, req.user.id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });

      const { recipients: recipientList } = req.body;

      if (!Array.isArray(recipientList) || recipientList.length === 0) {
        return res.status(400).json({ error: "Recipients array is required" });
      }

      const recipientsToAdd = recipientList.map((r: any) => ({
        campaignId,
        userId: req.user.id,
        email: r.email,
        firstName: r.firstName || null,
        lastName: r.lastName || null,
        companyName: r.companyName || null,
        sourceType: r.sourceType || "manual",
        sourceId: r.sourceId || null,
        status: "pending" as const,
        verificationStatus: r.verificationStatus || "unverified",
        verificationGrade: r.verificationGrade || null,
        verificationScore: r.verificationScore ?? null,
      }));

      const added = await storage.addCampaignRecipients(recipientsToAdd);

      // Update recipient count on campaign
      const allRecipients = await storage.listCampaignRecipients(campaignId, req.user.id);
      await storage.updateEmailCampaign(campaignId, {
        recipientCount: allRecipients.length,
      } as any);

      res.status(201).json({ added: added.length, total: allRecipients.length });
    } catch (err: any) {
      handleApiError(res, err, "add-campaign-recipients");
    }
  }
);

// Clear all recipients from campaign
router.delete(
  "/email-campaigns/:id/recipients",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      await storage.clearCampaignRecipients(campaignId, req.user.id);
      await storage.updateEmailCampaign(campaignId, {
        recipientCount: 0,
      } as any);
      res.json({ success: true });
    } catch (err: any) {
      handleApiError(res, err, "clear-campaign-recipients");
    }
  }
);

// Campaign analytics
router.get(
  "/email-campaigns/:id/analytics",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getEmailCampaign(campaignId, req.user.id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });

      const recipients = await storage.listCampaignRecipients(campaignId, req.user.id);

      const analytics = {
        totalRecipients: recipients.length,
        totalSent: recipients.filter((r) => r.status !== "pending").length,
        totalDelivered: recipients.filter((r) => ["delivered", "opened", "clicked"].includes(r.status)).length,
        totalOpened: recipients.filter((r) => ["opened", "clicked"].includes(r.status)).length,
        totalClicked: recipients.filter((r) => r.status === "clicked").length,
        totalBounced: recipients.filter((r) => r.status === "bounced").length,
        totalFailed: recipients.filter((r) => r.status === "failed").length,
        totalUnsubscribed: recipients.filter((r) => r.status === "unsubscribed").length,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
      };

      const delivered = analytics.totalDelivered || analytics.totalSent;
      if (delivered > 0) {
        analytics.openRate = Math.round((analytics.totalOpened / delivered) * 100);
        analytics.clickRate = Math.round((analytics.totalClicked / delivered) * 100);
        analytics.bounceRate = Math.round((analytics.totalBounced / analytics.totalSent) * 100);
      }

      res.json(analytics);
    } catch (err: any) {
      handleApiError(res, err, "campaign-analytics");
    }
  }
);

// Open tracking pixel — public endpoint (no auth), called when email client loads the image
router.get(
  "/email-tracking/open/:recipientId",
  async (req: Request, res: Response) => {
    try {
      const recipientId = parseInt(req.params.recipientId);
      if (!isNaN(recipientId)) {
        // Update recipient status to opened (only if currently sent/delivered)
        const recipient = await storage.getCampaignRecipientById(recipientId);
        if (recipient && ["sent", "delivered"].includes(recipient.status)) {
          await storage.updateCampaignRecipient(recipientId, {
            status: "opened",
            openedAt: new Date(),
          });
          console.log(`[EmailTracking] Open tracked for recipient ${recipientId}`);
        }
      }
    } catch (err) {
      // Don't fail the pixel response on tracking errors
      console.error("[EmailTracking] Open tracking error:", err);
    }

    // Always return the pixel regardless of tracking success
    sendTrackingPixel(res);
  }
);

router.get(
  "/email-tracking/unsubscribe/:recipientId",
  async (req: Request, res: Response) => {
    try {
      const recipientId = parseInt(req.params.recipientId);
      if (!isNaN(recipientId)) {
        const recipient = await storage.getCampaignRecipientById(recipientId);
        if (recipient && recipient.status !== "unsubscribed") {
          await storage.updateCampaignRecipient(recipientId, {
            status: "unsubscribed",
          });
        }
      }
    } catch (err) {
      console.error("[EmailTracking] Unsubscribe error:", err);
    }

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(
      "<!doctype html><title>Unsubscribed</title><p>You've been unsubscribed from Strata Finance emails.</p>"
    );
  }
);

export default router;
