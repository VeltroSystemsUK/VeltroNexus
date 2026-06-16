import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { usePageTitle, usePageActions } from '@/context/LayoutContext';
import {
  LayoutDashboard,
  MailCheck,
  Building2,
  Users,
  Send,
  BarChart3,
  Plus,
  Search
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [location, setLocation] = useLocation();

  // Set Page Title
  usePageTitle("MARKETING", "");

  // Set Header Actions
  const actions = useMemo(() => (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setLocation('/marketing/analytics')}>
        <Search className="mr-2 h-4 w-4" />
        Investigate
      </Button>
      <Button onClick={() => setLocation('/marketing/campaigns')}>
        <Plus className="mr-2 h-4 w-4" />
        Launch Campaign
      </Button>
    </div>
  ), [setLocation]);

  usePageActions(actions);

  const navItems = [
    { to: '/marketing', icon: <LayoutDashboard className="w-4 h-4 mr-2" />, label: 'Dashboard', value: 'dashboard', color: 'bg-primary' },
    { to: '/marketing/validate', icon: <MailCheck className="w-4 h-4 mr-2" />, label: 'Verification', value: 'validate', color: 'bg-emerald-600' },
    { to: '/marketing/companies', icon: <Building2 className="w-4 h-4 mr-2" />, label: 'Companies', value: 'companies', color: 'bg-blue-600' },
    { to: '/marketing/contacts', icon: <Users className="w-4 h-4 mr-2" />, label: 'Contacts', value: 'contacts', color: 'bg-emerald-600' },
    { to: '/marketing/campaigns', icon: <Send className="w-4 h-4 mr-2" />, label: 'Campaigns', value: 'campaigns', color: 'bg-amber-600' },
    { to: '/marketing/analytics', icon: <BarChart3 className="w-4 h-4 mr-2" />, label: 'Analytics', value: 'analytics', color: 'bg-emerald-600' },
  ];

  // Determine active tab based on location
  const activeTab = useMemo(() => {
    const found = navItems.find(item => item.to === location);
    if (found) return found.value;
    // Fallback/Matches partially
    if (location.startsWith('/marketing/validate')) return 'validate';
    if (location.startsWith('/marketing/companies')) return 'companies';
    if (location.startsWith('/marketing/contacts')) return 'contacts';
    if (location.startsWith('/marketing/campaigns')) return 'campaigns';
    if (location.startsWith('/marketing/analytics')) return 'analytics';
    return 'dashboard';
  }, [location, navItems]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={(val) => {
          const found = navItems.find(i => i.value === val);
          if (found) setLocation(found.to);
        }}>
          <TabsList className="w-full grid grid-cols-6 h-auto p-1 gap-1 bg-muted/50 border border-white/10">
            {navItems.map(item => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className={`data-[state=active]:${(item as any).color} data-[state=active]:text-white transition-all duration-300`}
              >
                {item.icon}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {children}
      </div>
    </div>
  );
};

export default Layout;
