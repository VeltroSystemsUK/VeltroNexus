import { storage } from "../storage";
import type { Lender, ProspectWithCompany, DueDiligenceData } from "@shared/schema";

export interface ProspectProfile {
  prospectId: number;
  loanAmount: number | null;
  termMonths: number | null;
  companyType: string | null;
  sicCode: string | null;
  sicDescription: string | null;
  tradingYears: number | null;
  region: string | null;
  securityTypes: string[];
  dscr: number | null;
  revenue: number | null;
}

export interface LenderMatch {
  lender: Lender;
  score: number;
  matchPercentage: number;
  reasons: string[];
  warnings: string[];
  disqualified: boolean;
  disqualificationReason?: string;
}

export interface RecommendationResult {
  prospectId: number;
  recommendations: LenderMatch[];
  profile: ProspectProfile;
  generatedAt: Date;
}

const UK_REGIONS: Record<string, string> = {
  'E': 'East of England',
  'EM': 'East Midlands',
  'L': 'London',
  'NE': 'North East',
  'NW': 'North West',
  'SE': 'South East',
  'SW': 'South West',
  'WM': 'West Midlands',
  'YH': 'Yorkshire and Humber',
  'S': 'Scotland',
  'W': 'Wales',
  'NI': 'Northern Ireland',
};

function getRegionFromPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const prefix = postcode.trim().toUpperCase().replace(/\s+/g, '');

  const regionMap: Record<string, string> = {
    'AB': 'Scotland', 'AL': 'East of England', 'B': 'West Midlands',
    'BA': 'South West', 'BB': 'North West', 'BD': 'Yorkshire and Humber',
    'BH': 'South West', 'BL': 'North West', 'BN': 'South East',
    'BR': 'London', 'BS': 'South West', 'BT': 'Northern Ireland',
    'CA': 'North West', 'CB': 'East of England', 'CF': 'Wales',
    'CH': 'North West', 'CM': 'East of England', 'CO': 'East of England',
    'CR': 'London', 'CT': 'South East', 'CV': 'West Midlands',
    'CW': 'North West', 'DA': 'London', 'DD': 'Scotland',
    'DE': 'East Midlands', 'DG': 'Scotland', 'DH': 'North East',
    'DL': 'North East', 'DN': 'Yorkshire and Humber', 'DT': 'South West',
    'DY': 'West Midlands', 'E': 'London', 'EC': 'London',
    'EH': 'Scotland', 'EN': 'London', 'EX': 'South West',
    'FK': 'Scotland', 'FY': 'North West', 'G': 'Scotland',
    'GL': 'South West', 'GU': 'South East', 'HA': 'London',
    'HD': 'Yorkshire and Humber', 'HG': 'Yorkshire and Humber', 'HP': 'South East',
    'HR': 'West Midlands', 'HS': 'Scotland', 'HU': 'Yorkshire and Humber',
    'HX': 'Yorkshire and Humber', 'IG': 'London', 'IP': 'East of England',
    'IV': 'Scotland', 'KA': 'Scotland', 'KT': 'London',
    'KW': 'Scotland', 'KY': 'Scotland', 'L': 'North West',
    'LA': 'North West', 'LD': 'Wales', 'LE': 'East Midlands',
    'LL': 'Wales', 'LN': 'East Midlands', 'LS': 'Yorkshire and Humber',
    'LU': 'East of England', 'M': 'North West', 'ME': 'South East',
    'MK': 'South East', 'ML': 'Scotland', 'N': 'London',
    'NE': 'North East', 'NG': 'East Midlands', 'NN': 'East Midlands',
    'NP': 'Wales', 'NR': 'East of England', 'NW': 'London',
    'OL': 'North West', 'OX': 'South East', 'PA': 'Scotland',
    'PE': 'East of England', 'PH': 'Scotland', 'PL': 'South West',
    'PO': 'South East', 'PR': 'North West', 'RG': 'South East',
    'RH': 'South East', 'RM': 'London', 'S': 'Yorkshire and Humber',
    'SA': 'Wales', 'SE': 'London', 'SG': 'East of England',
    'SK': 'North West', 'SL': 'South East', 'SM': 'London',
    'SN': 'South West', 'SO': 'South East', 'SP': 'South West',
    'SR': 'North East', 'SS': 'East of England', 'ST': 'West Midlands',
    'SW': 'London', 'SY': 'West Midlands', 'TA': 'South West',
    'TD': 'Scotland', 'TF': 'West Midlands', 'TN': 'South East',
    'TQ': 'South West', 'TR': 'South West', 'TS': 'North East',
    'TW': 'London', 'UB': 'London', 'W': 'London',
    'WA': 'North West', 'WC': 'London', 'WD': 'East of England',
    'WF': 'Yorkshire and Humber', 'WN': 'North West', 'WR': 'West Midlands',
    'WS': 'West Midlands', 'WV': 'West Midlands', 'YO': 'Yorkshire and Humber',
    'ZE': 'Scotland',
  };

  for (const [code, region] of Object.entries(regionMap)) {
    if (prefix.startsWith(code)) {
      return region;
    }
  }
  return null;
}

