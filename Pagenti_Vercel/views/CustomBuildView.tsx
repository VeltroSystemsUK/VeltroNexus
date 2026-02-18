
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Zap, ArrowRight, CheckCircle2, ChevronLeft, Settings2, Binary, ShieldAlert, Cpu, Lock, Eye, Clock, Users, Server, Fingerprint } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { enquiryService } from '../services/enquiryService';
import { useAuth } from '../contexts/AuthContext';

export const CustomBuildView: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Builder State
  const [departments, setDepartments] = useState<string[]>(['Operations']);
  const [access, setAccess] = useState({
    email: true,
    crm: false,
    slack: false,
    db: false
  });
  const [complexity, setComplexity] = useState(50);

  // Derived Quote Logic - Simplified for new pricing model
  // One-time: 1500 (Setup) + 500 (Go Live) = 2000
  // Monthly: 250 * Modules
  // Access levels (CRM/DB) included in base or module fee for now as per specific request.



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Capture form data - in a real app these would be state controlled, but for this demo 
    // we'll grab them from the event or just rely on the existing state we have + some basic extraction
    // Since we didn't fully wire up all inputs in the previous file view to state, 
    // I entered placeholder logic. To make it work perfectly, I should wire up the inputs. 
    // However, given the code view, I see the inputs are uncontrolled (ref-less). 
    // I will quickly extract values from the form event for the "Demo" experience.

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // Recalculate quote for the record (2000 setup + 250 * modules)
    const quote = 2000 + (departments.length * 250);

    enquiryService.addEnquiry({
      jobTitle: formData.get('jobTitle') as string || 'Unknown Role',
      primaryDuty: formData.get('primaryDuty') as string || 'Unspecified Duties',
      fullName: isAuthenticated && user ? user.name : (formData.get('fullName') as string || 'Anonymous'),
      email: isAuthenticated && user ? user.email : (formData.get('email') as string || 'no-email@provided.com'),
      stack: formData.get('stack') as string || '',
      metric: formData.get('metric') as string || '',
      departments,
      access,
      quote
    });

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 2500);
  };

  const toggleDept = (dept: string) => {
    setDepartments(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  };

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse text-indigo-600">
          <Cpu size={48} />
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 tracking-tight font-heading">Scope Received.</h1>
        <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto">Our Engineers are spinning up a staging environment. Expect a secure link to your Agent's "Draft Mode" within 24 hours.</p>
        <button
          onClick={() => navigate(isAuthenticated ? '/dashboard/client' : '/browse')}
          className="bg-gray-900 text-white px-10 py-5 rounded-full font-bold hover:scale-105 transition-transform"
        >
          {isAuthenticated ? 'Return to Dashboard' : 'Return to Talent Pool'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <button onClick={() => navigate('/browse')} className="flex items-center gap-2 text-gray-400 hover:text-indigo-600 mb-12 font-bold uppercase tracking-widest text-[10px] transition-colors">
        <ChevronLeft size={14} /> Back
      </button>

      {/* Hero Section */}
      <div className="text-center mb-24 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-indigo-100">
          <Settings2 size={12} /> The Custom Placement Studio
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 tracking-tighter leading-[1.1] font-heading">
          The Role Doesn't Exist <span className="text-gray-300">Yet.</span> <br />
          So We’ll Build the <span className="text-indigo-600">Associate</span> Who Can Fill It.
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed font-medium max-w-2xl mx-auto">
          When a standard candidate won't do, our Forward Development team enters your "Office" to map your specific logic, security requirements, and legacy systems.
        </p>
      </div>

      {/* Associate Builder Interactive Component */}
      <div className="bg-white border border-gray-200 rounded-[3rem] shadow-2xl overflow-hidden mb-24 flex flex-col lg:flex-row">
        {/* Configurator Panel */}
        <div className="p-10 lg:p-14 lg:w-3/5 border-b lg:border-b-0 lg:border-r border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 font-heading mb-10 flex items-center gap-3">
            <Binary className="text-indigo-600" /> Associate Builder
          </h3>

          <div className="space-y-12">
            {/* Departments */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-4">Core Functions (Department Access)</label>
              <div className="flex flex-wrap gap-3">
                {['Sales', 'Operations', 'Finance', 'R&D', 'Support'].map(dept => (
                  <button
                    key={dept}
                    onClick={() => toggleDept(dept)}
                    className={`px-6 py-3 rounded-xl border font-bold text-sm transition-all ${departments.includes(dept) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-white'}`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Access Toggles */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-4">System Privileges</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setAccess({ ...access, email: !access.email })} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${access.email ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                  <span className="font-bold flex items-center gap-2"><Lock size={16} /> Email / Communication</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${access.email ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{access.email && <CheckCircle2 size={12} className="text-white" />}</div>
                </button>
                <button onClick={() => setAccess({ ...access, crm: !access.crm })} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${access.crm ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                  <span className="font-bold flex items-center gap-2"><Database size={16} /> CRM Rewrite</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${access.crm ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{access.crm && <CheckCircle2 size={12} className="text-white" />}</div>
                </button>
                <button onClick={() => setAccess({ ...access, db: !access.db })} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${access.db ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                  <span className="font-bold flex items-center gap-2"><Server size={16} /> Internal Database</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${access.db ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{access.db && <CheckCircle2 size={12} className="text-white" />}</div>
                </button>
              </div>
            </div>

            {/* Complexity Slider */}
            <div>
              <div className="flex justify-between mb-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cognitive Complexity</label>
                <span className="text-xs font-bold text-indigo-600">{complexity > 80 ? 'Executive Reasoning' : complexity > 40 ? 'Advanced Logic' : 'Standard Admin'}</span>
              </div>
              <input
                type="range" min="0" max="100" value={complexity}
                onChange={(e) => setComplexity(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Result / Quote Panel */}
        <div className="lg:w-2/5 bg-gray-900 p-10 lg:p-14 text-white flex flex-col justify-between">
          <div>
            <div className="uppercase tracking-[0.2em] text-[10px] text-gray-400 font-bold mb-8">Draft Configuration</div>
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <span className="text-gray-400">Set Up / Build Fee</span>
                <span className="font-mono text-white">£1,500</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <span className="text-gray-400">Go Live Fee</span>
                <span className="font-mono text-white">£500</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <span className="text-gray-400">Function Modules ({departments.length})</span>
                <span className="font-mono text-emerald-400">£{departments.length * 250} /mo</span>
              </div>

              {/* One-time Total */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-indigo-400 uppercase font-bold tracking-widest">Total One-Time</span>
                <span className="font-mono font-bold text-white">£2,000</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-gray-400">Estimated Monthly Cost</div>
            <div className="text-5xl font-mono font-bold mb-8 text-white">£{(departments.length * 250).toLocaleString()}</div>
            <p className="text-xs text-gray-500 mb-0">*Final quote subject to engineering audit.</p>
          </div>
        </div>
      </div>

      {/* Process & Security Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
        {/* Value Prop / Process */}
        <div className="space-y-8">
          <h3 className="text-2xl font-bold font-heading">The Forward Engineering Protocol</h3>
          <div className="space-y-6 relative pl-8 border-l-2 border-indigo-100">
            <div className="relative">
              <div className="absolute -left-[39px] top-1 w-5 h-5 rounded-full bg-white border-4 border-indigo-600"></div>
              <h4 className="text-lg font-bold text-gray-900">Week 1: The Audit</h4>
              <p className="text-gray-500">We shadow your team to learn the nuances of the role, mapping undefined logic and edge cases.</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[39px] top-1 w-5 h-5 rounded-full bg-gray-200"></div>
              <h4 className="text-lg font-bold text-gray-900">Week 2: The Build</h4>
              <p className="text-gray-500">We engineer the agent's logic, memory, and tool-access in Pagenti's secure staging environment.</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[39px] top-1 w-5 h-5 rounded-full bg-gray-200"></div>
              <h4 className="text-lg font-bold text-gray-900">Week 3: Probation</h4>
              <p className="text-gray-500">Parallel testing. Your new associate works in "Draft Mode" alongside human staff to ensure 100% accuracy.</p>
            </div>
          </div>
        </div>

        {/* Security Features */}
        <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]"></div>
          <h3 className="text-2xl font-bold font-heading mb-8 relative z-10 flex items-center gap-3"><ShieldAlert className="text-indigo-400" /> Enterprise Governance</h3>
          <div className="grid gap-6 relative z-10">
            <div className="bg-indigo-800/50 p-6 rounded-2xl border border-indigo-700/50">
              <h4 className="font-bold mb-2 flex items-center gap-2"><Server size={16} className="text-indigo-300" /> Private Cloud Deployment</h4>
              <p className="text-sm text-indigo-200">We deploy on your private cloud (AWS/GCP/Azure) to ensure zero data leakage.</p>
            </div>
            <div className="bg-indigo-800/50 p-6 rounded-2xl border border-indigo-700/50">
              <h4 className="font-bold mb-2 flex items-center gap-2"><Users size={16} className="text-indigo-300" /> Human-in-the-Loop (HITL)</h4>
              <p className="text-sm text-indigo-200">Mandatory "Approval Gates" for high-stakes decisions during the training phase.</p>
            </div>
            <div className="bg-indigo-800/50 p-6 rounded-2xl border border-indigo-700/50">
              <h4 className="font-bold mb-2 flex items-center gap-2"><Eye size={16} className="text-indigo-300" /> Granular Audit Logs</h4>
              <p className="text-sm text-indigo-200">View every "Thought Process" the agent had before taking an action.</p>
            </div>
          </div>
        </div>
      </div>

      {/* The Conversion Form */}
      <section className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 font-heading">Begin the Specification</h2>
          <p className="text-gray-500">Describe the role once. We'll engineer it forever.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl">
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Job Title</label>
                <input name="jobTitle" required type="text" placeholder="e.g. Director of First Impressions" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Primary Duty</label>
                <input name="primaryDuty" required type="text" placeholder="e.g. Managing 400+ WhatsApp inquiries" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>
            </div>



            {!isAuthenticated && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
                    <input name="fullName" required={!isAuthenticated} type="text" placeholder="Your Name" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-900 placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Work Email</label>
                    <input name="email" required={!isAuthenticated} type="email" placeholder="name@company.com" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-900 placeholder:text-gray-400" />
                  </div>
                </div>
              </>
            )}

            {isAuthenticated && (
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                    {user?.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Authenticated Contact</p>
                    <p className="text-sm font-bold text-gray-900">{user?.name} ({user?.email})</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Software Stack</label>
              <input name="stack" type="text" placeholder="List apps the agent must use (HubSpot, Jira, etc.)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Success Metric</label>
              <input name="metric" type="text" placeholder="e.g. Reduce response time to under 60 seconds" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
            </div>

            <div className="pt-4">
              <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all disabled:opacity-70 group">
                {loading ? (
                  <>Engineering Protocol Initiated... <Server className="animate-pulse" size={20} /></>
                ) : (
                  <>Initialize Build <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-4">By initiating, you agree to the Forward Development NDA.</p>
            </div>
          </div>
        </form>
      </section>

    </div>
  );
};
