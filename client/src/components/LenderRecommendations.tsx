import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Star, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Trophy,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";

interface LenderMatch {
  lender: {
    id: number;
    institutionName: string;
    lenderType: string | null;
    turnaroundDays: number | null;
    rating: number | null;
    isFavourite: number | null;
    bdmName: string | null;
    bdmEmail: string | null;
    submissionEmail: string | null;
    keyStrengths: string | null;
  };
  score: number;
  matchPercentage: number;
  reasons: string[];
  warnings: string[];
  disqualified: boolean;
  disqualificationReason?: string;
}

interface ProspectProfile {
  prospectId: number;
  loanAmount: number | null;
  termMonths: number | null;
  companyType: string | null;
  sicDescription: string | null;
  tradingYears: number | null;
  region: string | null;
  securityTypes: string[];
  dscr: number | null;
  revenue: number | null;
}

interface RecommendationResult {
  prospectId: number;
  recommendations: LenderMatch[];
  profile: ProspectProfile;
  generatedAt: string;
}

interface LenderRecommendationsProps {
  prospectId: number;
  onSelectLender?: (lenderId: number) => void;
  showDisqualified?: boolean;
  limit?: number;
}

function getMatchBadgeVariant(percentage: number): "default" | "secondary" | "destructive" | "outline" {
  if (percentage >= 80) return "default";
  if (percentage >= 60) return "secondary";
  if (percentage >= 40) return "outline";
  return "destructive";
}

function getMatchLabel(percentage: number): string {
  if (percentage >= 90) return "Excellent Match";
  if (percentage >= 80) return "Strong Match";
  if (percentage >= 70) return "Good Match";
  if (percentage >= 60) return "Fair Match";
  if (percentage >= 50) return "Possible Match";
  return "Weak Match";
}

export function LenderRecommendations({ 
  prospectId, 
  onSelectLender,
  showDisqualified = false,
  limit = 5 
}: LenderRecommendationsProps) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<RecommendationResult>({
    queryKey: ['/api/prospects', prospectId, 'recommendations', { limit, includeDisqualified: showDisqualified }],
    enabled: prospectId > 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <span>Lender Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <span>Lender Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p>Failed to load recommendations</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <span>Lender Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2" />
            <p>No lender recommendations available</p>
            <p className="text-sm mt-1">Add lenders to your directory to see recommendations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const qualified = data.recommendations.filter(m => !m.disqualified);
  const disqualified = data.recommendations.filter(m => m.disqualified);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <span>Lender Recommendations</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-recommendations"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh recommendations</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.profile && (
          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <div className="flex items-center gap-1 mb-2 font-medium">
              <Info className="h-4 w-4" />
              <span>Matching Profile</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-muted-foreground">
              {data.profile.loanAmount && (
                <span>Loan: £{(data.profile.loanAmount / 1000).toFixed(0)}k</span>
              )}
              {data.profile.termMonths && (
                <span>Term: {data.profile.termMonths} months</span>
              )}
              {data.profile.dscr && (
                <span>DSCR: {data.profile.dscr.toFixed(2)}x</span>
              )}
              {data.profile.tradingYears !== null && (
                <span>Trading: {data.profile.tradingYears} years</span>
              )}
            </div>
          </div>
        )}

        {qualified.map((match, index) => (
          <div 
            key={match.lender.id}
            className={`relative p-4 border rounded-lg hover-elevate cursor-pointer transition-all ${
              index === 0 ? 'border-primary bg-primary/5' : ''
            }`}
            onClick={() => onSelectLender?.(match.lender.id)}
            data-testid={`lender-recommendation-${match.lender.id}`}
          >
            {index === 0 && (
              <div className="absolute -top-2 -right-2">
                <Badge className="bg-amber-500 hover:bg-amber-500">
                  <Trophy className="h-3 w-3 mr-1" />
                  Best Match
                </Badge>
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                <Building2 className="h-6 w-6" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold truncate">{match.lender.institutionName}</h4>
                  <Badge variant={getMatchBadgeVariant(match.matchPercentage)}>
                    {match.matchPercentage}% - {getMatchLabel(match.matchPercentage)}
                  </Badge>
                  {match.lender.isFavourite === 1 && (
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  )}
                </div>

                {match.lender.lenderType && (
                  <p className="text-sm text-muted-foreground capitalize">
                    {match.lender.lenderType}
                  </p>
                )}

                <div className="mt-2 space-y-1">
                  {match.reasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{reason}</span>
                    </div>
                  ))}
                  {match.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  {match.lender.turnaroundDays && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {match.lender.turnaroundDays} day turnaround
                    </span>
                  )}
                  {match.lender.rating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {match.lender.rating}/5 rating
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </div>
        ))}

        {showDisqualified && disqualified.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Disqualified Lenders ({disqualified.length})
            </h4>
            {disqualified.map((match) => (
              <div 
                key={match.lender.id}
                className="p-3 border rounded-lg bg-muted/30 opacity-60 mb-2"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{match.lender.institutionName}</span>
                  <Badge variant="destructive" className="ml-auto">Disqualified</Badge>
                </div>
                {match.disqualificationReason && (
                  <p className="text-sm text-muted-foreground mt-1 ml-6">
                    {match.disqualificationReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {qualified.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Based on loan requirements, company profile, and lender criteria
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default LenderRecommendations;
