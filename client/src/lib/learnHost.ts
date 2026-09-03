import { isLearnHost } from "@shared/learn";

export function isLearnBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  return isLearnHost(window.location.host);
}
