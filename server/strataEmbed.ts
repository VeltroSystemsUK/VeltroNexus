import http from "http";
import type { Express, Request, Response } from "express";

const EMBED_PREFIXES = ["/cases", "/_next", "/api/v1", "/login"];

export function isStrataEmbedPath(urlPath: string) {
  return EMBED_PREFIXES.some((prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`));
}

export function allowsSameOriginFrame(urlPath: string) {
  if (isStrataEmbedPath(urlPath)) return true;
  return /^\/api\/broker-portal\/handoffs\/[^/]+\/(report|handover|application)\.html$/.test(urlPath);
}

export function embedPathFromLaunch(launchUrl?: string | null) {
  if (!launchUrl) return undefined;
  try {
    const url = new URL(launchUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return launchUrl.startsWith("/") ? launchUrl : undefined;
  }
}

function rewriteLocation(value: string, targetBase: string) {
  try {
    const url = new URL(value, targetBase);
    const target = new URL(targetBase);
    if (url.host === target.host) return `${url.pathname}${url.search}`;
    return value;
  } catch {
    return value;
  }
}

function rewriteCookies(values: string | string[]) {
  const list = Array.isArray(values) ? values : [values];
  return list.map((cookie) =>
    cookie
      .replace(/;\s*Domain=[^;]*/gi, "")
      .replace(/;\s*Secure/gi, "")
      .replace(/;\s*SameSite=[^;]*/gi, "; SameSite=Lax")
  );
}

export function mountStrataEmbed(app: Express) {
  const targetBase = (process.env.STRATA_WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

  app.use((req: Request, res: Response, next) => {
    if (!isStrataEmbedPath(req.path)) return next();

    const dest = new URL(req.originalUrl, targetBase);
    const headers: http.OutgoingHttpHeaders = { ...req.headers, host: dest.host };
    delete headers["accept-encoding"];

    const upstream = http.request(
      {
        protocol: dest.protocol,
        hostname: dest.hostname,
        port: dest.port,
        path: `${dest.pathname}${dest.search}`,
        method: req.method,
        headers,
      },
      (incoming) => {
        const outHeaders = { ...incoming.headers };
        if (outHeaders.location) {
          outHeaders.location = rewriteLocation(String(outHeaders.location), targetBase);
        }
        delete outHeaders["x-frame-options"];
        if (outHeaders["content-security-policy"]) {
          outHeaders["content-security-policy"] = String(outHeaders["content-security-policy"]).replace(
            /frame-ancestors[^;]*;?/gi,
            ""
          );
        }
        if (outHeaders["set-cookie"]) {
          outHeaders["set-cookie"] = rewriteCookies(outHeaders["set-cookie"]);
        }
        res.writeHead(incoming.statusCode || 502, outHeaders);
        incoming.pipe(res);
      }
    );

    upstream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(502).json({
          error: "The Strata app is not reachable from Nexus",
          detail: error.message,
        });
      }
    });

    req.pipe(upstream);
  });
}
