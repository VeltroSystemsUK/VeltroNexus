import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "sonner";
import NotFound from "@/pages/not-found";
import Pipeline from "@/pages/Pipeline";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Pipeline} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SonnerToaster position="top-right" />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
