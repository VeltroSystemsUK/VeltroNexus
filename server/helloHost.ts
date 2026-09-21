import type { NextFunction, Request, Response } from "express";
import { helloRedirectUrl, isHelloAllowedPath, isHelloHost } from "@shared/helloHost";
import { privateWallHtml } from "./services/briefings";

function requestHost(req: Request): string {
  return String(req.get("x-forwarded-host") || req.get("host") || "");
}

function requestSearch(req: Request): string {
  const url = String(req.originalUrl || req.url || "");
  const cut = url.indexOf("?");
  return cut >= 0 ? url.slice(cut) : "";
}

export function helloHostMiddleware(req: Request, res: Response, next: NextFunction): void {
  const host = requestHost(req);
  const redirect = helloRedirectUrl(host, req.path, requestSearch(req));
  if (redirect) {
    res.redirect(301, redirect);
    return;
  }
  if (isHelloHost(host) && !isHelloAllowedPath(req.path)) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(404).send(privateWallHtml());
    return;
  }
  next();
}
