import { isHelloHost } from "@shared/helloHost";

export function isHelloBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  return isHelloHost(window.location.host);
}