function calculateTradingYears(incorporationDate: string | null | undefined): number | null {
  if (!incorporationDate) return null;
  try {
    const incDate = new Date(incorporationDate);
    const now = new Date();
    const years = (now.getTime() - incDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.floor(years);
  } catch {
    return null;
  }
}

function extractSecurityTypes(prospect: ProspectWithCompany): string[] {
  const types: string[] = [];
  if (prospect.directorsGuarantee) types.push('Personal Guarantee');
  if (prospect.commercialProperty) types.push('Commercial Property');
  if (prospect.homeEquity) types.push('Residential Property');
  if (prospect.propertyOther) types.push('Other Property');
  if (prospect.debenture) types.push('Debenture');
  if (prospect.parentCompanyGuarantee) types.push('Parent Company Guarantee');
  if (prospect.collateral) types.push('Other Collateral');
  if (prospect.crossCompanyGuarantee) types.push('Cross Company Guarantee');
  return types;
}

function calculateDscr(dueDiligence: DueDiligenceData | null): number | null {
  if (!dueDiligence?.dscr) return null;
  const { annualNetOperatingIncome, annualDebtService } = dueDiligence.dscr;
  if (!annualNetOperatingIncome || !annualDebtService || annualDebtService === 0) {
    return null;
  }
  return annualNetOperatingIncome / annualDebtService;
}

function calculateRevenue(dueDiligence: DueDiligenceData | null): number | null {
  return dueDiligence?.financialRatios?.revenue ?? null;
}

export async function buildProspectProfile(
  prospect: ProspectWithCompany,
  dueDiligence: DueDiligenceData | null
): Promise<ProspectProfile> {
  return {
    prospectId: prospect.id!,
    loanAmount: prospect.loanAmount ?? null,
    termMonths: prospect.term ?? null,
    companyType: prospect.company?.companyType ?? null,
    sicCode: prospect.company?.sicCode ?? null,
    sicDescription: prospect.company?.sicDescription ?? null,
    tradingYears: calculateTradingYears(prospect.company?.incorporationDate),
    region: getRegionFromPostcode(prospect.company?.postcode),
    securityTypes: extractSecurityTypes(prospect),
    dscr: calculateDscr(dueDiligence),
    revenue: calculateRevenue(dueDiligence),
  };
}

function checkHardCriteria(
  lender: Lender,
  profile: ProspectProfile
): { passed: boolean; reason?: string } {
  if (profile.loanAmount !== null) {
    if (lender.minLoanAmount && profile.loanAmount < lender.minLoanAmount) {
      return { passed: false, reason: `Loan amount £${(profile.loanAmount / 1000).toFixed(0)}k below minimum £${(lender.minLoanAmount / 1000).toFixed(0)}k` };
    }
    if (lender.maxLoanAmount && profile.loanAmount > lender.maxLoanAmount) {
      return { passed: false, reason: `Loan amount £${(profile.loanAmount / 1000).toFixed(0)}k exceeds maximum £${(lender.maxLoanAmount / 1000).toFixed(0)}k` };
    }
  }

  if (profile.termMonths !== null) {
    if (lender.minTermMonths && profile.termMonths < lender.minTermMonths) {
      return { passed: false, reason: `Term ${profile.termMonths} months below minimum ${lender.minTermMonths} months` };
    }
    if (lender.maxTermMonths && profile.termMonths > lender.maxTermMonths) {
      return { passed: false, reason: `Term ${profile.termMonths} months exceeds maximum ${lender.maxTermMonths} months` };
    }
  }

  if (profile.tradingYears !== null) {
    if (profile.tradingYears === 0 && !lender.acceptsStartups) {
      return { passed: false, reason: 'Does not accept startups (0 trading years)' };
    }
    if (lender.minTradingYears && profile.tradingYears < lender.minTradingYears) {
      return { passed: false, reason: `Trading years ${profile.tradingYears} below minimum ${lender.minTradingYears}` };
    }
  }

  if (profile.revenue !== null && lender.minRevenue) {
    if (profile.revenue < lender.minRevenue) {
      return { passed: false, reason: `Revenue £${(profile.revenue / 1000).toFixed(0)}k below minimum £${(lender.minRevenue / 1000).toFixed(0)}k` };
    }
  }

  if (profile.dscr !== null && lender.minDscr) {
    const minDscr = parseFloat(lender.minDscr);
    if (!isNaN(minDscr) && profile.dscr < minDscr) {
      return { passed: false, reason: `DSCR ${profile.dscr.toFixed(2)} below minimum ${minDscr.toFixed(2)}` };
    }
  }

  return { passed: true };
}

interface ScoreResult {
  score: number;
  maxScore: number;
  reasons: string[];
  warnings: string[];
}

function scoreLender(lender: Lender, profile: ProspectProfile): ScoreResult {
  let score = 0;
  let maxScore = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  maxScore += 20;
  if (profile.loanAmount !== null && lender.minLoanAmount && lender.maxLoanAmount) {
    const midpoint = (lender.minLoanAmount + lender.maxLoanAmount) / 2;
    const range = lender.maxLoanAmount - lender.minLoanAmount;
    if (range > 0) {
      const distanceFromMid = Math.abs(profile.loanAmount - midpoint);
      const fitPercentage = 1 - (distanceFromMid / (range / 2));
      const loanScore = Math.max(0, Math.min(20, fitPercentage * 20));
      score += loanScore;
      if (loanScore >= 15) {
        reasons.push(`Loan amount £${(profile.loanAmount / 1000).toFixed(0)}k is in their sweet spot`);
      }
    } else {
      score += 10;
    }
  } else {
    score += 10;
  }

  const lenderSectors = (lender.sectors as string[]) || [];
  if (lenderSectors.length > 0 && profile.sicDescription) {
    maxScore += 15;
    const sectorMatch = lenderSectors.some(sector =>
      profile.sicDescription?.toLowerCase().includes(sector.toLowerCase()) ||
      sector.toLowerCase().includes(profile.sicDescription?.toLowerCase() || '')
    );
    if (sectorMatch) {
      score += 15;
      reasons.push(`Sector "${profile.sicDescription}" matches their target sectors`);
    } else {
      warnings.push(`Sector "${profile.sicDescription}" not in their preferred list`);
    }
  }

  const lenderRegions = (lender.regions as string[]) || [];
  if (lenderRegions.length > 0 && profile.region) {
    maxScore += 10;
    const regionMatch = lenderRegions.some(region =>
      region.toLowerCase() === profile.region?.toLowerCase() ||
      region.toLowerCase() === 'nationwide' ||
      region.toLowerCase() === 'uk wide'
    );
    if (regionMatch) {
      score += 10;
      reasons.push(`Operates in ${profile.region}`);
    } else {
      warnings.push(`${profile.region} not in their typical regions`);
    }
  }

  const lenderSecurityTypes = (lender.securityTypes as string[]) || [];
  if (lenderSecurityTypes.length > 0 && profile.securityTypes.length > 0) {
    maxScore += 15;
    const matchingSecurities = profile.securityTypes.filter(st =>
      lenderSecurityTypes.some(lst =>
        lst.toLowerCase().includes(st.toLowerCase()) ||
        st.toLowerCase().includes(lst.toLowerCase())
      )
    );
    if (matchingSecurities.length > 0) {
      const securityScore = (matchingSecurities.length / lenderSecurityTypes.length) * 15;
      score += Math.min(15, securityScore);
      reasons.push(`Security offered: ${matchingSecurities.join(', ')}`);
    }
  }

  const lenderBorrowerTypes = (lender.borrowerTypes as string[]) || [];
  if (lenderBorrowerTypes.length > 0 && profile.companyType) {
    maxScore += 10;
    const typeMatch = lenderBorrowerTypes.some(bt =>
      bt.toLowerCase().includes(profile.companyType?.toLowerCase() || '') ||
      profile.companyType?.toLowerCase().includes(bt.toLowerCase())
    );
    if (typeMatch) {
      score += 10;
      reasons.push(`Accepts ${profile.companyType} entities`);
    }
  }

  if (profile.dscr !== null) {
    maxScore += 15;
    if (lender.minDscr) {
      const minDscr = parseFloat(lender.minDscr);
      if (!isNaN(minDscr) && profile.dscr >= minDscr) {
        const headroom = ((profile.dscr - minDscr) / minDscr) * 100;
        score += 15;
        reasons.push(`DSCR ${profile.dscr.toFixed(2)}x meets requirement (${headroom.toFixed(0)}% headroom)`);
      }
    } else {
      score += 10;
      if (profile.dscr >= 1.25) {
        reasons.push(`Strong DSCR of ${profile.dscr.toFixed(2)}x`);
      }
    }
  }

  if (lender.turnaroundDays) {
    maxScore += 10;
    if (lender.turnaroundDays <= 5) {
      score += 10;
      reasons.push(`Fast turnaround: ${lender.turnaroundDays} days`);
    } else if (lender.turnaroundDays <= 10) {
      score += 7;
      reasons.push(`Reasonable turnaround: ${lender.turnaroundDays} days`);
    } else {
      score += 3;
      warnings.push(`Longer turnaround: ${lender.turnaroundDays} days`);
    }
  }

  if (lender.rating) {
    maxScore += 5;
    score += (lender.rating / 5) * 5;
    if (lender.rating >= 4) {
      reasons.push(`Highly rated (${lender.rating}/5 stars)`);
    }
  }

  if (lender.isFavourite) {
    maxScore += 5;
    score += 5;
    reasons.push('Marked as favourite lender');
  }

  if (lender.introducerAgreementSigned) {
    maxScore += 5;
    score += 5;
    reasons.push('Introducer agreement in place');
  }

  return { score, maxScore, reasons, warnings };
}

export async function generateRecommendations(
  userId: string,
  prospectId: number
): Promise<RecommendationResult> {
  const prospect = await storage.getProspect(prospectId, userId);
  if (!prospect) {
    throw new Error('Prospect not found');
  }

  const dueDiligenceRecord = await storage.getDueDiligence(prospectId, userId);
  const dueDiligence = dueDiligenceRecord?.data as DueDiligenceData | null;

  const profile = await buildProspectProfile(prospect, dueDiligence);

  const lenders = await storage.listLenders(userId);

  const matches: LenderMatch[] = [];

  for (const lender of lenders) {
    const hardCriteriaResult = checkHardCriteria(lender, profile);

    if (!hardCriteriaResult.passed) {
      matches.push({
        lender,
        score: 0,
        matchPercentage: 0,
        reasons: [],
        warnings: [],
        disqualified: true,
        disqualificationReason: hardCriteriaResult.reason,
      });
      continue;
    }

    const scoreResult = scoreLender(lender, profile);
    const matchPercentage = scoreResult.maxScore > 0
      ? Math.round((scoreResult.score / scoreResult.maxScore) * 100)
      : 50;

    matches.push({
      lender,
      score: scoreResult.score,
      matchPercentage,
      reasons: scoreResult.reasons,
      warnings: scoreResult.warnings,
      disqualified: false,
    });
  }

  matches.sort((a, b) => {
    if (a.disqualified && !b.disqualified) return 1;
    if (!a.disqualified && b.disqualified) return -1;
    return b.matchPercentage - a.matchPercentage;
  });

  return {
    prospectId,
    recommendations: matches,
    profile,
    generatedAt: new Date(),
  };
}

export async function getTopRecommendations(
  userId: string,
  prospectId: number,
  limit: number = 5
): Promise<RecommendationResult> {
  const result = await generateRecommendations(userId, prospectId);

  const qualified = result.recommendations.filter(m => !m.disqualified);
  const topQualified = qualified.slice(0, limit);

  return {
    ...result,
    recommendations: topQualified,
  };
}
