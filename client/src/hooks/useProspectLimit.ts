import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

interface UserData {
  id: string;
  subscriptionTier: string;
  prospectLimit: number;
}

interface ProspectLimitState {
  isAtLimit: boolean;
  isOverLimit: boolean;
  currentCount: number;
  limit: number;
  subscriptionTier: string;
  showLimitModal: boolean;
  setShowLimitModal: (show: boolean) => void;
  checkAndShowModal: (prospectIndex: number) => boolean;
}

export function useProspectLimit(): ProspectLimitState {
  const { user, isAuthenticated } = useAuth();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const { data: prospects = [] } = useQuery<any[]>({
    queryKey: ["/api/prospects"],
    enabled: isAuthenticated,
  });

  const userData = user as UserData | undefined;
  const currentCount = prospects.length;
  const limit = userData?.prospectLimit || 10;
  const subscriptionTier = userData?.subscriptionTier || "free";
  const isAtLimit = currentCount >= limit;
  const isOverLimit = currentCount > limit;

  const checkAndShowModal = useCallback(
    (prospectIndex: number): boolean => {
      if (prospectIndex >= limit) {
        setShowLimitModal(true);
        return true;
      }
      return false;
    },
    [limit]
  );

  return {
    isAtLimit,
    isOverLimit,
    currentCount,
    limit,
    subscriptionTier,
    showLimitModal,
    setShowLimitModal,
    checkAndShowModal,
  };
}
