import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import MobileNav from "@/components/MobileNav";
import { lazy, Suspense } from "react";

// Lazy load all page components for better performance
const NotFound = lazy(() => import("@/pages/not-found"));


const Pipeline = lazy(() => import("@/pages/Pipeline"));
const CompanySearch = lazy(() => import("@/pages/CompanySearch"));
const ProspectDetail = lazy(() => import("@/pages/ProspectDetail"));

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
const BrokersCRM = lazy(() => import("@/pages/BrokersCRM"));
const Clients = lazy(() => import("@/pages/GodModeCRM")); // Clients page
const Brokers = lazy(() => import("@/pages/BrokersCRM")); // Brokers page
const CreditTools = lazy(() => import("@/pages/CreditTools"));
const Workforce = lazy(() => import("@/pages/Workforce"));
const ContactEnrichmentTest = lazy(() => import("@/pages/ContactEnrichmentTest"));

const AuthPage = lazy(() => import("@/pages/Auth"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Compliance = lazy(() => import("@/pages/Compliance"));
const Terms = lazy(() => import("@/pages/Terms"));
const LenderEnquiry = lazy(() => import("@/pages/LenderEnquiry"));
const Gmail = lazy(() => import("@/pages/Gmail"));
const UnderwritingLayout = lazy(() => import("@/layouts/UnderwritingLayout"));
const DocumentPortalPage = lazy(() => import("@/pages/DocumentPortalPage"));
const Forecasts = lazy(() => import("@/pages/Forecasts"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Cashflow = lazy(() => import("@/pages/Cashflow"));
const AIStudio = lazy(() => import("@/pages/AIStudio"));
const Invoicing = lazy(() => import("@/pages/Invoicing"));
const Income = lazy(() => import("@/pages/Income"));
const EmailTemplates = lazy(() => import("@/pages/EmailTemplates"));
const EmailCampaigns = lazy(() => import("@/pages/EmailCampaigns"));
const MediaGallery = lazy(() => import("@/pages/MediaGallery"));
const Craft = lazy(() => import("@/pages/Craft"));
const WhatsApp = lazy(() => import("@/pages/WhatsApp"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));
const BrokerPortal = lazy(() => import("@/pages/BrokerPortal"));
const SterlingFile = lazy(() => import("@/pages/sterling/SterlingFile"));
const SterlingSettings = lazy(() => import("@/pages/sterling/SterlingSettings"));
const IntroductionPortal = lazy(() => import("@/pages/IntroductionPortal"));
const PackUpload = lazy(() => import("@/pages/PackUpload"));
const CallCentre = lazy(() => import("@/pages/CallCentre"));
const AgentMail = lazy(() => import("@/pages/AgentMail"));


import { CookieConsent } from "@/components/CookieConsent";
import { ThemeManager } from "@/components/ThemeManager";


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
  const isExternalBroker = role === "external_broker";

  if (isAuthenticated && isExternalBroker) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/pack/:token" component={PackUpload} />
          <Route path="/broker-portal/settings" component={SterlingSettings} />
          <Route path="/broker-portal/:id" component={SterlingFile} />
          <Route path="/broker-portal" component={BrokerPortal} />
          <Route path="/auth" component={AuthPage} />
          <Route>
            <Redirect to="/broker-portal" />
          </Route>
        </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public Routes */}
        <Route path="/auth" component={AuthPage} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={Terms} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/introduction-portal" component={IntroductionPortal} />
        <Route path="/pack/:token" component={PackUpload} />

        <Route path="/broker-portal/settings">
          {!isAuthenticated ? <Redirect to="/auth" /> : <SterlingSettings />}
        </Route>
        <Route path="/broker-portal/:id">
          {!isAuthenticated ? <Redirect to="/auth" /> : <SterlingFile />}
        </Route>
        <Route path="/broker-portal">
          {!isAuthenticated ? <Redirect to="/auth" /> : <BrokerPortal />}
        </Route>

        {/* Redirect for root — send unauthenticated users to login */}
        <Route path="/">
          {!isAuthenticated ? <Redirect to="/auth" /> : (
            isExternalBroker ? <Redirect to="/broker-portal" /> :
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
        <Route path="/clients">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Clients />}
        </Route>
        <Route path="/brokers">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Brokers />}
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
<Route path="/enrichment-test">
          {!isAuthenticated ? <Redirect to="/auth" /> : <ContactEnrichmentTest />}
        </Route>
        <Route path="/admin">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Admin />}
        </Route>
        <Route path="/gmail">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Gmail />}
        </Route>
        <Route path="/whatsapp">
          {!isAuthenticated ? <Redirect to="/auth" /> : <WhatsApp />}
        </Route>
        <Route path="/agent-mail">
          {!isAuthenticated ? <Redirect to="/auth" /> : <AgentMail />}
        </Route>
        <Route path="/outreach">
          {!isAuthenticated ? <Redirect to="/auth" /> : <CallCentre mode="outreach" />}
        </Route>
        <Route path="/customer-service">
          {!isAuthenticated ? <Redirect to="/auth" /> : <CallCentre mode="service" />}
        </Route>

        <Route path="/email-templates">
          {!isAuthenticated ? <Redirect to="/auth" /> : <EmailTemplates />}
        </Route>
        <Route path="/email-campaigns">
          {!isAuthenticated ? <Redirect to="/auth" /> : <EmailCampaigns />}
        </Route>
        <Route path="/media">
          {!isAuthenticated ? <Redirect to="/auth" /> : <MediaGallery />}
        </Route>
        <Route path="/craft">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Craft />}
        </Route>
        <Route path="/crm">
          {!isAuthenticated ? <Redirect to="/auth" /> : <GodModeCRM />}
        </Route>
        <Route path="/brokers">
          {!isAuthenticated ? <Redirect to="/auth" /> : <BrokersCRM />}
        </Route>

        <Route path="/credit-tools">
          {!isAuthenticated ? <Redirect to="/auth" /> : <CreditTools />}
        </Route>
        <Route path="/forecasts">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Forecasts />}
        </Route>
        <Route path="/expenses">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Expenses />}
        </Route>
        <Route path="/cashflow">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Cashflow />}
        </Route>
        <Route path="/ai-studio">
          {!isAuthenticated ? <Redirect to="/auth" /> : <AIStudio />}
        </Route>
        <Route path="/invoicing">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Invoicing />}
        </Route>
        <Route path="/income">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Income />}
        </Route>
        <Route path="/profile">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Profile />}
        </Route>
        <Route path="/settings">
          {!isAuthenticated ? <Redirect to="/auth" /> : <Settings />}
        </Route>

        <Route path="/lender-enquiry" component={LenderEnquiry} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}


