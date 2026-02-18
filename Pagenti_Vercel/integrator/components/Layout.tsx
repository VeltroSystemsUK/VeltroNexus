
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from "../services/firebase";
import { signOut } from "firebase/auth";
import { 
  LayoutDashboard, 
  MailCheck, 
  Building2, 
  Users, 
  Send, 
  BarChart3, 
  LogOut,
  Bell,
  Zap,
  Globe
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const isDemo = localStorage.getItem('veltro_demo_mode') === 'true';

  const handleLogout = async () => {
    localStorage.removeItem('veltro_demo_mode');
    await signOut(auth);
    navigate('/login');
    window.location.reload();
  };

  const navItems = [
    { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
    { to: '/validate', icon: <MailCheck className="w-5 h-5" />, label: 'Verification' },
    { to: '/companies', icon: <Building2 className="w-5 h-5" />, label: 'Companies' },
    { to: '/contacts', icon: <Users className="w-5 h-5" />, label: 'Contacts' },
    { to: '/campaigns', icon: <Send className="w-5 h-5" />, label: 'Campaigns' },
    { to: '/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col hidden md:flex z-50">
        <div className="p-6 flex items-center space-x-3 text-white">
          <Zap className="w-6 h-6 text-indigo-500 fill-indigo-500" />
          <span className="text-xl font-bold tracking-tight uppercase">Veltro</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span className="font-semibold text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 px-2 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
              {isDemo ? 'D' : user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate">
                {isDemo ? 'Demo Session' : user?.email?.split('@')[0]}
              </p>
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
                {isDemo ? 'Simulated' : 'Active Station'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-2 w-full px-2 py-2 text-slate-400 hover:text-red-400 transition-all font-bold text-[10px] uppercase tracking-wider mt-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="flex items-center">
            <h1 className="text-lg font-black text-slate-900 md:hidden">VELTRO</h1>
            {isDemo && (
              <div className="ml-4 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[9px] font-black text-amber-700 uppercase tracking-widest flex items-center">
                <Globe className="w-3 h-3 mr-1.5" /> Preview Mode
              </div>
            )}
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center space-x-6">
            <div className="hidden lg:flex items-center text-slate-500">
              <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isDemo ? 'Sync Paused' : 'Cloud Sync Active'}
              </span>
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fleet Power</p>
              <p className="text-xs font-bold text-indigo-600">PRO LEVEL</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
