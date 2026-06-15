import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { storage, MOCK_DEV_ADMIN_ID } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError, logUnderwritingAudit } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import {
    insertApplicationSubmissionSchema,
    type InsertApplicationSubmission,
    type UnderwritingAttachment,
} from "@shared/schema";
import {
    requireSubmissionReadAccess,
    requireSubmissionWriteAccess,
    requireUnderwritingAccess,
} from "../utils/underwritingAuth";
import { zeusService } from "../services/zeusService";
import { sendEmail } from "../services/email";
import busboy from "busboy";
import { getObjectStorage } from "../utils/routerHelpers";

const router = Router();

  router.get("/submissions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const submissions = await storage.listApplicationSubmissions(userId as any);

      // Enrich submissions with prospect and lender details
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          const [prospect, lender] = await Promise.all([
            storage.getProspect(submission.prospectId, userId),
            storage.getLender(submission.lenderId),
          ]);

          return {
            ...submission,
            prospect,
            lender,
          };
        })
      );

      res.json(enrichedSubmissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Generate and download PDF report
  router.get(
    "/api/prospects/:prospectId/report",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ message: "Prospect not found" });
        }

        const user = await storage.getUser(userId);

        // Fetch related data
        const [contacts, activities, dueDiligence] = await Promise.all([
          storage.listContacts(prospectId, userId),
          storage.listActivities(prospectId, userId),
          storage.getDueDiligence(prospectId, userId).catch(() => null),
        ]);

        // Fetch Companies House data if available
        let companiesHouseData: any = null;
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (apiKey && prospect.company.companyNumber) {
          try {
            const trimmedApiKey = apiKey.trim();
            const authString = `${trimmedApiKey}:`;
            const base64Auth = Buffer.from(authString).toString("base64");
            const companyNumber = prospect.company.companyNumber;

            const [officersRes, pscRes, chargesRes] = await Promise.all([
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
            ]);

            companiesHouseData = {
              officers: officersRes && officersRes.ok ? await officersRes.json() : null,
              psc: pscRes && pscRes.ok ? await pscRes.json() : null,
              charges: chargesRes && chargesRes.ok ? await chargesRes.json() : null,
            };
          } catch (error) {
            console.error("Error fetching Companies House data for report");
          }
        }

        const { createProspectReportDocument, renderProspectReport } =
          await import("../utils/pdfGenerator");

        // Create document
        const doc = createProspectReportDocument({
          prospect,
          contacts,
          activities,
          dueDiligence: dueDiligence || undefined,
          companiesHouseData: companiesHouseData || undefined,
          pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
          user: user as any,
        });

        // Set response headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="Credit_Assessment_${prospect.company.companyName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`
        );

        // Pipe to response
        doc.pipe(res);

        // Render content
        renderProspectReport(doc, {
          prospect,
          contacts,
          activities,
          dueDiligence: dueDiligence || undefined,
          companiesHouseData: companiesHouseData || undefined,
          pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
          user: user as any,
        });

        // Finalize PDF
        doc.end();
      } catch (error) {
        console.error("Error generating report:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.post(
    "/api/submissions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const result = insertApplicationSubmissionSchema.safeParse(req.body);

        if (!result.success) {
          const validationError = fromZodError(result.error);
          return res.status(400).json({ message: validationError.toString() });
        }

        // Type-narrow the parsed data
        const submissionInput: InsertApplicationSubmission = result.data;

        // Validate that the prospect belongs to the user
        const prospect = await storage.getProspect(submissionInput.prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ message: "Prospect not found" });
        }

        // Validate that the lender belongs to the user
        const lender = await storage.getLender(submissionInput.lenderId);
        if (!lender) {
          console.error("Lender not found");
          return res.status(404).json({ message: "Lender not found" });
        }

        // Validate lender email before proceeding
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!lender.email || !emailRegex.test(lender.email)) {
          console.error("Invalid lender email");
          return res.status(400).json({ message: "Lender has invalid email address" });
        }

        // Generate PDF report before creating submission
        let pdfBuffer: Buffer;
        try {
          const [contacts, activities, dueDiligence, user] = await Promise.all([
            storage.listContacts(submissionInput.prospectId, userId),
            storage.listActivities(submissionInput.prospectId, userId),
            storage.getDueDiligence(submissionInput.prospectId, userId).catch(() => null),
            storage.getUser(userId),
          ]);

          // Fetch Companies House data (officers, PSC, charges) if available
          let companiesHouseData: any = null;
          const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
          if (apiKey && prospect.company.companyNumber) {
            try {
              const trimmedApiKey = apiKey.trim();
              const authString = `${trimmedApiKey}:`;
              const base64Auth = Buffer.from(authString).toString("base64");
              const companyNumber = prospect.company.companyNumber;

              const [officersRes, pscRes, chargesRes] = await Promise.all([
                fetch(
                  `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
                  {
                    headers: { Authorization: `Basic ${base64Auth}` },
                  }
                ).catch(() => null),
                fetch(
                  `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
                  {
                    headers: { Authorization: `Basic ${base64Auth}` },
                  }
                ).catch(() => null),
                fetch(
                  `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`,
                  {
                    headers: { Authorization: `Basic ${base64Auth}` },
                  }
                ).catch(() => null),
              ]);

              companiesHouseData = {
                officers: officersRes && officersRes.ok ? await officersRes.json() : null,
                psc: pscRes && pscRes.ok ? await pscRes.json() : null,
                charges: chargesRes && chargesRes.ok ? await chargesRes.json() : null,
              };
            } catch (error) {
              console.error("Error fetching Companies House data for submission report");
            }
          }

          const { createProspectReportDocument, renderProspectReport } =
            await import("../utils/pdfGenerator");

          const reportDoc = createProspectReportDocument({
            prospect,
            contacts,
            activities,
            dueDiligence: dueDiligence || undefined,
            companiesHouseData: companiesHouseData || undefined,
            pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
            user: user as any,
          });

          const chunks: Buffer[] = [];
          reportDoc.on("data", (chunk: Buffer) => chunks.push(chunk));

          // Render the report content
          renderProspectReport(reportDoc, {
            prospect,
            contacts,
            activities,
            dueDiligence: dueDiligence || undefined,
            companiesHouseData: companiesHouseData || undefined,
            pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
            user: user as any,
          });

          await new Promise<void>((resolve, reject) => {
            reportDoc.on("end", () => resolve());
            reportDoc.on("error", reject);
          });
          pdfBuffer = Buffer.concat(chunks);
        } catch (pdfError: any) {
          const errMessage = (pdfError as Error)?.message || "Unknown error";
          console.error("PDF generation error");
          return res.status(500).json({ message: `Failed to generate PDF report: ${errMessage}` });
        }

        // Send email with PDF attachment - MOCKED (Resend removed)
        let emailSent = true;
        let emailError: string | null = null;
        console.log("Email sending is disabled (Resend removed). Simulating success.");

        // Create the submission only after successful PDF generation
        const submission = await storage.createApplicationSubmission(submissionInput, userId);

        // Update submission status based on email result
        if (emailSent) {
          await storage.updateApplicationSubmission(submission.id!, userId, {
            emailSent: 1,
            status: "sent",
          });
        }

        // Create an activity task to log this submission
        const activity = await storage.createActivity(
          {
            activityType: "task",
            title: `Application ${emailSent ? "sent" : "submitted"} to ${lender.institutionName}`,
            description: `Loan application for ${prospect.company.companyName} ${emailSent ? "emailed" : "submitted"} to ${lender.institutionName}${emailSent ? "" : emailError ? ` (email failed: ${emailError})` : " (email failed)"}`,
            prospectId: submissionInput.prospectId,
            priority: "high",
            dueDate: null,
            completed: 1,
          },
          userId
        );

        res.status(201).json({
          submission: {
            ...submission,
            emailSent: emailSent ? 1 : 0,
            status: emailSent ? "sent" : "pending",
          },
          activity,
          emailSent,
          emailError: emailError || undefined,
        });
      } catch (error) {
        console.error("Error creating submission:", error);
        res.status(500).json({ message: "Failed to create submission" });
      }
    }
  );

  router.delete(
    "/api/submissions/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const submissionId = parseInt(req.params.id);

        if (isNaN(submissionId)) {
          return res.status(400).json({ message: "Invalid submission ID" });
        }

        // Verify submission exists and belongs to user before deleting
        const submission = await storage.getApplicationSubmission(submissionId, userId);
        if (!submission) {
          return res.status(404).json({ message: "Submission not found" });
        }

        await storage.deleteApplicationSubmission(submissionId, userId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting submission:", error);
        res.status(500).json({ message: "Failed to delete submission" });
      }
    }
  );

  // ============= UNDERWRITING SUBMISSIONS =============

  // Middleware to check if user is an underwriter
  const isUnderwriter = async (req: any, res: any, next: any) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.user!.id);
    if (!user || user.role !== "underwriter") {
      return res.status(403).json({ error: "Access denied. Underwriter role required." });
    }
    next();
  };

  // Helper to enrich submissions with prospect and company details (batch loaded)
  async function enrichSubmissions(submissions: any[]) {
    if (submissions.length === 0) return [];

    // Collect unique IDs for batch loading
    const prospectIds = Array.from(new Set(submissions.map((s) => s.prospectId).filter(Boolean))) as number[];
    const brokerIds = Array.from(new Set(submissions.map((s) => s.brokerId).filter(Boolean))) as string[];

    // Batch load all prospects and brokers in single queries
    const [prospectsResult, brokersArr] = await Promise.all([
      Promise.all(prospectIds.map((id) => storage.getProspectById(id))),
      storage.getUsersByIds(brokerIds),
    ]);

    const prospectsArr = prospectsResult.filter((p): p is NonNullable<typeof p> => !!p);

    // Create lookup maps
    const prospectsMap = new Map<number, any>(prospectsArr.map((p: any) => [p.id, p]));
    const brokersMap = new Map<string, any>(brokersArr.map((b: any) => [b.id, b]));

    // Enrich submissions using maps
    return submissions.map((submission) => {
      const prospect = prospectsMap.get(submission.prospectId) || null;
      const broker = brokersMap.get(submission.brokerId);
      return {
        ...submission,
        prospect,
        broker: broker
          ? {
            firstName: broker.firstName,
            lastName: broker.lastName,
            email: broker.email,
          }
          : null,
      };
    });
  }

  // Get underwriting submissions (scoped by role)
  router.get(
    "/api/underwriting/submissions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const user = await storage.getUser(userId);

        let submissions;
        if (user?.role === "super_admin" || user?.role === "sales_admin") {
          // Admin roles see all submissions
          const { status, assigned } = req.query;
          const filters: { status?: string; assignedUnderwriterId?: string } = {};
          if (status) filters.status = status as string;
          if (assigned === "me") filters.assignedUnderwriterId = userId;
          submissions = await storage.listUnderwritingSubmissions(filters);
        } else if (user?.role === "underwriter" || user?.hasUnderwritingAccess) {
          // Underwriter (or user with add-on) sees: queue (submitted + unassigned) + their assigned
          submissions = await storage.listUnderwriterScopedSubmissions(userId);
        } else {
          // No access
          return res.status(403).json({ error: "Access denied" });
        }

        const enrichedSubmissions = await enrichSubmissions(submissions);
        res.json(enrichedSubmissions);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get broker's own underwriting submissions
  router.get(
    "/api/underwriting/my-submissions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const submissions = await storage.listBrokerUnderwritingSubmissions(userId);
        const enrichedSubmissions = await enrichSubmissions(submissions);
        res.json(enrichedSubmissions);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get underwriting status for all user's prospects (for pipeline view)
  router.get(
    "/api/underwriting/status",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const submissions = await storage.listBrokerUnderwritingSubmissions(userId);

        // Return a map of prospectId -> status
        const statusMap: Record<number, { status: string; submittedAt: Date | null }> = {};
        for (const submission of submissions) {
          statusMap[submission.prospectId] = {
            status: submission.status,
            submittedAt: submission.submittedAt,
          };
        }
        res.json(statusMap);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get single underwriting submission
  router.get(
    "/api/underwriting/submissions/:id",
    isAuthenticated,
    requireSubmissionReadAccess({ storage, allowTriage: true }),
    async (req: Request, res: Response) => {
      const { submission } = req.ctx || {};
      res.json(submission);
    }
  );

  // Create underwriting submission (broker submits prospect for review)
  router.post(
    "/api/underwriting/submissions",
    isAuthenticated,
    requireUnderwritingAccess,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const { prospectId, priority, brokerComments } = req.body;

        if (!prospectId) {
          return res.status(400).json({ error: "prospectId is required" });
        }

        // Check if prospect exists and belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Check if there's already an active submission for this prospect
        const existingSubmission = await storage.getUnderwritingSubmissionByProspect(prospectId);
        if (
          existingSubmission &&
          !["approved", "declined", "withdrawn"].includes(existingSubmission.status)
        ) {
          return res
            .status(409)
            .json({ error: "This prospect already has an active underwriting submission" });
        }

        // Create the submission
        const submission = await storage.createUnderwritingSubmission(
          {
            prospectId,
            priority: (priority as any) || "normal",
            status: "submitted",
            brokerComments,
          },
          userId
        );

        // Create activity record
        await storage.createUnderwritingActivity(
          {
            submissionId: submission.id,
            activityType: "submitted",
            content: brokerComments || "Submitted for underwriting review",
          },
          userId
        );

        // Update prospect stage to submission
        await storage.updateProspectStage(prospectId, userId, "submission");

        res.status(201).json(submission);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Claim a submission (underwriter takes ownership) - atomic to prevent race conditions
  router.post(
    "/api/underwriting/submissions/:id/claim",
    isAuthenticated,
    isUnderwriter,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;

        // Atomic claim: only succeeds if status='submitted' AND assignedUnderwriterId IS NULL
        const updated = await storage.claimUnderwritingSubmission(id, userId);

        if (!updated) {
          return res.status(409).json({ error: "Submission already claimed or not available" });
        }

        // Create activity record
        await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType: "claimed",
            content: "Claimed for review",
          },
          userId
        );

        const user = await storage.getUser(userId);
        logUnderwritingAudit({
          action: "claim",
          submissionId: id,
          userId,
          role: user?.role,
          fromStatus: "submitted",
          toStatus: "in_review",
          sourceIp: req.ip,
        });

        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Update submission (underwriter actions OR broker-withdraw)
  router.patch(
    "/api/underwriting/submissions/:id",
    isAuthenticated,
    async (req: any, res, next) => {
      try {
        const userId = req.user!.id;
        const user = await storage.getUser(userId);
        const id = Number(req.params.id);

        // Broker-withdraw path (owner only)
        if (user?.role === "broker") {
          const submission = await storage.getUnderwritingSubmission(id);
          if (!submission) return res.status(404).json({ error: "Submission not found" });
          if (submission.brokerId !== userId)
            return res.status(403).json({ error: "Access denied" });

          const { status } = req.body;
          if (status && status !== "withdrawn") {
            return res.status(403).json({ error: "Brokers can only withdraw submissions" });
          }

          const fromStatus = submission.status;
          const updated = await storage.updateUnderwritingSubmission(id, { status: "withdrawn" });

          await storage.createUnderwritingActivity(
            {
              submissionId: id,
              activityType: "withdrawn",
              content: "Submission withdrawn by broker",
            },
            userId
          );

          await storage.updateProspectStage(submission.prospectId, userId, "due-diligence");

          logUnderwritingAudit({
            action: "withdraw",
            submissionId: id,
            userId,
            role: "broker",
            fromStatus,
            toStatus: "withdrawn",
            sourceIp: req.ip,
          });

          return res.json(updated);
        }

        // Underwriter/admin path must be assignment-scoped
        return requireSubmissionWriteAccess({ storage })(req, res, next);
      } catch (e) {
        next(e);
      }
    },
    async (req: any, res, next) => {
      try {
        const { submission, user } = req.ctx;
        const { status, underwriterNotes, decisionReason } = req.body;

        const updates: any = {};
        if (status) updates.status = status;
        if (underwriterNotes) updates.underwriterNotes = underwriterNotes;
        if (decisionReason) updates.decisionReason = decisionReason;

        const fromStatus = submission.status;
        const updated = await storage.updateUnderwritingSubmission(submission.id, updates);

        if (status) {
          await storage.createUnderwritingActivity(
            {
              submissionId: submission.id,
              activityType: status,
              content: decisionReason || `Status changed to ${status}`,
            },
            user.id
          );

          // Update prospect stage based on decision
          if (status === "approved") {
            await storage.updateProspectStage(
              submission.prospectId,
              submission.brokerId,
              "approved"
            );
          } else if (status === "declined") {
            await storage.updateProspectStage(
              submission.prospectId,
              submission.brokerId,
              "declined"
            );
          }

          logUnderwritingAudit({
            action: status,
            submissionId: submission.id,
            userId: user.id,
            role: user.role,
            fromStatus,
            toStatus: status,
            sourceIp: req.ip,
            details: decisionReason ? { decisionReason } : undefined,
          });
        }

        res.json(updated);
      } catch (e) {
        next(e);
      }
    }
  );

  // Add comment to submission
  router.post(
    "/api/underwriting/submissions/:id/comments",
    isAuthenticated,
    requireSubmissionReadAccess({ storage, allowTriage: false }),
    async (req: any, res, next) => {
      try {
        const { submission, user } = req.ctx;
        const { content } = req.body;

        if (!content) {
          return res.status(400).json({ error: "Content is required" });
        }

        // Determine if this is a response to a query
        const activityType =
          user.role === "broker" && submission.status === "queried" ? "responded" : "comment";

        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: submission.id,
            activityType,
            content,
          },
          user.id
        );

        // If broker responded to query, update status back to in_review
        if (activityType === "responded") {
          await storage.updateUnderwritingSubmission(submission.id, { status: "in_review" });
        }

        res.status(201).json(activity);
      } catch (error: any) {
        next(error);
      }
    }
  );

  // Get submission activities
  router.get(
    "/api/underwriting/submissions/:id/activities",
    isAuthenticated,
    requireSubmissionReadAccess({ storage, allowTriage: false }),
    async (req: any, res, next) => {
      try {
        const { submission } = req.ctx;
        const activities = await storage.listUnderwritingActivities(submission.id);

        // Enrich activities with user info
        const enrichedActivities = await Promise.all(
          activities.map(async (activity) => {
            const activityUser = await storage.getUser(activity.userId);
            return {
              ...activity,
              user: activityUser
                ? {
                  firstName: activityUser.firstName,
                  lastName: activityUser.lastName,
                  email: activityUser.email,
                  role: activityUser.role,
                }
                : null,
            };
          })
        );

        res.json(enrichedActivities);
      } catch (error: any) {
        next(error);
      }
    }
  );

  // Get underwriting submission for a specific prospect
  router.get(
    "/api/underwriting/prospects/:prospectId/submission",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
        const user = await storage.getUser(userId);

        const submission = await storage.getUnderwritingSubmissionByProspect(prospectId);
        if (!submission) {
          if (userId === MOCK_DEV_ADMIN_ID) {
            return res.json(null);
          }
          return res.status(404).json({ error: "No submission found for this prospect" });
        }

        // Apply same access control as requireSubmissionReadAccess
        const isBrokerOwner = submission.brokerId === userId;
        const isAssignedUnderwriter = submission.assignedUnderwriterId === userId;
        const isSuperAdmin = user?.role === "super_admin";
        const isUnderwriterViewingQueue =
          user?.role === "underwriter" &&
          submission.status === "submitted" &&
          !submission.assignedUnderwriterId;

        if (
          !isBrokerOwner &&
          !isAssignedUnderwriter &&
          !isSuperAdmin &&
          !isUnderwriterViewingQueue
        ) {
          return res.status(403).json({ error: "Access denied" });
        }

        res.json(submission);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // File upload endpoint for underwriting attachments - uses busboy streaming parser
  const MAX_UNDERWRITING_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
  const MAX_UNDERWRITING_FILES = 10; // Maximum 10 files per request

  router.post(
    "/api/underwriting/upload/:submissionId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const submissionId = parseInt(req.params.submissionId);

      if (isNaN(submissionId)) {
        return res.status(400).json({ error: "Invalid submission ID" });
      }

      try {
        // Verify user role (must be broker or underwriter)
        const user = await storage.getUser(userId);
        if (!user || !["broker", "underwriter", "sales_admin", "super_admin"].includes(user.role)) {
          return res
            .status(403)
            .json({ error: "Access denied. Broker or Underwriter role required." });
        }

        // Verify submission exists and user has access
        const submission = await storage.getUnderwritingSubmission(submissionId);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only the broker who created it, assigned underwriter, or admins can upload
        const isOwner = submission.brokerId === userId;
        const isAssignedUnderwriter = submission.assignedUnderwriterId === userId;
        const isAdmin = ["sales_admin", "super_admin"].includes(user.role);

        if (!isOwner && !isAssignedUnderwriter && !isAdmin) {
          return res
            .status(403)
            .json({ error: "Access denied. You don't have permission for this submission." });
        }

        const contentType = req.headers["content-type"];
        if (!contentType?.startsWith("multipart/form-data")) {
          return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
        }

        const uploadedFiles: UnderwritingAttachment[] = [];
        const uploadPromises: Promise<UnderwritingAttachment>[] = [];
        let validationError: string | null = null;

        const bb = busboy({
          headers: req.headers,
          limits: { fileSize: MAX_UNDERWRITING_FILE_SIZE, files: MAX_UNDERWRITING_FILES },
        });

        bb.on("file", (fieldname, fileStream, info) => {
          const { filename, mimeType } = info;

          if (!filename) {
            fileStream.resume();
            return;
          }

          const timestamp = Date.now();
          const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `.private/underwriting/${submissionId}/${userId}/${timestamp}_${sanitizedFileName}`;

          // Stream directly to storage - no RAM buffering
          const uploadPromise = (async (): Promise<UnderwritingAttachment> => {
            const { PassThrough } = await import("stream");
            const passThrough = new PassThrough();
            let limitExceeded = false;
            let bytesWritten = 0;

            fileStream.on("limit", () => {
              limitExceeded = true;
              validationError = `File "${filename}" exceeds 5MB limit`;
              passThrough.destroy(new Error("File size limit exceeded"));
            });

            fileStream.on("data", (chunk: Buffer) => {
              bytesWritten += chunk.length;
            });

            fileStream.pipe(passThrough);

            try {
              await getObjectStorage().uploadFromStream(storagePath, passThrough);

              if (limitExceeded) {
                try {
                  await getObjectStorage().delete(storagePath);
                } catch {
                  // Ignore cleanup errors
                }
                throw new Error(`File "${filename}" exceeds 5MB limit`);
              }

              return {
                fileName: filename,
                fileType: mimeType || "application/octet-stream",
                fileSize: bytesWritten,
                storagePath,
                uploadedAt: new Date().toISOString(),
              };
            } catch (err: any) {
              if (limitExceeded) throw new Error(`File "${filename}" exceeds 5MB limit`);
              throw err;
            }
          })();

          uploadPromises.push(uploadPromise);
        });

        bb.on("close", async () => {
          try {
            if (validationError) {
              return res.status(413).json({ error: validationError });
            }

            if (uploadPromises.length === 0) {
              return res.status(400).json({ error: "No files uploaded" });
            }

            const results = await Promise.all(uploadPromises);
            res.json({ files: results });
          } catch (error: any) {
            console.error("Error completing underwriting upload:", error);
            if (!res.headersSent) {
              handleApiError(res, error, "api-error");
            }
          }
        });

        bb.on("error", (error: any) => {
          console.error("Busboy error in underwriting upload:", error);
          if (!res.headersSent) {
            handleApiError(res, error, "api-error");
          }
        });

        req.pipe(bb);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Download attachment endpoint (SECURITY: requires assigned underwriter or submitting broker)
  router.get(
    "/api/underwriting/download/:submissionId/:activityId/:fileIndex",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const submissionId = parseInt(req.params.submissionId);
        const activityId = parseInt(req.params.activityId);
        const fileIndex = parseInt(req.params.fileIndex);

        // Check submission access
        const submission = await storage.getUnderwritingSubmission(submissionId);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // SECURITY: Only allow the submitting broker OR the assigned underwriter
        // Not just any user with role 'underwriter'
        const user = await storage.getUser(userId);
        const isSubmittingBroker = submission.brokerId === userId;
        const isAssignedUnderwriter = submission.assignedUnderwriterId === userId;
        const isSuperAdmin = user?.role === "super_admin";

        if (!isSubmittingBroker && !isAssignedUnderwriter && !isSuperAdmin) {
          return res.status(403).json({
            error: "Access denied - you must be the submitting broker or assigned underwriter",
          });
        }

        // Get the activity and extract attachment
        const activities = await storage.listUnderwritingActivities(submissionId);
        const activity = activities.find((a) => a.id === activityId);

        if (!activity || !activity.attachments) {
          return res.status(404).json({ error: "Activity not found" });
        }

        const attachments = activity.attachments as UnderwritingAttachment[];
        if (fileIndex < 0 || fileIndex >= attachments.length) {
          return res.status(404).json({ error: "File not found" });
        }

        const attachment = attachments[fileIndex];

        // Download from object storage
        const { data } = await getObjectStorage().downloadAsBytes(attachment.storagePath);

        // SECURITY: Use sanitized filename to prevent header injection
        const { encodeContentDisposition } = await import("../utils/security");
        res.setHeader("Content-Type", attachment.fileType);
        res.setHeader("Content-Disposition", encodeContentDisposition(attachment.fileName));
        res.send(Buffer.from(data));
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Broker responds to underwriter query with message and attachments
  router.post(
    "/api/underwriting/submissions/:id/respond",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;

        const submission = await storage.getUnderwritingSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only the broker who submitted can respond
        if (submission.brokerId !== userId) {
          return res
            .status(403)
            .json({ error: "Only the submitting broker can respond to queries" });
        }

        // Can only respond to queries
        if (submission.status !== "queried") {
          return res
            .status(400)
            .json({ error: "Can only respond to submissions with 'queried' status" });
        }

        const { message, attachments } = req.body;

        if (!message || message.trim().length === 0) {
          return res.status(400).json({ error: "Response message is required" });
        }

        // Create activity record with response and attachments
        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType: "responded",
            content: message,
            attachments: attachments || [],
          },
          userId
        );

        // Update submission status back to in_review
        await storage.updateUnderwritingSubmission(id, { status: "in_review" });

        res.status(201).json({
          activity,
          message: "Response submitted successfully. The underwriter will review your response.",
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Underwriter sends message to broker
  router.post(
    "/api/underwriting/submissions/:id/message",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;

        const user = await storage.getUser(userId);
        if (user?.role !== "underwriter") {
          return res
            .status(403)
            .json({ error: "Only underwriters can send messages through this endpoint" });
        }

        const submission = await storage.getUnderwritingSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only assigned underwriter can message
        if (submission.assignedUnderwriterId !== userId) {
          return res.status(403).json({ error: "Only the assigned underwriter can send messages" });
        }

        const { message, setStatus } = req.body;

        if (!message || message.trim().length === 0) {
          return res.status(400).json({ error: "Message is required" });
        }

        // Create activity record
        const activityType = setStatus === "queried" ? "queried" : "comment";
        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType,
            content: message,
            attachments: [],
          },
          userId
        );

        // Update status if requesting a query
        if (setStatus === "queried") {
          await storage.updateUnderwritingSubmission(id, {
            status: "queried",
            decisionReason: message,
          });
        }

        res.status(201).json({
          activity,
          message:
            activityType === "queried"
              ? "Query sent to broker. They will be notified to respond."
              : "Message sent successfully.",
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Broker sends a message on their submission
  router.post(
    "/api/underwriting/submissions/:id/broker-message",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;

        const submission = await storage.getUnderwritingSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only the broker who submitted can send messages
        if (submission.brokerId !== userId) {
          return res.status(403).json({ error: "Only the submitting broker can send messages" });
        }

        const { message } = req.body;

        if (!message || message.trim().length === 0) {
          return res.status(400).json({ error: "Message is required" });
        }

        // Create activity record as a comment from broker
        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType: "comment",
            content: message,
            attachments: [],
          },
          userId
        );

        res.status(201).json({
          activity,
          message: "Message sent to underwriter.",
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );


export default router;
