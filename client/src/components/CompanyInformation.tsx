import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Calendar,
  MapPin,
  FileText,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Shield,
  Briefcase,
} from "lucide-react";
import type {
  CompanyProfile,
  OfficersResponse,
  PSCResponse,
  ChargesResponse,
} from "@shared/companiesHouseTypes";
import { format } from "date-fns";
import { getSicDescription } from "@/utils/sicCodeLookup";

interface CompanyInformationProps {
  companyProfile: CompanyProfile;
}

export function CompanyInformation({ companyProfile }: CompanyInformationProps) {
  const companyNumber = companyProfile.company_number;
  const companyStatus = companyProfile.company_status || "Unknown";

  // Fetch Officers
  const {
    data: officers,
    isLoading: officersLoading,
    error: officersError,
  } = useQuery<OfficersResponse>({
    queryKey: [`/api/companies-house/company/${companyNumber}/officers`],
    enabled: !!companyNumber,
  });

  // Fetch PSC
  const {
    data: psc,
    isLoading: pscLoading,
    error: pscError,
  } = useQuery<PSCResponse>({
    queryKey: [`/api/companies-house/company/${companyNumber}/persons-with-significant-control`],
    enabled: !!companyNumber,
  });

  // Fetch Charges
  const {
    data: charges,
    isLoading: chargesLoading,
    error: chargesError,
  } = useQuery<ChargesResponse>({
    queryKey: [`/api/companies-house/company/${companyNumber}/charges`],
    enabled: !!companyNumber,
  });

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
      address.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const getStatusColor = (status: string) => {
    const lowercaseStatus = status.toLowerCase();
    if (lowercaseStatus === "active") return "default";
    if (lowercaseStatus.includes("dissolved") || lowercaseStatus.includes("liquidation"))
      return "destructive";
    return "secondary";
  };

  const getStatusIcon = (status: string) => {
    const lowercaseStatus = status.toLowerCase();
    if (lowercaseStatus === "active") return <CheckCircle2 className="w-4 h-4" />;
    if (lowercaseStatus.includes("dissolved") || lowercaseStatus.includes("liquidation"))
      return <XCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  const formatNatureOfControl = (nature: string) => {
    return nature.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
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
            <Badge variant={getStatusColor(companyStatus)} className="gap-1">
              {getStatusIcon(companyStatus)}
              {companyStatus}
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
              <div className="font-medium capitalize">
                {companyProfile.jurisdiction?.replace(/-/g, " ") || "N/A"}
              </div>
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

      {/* SIC Codes - Business Activities */}
      {companyProfile.sic_codes && companyProfile.sic_codes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-4 h-4" />
              Business Activities (SIC Codes)
            </CardTitle>
            <CardDescription>Standard Industrial Classification codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companyProfile.sic_codes.map((sicCode, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                  data-testid={`sic-code-${idx}`}
                >
                  <Badge variant="outline" className="font-mono">
                    {sicCode}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {getSicDescription(sicCode)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Officers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Officers
            {officers &&
              ` (${officers.active_count || 0} active, ${officers.resigned_count || 0} resigned)`}
          </CardTitle>
          <CardDescription>Directors and company secretaries</CardDescription>
        </CardHeader>
        <CardContent>
          {officersLoading && (
            <p className="text-sm text-muted-foreground">Loading officers data...</p>
          )}
          {officersError && (
            <p className="text-sm text-muted-foreground">No officers data available</p>
          )}
          {officers && officers.total_results > 0 && (
            <div className="space-y-4">
              {officers.items.map((officer, idx) => (
                <div key={idx} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold" data-testid={`officer-name-${idx}`}>
                        {officer.name}
                      </h4>
                      <p className="text-sm text-muted-foreground capitalize">
                        {officer.officer_role?.replace(/-/g, " ")}
                      </p>
                    </div>
                    <Badge variant={officer.resigned_on ? "secondary" : "default"}>
                      {officer.resigned_on ? "Resigned" : "Active"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Appointed: </span>
                      <span>{formatDate(officer.appointed_on)}</span>
                    </div>
                    {officer.resigned_on && (
                      <div>
                        <span className="text-muted-foreground">Resigned: </span>
                        <span>{formatDate(officer.resigned_on)}</span>
                      </div>
                    )}
                    {officer.nationality && (
                      <div>
                        <span className="text-muted-foreground">Nationality: </span>
                        <span>{officer.nationality}</span>
                      </div>
                    )}
                    {officer.occupation && (
                      <div>
                        <span className="text-muted-foreground">Occupation: </span>
                        <span>{officer.occupation}</span>
                      </div>
                    )}
                  </div>
                  {officer.address && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatAddress(officer.address)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PSC */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Persons with Significant Control
            {psc && ` (${psc.active_count || 0} active)`}
          </CardTitle>
          <CardDescription>
            Individuals or entities with significant influence over the company
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pscLoading && <p className="text-sm text-muted-foreground">Loading PSC data...</p>}
          {pscError && <p className="text-sm text-muted-foreground">No PSC data available</p>}
          {psc && psc.total_results > 0 && (
            <div className="space-y-4">
              {psc.items.map((person, idx) => (
                <div key={idx} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold" data-testid={`psc-name-${idx}`}>
                        {person.name || "Unknown"}
                      </h4>
                      <p className="text-xs text-muted-foreground capitalize">
                        {person.kind?.replace(/-/g, " ")}
                      </p>
                    </div>
                    <Badge variant={person.ceased_on ? "secondary" : "default"}>
                      {person.ceased_on ? "Ceased" : "Active"}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Notified: </span>
                      <span>{formatDate(person.notified_on)}</span>
                    </div>
                    {person.ceased_on && (
                      <div>
                        <span className="text-muted-foreground">Ceased: </span>
                        <span>{formatDate(person.ceased_on)}</span>
                      </div>
                    )}
                    {person.nationality && (
                      <div>
                        <span className="text-muted-foreground">Nationality: </span>
                        <span>{person.nationality}</span>
                      </div>
                    )}
                    {person.natures_of_control && person.natures_of_control.length > 0 && (
                      <div>
                        <span className="text-muted-foreground block mb-1">Nature of Control:</span>
                        <div className="flex flex-wrap gap-1">
                          {person.natures_of_control.map((nature, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {formatNatureOfControl(nature)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {person.address && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatAddress(person.address)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            Charges
            {charges && ` (${charges.total_count})`}
          </CardTitle>
          <CardDescription>
            {charges &&
              `${charges.satisfied_count || 0} satisfied, ${charges.total_count - (charges.satisfied_count || 0)} outstanding`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chargesLoading && (
            <p className="text-sm text-muted-foreground">Loading charges data...</p>
          )}
          {chargesError && (
            <p className="text-sm text-muted-foreground">No charges data available</p>
          )}
          {charges && charges.total_count > 0 && (
            <div className="space-y-4">
              {charges.items.map((charge, idx) => (
                <div key={idx} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold" data-testid={`charge-number-${idx}`}>
                          Charge #{charge.charge_number || idx + 1}
                        </h4>
                        <Badge
                          variant={
                            charge.status?.toLowerCase().includes("satisfied")
                              ? "outline"
                              : "destructive"
                          }
                        >
                          {charge.status || "Unknown"}
                        </Badge>
                      </div>
                      {charge.classification?.description && (
                        <p className="text-sm text-muted-foreground">
                          {charge.classification.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    {charge.created_on && (
                      <div>
                        <span className="text-muted-foreground">Created: </span>
                        <span>{formatDate(charge.created_on)}</span>
                      </div>
                    )}
                    {charge.satisfied_on && (
                      <div>
                        <span className="text-muted-foreground">Satisfied: </span>
                        <span>{formatDate(charge.satisfied_on)}</span>
                      </div>
                    )}
                  </div>

                  {charge.persons_entitled && charge.persons_entitled.length > 0 && (
                    <div className="text-sm mb-2">
                      <span className="text-muted-foreground">Entitled to: </span>
                      <span>{charge.persons_entitled.map((p) => p.name).join(", ")}</span>
                    </div>
                  )}

                  {charge.particulars && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {charge.particulars.contains_fixed_charge && (
                        <Badge variant="outline" className="text-xs">
                          Fixed Charge
                        </Badge>
                      )}
                      {charge.particulars.contains_floating_charge && (
                        <Badge variant="outline" className="text-xs">
                          Floating Charge
                        </Badge>
                      )}
                      {charge.particulars.contains_negative_pledge && (
                        <Badge variant="outline" className="text-xs">
                          Negative Pledge
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                  {companyProfile.accounts.accounting_reference_date.day}/
                  {companyProfile.accounts.accounting_reference_date.month}
                </div>
              </div>
            )}

            <Separator />

            {companyProfile.accounts.last_accounts && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Last Accounts Made Up To</div>
                  <div className="font-medium">
                    {formatDate(companyProfile.accounts.last_accounts.made_up_to)}
                  </div>
                </div>
                {companyProfile.accounts.last_accounts.type && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Type</div>
                    <div className="font-medium capitalize">
                      {companyProfile.accounts.last_accounts.type}
                    </div>
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
                        <Badge variant="destructive" className="text-xs">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  {companyProfile.accounts.next_accounts.period_end_on && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Period End</div>
                      <div className="font-medium">
                        {formatDate(companyProfile.accounts.next_accounts.period_end_on)}
                      </div>
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
                  <div className="font-medium">
                    {formatDate(companyProfile.confirmation_statement.last_made_up_to)}
                  </div>
                </div>
              )}
              {companyProfile.confirmation_statement.next_due && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Next Due</div>
                  <div className="font-medium flex items-center gap-2">
                    {formatDate(companyProfile.confirmation_statement.next_due)}
                    {companyProfile.confirmation_statement.overdue && (
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
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
              <Badge
                variant={companyProfile.has_charges ? "secondary" : "outline"}
                className="text-xs"
              >
                {companyProfile.has_charges ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Insolvency History</span>
              <Badge
                variant={companyProfile.has_insolvency_history ? "destructive" : "outline"}
                className="text-xs"
              >
                {companyProfile.has_insolvency_history ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Been Liquidated</span>
              <Badge
                variant={companyProfile.has_been_liquidated ? "destructive" : "outline"}
                className="text-xs"
              >
                {companyProfile.has_been_liquidated ? "Yes" : "No"}
              </Badge>
            </div>
            {companyProfile.is_community_interest_company && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Community Interest Co.</span>
                <Badge variant="default" className="text-xs">
                  Yes
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Previous Names */}
      {companyProfile.previous_company_names &&
        companyProfile.previous_company_names.length > 0 && (
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
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
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
    </div>
  );
}
