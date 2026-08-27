import { Router } from "express";
import type { Request, Response } from "express";
import { PassThrough, Transform } from "stream";
import busboy from "busboy";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { createErrorResponse } from "../utils/errorResponse";
import { fromZodError } from "zod-validation-error";
import { isSvgContent, hasValidImageMagicBytes } from "../utils/security";
import { getObjectStorage } from "../utils/routerHelpers";

const router = Router();

router.get("/auth/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      // Add no-store cache header for sensitive auth data
      res.setHeader("Cache-Control", "no-store");
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res
        .status(500)
        .json(createErrorResponse(error as Error, 500, (req as any).requestId, "Failed to fetch user"));
    }
  });

  // Recursive schema for PDF sections
  const pdfSectionSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
      id: z.string(),
      label: z.string(),
      enabled: z.boolean(),
      type: z.enum(["module", "structure", "container"]).optional(),
      subtype: z.enum(["pageBreak", "divider", "spacer", "2-column"]).optional(),
      columns: z.array(z.array(pdfSectionSchema)).optional(),
    })
  );

  // User settings API
  const updateUserSettingsSchema = z.object({
    currency: z.string().optional(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    theme: z.string().optional(),
    pipelineStageNames: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          color: z.string(),
        })
      )
      .optional(),
    pdfLayoutPreferences: z
      .object({
        sections: z.array(pdfSectionSchema),
        header: z // Added header config validation if missing
          .object({
            title: z.string(),
            showDate: z.boolean(),
            showUser: z.boolean(),
          })
          .optional(),
      })
      .optional(),
    brandingPrimaryColor: z.string().optional().nullable(),
    brandingAccentColor: z.string().optional().nullable(),
    brandingLogoUrl: z.string().optional().nullable(),
    aiDataConsent: z.number().int().min(0).max(1).optional(),
  });

router.patch(
    "/user/settings",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const result = updateUserSettingsSchema.safeParse(req.body);

        if (!result.success) {
          const humanError = fromZodError(result.error);
          return res.status(400).json({ error: humanError.message });
        }

        const updateData: any = { ...result.data };

        // Track consent timestamp when AI consent is granted
        if (result.data.aiDataConsent === 1) {
          const currentUser = await storage.getUser(userId);
          if (currentUser && (currentUser as any).aiDataConsent !== 1) {
            updateData.aiDataConsentAt = new Date();
            console.info(
              JSON.stringify({
                type: "ai_consent_granted",
                userId,
                timestamp: new Date().toISOString(),
              })
            );
          }
        }

        const updatedUser = await storage.updateUser(userId, updateData);
        if (!updatedUser) {
          return res.status(404).json(createErrorResponse("User not found", 404, (req as any).requestId));
        }

        res.json(updatedUser);
      } catch (error: any) {
        console.error("Error updating user settings:", error);
        res
          .status(500)
          .json(createErrorResponse(error, 500, (req as any).requestId, "Failed to update settings"));
      }
    }
  );

  // Upload branding logo - uses busboy + streaming upload to object storage
  // No RAM buffering: files stream directly to storage via uploadFromStream
  const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB limit

