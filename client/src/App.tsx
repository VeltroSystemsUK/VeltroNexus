import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/subscription/complete" component={SubscriptionComplete} />
        </>
      ) : (
        <>
          <Route path="/" component={Pipeline} />
          <Route path="/pipeline" component={Pipeline} />
          <Route path="/search" component={CompanySearch} />
          <Route path="/prospect/:id" component={ProspectDetail} />
          <Route path="/lenders" component={Lenders} />
          <Route path="/submissions" component={Submissions} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
          <Route path="/pricing" component={Pricing} />
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
