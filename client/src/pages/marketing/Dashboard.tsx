import React from 'react';
import { useLocation } from 'wouter';
import {
  MailCheck,
  Building2,
  Send,
  Users,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Contact } from './types';

const StatCard = ({ title, value, icon, change, trend }: any) => (
  <div className="antigravity-card p-8 rounded-[2rem] transition-all duration-500 hover:scale-105 hover:shadow-[0_20px_50px_rgba(99,102,241,0.2)] group">
    <div className="flex justify-between items-start mb-6">
      <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/30 group-hover:rotate-12 transition-transform">
        {icon}
      </div>
      <div className={`flex items-center text-xs font-black px-2 py-1 rounded-full ${trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 bg-slate-400/10'}`}>
        {change}
        <ArrowUpRight className="w-3 h-3 ml-1" />
      </div>
    </div>
    <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">{title}</h3>
    <p className="text-4xl font-black text-white mt-2 tracking-tighter">{value}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/marketing/contacts'],
  });

  const totalValidated = contacts.length;
  const gradeA = contacts.filter(c => c.qualityGrade === 'A').length;
  const gradeB = contacts.filter(c => c.qualityGrade === 'B').length;

  const chartData = [
    { name: 'Grade A', value: gradeA, color: '#10b981' },
    { name: 'Grade B', value: gradeB, color: '#6366f1' },
    { name: 'Risky/Other', value: contacts.length - (gradeA + gradeB), color: '#fbbf24' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Header removed as it is now in the global layout */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard title="Total Validated" value={totalValidated.toString()} icon={<MailCheck />} change="0%" trend="stable" />
        <StatCard title="Active Companies" value="0" icon={<Building2 />} change="0%" trend="stable" />
        <StatCard title="Fleet Activity" value="0" icon={<Send />} change="0%" trend="stable" />
        <StatCard title="Universe Contacts" value={totalValidated.toString()} icon={<Users />} change="0" trend="stable" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 antigravity-card p-10 rounded-[2.5rem]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Signal Quality Metrics</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">Spectral analysis of verified entities</p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="antigravity-card p-10 rounded-[2.5rem] flex flex-col">
          <h3 className="text-xl font-black text-white tracking-tight mb-8">System Log</h3>
          <div className="space-y-8 flex-1 overflow-y-auto pr-2 scrollbar-hide">
            <div className="flex flex-col items-center justify-center h-full opacity-20">
              <Clock className="w-8 h-8 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">No Activity Indexed</p>
            </div>
          </div>
          <button
            onClick={() => setLocation('/marketing/analytics')}
            className="mt-10 w-full py-3.5 text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-white hover:bg-indigo-500/20 rounded-2xl transition-all border border-indigo-500/20"
          >
            Access Archives
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
