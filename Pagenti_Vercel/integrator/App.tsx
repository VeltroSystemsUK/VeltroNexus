
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./services/firebase";
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import EmailValidation from './components/EmailValidation';
import CompanyVerification from './components/CompanyVerification';
import CampaignBuilder from './components/CampaignBuilder';
import Contacts from './components/Contacts';
import Analytics from './components/Analytics';
import Login from './components/Login';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for demo bypass first
    const demoMode = localStorage.getItem('veltro_demo_mode') === 'true';
    if (demoMode) {
      setIsDemo(true);
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsDemo(false);
        localStorage.removeItem('veltro_demo_mode');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const isAuthenticated = user || isDemo;

  return (
    <Router>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/validate" element={<EmailValidation />} />
            <Route path="/companies" element={<CompanyVerification />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/campaigns" element={<CampaignBuilder />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
};

export default App;
