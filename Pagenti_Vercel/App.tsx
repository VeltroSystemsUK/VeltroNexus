import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { I18nProvider, useI18n } from './I18nContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth, UserRole } from './contexts/AuthContext';
import { Navigation } from './components/Navigation';
import { HomeView } from './views/HomeView';
import { CandidateProfileView } from './views/CandidateProfileView';
import { TalentAuditView } from './views/TalentAuditView';
import { BrowseView } from './views/BrowseView';
import { CustomBuildView } from './views/CustomBuildView';
import { ForwardDevDashboardView } from './views/ForwardDevDashboardView';
import { EmployerDashboardView } from './views/EmployerDashboardView';
import { LoginView } from './views/LoginView';
import { RegisterView } from './views/RegisterView';
import { AgentForgeView } from './views/AgentForgeView';
import { AdminAgentBuilderView } from './views/AdminAgentBuilderView';
import { ROICalculatorView } from './views/ROICalculatorView';
import { CompanyProfileView } from './views/CompanyProfileView';
import { DeploymentView } from './views/DeploymentView';
import { AresTerminalView } from './views/AresTerminalView';
import { AresArchitectView } from './views/AresArchitectView';
import { UplinkView } from './views/UplinkView';
import { Footer } from './components/Footer';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    // Redirect to appropriate dashboard if role mismatch
    return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/dashboard/client'} replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();

  // Hide navigation and footer on admin pages for cleaner UI
  const isAdmin = location.pathname.startsWith('/admin') || location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/forge');

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col">
      <Navigation />
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomeView />} />
          <Route path="/login" element={<LoginView />} />
          <Route path="/register" element={<RegisterView />} />
          <Route path="/browse" element={<BrowseView />} />
          <Route path="/audit" element={<TalentAuditView />} />
          <Route path="/roi" element={<ROICalculatorView />} />
          <Route path="/candidate/:id" element={<CandidateProfileView />} />
          <Route path="/custom-build" element={<CustomBuildView />} />

          {/* Admin Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={['ADMIN']}>
              <ForwardDevDashboardView />
            </ProtectedRoute>
          } />
          <Route path="/forge" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AgentForgeView />
            </ProtectedRoute>
          } />
          <Route path="/admin/create-agent" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminAgentBuilderView />
            </ProtectedRoute>
          } />
          <Route path="/company" element={
            <ProtectedRoute roles={['ADMIN']}>
              <CompanyProfileView />
            </ProtectedRoute>
          } />
          <Route path="/deploy/:agentId" element={
            <ProtectedRoute roles={['ADMIN']}>
              <DeploymentView />
            </ProtectedRoute>
          } />
          <Route path="/architect" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AresTerminalView />
            </ProtectedRoute>
          } />
          <Route path="/ares-architect" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AresArchitectView />
            </ProtectedRoute>
          } />

          {/* Employer Routes */}
          <Route path="/dashboard/client" element={
            <ProtectedRoute roles={['EMPLOYER']}>
              <EmployerDashboardView />
            </ProtectedRoute>
          } />

          <Route path="/uplink/:id" element={<UplinkView />} />

        </Routes>
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </Router>
  );
};

export default App;
