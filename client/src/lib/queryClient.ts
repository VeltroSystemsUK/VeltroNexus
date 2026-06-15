import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Custom error class for session revocation
export class SessionRevokedError extends Error {
  reason: string;
  details: string;
  
  constructor(details: string) {
    super("Your session has ended");
    this.name = "SessionRevokedError";
    this.reason = "session_revoked";
    this.details = details;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Check for session revocation
    if (res.status === 401) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.reason === "session_revoked") {
          throw new SessionRevokedError(errorData.details || "Your session was ended because another device logged in");
        }
      } catch (e) {
        // If not JSON or not session_revoked, continue with normal error
        if (e instanceof SessionRevokedError) throw e;
      }
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let pathParts: string[] = [];
    let queryParams: Record<string, any> = {};

    queryKey.forEach((part) => {
      if (typeof part === "string" || typeof part === "number") {
        pathParts.push(String(part));
      } else if (typeof part === "object" && part !== null) {
        Object.assign(queryParams, part);
      }
    });

    let url = pathParts.join("/");
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Global handler for session revocation - redirects to login
function handleSessionRevoked(details: string) {
  // Show alert and redirect to login
  alert(details + "\n\nYou will be redirected to login.");
  window.location.href = "/api/login";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry on session revocation
        if (error instanceof SessionRevokedError) {
          handleSessionRevoked(error.details);
          return false;
        }
        return false;
      },
    },
    mutations: {
      retry: false,
      onError: (error) => {
        if (error instanceof SessionRevokedError) {
          handleSessionRevoked(error.details);
        }
      },
    },
  },
});
