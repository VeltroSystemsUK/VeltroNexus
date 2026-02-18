import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ShieldCheck, Users, Briefcase, Lock, ArrowRight, Building2 } from 'lucide-react';

export const LoginView: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'employer' | 'admin'>('employer');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Mock authentication delay (simulating network)
        setTimeout(() => {
            const success = login(activeTab, email, password);
            setLoading(false);

            if (success) {
                showToast(`Welcome back! Logged in as ${activeTab === 'admin' ? 'Super Admin' : 'Employer'}`, 'success');
                if (activeTab === 'admin') {
                    navigate('/dashboard');
                } else {
                    navigate('/dashboard/client');
                }
            } else {
                showToast('Invalid credentials. Please check your email and password.', 'error');
            }
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center rotate-3 shadow-lg shadow-indigo-500/30">
                    <ShieldCheck className="text-white" size={24} />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight font-heading">
                    Sign in to your account
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Or{' '}
                    <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                        request access to open an account
                    </Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
                <div className="bg-white py-8 px-4 shadow-2xl shadow-indigo-100 sm:rounded-[2rem] sm:px-10 border border-gray-100">

                    {/* Tab Switcher */}
                    <div className="flex bg-gray-50 p-1 rounded-xl mb-8 border border-gray-100">
                        <button
                            onClick={() => setActiveTab('employer')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'employer' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Users size={16} /> Employer Portal
                        </button>
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'admin' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Lock size={16} /> Super Admin
                        </button>
                    </div>

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email address
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    {activeTab === 'employer' ? <Briefcase className="h-5 w-5 text-gray-400" /> : <Lock className="h-5 w-5 text-gray-400" />}
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg p-3"
                                    placeholder={activeTab === 'employer' ? 'client@company.com' : 'pagenti@admin.com'}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg p-3"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                                    Remember me
                                </label>
                            </div>

                            <div className="text-sm">
                                <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
                                    Forgot your password?
                                </a>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 ${activeTab === 'employer' ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-gray-900 hover:bg-black focus:ring-gray-800'}`}
                            >
                                {loading ? 'Authenticating...' : (
                                    <span className="flex items-center gap-2">
                                        Sign in <ArrowRight size={16} />
                                    </span>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-100" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">
                                    Secured by Pagenti Auth Protocol
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
