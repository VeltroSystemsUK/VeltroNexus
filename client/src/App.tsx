import { Switch, Route, useLocation, Redirect } from "wouter";
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
import Inbox from "@/pages/Inbox";
import Admin from "@/pages/Admin";
import GodModeDashboard from "@/pages/GodModeDashboard";
import GodModeCRM from "@/pages/GodModeCRM";
import GodModeMarketing from "@/pages/GodModeMarketing";
import CreditTools from "@/pages/CreditTools";

import ValuePackages from "@/pages/ValuePackages";
import AuthPage from "@/pages/Auth";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import { CookieConsent } from "@/components/CookieConsent";
import { ThemeManager } from "@/components/ThemeManager";
import TrialBanner from "@/components/TrialBanner";
import LenderEnquiry from "@/pages/LenderEnquiry";
import UnderwritingLayout from "@/layouts/UnderwritingLayout";

import Compliance from "@/pages/Compliance";
import Terms from "@/pages/Terms";

function Router() {
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
  const { data: roleData, isLoading: isRoleLoading } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
    enabled: !!user,
  });

  if (isAuthLoading || (isAuthenticated && isRoleLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isUnderwriter = roleData?.role === "underwriter";

  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={Terms} />

      {/* Redirect for root */}
      <Route path="/">
        {!isAuthenticated ? <Landing /> : (
          isUnderwriter ? <Redirect to="/underwriting" /> : <Redirect to="/pipeline" />
        )}
      </Route>

      {/* Authenticated Routes */}
      <Route path="/pipeline">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Pipeline />}
      </Route>
      <Route path="/search">
        {!isAuthenticated ? <Redirect to="/auth" /> : <CompanySearch mode="user" />}
      </Route>
      <Route path="/prospect/:id/underwriting/:rest*">
        {!isAuthenticated ? <Redirect to="/auth" /> : <UnderwritingLayout />}
      </Route>
      <Route path="/prospect/:id">
        {!isAuthenticated ? <Redirect to="/auth" /> : <ProspectDetail />}
      </Route>
      <Route path="/lenders">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Lenders />}
      </Route>
      <Route path="/lenders/:id">
        {!isAuthenticated ? <Redirect to="/auth" /> : <LenderDetail />}
      </Route>
      <Route path="/submissions">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Submissions />}
      </Route>
      <Route path="/leads">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Leads />}
      </Route>
      <Route path="/underwriting">
        {!isAuthenticated ? <Redirect to="/auth" /> : <UnderwriterInbox />}
      </Route>
      <Route path="/compliance">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Compliance />}
      </Route>
      <Route path="/inbox">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Inbox />}
      </Route>
      <Route path="/teams">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Teams />}
      </Route>
      <Route path="/admin">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Admin />}
      </Route>

      <Route path="/god-mode/marketing/:rest*" component={GodModeMarketing} />
      <Route path="/god-mode/marketing" component={GodModeMarketing} />
      <Route path="/god-mode/crm">
        {!isAuthenticated ? <Redirect to="/auth" /> : <GodModeCRM />}
      </Route>
      <Route path="/god-mode">
        {!isAuthenticated ? <Redirect to="/auth" /> : <GodModeDashboard />}
      </Route>

      <Route path="/credit-tools">
        {!isAuthenticated ? <Redirect to="/auth" /> : <CreditTools />}
      </Route>
      <Route path="/profile">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Profile />}
      </Route>
      <Route path="/settings">
        {!isAuthenticated ? <Redirect to="/auth" /> : <Settings />}
      </Route>

      <Route path="/pricing" component={Pricing} />
      <Route path="/lender-enquiry" component={LenderEnquiry} />
      <Route path="/value-packages" component={ValuePackages} />
      <Route path="/subscribe" component={SubscriptionPage} />
      <Route path="/subscription/complete" component={SubscriptionComplete} />

      <Route component={NotFound} />
    </Switch>
  );
}

import { OnboardingProvider, WelcomeModal, CelebrationModal } from "@/components/onboarding";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  const isMarketingPortal = location.startsWith("/god-mode/marketing");

  return (
    <>
      <div className="flex bg-background h-screen overflow-hidden">
        {isAuthenticated && !isLoading && !isMarketingPortal && (
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
