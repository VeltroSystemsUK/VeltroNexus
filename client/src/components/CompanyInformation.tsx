import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, Calendar, MapPin, FileText, Users, 
  ExternalLink, AlertCircle, CheckCircle2, XCircle,
  TrendingUp, Shield, Link as LinkIcon
} from "lucide-react";
import type { CompanyProfile } from "@shared/companiesHouseTypes";
import { format } from "date-fns";

interface CompanyInformationProps {
  companyProfile: CompanyProfile;
}

export function CompanyInformation({ companyProfile }: CompanyInformationProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch {
      return dateString;
    }
  };

  const formatAddress = (address?: any) => {
    if (!address) return "No address available";
    const parts = [
      address.premises,
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.region,
      address.postal_code,
      address.country
    ].filter(Boolean);
    return parts.join(", ");
  };

  const getStatusColor = (status: string) => {
    const lowercaseStatus = status.toLowerCase();
    if (lowercaseStatus === "active") return "default";
    if (lowercaseStatus.includes("dissolved") || lowercaseStatus.includes("liquidation")) return "destructive";
    return "secondary";
  };

  const getStatusIcon = (status: string) => {
    const lowercaseStatus = status.toLowerCase();
    if (lowercaseStatus === "active") return <CheckCircle2 className="w-4 h-4" />;
    if (lowercaseStatus.includes("dissolved") || lowercaseStatus.includes("liquidation")) return <XCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Company Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {companyProfile.company_name}
              </CardTitle>
              <CardDescription>Company Number: {companyProfile.company_number}</CardDescription>
            </div>
            <Badge variant={getStatusColor(companyProfile.company_status)} className="gap-1">
              {getStatusIcon(companyProfile.company_status)}
              {companyProfile.company_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Company Type</div>
              <div className="font-medium">{companyProfile.type || "N/A"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Jurisdiction</div>
              <div className="font-medium capitalize">{companyProfile.jurisdiction?.replace(/-/g, " ") || "N/A"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Incorporation Date
              </div>
              <div className="font-medium">{formatDate(companyProfile.date_of_creation)}</div>
            </div>
            {companyProfile.date_of_cessation && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Date of Cessation</div>
                <div className="font-medium">{formatDate(companyProfile.date_of_cessation)}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Registered Office Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" />
            Registered Office Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{formatAddress(companyProfile.registered_office_address)}</p>
          {companyProfile.registered_office_is_in_dispute && (
            <Badge variant="destructive" className="mt-2 gap-1">
              <AlertCircle className="w-3 h-3" />
              Address in dispute
            </Badge>
          )}
          {companyProfile.undeliverable_registered_office_address && (
            <Badge variant="destructive" className="mt-2 gap-1">
              <AlertCircle className="w-3 h-3" />
              Undeliverable address
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* SIC Codes */}
      {companyProfile.sic_codes && companyProfile.sic_codes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Standard Industrial Classification (SIC) Codes
            </CardTitle>
            <CardDescription>Business activities of the company</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {companyProfile.sic_codes.map((code) => (
                <Badge key={code} variant="secondary" data-testid={`badge-sic-${code}`}>
                  {code}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounts Information */}
      {companyProfile.accounts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" />
              Accounts Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {companyProfile.accounts.accounting_reference_date && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Accounting Reference Date</div>
                <div className="font-medium">
                  {companyProfile.accounts.accounting_reference_date.day}/{companyProfile.accounts.accounting_reference_date.month}
                </div>
              </div>
            )}

            <Separator />

            {companyProfile.accounts.last_accounts && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Last Accounts Made Up To</div>
                  <div className="font-medium">{formatDate(companyProfile.accounts.last_accounts.made_up_to)}</div>
                </div>
                {companyProfile.accounts.last_accounts.type && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Type</div>
                    <div className="font-medium capitalize">{companyProfile.accounts.last_accounts.type}</div>
                  </div>
                )}
              </div>
            )}

            {companyProfile.accounts.next_accounts && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Next Accounts Due</div>
                    <div className="font-medium flex items-center gap-2">
                      {formatDate(companyProfile.accounts.next_accounts.due_on)}
                      {companyProfile.accounts.next_accounts.overdue && (
                        <Badge variant="destructive" className="text-xs">Overdue</Badge>
                      )}
                    </div>
                  </div>
                  {companyProfile.accounts.next_accounts.period_end_on && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Period End</div>
                      <div className="font-medium">{formatDate(companyProfile.accounts.next_accounts.period_end_on)}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Statement */}
      {companyProfile.confirmation_statement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="w-4 h-4" />
              Confirmation Statement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {companyProfile.confirmation_statement.last_made_up_to && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Last Made Up To</div>
                  <div className="font-medium">{formatDate(companyProfile.confirmation_statement.last_made_up_to)}</div>
                </div>
              )}
              {companyProfile.confirmation_statement.next_due && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Next Due</div>
                  <div className="font-medium flex items-center gap-2">
                    {formatDate(companyProfile.confirmation_statement.next_due)}
                    {companyProfile.confirmation_statement.overdue && (
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            Risk Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Has Charges</span>
              <Badge variant={companyProfile.has_charges ? "secondary" : "outline"} className="text-xs">
                {companyProfile.has_charges ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Insolvency History</span>
              <Badge variant={companyProfile.has_insolvency_history ? "destructive" : "outline"} className="text-xs">
                {companyProfile.has_insolvency_history ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Been Liquidated</span>
              <Badge variant={companyProfile.has_been_liquidated ? "destructive" : "outline"} className="text-xs">
                {companyProfile.has_been_liquidated ? "Yes" : "No"}
              </Badge>
            </div>
            {companyProfile.is_community_interest_company && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Community Interest Co.</span>
                <Badge variant="default" className="text-xs">Yes</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Previous Names */}
      {companyProfile.previous_company_names && companyProfile.previous_company_names.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" />
              Previous Company Names
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companyProfile.previous_company_names.map((prevName, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className="font-medium">{prevName.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(prevName.effective_from)} - {formatDate(prevName.ceased_on)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      {companyProfile.links && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="w-4 h-4" />
              Companies House Links
            </CardTitle>
            <CardDescription>View additional information on Companies House website</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {companyProfile.links.officers && (
                <a
                  href={`https://find-and-update.company-information.service.gov.uk${companyProfile.links.officers}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid="link-officers"
                >
                  <Users className="w-3 h-3" />
                  View Officers
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {companyProfile.links.persons_with_significant_control && (
                <a
                  href={`https://find-and-update.company-information.service.gov.uk${companyProfile.links.persons_with_significant_control}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid="link-psc"
                >
                  <Users className="w-3 h-3" />
                  View PSC
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {companyProfile.links.filing_history && (
                <a
                  href={`https://find-and-update.company-information.service.gov.uk${companyProfile.links.filing_history}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid="link-filing-history"
                >
                  <FileText className="w-3 h-3" />
                  View Filing History
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {companyProfile.links.charges && (
                <a
                  href={`https://find-and-update.company-information.service.gov.uk${companyProfile.links.charges}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid="link-charges"
                >
                  <Shield className="w-3 h-3" />
                  View Charges
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