router.post(
    "/api/user/branding/logo",
    isAuthenticated,
    (req: Request, res: Response) => {
      const userId = req.user!.id;

      const contentType = req.headers["content-type"];
      if (!contentType?.startsWith("multipart/form-data")) {
        return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
      }

      let uploadPromise: Promise<string> | null = null;
      let validationError: string | null = null;

      try {
        const bb = busboy({
          headers: req.headers,
          limits: { fileSize: MAX_LOGO_SIZE, files: 1 },
        });

        bb.on("file", (fieldname, fileStream, info) => {
          const { filename, mimeType } = info;

          // SECURITY: Normalize MIME type (lowercase, strip parameters like charset)
          const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();

          // SECURITY: Check file extension case-insensitively
          const extension = (filename.split(".").pop() || "").toLowerCase();
          const isSvgExtension = extension === "svg" || extension === "svgz";
          const isSvgMime = normalizedMime === "image/svg+xml";

          // Early MIME type validation - drain stream immediately if invalid
          // SECURITY: Block SVG uploads - SVG can contain embedded JavaScript (XSS vector)
          if (!normalizedMime.startsWith("image/") || isSvgMime || isSvgExtension) {
            validationError =
              isSvgMime || isSvgExtension
                ? "SVG files are not allowed for security reasons. Please use PNG, JPEG, or WebP."
                : "Only image files are allowed for logos";
            fileStream.resume();
            return;
          }

          // SECURITY: Only allow safe image extensions
          const allowedExtensions = ["png", "jpg", "jpeg", "gif", "webp"];
          if (!allowedExtensions.includes(extension)) {
            validationError = `File extension '.${extension}' is not allowed. Please use PNG, JPEG, GIF, or WebP.`;
            fileStream.resume();
            return;
          }

          const timestamp = Date.now();
          const logoFileName = `${userId}_logo_${timestamp}.${extension}`;
          const storagePath = `public/branding/${logoFileName}`;

          // Stream to storage with content validation
          uploadPromise = (async () => {
            // const { PassThrough, Transform } = await import("stream");
            // const { isSvgContent, hasValidImageMagicBytes } = await import("../utils/security");

            const passThrough = new PassThrough();
            let limitExceeded = false;
            let magicBytesValidated = false;
            let accumulatedBuffer: Buffer = Buffer.alloc(0);
            const MAX_VALIDATION_SIZE = 4096; // Accumulate up to 4KB for SVG pattern detection

            fileStream.on("limit", () => {
              limitExceeded = true;
              validationError = "Logo file must be under 2MB";
              passThrough.destroy(new Error("File size limit exceeded"));
            });

            // SECURITY: Create transform stream with robust validation
            // Strategy: Validate magic bytes immediately, then continue scanning for SVG patterns
            const validationTransform = new Transform({
              transform(chunk, encoding, callback) {
                // Always accumulate for ongoing SVG detection (up to limit)
                if (accumulatedBuffer.length < MAX_VALIDATION_SIZE) {
                  accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);
                }

                // SECURITY: Validate magic bytes FIRST (only needs first few bytes)
                if (!magicBytesValidated && accumulatedBuffer.length >= 12) {
                  if (!hasValidImageMagicBytes(accumulatedBuffer)) {
                    validationError =
                      "Invalid image file - content does not match a recognized image format (PNG, JPEG, GIF, or WebP).";
                    passThrough.destroy(new Error(validationError));
                    return;
                  }
                  magicBytesValidated = true;
                }

                // SECURITY: Continuously check for SVG patterns in accumulated buffer
                // This catches split-chunk SVG attacks
                if (isSvgContent(accumulatedBuffer)) {
                  validationError =
                    "File content appears to be SVG disguised as another format. SVG files are not allowed.";
                  passThrough.destroy(new Error(validationError));
                  return;
                }

                // Only pass through data after magic bytes validated
                if (magicBytesValidated) {
                  callback(null, chunk);
                } else {
                  callback();
                }
              },
              flush(callback) {
                // Final validation for small files
                if (!magicBytesValidated && accumulatedBuffer.length > 0) {
                  if (!hasValidImageMagicBytes(accumulatedBuffer)) {
                    validationError =
                      "Invalid image file - content does not match a recognized image format.";
                    passThrough.destroy(new Error(validationError));
                    return;
                  }
                  // Final SVG check
                  if (isSvgContent(accumulatedBuffer)) {
                    validationError = "File content appears to be SVG disguised as another format.";
                    passThrough.destroy(new Error(validationError));
                    return;
                  }
                  // Push buffered data for small files
                  this.push(accumulatedBuffer);
                }
                callback();
              },
            });

            fileStream.pipe(validationTransform).pipe(passThrough);

            try {
              await getObjectStorage().uploadFromStream(storagePath, passThrough);

              if (limitExceeded || validationError) {
                // Clean up partial upload
                try {
                  await getObjectStorage().delete(storagePath);
                } catch {
                  // Ignore cleanup errors
                }
                throw new Error(validationError || "File size limit exceeded");
              }

              const logoUrl = `/public-objects/branding/${logoFileName}`;
              await storage.updateUser(userId, { brandingLogoUrl: logoUrl });
              return logoUrl;
            } catch (err: any) {
              if (limitExceeded) throw new Error("Logo file must be under 2MB");
              if (validationError) throw new Error(validationError);
              throw err;
            }
          })();
        });

        bb.on("close", async () => {
          try {
            if (validationError) {
              return res.status(400).json({ error: validationError });
            }

            if (!uploadPromise) {
              return res.status(400).json({ error: "No logo file uploaded" });
            }

            const logoUrl = await uploadPromise;
            res.json({ logoUrl, message: "Logo uploaded successfully" });
          } catch (error: any) {
            console.error("Error completing logo upload:", error);
            if (!res.headersSent) {
              handleApiError(res, error, "api-error");
            }
          }
        });

        bb.on("error", (error: any) => {
          console.error("Busboy error:", error);
          if (!res.headersSent) {
            handleApiError(res, error, "api-error");
          }
        });

        req.pipe(bb);
      } catch (error: any) {
        console.error("Error uploading logo:", error);
        if (!res.headersSent) {
          handleApiError(res, error, "api-error");
        }
      }
    }
  );

  // Delete branding logo
