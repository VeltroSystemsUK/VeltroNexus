import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import MobileNav from "@/components/MobileNav";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Pipeline from "@/pages/Pipeline";
import CompanySearch from "@/pages/CompanySearch";
import ProspectDetail from "@/pages/ProspectDetail";
import SubscriptionComplete from "@/pages/SubscriptionComplete";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Lenders from "@/pages/Lenders";
import Submissions from "@/pages/Submissions";
import Leads from "@/pages/Leads";
import UnderwriterInbox from "@/pages/UnderwriterInbox";
import Teams from "@/pages/Teams";
import Admin from "@/pages/Admin";
import ValuePackages from "@/pages/ValuePackages";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
    enabled: isAuthenticated,
  });

  const isUnderwriter = roleData?.role === "underwriter";

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/value-packages" component={ValuePackages} />
          <Route path="/subscription/complete" component={SubscriptionComplete} />
        </>
      ) : (
        <>
          <Route path="/" component={isUnderwriter ? UnderwriterInbox : Pipeline} />
          <Route path="/pipeline" component={Pipeline} />
          <Route path="/search" component={CompanySearch} />
          <Route path="/prospect/:id" component={ProspectDetail} />
          <Route path="/lenders" component={Lenders} />
          <Route path="/submissions" component={Submissions} />
          <Route path="/leads" component={Leads} />
          <Route path="/underwriting" component={UnderwriterInbox} />
          <Route path="/teams" component={Teams} />
          <Route path="/admin" component={Admin} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/value-packages" component={ValuePackages} />
          <Route path="/subscription/complete" component={SubscriptionComplete} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  return (
    <>
      <Router />
      {isAuthenticated && !isLoading && <MobileNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SonnerToaster position="top-right" />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
