import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { ShieldCheck, User, Building2, Mail, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { userService } from '../services/userService';

export const RegisterView: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        company: '',
        email: '',
        phone: '',
        reason: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Mock API call
        setTimeout(() => {
            userService.addRegistration(formData);
            setLoading(false);
            setSubmitted(true);
            showToast('Access request submitted successfully. Our team will review your application.', 'success');
        }, 1500);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-12 px-4 shadow-2xl shadow-indigo-100 sm:rounded-[2rem] sm:px-10 border border-gray-100 text-center">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="text-green-600" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Received</h2>
                        <p className="text-gray-500 mb-8">
                            Thank you for your interest in Pagenti. Our compliance team is reviewing your application. You will receive an email at <span className="font-bold text-gray-900">{formData.email}</span> within 24 hours.
                        </p>
                        <Link to="/" className="text-indigo-600 font-bold hover:text-indigo-500 flex items-center justify-center gap-2">
                            <ArrowRight size={16} className="rotate-180" /> Return Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto h-12 w-12 bg-gray-900 rounded-xl flex items-center justify-center rotate-3 shadow-lg shadow-gray-500/30">
                    <ShieldCheck className="text-white" size={24} />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight font-heading">
                    Request Access
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Pagenti is an exclusive platform. Apply for an Employer account below.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
                <div className="bg-white py-8 px-4 shadow-2xl shadow-indigo-100 sm:rounded-[2rem] sm:px-10 border border-gray-100">

                    <form className="space-y-6" onSubmit={handleSubmit}>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        name="name"
                                        id="name"
                                        required
                                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg p-3"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company Name</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Building2 className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    name="company"
                                    id="company"
                                    required
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg p-3"
                                    placeholder="Acme Corp"
                                    value={formData.company}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Work Email</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    required
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg p-3"
                                    placeholder="you@company.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:scale-[1.02]"
                            >
                                {loading ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <p className="text-center text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-500">
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
