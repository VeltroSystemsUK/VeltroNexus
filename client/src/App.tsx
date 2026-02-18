import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import MobileNav from "@/components/MobileNav";
import Sidebar from "@/components/Sidebar";
import { lazy, Suspense } from "react";

// Lazy load all page components for better performance
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Pipeline = lazy(() => import("@/pages/Pipeline"));
const CompanySearch = lazy(() => import("@/pages/CompanySearch"));
const ProspectDetail = lazy(() => import("@/pages/ProspectDetail"));
const SubscriptionComplete = lazy(() => import("@/pages/SubscriptionComplete"));
const SubscriptionPage = lazy(() => import("@/pages/SubscriptionPage"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Lenders = lazy(() => import("@/pages/Lenders"));
const LenderDetail = lazy(() => import("@/pages/LenderDetail"));
const Submissions = lazy(() => import("@/pages/Submissions"));
const Leads = lazy(() => import("@/pages/Leads"));
const UnderwriterInbox = lazy(() => import("@/pages/UnderwriterInbox"));
const Teams = lazy(() => import("@/pages/Teams"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const Admin = lazy(() => import("@/pages/Admin"));
const GodModeCRM = lazy(() => import("@/pages/GodModeCRM"));
const LeadFinder = lazy(() => import("@/pages/LeadFinder"));
const BrokersCRM = lazy(() => import("@/pages/BrokersCRM"));
const BrokerFinder = lazy(() => import("@/pages/BrokerFinder"));
const GodModeMarketing = lazy(() => import("@/pages/GodModeMarketing"));
const CreditTools = lazy(() => import("@/pages/CreditTools"));
const Workforce = lazy(() => import("@/pages/Workforce"));
const OutreachQueue = lazy(() => import("@/pages/OutreachQueue"));
const ContactEnrichmentTest = lazy(() => import("@/pages/ContactEnrichmentTest"));
const ValuePackages = lazy(() => import("@/pages/ValuePackages"));
const AuthPage = lazy(() => import("@/pages/Auth"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Compliance = lazy(() => import("@/pages/Compliance"));
const Terms = lazy(() => import("@/pages/Terms"));
const RefinanceLanding = lazy(() => import("@/pages/marketing/RefinanceLanding"));
const RefinanceAnalysis = lazy(() => import("@/pages/marketing/RefinanceAnalysis"));
const RefinanceApplication = lazy(() => import("@/pages/marketing/RefinanceApplication"));
const LenderEnquiry = lazy(() => import("@/pages/LenderEnquiry"));
const Gmail = lazy(() => import("@/pages/Gmail"));
const UnderwritingLayout = lazy(() => import("@/layouts/UnderwritingLayout"));
const DocumentPortalPage = lazy(() => import("@/pages/DocumentPortalPage"));


import { CookieConsent } from "@/components/CookieConsent";
import { ThemeManager } from "@/components/ThemeManager";
import TrialBanner from "@/components/TrialBanner";

// Loading component for lazy routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function Router() {
  const { isAuthenticated, role, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <PageLoader />;
  }

  const isUnderwriter = role === "underwriter";


  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public Routes */}
        <Route path="/auth" component={AuthPage} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={Terms} />
        <Route path="/refinance" component={RefinanceLanding} />
        <Route path="/refinance/analysis" component={RefinanceAnalysis} />
        <Route path="/refinance/apply" component={RefinanceApplication} />

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
        <Route path="/portal/:id">
          {!isAuthenticated ? <Redirect to="/auth" /> : <DocumentPortalPage />}
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
        <Route path="/workforce">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Workforce />}
        </Route>
        <Route path="/outreach">
          {!isAuthenticated ? <Redirect to="/auth" /> : <OutreachQueue />}
        </Route>
        <Route path="/enrichment-test">
          {!isAuthenticated ? <Redirect to="/auth" /> : <ContactEnrichmentTest />}
        </Route>
        <Route path="/admin">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Admin />}
        </Route>
        <Route path="/gmail">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Gmail />}
        </Route>

        <Route path="/marketing/:rest*" component={GodModeMarketing} />
        <Route path="/marketing" component={GodModeMarketing} />
        <Route path="/crm">
          {!isAuthenticated ? <Redirect to="/auth" /> : <GodModeCRM />}
        </Route>
        <Route path="/lead-finder">
          {!isAuthenticated ? <Redirect to="/auth" /> : <LeadFinder />}
        </Route>
        <Route path="/brokers">
          {!isAuthenticated ? <Redirect to="/auth" /> : <BrokersCRM />}
        </Route>
        <Route path="/broker-finder">
          {!isAuthenticated ? <Redirect to="/auth" /> : <BrokerFinder />}
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
    </Suspense>
  );
}


import { OnboardingProvider, WelcomeModal, CelebrationModal } from "@/components/onboarding";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  return (
    <>
      <div className="flex bg-background h-screen overflow-hidden">
        {isAuthenticated && !isLoading && (
          <div className="hidden md:block">
            <Sidebar />
          </div>
        )}

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {isAuthenticated && !isLoading && <UnifiedHeader />}
          {isAuthenticated && !isLoading && <TrialBanner />}

          <main className="flex-1 overflow-y-auto w-full">
            <Suspense fallback={<PageLoader />}>
              {isAuthenticated && !isLoading ? (
                <OnboardingProvider userName={user?.firstName || "there"}>
                  <Router />
                  <WelcomeModal userName={user?.firstName || "there"} />
                  <CelebrationModal />
                </OnboardingProvider>
              ) : (
                <Router />
              )}
            </Suspense>
          </main>
        </div>
      </div>
      {isAuthenticated && !isLoading && <MobileNav />}
    </>
  );
}

import { LayoutProvider } from "@/context/LayoutContext";
import { UnifiedHeader } from "@/components/UnifiedHeader";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LayoutProvider>
          <Toaster />
          <SonnerToaster position="top-right" />
          <AppContent />
          <ThemeManager />
          <CookieConsent />
        </LayoutProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
