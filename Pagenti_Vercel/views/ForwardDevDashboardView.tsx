import React, { useEffect, useState } from 'react';
import { useI18n } from '../I18nContext';
import { useToast } from '../contexts/ToastContext';
import { enquiryService, Enquiry } from '../services/enquiryService';
import { agentService } from '../services/agentService';
import { userService } from '../services/userService';
import { DigitalAssociate, AssociateStatus, UserRegistration } from '../types';
import { Clock, CheckCircle2, XCircle, FileText, Activity, Server, ArrowUpRight, Search, Trash2, RefreshCw, Bot, Edit2, Eye, Rocket, Copy, Terminal, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ForwardDevDashboardView: React.FC = () => {
    const { formatPrice } = useI18n();

    const [activeTab, setActiveTab] = useState<'enquiries' | 'agents' | 'users'>('enquiries');

    // Data State
    const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
    const [agents, setAgents] = useState<DigitalAssociate[]>([]);
    const [registrations, setRegistrations] = useState<UserRegistration[]>([]);

    const [filter, setFilter] = useState('All');
    const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

    const [processingAresIds, setProcessingAresIds] = useState<string[]>([]);
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);

    useEffect(() => {
        // Seed demo data if empty
        enquiryService.seedDemoData();
        userService.seedDemoData();
        loadData();
    }, [activeTab]);

    const loadData = () => {
        setEnquiries(enquiryService.getEnquiries());
        setAgents(agentService.getAgents());
        setRegistrations(userService.getRegistrations());
    };

    const { showToast } = useToast();

    const handleStatusChange = (id: string, newStatus: Enquiry['status']) => {
        enquiryService.updateStatus(id, newStatus);
        showToast(`Status updated to ${newStatus}`, 'success');
        loadData();
    };

    const handleDelete = (id: string, type: 'enquiry' | 'agent') => {
        if (confirm('Are you sure you want to delete this item?')) {
            if (type === 'enquiry') enquiryService.deleteEnquiry(id);
            else agentService.deleteAgent(id);
            showToast('Item deleted successfully', 'info');
            loadData();
        }
    };

    const handleDuplicate = (agent: DigitalAssociate) => {
        const id = `draft-${Date.now()}`;
        const newAgent: DigitalAssociate = {
            ...agent,
            id,
            name: `${agent.name} (Copy)`,
            status: AssociateStatus.AVAILABLE,
        };
        agentService.saveAgent(newAgent);
        showToast(`Duplicated ${agent.name}`, 'success');
        loadData();
    };

    const filteredEnquiries = enquiries.filter(e => filter === 'All' || e.status === filter);
    const filteredAgents = agents.filter(a => filter === 'All' || a.name.toLowerCase().includes(filter.toLowerCase())); // Simplified filter for agents for now

    // Stats
    const statTotal = enquiries.length;
    const statPending = enquiries.filter(e => e.status === 'Pending').length;
    const statRevenue = enquiries.reduce((acc, curr) => acc + curr.quote, 0);
    const statAgents = agents.length;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Ares Review': return 'bg-black text-[#00FF41] border-[#00FF41]/20 font-mono italic';
            case 'Reviewing': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'Technical Audit': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Rejected': return 'bg-red-50 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="bg-gray-900 text-white pb-32">
                <div className="max-w-[1600px] mx-auto px-4 py-12">
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 font-mono">Back Office • V2.5</p>
                            <h1 className="text-4xl font-bold font-heading">Forward Development Control</h1>
                        </div>
                        <button onClick={loadData} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                            <RefreshCw size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                            <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Total Enquiries</div>
                            <div className="text-4xl font-bold font-mono">{statTotal}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                            <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Pending Review</div>
                            <div className="text-4xl font-bold font-mono text-amber-400">{statPending}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                            <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Pipeline Value</div>
                            <div className="text-4xl font-bold font-mono text-emerald-400">£{statRevenue.toLocaleString()}</div>
                        </div>
                        <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 p-6 rounded-2xl">
                            <div className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-2">Active Prototypes</div>
                            <div className="text-4xl font-bold font-mono text-indigo-400">{statAgents}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-4 -mt-24 pb-24">
                <div className="bg-white border border-gray-200 rounded-[2rem] shadow-xl overflow-hidden min-h-[500px]">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                        <button
                            onClick={() => { setActiveTab('enquiries'); setFilter('All'); }}
                            className={`flex-1 py-6 text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'enquiries' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
                        >
                            <FileText size={16} /> Enquiries
                        </button>
                        <button
                            onClick={() => { setActiveTab('agents'); setFilter('All'); }}
                            className={`flex-1 py-6 text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'agents' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
                        >
                            <Bot size={16} /> Agent Prototypes
                        </button>
                        <button
                            onClick={() => { setActiveTab('users'); setFilter('All'); }}
                            className={`flex-1 py-6 text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
                        >
                            <Users size={16} /> User Requests
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-0">
                        {/* Toolbar */}
                        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
                            {activeTab === 'enquiries' ? (
                                <div className="flex gap-2 bg-gray-50 p-1 rounded-xl">
                                    {['All', 'Pending', 'Ares Review', 'Reviewing', 'Approved'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            ) : activeTab === 'agents' ? (
                                <div className="flex gap-2 items-center">
                                    <Link to="/company" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-emerald-700 transition-colors flex items-center gap-2">
                                        <Activity size={14} /> Train Agents
                                    </Link>
                                    <Link to="/architect" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase hover:bg-black transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/10">
                                        <Terminal size={14} className="text-[#00FF41]" /> ARES Command
                                    </Link>
                                    <Link to="/forge" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-indigo-700 transition-colors">
                                        + Create New
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={() => setIsCreateUserModalOpen(true)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                    >
                                        <Users size={14} /> + Create New User
                                    </button>
                                </div>
                            )}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            {activeTab === 'enquiries' ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID / Timestamp</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client Details</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role Specification</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tech Stack</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quote Estimate</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredEnquiries.length > 0 ? filteredEnquiries.map(enquiry => (
                                            <tr key={enquiry.id} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-xs font-bold text-gray-900">#{enquiry.id}</div>
                                                    <div className="text-xs text-gray-400 font-medium">{new Date(enquiry.timestamp).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-gray-900">{enquiry.fullName}</div>
                                                    <div className="text-xs text-gray-500">{enquiry.email}</div>
                                                </td>
                                                <td className="px-6 py-4 max-w-xs">
                                                    <div className="text-sm font-bold text-indigo-700">{enquiry.jobTitle}</div>
                                                    <div className="text-xs text-gray-500 truncate" title={enquiry.primaryDuty}>{enquiry.primaryDuty}</div>
                                                    <div className="flex gap-1 mt-1">
                                                        {enquiry.departments.map(d => (
                                                            <span key={d} className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-medium text-gray-600">{d}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 max-w-[200px]">
                                                    <div className="text-xs text-gray-600 truncate" title={enquiry.stack}>{enquiry.stack || 'None specified'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-sm font-bold text-gray-900">£{enquiry.quote.toLocaleString()}</div>
                                                    <div className="text-[10px] text-gray-400">One-time</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {processingAresIds.includes(enquiry.id) ? (
                                                        <div className="flex items-center gap-2 text-[#00FF41] font-mono text-[10px] animate-pulse">
                                                            <div className="w-1 h-1 bg-[#00FF41] rounded-full animate-ping" />
                                                            ARES ARCHITECTING...
                                                        </div>
                                                    ) : (
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(enquiry.status)}`}>
                                                            {enquiry.status}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setSelectedEnquiry(enquiry)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="View Details">
                                                            <Eye size={16} />
                                                        </button>
                                                        {enquiry.status === 'Pending' && !processingAresIds.includes(enquiry.id) && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setProcessingAresIds(prev => [...prev, enquiry.id]);
                                                                    enquiryService.initiateAresBuild(enquiry.id);
                                                                    showToast('ARES Build Initiated', 'success');
                                                                    setTimeout(() => {
                                                                        setProcessingAresIds(prev => prev.filter(id => id !== enquiry.id));
                                                                        loadData();
                                                                    }, 3000);
                                                                }}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-black text-[#00FF41] rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-black/90 transition-colors border border-[#00FF41]/30"
                                                            >
                                                                <Bot size={12} /> Ares: Build
                                                            </button>
                                                        )}
                                                        {enquiry.status === 'Ares Review' && (
                                                            <Link
                                                                to={`/forge?architectMode=true&blueprint=${btoa(JSON.stringify({
                                                                    IdentityMatrix: { Name: enquiry.fullName.split(' ')[0], Department: enquiry.departments[0], Function: enquiry.jobTitle },
                                                                    CoreLogic: { SystemPrompt: enquiry.primaryDuty, Capabilities: enquiry.stack, Rate: (enquiry.quote / 2000).toFixed(2) }
                                                                }))}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-700 transition-colors shadow-lg"
                                                            >
                                                                <Rocket size={12} /> Review Build
                                                            </Link>
                                                        )}
                                                        {enquiry.status === 'Approved' && (
                                                            <button onClick={(e) => { e.stopPropagation(); window.location.href = `#/forge?enquiryId=${enquiry.id}`; }} className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-black transition-colors shadow-lg">
                                                                <Server size={12} /> Build
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleDelete(enquiry.id, 'enquiry')} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-24 text-center text-gray-400">
                                                    No enquiries found matching this filter.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : activeTab === 'agents' ? (
                                // Agents Table
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-10">Agent Identity</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role & Specs</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rate</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {agents.length > 0 ? agents.map(agent => (
                                            <tr key={agent.id} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 pl-10">
                                                    <div className="flex items-center gap-3">
                                                        <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900">{agent.name}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono">{agent.id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-indigo-700">{typeof agent.role === 'string' ? agent.role : agent.role.en}</div>
                                                    <div className="flex gap-1 mt-1">
                                                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-medium text-gray-600">{agent.department}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-sm font-bold text-gray-900">£{agent.hourlyRate}/hr</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {agent.id.startsWith('ares-draft-') || agent.id.includes('ares-draft') ? (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-black text-[#00FF41] border border-[#00FF41]/20 font-mono italic">
                                                            Ares Blueprint
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                            System Roster
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Link to={`/candidate/${agent.id}`} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="View Profile">
                                                            <Eye size={16} />
                                                        </Link>
                                                        <button onClick={() => handleDuplicate(agent)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Duplicate">
                                                            <Copy size={16} />
                                                        </button>
                                                        <Link to={`/forge?agentId=${agent.id}`} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit Configuration">
                                                            <Edit2 size={16} />
                                                        </Link>
                                                        <Link to={`/deploy/${agent.id}`} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Deploy Agent">
                                                            <Rocket size={16} />
                                                        </Link>
                                                        <button onClick={() => handleDelete(agent.id, 'agent')} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-24 text-center text-gray-400">
                                                    No agents built yet. Use the Enquiry tab to build one.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                // Users Table
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-10">Requester</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Info</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Purpose</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Applied</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {registrations.length > 0 ? registrations.map(reg => (
                                            <tr key={reg.id} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 pl-10">
                                                    <div className="text-sm font-bold text-gray-900">{reg.name}</div>
                                                    <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">{reg.company}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-medium text-gray-600">{reg.email}</div>
                                                    {reg.phone && <div className="text-[10px] text-gray-400">{reg.phone}</div>}
                                                </td>
                                                <td className="px-6 py-4 max-w-xs">
                                                    <div className="text-xs text-gray-500 line-clamp-2" title={reg.reason}>{reg.reason || 'No reason provided.'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-gray-400 font-medium">{new Date(reg.timestamp).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${reg.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        reg.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                            'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        {reg.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {reg.status === 'pending' && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        userService.updateRegistrationStatus(reg.id, 'approved');
                                                                        showToast(`Request for ${reg.name} approved`, 'success');
                                                                        loadData();
                                                                    }}
                                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        userService.updateRegistrationStatus(reg.id, 'rejected');
                                                                        showToast(`Request for ${reg.name} rejected`, 'error');
                                                                        loadData();
                                                                    }}
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                                                    title="Reject"
                                                                >
                                                                    <XCircle size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                        <button onClick={() => {
                                                            userService.deleteRegistration(reg.id);
                                                            showToast('Registration deleted', 'info');
                                                            loadData();
                                                        }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-24 text-center text-gray-400">
                                                    No registration requests found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div >

            {/* Enquiry Details Modal */}
            {
                selectedEnquiry && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEnquiry(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-gray-900 text-white p-6 rounded-t-2xl flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 font-mono">Enquiry #{selectedEnquiry.id}</p>
                                    <h2 className="text-2xl font-bold">{selectedEnquiry.jobTitle}</h2>
                                </div>
                                <button onClick={() => setSelectedEnquiry(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-8 space-y-6">
                                {/* Status & Timestamp */}
                                <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Status</p>
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(selectedEnquiry.status)}`}>
                                            {selectedEnquiry.status}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Submitted</p>
                                        <p className="text-sm font-bold text-gray-900">{new Date(selectedEnquiry.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                </div>

                                {/* Client Details */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Client Contact</h3>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                                        <p className="text-lg font-bold text-gray-900">{selectedEnquiry.fullName}</p>
                                        <p className="text-sm text-gray-600">{selectedEnquiry.email}</p>
                                    </div>
                                </div>

                                {/* Role Specification */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Role Specification</h3>
                                    <div className="bg-indigo-50 p-4 rounded-xl space-y-3">
                                        <div>
                                            <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Primary Duty</p>
                                            <p className="text-sm text-gray-900">{selectedEnquiry.primaryDuty}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {selectedEnquiry.departments.map(dept => (
                                                <span key={dept} className="px-2 py-1 bg-white rounded text-xs font-medium text-indigo-700 border border-indigo-100">
                                                    {dept}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Tech Stack */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Technology Stack</h3>
                                    <div className="bg-gray-50 p-4 rounded-xl">
                                        <p className="text-sm text-gray-900 font-mono">{selectedEnquiry.stack || 'None specified'}</p>
                                    </div>
                                </div>

                                {/* Success Metric */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Success Metric</h3>
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <p className="text-sm text-gray-900">{selectedEnquiry.metric}</p>
                                    </div>
                                </div>

                                {/* Access Requirements */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">System Access</h3>
                                    <div className="flex gap-3">
                                        {Object.entries(selectedEnquiry.access).map(([key, value]) => (
                                            <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${value ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                {value ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                <span className="text-xs font-bold uppercase">{key}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quote */}
                                <div className="pt-6 border-t border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Estimated Quote</p>
                                    <p className="text-3xl font-bold text-gray-900 font-mono">£{selectedEnquiry.quote.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 mt-1">One-time setup + integration</p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl border-t border-gray-100 flex justify-between items-center">
                                <button onClick={() => setSelectedEnquiry(null)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">
                                    Close
                                </button>
                                <Link
                                    to={`/forge?enquiryId=${selectedEnquiry.id}`}
                                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-indigo-200"
                                >
                                    <Server size={18} />
                                    Build in Forge
                                </Link>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create User Modal */}
            {isCreateUserModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsCreateUserModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Register New User</h2>
                            <button onClick={() => setIsCreateUserModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <form className="p-6 space-y-4" onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const data = {
                                name: formData.get('name') as string,
                                company: formData.get('company') as string,
                                email: formData.get('email') as string,
                                phone: formData.get('phone') as string,
                                reason: formData.get('reason') as string,
                            };
                            userService.addRegistration(data);
                            showToast('User registration created successfully', 'success');
                            setIsCreateUserModalOpen(false);
                            loadData();
                        }}>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</label>
                                <input name="name" required className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="e.g. John Doe" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Company</label>
                                <input name="company" required className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="e.g. Acme Inc" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Email</label>
                                <input name="email" type="email" required className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="john@example.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Purpose / Reason</label>
                                <textarea name="reason" rows={3} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="What will they use Pagenti for?" />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsCreateUserModalOpen(false)} className="flex-1 px-4 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
};
