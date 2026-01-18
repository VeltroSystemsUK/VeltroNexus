import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
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
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    logoutMutation,
  };
}
