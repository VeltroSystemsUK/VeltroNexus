import React from 'react';
import { type ProspectCardData } from './ProspectCard';
import ProspectCard from './ProspectCard';

interface SafeProspectCardProps {
    prospect: any; // Allow loose typing to catch bad data
    isDragging?: boolean;
    onClick?: () => void;
    className?: string;
    [key: string]: any; // Allow pass-through props
}

/**
 * Validates that a prospect has minimum required data
 */
function isValidProspect(prospect: any): boolean {
    return (
        prospect &&
        typeof prospect === 'object' &&
        (typeof prospect.id === 'string' || typeof prospect.id === 'number')
    );
}

/**
 * Provides safe default values for prospect properties
 */
function getSafeProspectData(prospect: any): ProspectCardData {
    if (!isValidProspect(prospect)) {
        return {
            id: 0,
            companyName: 'Unknown Company',
            companyNumber: '00000000',
            loanAmount: 0,
            priority: 'medium',
        };
    }

    // Handle potential missing company object
    const companyName = prospect.companyName ||
        (prospect.company && prospect.company.companyName) ||
        'Unknown Company';

    const companyNumber = prospect.companyNumber ||
        (prospect.company && prospect.company.companyNumber) ||
        '00000000';

    return {
        id: prospect.id,
        companyName,
        companyNumber,
        loanAmount: Number(prospect.loanAmount) || 0,
        priority: (prospect.priority || 'medium') as any,
    };
}

/**
 * Safe wrapper component for ProspectCard
 */
export default function SafeProspectCard(props: SafeProspectCardProps) {
    const { prospect, ...rest } = props;

    // If prospect is completely invalid or missing, we can either return null or a skeleton
    // returning null prevents the crash
    if (!prospect) return null;

    const safeProspect = getSafeProspectData(prospect);

    return (
        <ProspectCard
            {...rest}
            prospect={safeProspect}
        />
    );
}