router.delete(
    "/api/user/branding/logo",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;

        // Clear the logo URL from user settings
        await storage.updateUser(userId, { brandingLogoUrl: null });

        res.json({ message: "Logo removed successfully" });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // =====================================
  // Onboarding API endpoints
  // =====================================

  // Get onboarding state
router.get(
    "/api/user/onboarding",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json(createErrorResponse("User not found", 404, (req as any).requestId));
        }

        const enabled = (user as any).onboardingEnabled === 1;
        const progress = (user as any).onboardingProgress || {
          completed: [],
          currentStep: null,
          startedAt: null,
          completedAt: null,
        };

        res.json({ enabled, progress });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Update onboarding state
  const updateOnboardingSchema = z.object({
    enabled: z.boolean().optional(),
    progress: z
      .object({
        completed: z.array(z.string()).optional(),
        currentStep: z.string().nullable().optional(),
        startedAt: z.string().nullable().optional(),
        completedAt: z.string().nullable().optional(),
      })
      .optional(),
  });

router.patch(
    "/api/user/onboarding",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const result = updateOnboardingSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).message });
        }

        const updateData: any = {};

        if (result.data.enabled !== undefined) {
          updateData.onboardingEnabled = result.data.enabled ? 1 : 0;
        }

        if (result.data.progress) {
          // Get current progress and merge with updates
          const user = await storage.getUser(userId);
          const currentProgress = (user as any)?.onboardingProgress || {
            completed: [],
            currentStep: null,
            startedAt: null,
            completedAt: null,
          };

          updateData.onboardingProgress = {
            ...currentProgress,
            ...result.data.progress,
          };
        }

        const updatedUser = await storage.updateUser(userId, updateData);
        if (!updatedUser) {
          return res.status(404).json(createErrorResponse("User not found", 404, (req as any).requestId));
        }

        res.json({
          enabled: (updatedUser as any).onboardingEnabled === 1,
          progress: (updatedUser as any).onboardingProgress,
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Complete an onboarding step
router.post(
    "/api/user/onboarding/complete-step",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const { stepId } = req.body;

        if (!stepId || typeof stepId !== "string") {
          return res.status(400).json({ error: "stepId is required" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json(createErrorResponse("User not found", 404, (req as any).requestId));
        }

        const currentProgress = (user as any).onboardingProgress || {
          completed: [],
          currentStep: null,
          startedAt: null,
          completedAt: null,
        };

        // Add step to completed list if not already there
        const completedSet = new Set(currentProgress.completed);
        completedSet.add(stepId);

        const newProgress = {
          ...currentProgress,
          completed: Array.from(completedSet),
        };

        // Check if all steps complete (5 total checklist items)
        if (completedSet.size >= 5 && !currentProgress.completedAt) {
          newProgress.completedAt = new Date().toISOString();
        }

        await storage.updateUser(userId, { onboardingProgress: newProgress });

        res.json({ success: true, progress: newProgress });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Reset onboarding
router.post(
    "/api/user/onboarding/reset",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;

        const freshProgress = {
          completed: [],
          currentStep: null,
          startedAt: null,
          completedAt: null,
        };

        await storage.updateUser(userId, {
          onboardingEnabled: 1,
          onboardingProgress: freshProgress,
        });

        res.json({ success: true, enabled: true, progress: freshProgress });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

router.get("/auth/role", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      // No-store cache for sensitive auth data
      res.setHeader("Cache-Control", "no-store");
      res.json({ role: user?.role || "broker" });
    } catch (error: any) {
      console.error("Error getting user role:", error);
      res
        .status(500)
        .json(createErrorResponse(error, 500, (req as any).requestId, "Failed to get user role"));
    }
  });

  // Update current user role
  // SECURITY: In production (NODE_ENV !== 'development'), only super_admin can change roles
  // DEVELOPMENT: Self role switching is allowed for testing when NODE_ENV === 'development'
router.post("/auth/role", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { role, targetUserId } = req.body;
      const currentUser = await storage.getUser(userId);

      const validRoles = ["super_admin", "sales_admin", "broker", "underwriter"];
      if (!role || !validRoles.includes(role)) {
        return res
          .status(400)
          .json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      }

      // Check if testing mode is enabled
      const testingModeEnabled = process.env.NODE_ENV === "development";

      // If changing another user's role, must be super_admin
      if (targetUserId && targetUserId !== userId) {
        if (currentUser?.role !== "super_admin") {
          return res.status(403).json({ error: "Only Super Admin can change other users' roles" });
        }
        await storage.updateUser(targetUserId, { role });
        return res.json({ role, message: `User role updated to ${role}` });
      }

      // Self role switching - only allowed for super_admin OR in testing mode
      if (currentUser?.role !== "super_admin") {
        if (!testingModeEnabled) {
          return res.status(403).json({ error: "Only Super Admin can change roles" });
        }
        // In development mode, allow self-switching with a warning
        console.warn(
          `[DEV MODE] User ${userId} switching own role to ${role} - disabled in production`
        );
      }

      await storage.updateUser(userId, { role });
      res.json({ role, message: `Role updated to ${role}` });
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // ============ TEAM MANAGEMENT ============

  // Get all users (super_admin only)
router.get("/admin/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || currentUser.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can access this endpoint" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get all teams (super_admin and sales_admin only)
router.get("/teams", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const teams = await storage.getTeams(user.role === "super_admin" ? undefined : userId);
      res.json(teams);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Create a new team (super_admin and sales_admin only)
router.post("/teams", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Team name is required" });
      }

      const team = await storage.createTeam({ name, description }, userId);
      res.status(201).json(team);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get team by ID with members
router.get("/teams/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      const teamId = parseInt(req.params.id);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const team = await storage.getTeamWithMembers(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Sales admin can only access teams they created or are admin of
      if (user.role === "sales_admin") {
        const isOwner = team.createdBy === userId;
        const isTeamAdmin = team.members.some(
          (m) => m.userId === userId && m.memberRole === "admin"
        );
        if (!isOwner && !isTeamAdmin) {
          return res.status(403).json({ error: "You don't have permission to view this team" });
        }
      }

      res.json(team);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Add member to team
router.post(
    "/api/teams/:id/members",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const user = await storage.getUser(userId);
        const teamId = parseInt(req.params.id);

        if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
          return res.status(403).json({ error: "Access denied. Admin role required." });
        }

        // Verify team ownership for sales_admin
        if (user.role === "sales_admin") {
          const team = await storage.getTeamWithMembers(teamId);
          if (!team) {
            return res.status(404).json({ error: "Team not found" });
          }
          const isOwner = team.createdBy === userId;
          const isTeamAdmin = team.members.some(
            (m) => m.userId === userId && m.memberRole === "admin"
          );
          if (!isOwner && !isTeamAdmin) {
            return res.status(403).json({ error: "You don't have permission to modify this team" });
          }
        }

        const { userId: memberUserId, memberRole } = req.body;
        if (!memberUserId) {
          return res.status(400).json({ error: "User ID is required" });
        }

        const member = await storage.addTeamMember({
          teamId,
          userId: memberUserId,
          memberRole: memberRole || "member",
        });
        res.status(201).json(member);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Remove member from team
router.delete(
    "/api/teams/:teamId/members/:userId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const currentUserId = req.user!.id;
        const user = await storage.getUser(currentUserId);
        const teamId = parseInt(req.params.teamId);
        const memberUserId = req.params.userId;

        if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
          return res.status(403).json({ error: "Access denied. Admin role required." });
        }

        // Verify team ownership for sales_admin
        if (user.role === "sales_admin") {
          const team = await storage.getTeamWithMembers(teamId);
          if (!team) {
            return res.status(404).json({ error: "Team not found" });
          }
          const isOwner = team.createdBy === currentUserId;
          const isTeamAdmin = team.members.some(
            (m) => m.userId === currentUserId && m.memberRole === "admin"
          );
          if (!isOwner && !isTeamAdmin) {
            return res.status(403).json({ error: "You don't have permission to modify this team" });
          }
        }

        await storage.removeTeamMember(teamId, memberUserId);
        res.json({ message: "Member removed from team" });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get user's teams
router.get("/my-teams", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get all users for team management (super_admin and sales_admin only)
router.get("/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Update user role (super_admin only)
router.patch(
    "/api/users/:id/role",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const currentUserId = req.user!.id;
        const currentUser = await storage.getUser(currentUserId);

        if (!currentUser || currentUser.role !== "super_admin") {
          return res.status(403).json({ error: "Access denied. Super Admin role required." });
        }

        const targetUserId = req.params.id;
        const { role } = req.body;

        const validRoles = ["super_admin", "sales_admin", "broker", "underwriter"];
        if (!role || !validRoles.includes(role)) {
          return res
            .status(400)
            .json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
        }

        await storage.updateUser(targetUserId, { role });
        res.json({ message: `User role updated to ${role}` });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

export default router;
