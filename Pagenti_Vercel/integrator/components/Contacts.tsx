
import React, { useState } from 'react';
import { Search, Filter, Mail, CheckCircle2, XCircle, UserPlus, Inbox } from 'lucide-react';
import { Contact } from '../types';

const Contacts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts] = useState<Contact[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Contact Repository</h2>
          <p className="text-slate-500 text-sm mt-1">Manage your B2B contacts and lead lists.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-semibold text-sm shadow-sm">
            Export Leads
          </button>
          <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-sm shadow-sm">
            <UserPlus className="w-4 h-4 mr-2" /> Add Contact
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by name, email or company..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors">
            <Filter className="w-3.5 h-3.5 mr-2" /> Advanced Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          {contacts.length > 0 ? (
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Identity</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Email Grade</th>
                  <th className="px-6 py-4">Tags</th>
                  <th className="px-6 py-4 text-right">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                          {c.firstName?.[0]}{c.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{c.firstName} {c.lastName}</p>
                          <p className="text-[11px] text-slate-400 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1.5" /> {c.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`flex items-center text-[11px] font-bold ${c.unsubscribed ? 'text-red-600' : 'text-emerald-600'}`}>
                        {c.unsubscribed ? <XCircle className="w-3.5 h-3.5 mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                        {c.unsubscribed ? 'Opted Out' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {c.validation ? (
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.validation.status === 'valid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {c.validation.qualityGrade}
                          </span>
                          <span className="text-[11px] text-slate-400 font-bold">{c.validation.deliverabilityScore}%</span>
                        </div>
                      ) : <span className="text-[11px] text-slate-300 italic font-bold">Pending</span>}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5">
                        {c.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 uppercase">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right text-xs text-slate-500 font-semibold">
                      {c.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-24 text-center">
              <Inbox className="w-12 h-12 mx-auto text-slate-100 mb-4" />
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Contacts Listed</h3>
              <p className="text-slate-300 text-xs font-semibold mt-1">Upload a CSV or add contacts manually to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contacts;
