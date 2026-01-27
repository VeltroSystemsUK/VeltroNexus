
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, Users, MousePointer2, MailOpen, AlertCircle, Info } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { Contact } from './types';

const AnalyticsCard = ({ title, value, subValue, icon, color }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex items-center space-x-4">
      <div className={`p-3 rounded-xl bg-indigo-50 text-indigo-600`}>
        {icon}
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h4>
        <div className="flex items-baseline space-x-2">
          <p className="text-2xl font-black text-slate-900">{value}</p>
          <p className="text-xs font-bold text-emerald-600">{subValue}</p>
        </div>
      </div>
    </div>
  </div>
);

const Analytics: React.FC = () => {
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/marketing/contacts'],
  });

  const gradeA = contacts.filter(c => c.qualityGrade === 'A').length;
  const gradeB = contacts.filter(c => c.qualityGrade === 'B').length;
  const others = contacts.length - (gradeA + gradeB);

  const gradeDistribution = [
    { name: 'Grade A', value: gradeA, color: '#10b981' },
    { name: 'Grade B', value: gradeB, color: '#6366f1' },
    { name: 'Risky/Other', value: others, color: '#fbbf24' },
  ].filter(g => g.value > 0);

  const campaignData: any[] = [];

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Advanced Analytics</h2>
        <p className="text-slate-500">Performance insights across all verification and marketing campaigns.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalyticsCard title="Avg. Open Rate" value="0%" subValue="0%" icon={<MailOpen />} color="indigo" />
        <AnalyticsCard title="Avg. Click Rate" value="0%" subValue="0%" icon={<MousePointer2 />} color="blue" />
        <AnalyticsCard title="Verify Rate" value="0%" subValue="0%" icon={<TrendingUp />} color="emerald" />
        <AnalyticsCard title="Bounces" value="0%" subValue="0%" icon={<AlertCircle />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center">
            Campaign Performance Engagement <Info className="w-4 h-4 ml-2 text-slate-300" />
          </h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={campaignData}>
                <defs>
                  <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="opens" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorOpens)" />
                <Area type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-8">Data Quality Mix</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gradeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {gradeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {gradeDistribution.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm font-medium text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{((item.value / 1000) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
