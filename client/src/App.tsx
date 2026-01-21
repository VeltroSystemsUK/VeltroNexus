import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import MobileNav from "@/components/MobileNav";
import Sidebar from "@/components/Sidebar";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Pipeline from "@/pages/Pipeline";
import CompanySearch from "@/pages/CompanySearch";
import ProspectDetail from "@/pages/ProspectDetail";
import SubscriptionComplete from "@/pages/SubscriptionComplete";
import SubscriptionPage from "@/pages/SubscriptionPage";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Lenders from "@/pages/Lenders";
import LenderDetail from "@/pages/LenderDetail";
import Submissions from "@/pages/Submissions";
import Leads from "@/pages/Leads";
import UnderwriterInbox from "@/pages/UnderwriterInbox";
import Teams from "@/pages/Teams";
import Admin from "@/pages/Admin";

import ValuePackages from "@/pages/ValuePackages";
import AuthPage from "@/pages/Auth";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import { CookieConsent } from "@/components/CookieConsent";
import { ThemeManager } from "@/components/ThemeManager";
import TrialBanner from "@/components/TrialBanner";
import LenderEnquiry from "@/pages/LenderEnquiry";

import Compliance from "@/pages/Compliance";
import Terms from "@/pages/Terms";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
    enabled: isAuthenticated,
  });

  const isUnderwriter = roleData?.role === "underwriter";

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/lender-enquiry" component={LenderEnquiry} />
          <Route path="/value-packages" component={ValuePackages} />
          <Route path="/subscribe" component={SubscriptionPage} />
          <Route path="/terms" component={Terms} />
          <Route path="/subscription/complete" component={SubscriptionComplete} />
        </>
      ) : (
        <>
          <Route path="/" component={isUnderwriter ? UnderwriterInbox : Pipeline} />
          <Route path="/pipeline" component={Pipeline} />
          <Route path="/search" component={CompanySearch} />
          <Route path="/prospect/:id" component={ProspectDetail} />
          <Route path="/lenders" component={Lenders} />
          <Route path="/lenders/:id" component={LenderDetail} />
          <Route path="/submissions" component={Submissions} />
          <Route path="/leads" component={Leads} />
          <Route path="/underwriting" component={UnderwriterInbox} />
          <Route path="/compliance" component={Compliance} />
          <Route path="/teams" component={Teams} />
          <Route path="/admin" component={Admin} />

          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/lender-enquiry" component={LenderEnquiry} />
          <Route path="/value-packages" component={ValuePackages} />
          <Route path="/subscribe" component={SubscriptionPage} />
          <Route path="/terms" component={Terms} />
          <Route path="/subscription/complete" component={SubscriptionComplete} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

import { OnboardingProvider, WelcomeModal, CelebrationModal } from "@/components/onboarding";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <>
      <div className="flex bg-background h-screen overflow-hidden">
        {isAuthenticated && !isLoading && (
          <div className="hidden md:block">
            <Sidebar />
          </div>
        )}

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {isAuthenticated && !isLoading && <TrialBanner />}

          <main className="flex-1 overflow-y-auto w-full">
            {isAuthenticated && !isLoading ? (
              <OnboardingProvider userName={user?.firstName || "there"}>
                <Router />
                <WelcomeModal userName={user?.firstName || "there"} />
                <CelebrationModal />
              </OnboardingProvider>
            ) : (
              <Router />
            )}
          </main>
        </div>
      </div>
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
        <ThemeManager />
        <CookieConsent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
