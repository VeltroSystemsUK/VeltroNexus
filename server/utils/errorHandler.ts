import type { Response, Request } from "express";
import { ProposalNotReadyError } from "@shared/proposalFacts";
import { createErrorResponse } from "./errorResponse";

function statusFromThrown(error: unknown, fallback: number): number {
  if (error instanceof ProposalNotReadyError) return error.status;
  const status = (error as { status?: unknown })?.status;
  if (status === 400 || status === 409) return status;
  return fallback;
}

export function handleApiError(
  res: Response,
  error: unknown,
  context: string,
  statusCode: number = 500,
  req?: Request
): void {
  const requestId = (req as any)?.id;
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const resolvedStatus = statusFromThrown(error, statusCode);

  console.error(
    JSON.stringify({
      type: "api_error",
      context,
      requestId: requestId || "unknown",
      error: errorObj.message,
      stack: process.env.NODE_ENV !== "production" ? errorObj.stack : undefined,
      timestamp: new Date().toISOString(),
    })
  );

  if (error instanceof ProposalNotReadyError) {
    res.status(error.status).json({
      message: error.message,
      conflicts: error.conflicts,
      missing: error.missing,
    });
    return;
  }

  const response = createErrorResponse(errorObj, resolvedStatus, requestId);
  res.status(resolvedStatus).json(response);
}

export function logUnderwritingAudit(params: {
  action: string;
  submissionId: number;
  userId: string;
  role?: string;
  fromStatus?: string | null;
  toStatus?: string;
  sourceIp?: string;
  details?: Record<string, unknown>;
}): void {
  console.log(
    JSON.stringify({
      type: "underwriting_audit",
      timestamp: new Date().toISOString(),
      action: params.action,
      submissionId: params.submissionId,
      userId: params.userId,
      role: params.role || "unknown",
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
      sourceIp: params.sourceIp || null,
      details: params.details || {},
    })
  );
}
