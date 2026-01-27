import { Switch, Route, Router, useLocation } from "wouter";
import MarketingLayout from "./marketing/Layout";
import MarketingDashboard from "./marketing/Dashboard";
import MarketingVerification from "./marketing/EmailValidation";
import CompanyVerification from "./marketing/CompanyVerification";
import MarketingContacts from "./marketing/Contacts";
import CampaignBuilder from "./marketing/CampaignBuilder";
import MarketingAnalytics from "./marketing/Analytics";

const PathDisplay = () => {
    const [location] = useLocation();
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
            <h2 className="text-2xl font-black uppercase tracking-widest opacity-20">Path Not Indexed</h2>
            <p className="mt-2 font-bold text-xs uppercase tracking-widest text-indigo-400">Current Scope: {location}</p>
            <p className="mt-2 font-bold text-xs uppercase tracking-widest">Select a valid signal from the sidebar</p>
        </div>
    );
};

export default function GodModeMarketing() {
    return (
        <MarketingLayout>
            <Switch>
                <Route path="/god-mode/marketing" component={MarketingDashboard} />
                <Route path="/god-mode/marketing/validate" component={MarketingVerification} />
                <Route path="/god-mode/marketing/companies" component={CompanyVerification} />
                <Route path="/god-mode/marketing/contacts" component={MarketingContacts} />
                <Route path="/god-mode/marketing/campaigns" component={CampaignBuilder} />
                <Route path="/god-mode/marketing/analytics" component={MarketingAnalytics} />

                {/* Catch-all for sub-routes that don't match */}
                <Route component={PathDisplay} />
            </Switch>
        </MarketingLayout>
    );
}