import { OnboardingProvider, WelcomeModal, CelebrationModal } from "@/components/onboarding";

function AppContent() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading, user, role } = useAuth();
  const isCustomerPack = location.startsWith("/pack/");
  const isSterlingPortal =
    role === "external_broker" || location.startsWith("/broker-portal");

  // Customer pack and the Sterling portal stay full-screen — no Nexus Command Deck.
  if (isCustomerPack || (isAuthenticated && !isLoading && isSterlingPortal)) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Router />
      </Suspense>
    );
  }

  // Signed-in: the Command Deck shell (lens rail + ⌘K bar + atmosphere)
  if (isAuthenticated && !isLoading) {
    return (
      <>
        <CommandDeck>
          <main className="flex-1 overflow-y-auto w-full">
            <Suspense fallback={<PageLoader />}>
              <OnboardingProvider userName={user?.firstName || "there"}>
                <Router />
                <WelcomeModal userName={user?.firstName || "there"} />
                <CelebrationModal />
              </OnboardingProvider>
            </Suspense>
          </main>
        </CommandDeck>
        <MobileNav />
      </>
    );
  }

  // Public / unauthenticated: full-screen routes (Landing, Auth)
  return (
    <Suspense fallback={<PageLoader />}>
      <Router />
    </Suspense>
  );
}

import { LayoutProvider } from "@/context/LayoutContext";
import { CommandDeck } from "@/components/shell/CommandDeck";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
