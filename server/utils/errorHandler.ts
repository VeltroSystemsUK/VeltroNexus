import type { Response, Request } from "express";
import { createErrorResponse } from "./errorResponse";

export function handleApiError(
  res: Response,
  error: unknown,
  context: string,
  statusCode: number = 500,
  req?: Request
): void {
  const requestId = (req as any)?.id;
  const errorObj = error instanceof Error ? error : new Error(String(error));

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

  const response = createErrorResponse(errorObj, statusCode, requestId);
  res.status(statusCode).json(response);
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
