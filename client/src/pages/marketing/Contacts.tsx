
import React, { useState } from 'react';
import { Search, Filter, Mail, CheckCircle2, XCircle, UserPlus, Inbox, Loader2 } from 'lucide-react';
import { Contact } from './types';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

const Contacts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/marketing/contacts'],
  });

  const filteredContacts = contacts.filter(c =>
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter">Entity Archive</h2>
          <p className="text-slate-400 mt-1 uppercase font-bold text-[10px] tracking-widest">Managed verified database of {filteredContacts.length} contacts.</p>
        </div>
        <div className="flex space-x-4">
          <button className="flex items-center px-6 py-3 bg-white/5 border border-white/10 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest">
            Export Signal Data
          </button>
          <button className="flex items-center px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20">
            <UserPlus className="w-4 h-4 mr-3" /> Add Entity
          </button>
        </div>
      </div>

      <div className="antigravity-card rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-white/5 bg-white/2 flex flex-col md:flex-row gap-6 justify-between items-center">
          <div className="relative flex-1 max-w-lg w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              type="text"
              id="contacts-search"
              name="contacts-search"
              placeholder="Query by name, email or corporation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 bg-black/20 border border-white/5 rounded-2xl text-xs font-black text-white focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
              <Filter className="w-3.5 h-3.5 mr-2" /> Sector Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <div className="py-32 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-indigo-500 animate-spin mb-6" />
              <p className="text-slate-500 font-black text-xs uppercase tracking-widest">Querying Archive...</p>
            </div>
          ) : filteredContacts.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/20 text-slate-500 text-[9px] font-black uppercase tracking-[0.25em]">
                <tr>
                  <th className="px-10 py-6">Entity Identity</th>
                  <th className="px-10 py-6">Signal Status</th>
                  <th className="px-10 py-6">Verification Grade</th>
                  <th className="px-10 py-6">Tags</th>
                  <th className="px-10 py-6 text-right">Added Cycle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-white rounded-2xl flex items-center justify-center font-black text-sm border border-white/10">
                          {c.firstName?.[0] || '?'}{c.lastName?.[0] || ''}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{c.firstName || 'Unknown'} {c.lastName || ''}</p>
                          <p className="text-[10px] text-slate-500 font-bold flex items-center mt-1">
                            <Mail className="w-3 h-3 mr-1.5 opacity-30" /> {c.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`flex items-center text-[10px] font-black uppercase tracking-widest ${c.unsubscribed ? 'text-red-400' : 'text-emerald-400'}`}>
                        {c.unsubscribed ? <XCircle className="w-3.5 h-3.5 mr-2" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                        {c.unsubscribed ? 'Opt-Out' : 'Live'}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${c.status === 'valid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          GRADE {c.qualityGrade}
                        </span>
                        <span className="text-[10px] text-slate-500 font-black tracking-widest">{c.deliverabilityScore}% Score</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-wrap gap-2">
                        {c.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-black bg-white/5 text-slate-400 px-3 py-1 rounded-lg border border-white/5 uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right text-[11px] text-slate-500 font-black">
                      {format(new Date(c.createdAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-32 text-center">
              <Inbox className="w-16 h-16 mx-auto text-white/5 mb-6" />
              <h3 className="text-xl font-black text-white tracking-widest uppercase opacity-20">Database Empty</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2 text-xs font-bold leading-relaxed">System awaiting initial entity ingestion or manual entry.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contacts;
