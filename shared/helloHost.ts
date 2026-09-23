export const DEFAULT_HELLO_HOST = "hello.stratanexus.co.uk";
export const DEFAULT_HELLO_ORIGIN = "https://hello.stratanexus.co.uk";
export const DEFAULT_LEADS_HOST = "leads.stratanexus.co.uk";

function hostWithoutPort(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

function hostList(value: string | undefined, fallback: string[]): string[] {
  const extras = String(value || "")
    .split(",")
    .map(hostWithoutPort)
    .filter(Boolean);
  return [...fallback, ...extras];
}

export function isHelloHost(host?: string | null): boolean {
  if (!host) return false;
  const bare = hostWithoutPort(host);
  if (!bare) return false;
  return hostList(process.env.HELLO_HOST, [DEFAULT_HELLO_HOST, "hello.localhost"]).includes(bare);
}

export function isLeadsHost(host?: string | null): boolean {
  if (!host) return false;
  const bare = hostWithoutPort(host);
  if (!bare) return false;
  return hostList(process.env.LEADS_HOST, [DEFAULT_LEADS_HOST]).includes(bare);
}

export function helloPublicOrigin(): string {
  return String(process.env.HELLO_PUBLIC_URL || DEFAULT_HELLO_ORIGIN).replace(/\/$/, "");
}

export function isHelloAllowedPath(path: string): boolean {
  const pathname = String(path || "").split("?")[0] || "";
  if (/^\/briefing\/[^/]+$/.test(pathname)) return true;
  if (pathname === "/veltro" || pathname.startsWith("/veltro/")) return true;
  if (pathname.startsWith("/api/briefing/")) return true;
  if (pathname === "/api/veltro/interest") return true;
  if (pathname.startsWith("/brand/logo/")) return true;
  if (pathname.startsWith("/src/") || pathname.startsWith("/@") || pathname.startsWith("/node_modules/")) return true;
  if (pathname.startsWith("/assets/") || pathname.startsWith("/uploads/media/")) return true;
  if (/\.(js|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(pathname)) return true;
  return false;
}

export function helloRedirectUrl(host: string, path: string, search = ""): string | null {
  if (!isLeadsHost(host)) return null;
  const pathname = String(path || "").split("?")[0] || "";
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  if (!/^\/briefing\/[^/]+$/.test(pathname) && pathname !== "/veltro") return null;
  const dest = helloPublicOrigin();
  let destHost = "";
  try {
    destHost = new URL(dest).hostname.toLowerCase();
  } catch {
    destHost = "";
  }
  if (!destHost || destHost === hostWithoutPort(host)) return null;
  return `${dest}${pathname}${query}`;
}
