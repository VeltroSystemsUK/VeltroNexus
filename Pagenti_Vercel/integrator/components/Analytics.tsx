
import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, MousePointer2, MailOpen, AlertCircle, Info, Activity } from 'lucide-react';

const campaignData = [
  { name: 'Mon', sent: 400, opens: 240, clicks: 120 },
  { name: 'Tue', sent: 300, opens: 139, clicks: 80 },
  { name: 'Wed', sent: 200, opens: 980, clicks: 200 },
  { name: 'Thu', sent: 278, opens: 390, clicks: 150 },
  { name: 'Fri', sent: 189, opens: 480, clicks: 110 },
  { name: 'Sat', sent: 239, opens: 380, clicks: 90 },
  { name: 'Sun', sent: 349, opens: 430, clicks: 130 },
];

const gradeDistribution = [
  { name: 'Grade A', value: 450, color: '#4f46e5' },
  { name: 'Grade B', value: 300, color: '#6366f1' },
  { name: 'Grade C', value: 150, color: '#818cf8' },
  { name: 'Grade D', value: 80, color: '#fbbf24' },
  { name: 'Grade F', value: 20, color: '#ef4444' },
];

const AnalyticsCard = ({ title, value, subValue, icon, trend }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex items-center space-x-4">
      <div className="p-3 bg-slate-50 text-slate-500 rounded-lg border border-slate-100">
        {icon}
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h4>
        <div className="flex items-baseline space-x-2 mt-0.5">
          <p className="text-xl font-bold text-slate-900">{value}</p>
          <p className="text-[10px] font-bold text-emerald-600 uppercase">{subValue}</p>
        </div>
      </div>
    </div>
  </div>
);

const Analytics: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Campaign Analytics</h2>
          <p className="text-slate-500 text-sm mt-1">Detailed performance metrics for all outreach activities.</p>
        </div>
        <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1">
          <button className="px-4 py-1.5 bg-white shadow-sm text-slate-700 text-xs font-bold rounded-md">Live View</button>
          <button className="px-4 py-1.5 text-slate-500 text-xs font-bold rounded-md hover:text-slate-700 transition-colors">Historical</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalyticsCard title="Open Rate" value="42.5%" subValue="+3.2%" icon={<MailOpen className="w-5 h-5" />} />
        <AnalyticsCard title="Click Rate" value="12.8%" subValue="+1.1%" icon={<MousePointer2 className="w-5 h-5" />} />
        <AnalyticsCard title="Verification Lock" value="94.2%" subValue="+0.4%" icon={<TrendingUp className="w-5 h-5" />} />
        <AnalyticsCard title="Bounces" value="1.2%" subValue="-0.8%" icon={<AlertCircle className="w-5 h-5" />} trend="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center">
            Daily Engagement Cycle <Info className="w-4 h-4 ml-2 text-slate-300" />
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={campaignData}>
                <defs>
                  <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="opens" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorEngagement)" />
                <Area type="monotone" dataKey="clicks" stroke="#0ea5e9" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center">
             Data Quality <Activity className="w-4 h-4 ml-2 text-indigo-600" />
          </h3>
          <div className="flex-1 min-h-[250px]">
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
          <div className="space-y-3 mt-6">
            {gradeDistribution.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs font-bold text-slate-500 uppercase">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{((item.value/1000)*100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
