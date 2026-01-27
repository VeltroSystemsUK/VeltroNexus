
import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  MailCheck,
  Building2,
  Users,
  Send,
  BarChart3,
  Zap,
  Bell,
  LogOut
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const navItems = [
    { to: '/god-mode/marketing', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
    { to: '/god-mode/marketing/validate', icon: <MailCheck className="w-5 h-5" />, label: 'Verification' },
    { to: '/god-mode/marketing/companies', icon: <Building2 className="w-5 h-5" />, label: 'Companies' },
    { to: '/god-mode/marketing/contacts', icon: <Users className="w-5 h-5" />, label: 'Contacts' },
    { to: '/god-mode/marketing/campaigns', icon: <Send className="w-5 h-5" />, label: 'Campaigns' },
    { to: '/god-mode/marketing/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      {/* Antigravity Sidebar */}
      <aside className="w-72 glass-sidebar text-slate-400 flex flex-col hidden md:flex z-50">
        <div className="p-8 flex items-center space-x-3 text-white">
          <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
            <Zap className="w-6 h-6 text-indigo-400 fill-indigo-400/20" />
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase">VELTRO</span>
        </div>

        <nav className="flex-1 px-6 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.to;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={`flex items-center space-x-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${isActive
                  ? 'bg-indigo-500/10 text-white border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                  : 'hover:bg-white/5 hover:text-white'
                  }`}
              >
                <span className="group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                <span className="font-bold text-sm tracking-wide uppercase">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 m-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg uppercase">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{user?.subscriptionTier} User</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all font-bold text-xs uppercase tracking-widest border border-transparent hover:border-white/10 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{logoutMutation.isPending ? 'Exiting...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        <header className="h-20 bg-transparent flex items-center justify-between px-10 z-10">
          <h1 className="text-lg font-black text-white md:hidden tracking-tighter">VELTRO</h1>
          <div className="flex-1 md:flex-none"></div>
          <div className="flex items-center space-x-6">
            <div className="hidden lg:flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Secure</span>
            </div>
            <button className="p-2.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl relative transition-all group">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#020617] group-hover:scale-125 transition-transform"></span>
            </button>
            <div className="h-8 w-px bg-white/10 mx-2"></div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Credits</p>
              <p className="text-sm font-black text-indigo-400">14.2K Units</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 z-10 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
