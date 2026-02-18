
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MailCheck, 
  Building2, 
  Send, 
  Users, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: 'Grade A', value: 45, color: '#4f46e5' },
  { name: 'Grade B', value: 30, color: '#6366f1' },
  { name: 'Grade C', value: 15, color: '#818cf8' },
  { name: 'Grade D', value: 8, color: '#fbbf24' },
  { name: 'Grade F', value: 2, color: '#ef4444' },
];

const StatCard = ({ title, value, icon, change, trend }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
        {icon}
      </div>
      <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'}`}>
        {change}
        <ArrowUpRight className="w-3 h-3 ml-1" />
      </div>
    </div>
    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm mt-1">Welcome back, Shaun. Here is what is happening across your fleet.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => navigate('/analytics')}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-semibold text-sm shadow-sm"
          >
            Analytics
          </button>
          <button 
            onClick={() => navigate('/campaigns')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-sm shadow-sm"
          >
            New Campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Validated" value="15,420" icon={<MailCheck />} change="+12%" trend="up" />
        <StatCard title="Active Companies" value="1,240" icon={<Building2 />} change="+5%" trend="up" />
        <StatCard title="Sent Today" value="850" icon={<Send />} change="0%" trend="stable" />
        <StatCard title="Contacts" value="8,510" icon={<Users />} change="+820" trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900">Email Quality Distribution</h3>
            <select className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg px-3 py-1.5 outline-none">
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
            </select>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h3>
          <div className="space-y-6 flex-1 overflow-y-auto pr-1">
            {[
              { text: 'Campaign "Q1 Refinancing" launched', time: '2h ago', icon: <Send className="w-4 h-4" /> },
              { text: 'Batch of 127 emails validated', time: '5h ago', icon: <CheckCircle2 className="w-4 h-4" /> },
              { text: 'Companies House sync complete', time: 'Yesterday', icon: <Building2 className="w-4 h-4" /> },
              { text: '50 new contacts added', time: '2 days ago', icon: <Users className="w-4 h-4" /> },
            ].map((item, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg text-slate-500">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm text-slate-700 font-semibold">{item.text}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> {item.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={() => navigate('/analytics')}
            className="mt-6 w-full py-2.5 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
          >
            View Full Audit
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
