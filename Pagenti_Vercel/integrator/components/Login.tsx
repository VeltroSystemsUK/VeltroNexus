
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import { Zap, Loader2, ShieldCheck, Mail, Lock, PlayCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Check for hardcoded bypass credentials
    if (email === 'admin@veltro.co.uk' && password === 'password123') {
      localStorage.setItem('veltro_demo_mode', 'true');
      window.location.reload(); // Refresh to trigger App.tsx state change
      return;
    }

    try {
      await (isLogin 
        ? signInWithEmailAndPassword(auth, email, password)
        : createUserWithEmailAndPassword(auth, email, password));
    } catch (err: any) {
      if (err.message.includes('API_KEY')) {
        setError('Firebase not configured. Please use "Demo Access" below to preview the app.');
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoBypass = () => {
    localStorage.setItem('veltro_demo_mode', 'true');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl border border-slate-200 shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
              <Zap className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight text-center uppercase">VELTRO</h2>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-widest">
            {isLogin ? 'Access Fleet Intelligence' : 'Register New Station'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="Email address (admin@veltro.co.uk)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="Password (password123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center text-xs font-bold text-red-600 leading-tight">
              <ShieldCheck className="w-4 h-4 mr-2 flex-shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Or Preview</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <button 
          onClick={handleDemoBypass}
          className="w-full py-3 px-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center group"
        >
          <PlayCircle className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
          Launch Demo Mode
        </button>

        <div className="text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-wider transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already registered? Log In"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
