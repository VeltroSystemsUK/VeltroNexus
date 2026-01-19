import { useAuth } from "@/hooks/useAuth";

export interface UnderwritingAccessInfo {
    hasAccess: boolean;
    isLender: boolean;
    isUnderwriter: boolean;
    requiresPurchase: boolean;
    expiresAt?: Date | null;
}

export function useUnderwritingAccess(): UnderwritingAccessInfo {
    const { user } = useAuth();

    if (!user) {
        return {
            hasAccess: false,
            isLender: false,
            isUnderwriter: false,
            requiresPurchase: true,
        };
    }

    const isLender = user.subscriptionTier === "lender";
    const isUnderwriter = user.role === "underwriter";

    // Lender tier and underwriter role auto-have access
    if (isLender || isUnderwriter) {
        return {
            hasAccess: true,
            isLender,
            isUnderwriter,
            requiresPurchase: false,
        };
    }

    // Check explicit access grant
    const hasExplicitAccess = user.hasUnderwritingAccess === 1;

    if (hasExplicitAccess) {
        // Check expiration
        const expiresAt = user.underwritingAccessExpiresAt
            ? new Date(user.underwritingAccessExpiresAt)
            : null;

        const hasExpired = expiresAt && new Date() > expiresAt;

        return {
            hasAccess: !hasExpired,
            isLender: false,
            isUnderwriter: false,
            requiresPurchase: hasExpired,
            expiresAt,
        };
    }

    // No access - needs to purchase
    return {
        hasAccess: false,
        isLender: false,
        isUnderwriter: false,
        requiresPurchase: true,
    };
}
