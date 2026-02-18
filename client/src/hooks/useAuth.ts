import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AuthSession {
  user: User | null;
  role: string | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const { data: session, isLoading } = useQuery<AuthSession>({
    queryKey: ["/api/auth/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/logout", "POST");
    },
    onSuccess: () => {
      // Clear all cached data and redirect to login
      queryClient.clear();
      // Force a full page reload to /auth to ensure clean state
      window.location.replace("/auth");
    },
    onError: (error: Error) => {
      console.error("Logout failed:", error);
      // Even on error, try to redirect
      window.location.replace("/auth");
    },
  });

  return {
    user: session?.user || null,
    role: session?.role || null,
    isLoading,
    isAuthenticated: session?.isAuthenticated || false,
    logoutMutation,
  };
}
