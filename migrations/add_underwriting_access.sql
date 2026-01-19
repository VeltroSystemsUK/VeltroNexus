-- Migration: Add underwriting access tracking to users
-- Created: 2026-01-19

ALTER TABLE users 
ADD COLUMN has_underwriting_access INTEGER NOT NULL DEFAULT 0,
ADD COLUMN underwriting_access_expires_at TIMESTAMP;

-- Grant access to all existing lender tier users
UPDATE users 
SET has_underwriting_access = 1 
WHERE subscription_tier = 'lender';

-- Grant access to all underwriter role users
UPDATE users 
SET has_underwriting_access = 1 
WHERE role = 'underwriter';
