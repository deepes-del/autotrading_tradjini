import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, LogIn, UserPlus, CheckCircle, Briefcase, User, Database, Package } from 'lucide-react';
import { Candidate, Profile, Recruiter } from './types';
import CandidateRegistration from './components/CandidateRegistration';
import CandidateLogin from './components/CandidateLogin';
import CandidateDashboard from './components/CandidateDashboard';
import CandidateProfileEdit from './components/CandidateProfileEdit';
import CandidateDocuments from './components/CandidateDocuments';
import AdminPanelModal from './components/AdminPanelModal';

// Recruiter Components
import RecruiterLogin from './components/RecruiterLogin';
import RecruiterRegistration from './components/RecruiterRegistration';
import RecruiterDashboard from './components/RecruiterDashboard';

export default function App() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [userRole, setUserRole] = useState<'candidate' | 'recruiter' | null>(null);
  const [portal, setPortal] = useState<'candidate' | 'recruiter'>('candidate');

  // Admin / Logo click triggers
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const handleLogoClick = () => {
    setLogoClickCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setIsAdminPanelOpen(true);
        return 0;
      }
      return next;
    });
  };

  // Supabase Guide State
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ configured: boolean; active: boolean; mode: string; errorDetails?: string | null } | null>(null);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/database-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (err) {
      console.error('Database status error:', err);
    }
  };

  // Candidate States
  const [token, setToken] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [view, setView] = useState<'login' | 'register' | 'dashboard' | 'profile_edit' | 'documents'>('login');

  // Recruiter States
  const [recruiterToken, setRecruiterToken] = useState<string | null>(null);
  const [recruiter, setRecruiter] = useState<Recruiter | null>(null);
  const [recruiterView, setRecruiterView] = useState<'login' | 'register' | 'dashboard'>('login');

  // Restore session tokens on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('delivery_hiring_token');
    const savedRecruiterToken = localStorage.getItem('recruiter_hiring_token');

    const checkCandidate = async (): Promise<boolean> => {
      if (savedToken) {
        try {
          const res = await fetch('/api/profile', {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setCandidate({
              id: data.id,
              fullName: data.fullName,
              mobile: data.mobile,
              email: data.email,
              profile: data.profile,
              documents: data.documents || []
            });
            setToken(savedToken);
            setView('dashboard');
            setPortal('candidate');
            setUserRole('candidate');
            return true;
          } else {
            localStorage.removeItem('delivery_hiring_token');
          }
        } catch (err) {
          console.error('Candidate restore error:', err);
        }
      }
      return false;
    };

    const checkRecruiter = async (): Promise<boolean> => {
      if (savedRecruiterToken) {
        try {
          const res = await fetch('/api/recruiter/profile', {
            headers: {
              'Authorization': `Bearer ${savedRecruiterToken}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setRecruiter(data.recruiter);
            setRecruiterToken(savedRecruiterToken);
            setRecruiterView('dashboard');
            setPortal('recruiter');
            setUserRole('recruiter');
            return true;
          } else {
            localStorage.removeItem('recruiter_hiring_token');
          }
        } catch (err) {
          console.error('Recruiter restore error:', err);
        }
      }
      return false;
    };

    const restoreAll = async () => {
      await fetchDbStatus();
      const candidateRestored = await checkCandidate();
      if (!candidateRestored) {
        await checkRecruiter();
      }
      setInitialLoading(false);
    };

    restoreAll();
  }, []);

  // --- CANDIDATE EVENT HANDLERS ---
  const handleCandidateAuthSuccess = (newCandidate: Candidate, newToken: string) => {
    setCandidate(newCandidate);
    setToken(newToken);
    localStorage.setItem('delivery_hiring_token', newToken);
    setUserRole('candidate');
    
    // Check if profile has any filled fields beyond default registration name.
    const isNew = !newCandidate.profile.dateOfBirth && !newCandidate.profile.address;
    if (isNew) {
      setView('profile_edit');
    } else {
      setView('dashboard');
    }
    setPortal('candidate');
  };

  const handleCandidateProfileSaveSuccess = (updatedProfile: Profile) => {
    if (candidate) {
      const updatedCandidate = {
        ...candidate,
        fullName: updatedProfile.fullName,
        profile: updatedProfile
      };
      setCandidate(updatedCandidate);
    }
    setView('dashboard');
  };

  const handleCandidateLogout = () => {
    localStorage.removeItem('delivery_hiring_token');
    setCandidate(null);
    setToken(null);
    setView('login');
    setUserRole(null);
  };

  // --- RECRUITER EVENT HANDLERS ---
  const handleRecruiterAuthSuccess = (newRecruiter: Recruiter, newToken: string) => {
    setRecruiter(newRecruiter);
    setRecruiterToken(newToken);
    localStorage.setItem('recruiter_hiring_token', newToken);
    setRecruiterView('dashboard');
    setPortal('recruiter');
    setUserRole('recruiter');
  };

  const handleRecruiterProfileUpdated = (updatedRecruiter: Recruiter) => {
    setRecruiter(updatedRecruiter);
  };

  const handleRecruiterLogout = () => {
    localStorage.removeItem('recruiter_hiring_token');
    setRecruiter(null);
    setRecruiterToken(null);
    setRecruiterView('login');
    setUserRole(null);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-gray-500">Restoring JobHai session...</p>
        </div>
      </div>
    );
  }

  const isCandidateLoggedIn = !!candidate && !!token;
  const isRecruiterLoggedIn = !!recruiter && !!recruiterToken;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-root-container">
      {/* Top Navbar Header */}
      <header className="bg-white border-b border-gray-150/80 sticky top-0 z-30 shadow-sm shadow-gray-100/10" id="global-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo brand */}
          <div 
            onClick={handleLogoClick}
            className="flex items-center gap-3 select-none cursor-pointer group active:scale-95 transition-all" 
            id="navbar-brand"
            title="Click 5 times to open developer admin panel"
          >
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-orange-600/25 group-hover:bg-orange-700 transition-colors">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-gray-900 tracking-tight text-lg group-hover:text-orange-600 transition-colors">JobHai</span>
              <span className="text-[10px] font-bold text-orange-600 uppercase block tracking-wider -mt-1">
                {userRole === null ? 'Gateway Portal' : portal === 'candidate' ? 'Candidate Portal' : 'Recruiter Portal'}
              </span>
            </div>
          </div>

          {/* Mini Info Badge & Portal Switcher */}
          <div className="flex items-center gap-3 sm:gap-4" id="navbar-controls">
            
            {/* If logged in, show status. Otherwise, show portal toggle button */}
            {userRole === null ? (
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
                Gateway Select
              </span>
            ) : portal === 'candidate' ? (
              isCandidateLoggedIn ? (
                <div className="hidden sm:flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-gray-600">Logged in as {candidate.profile.fullName}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setView('login');
                      setPortal('recruiter');
                      setRecruiterView('login');
                      setUserRole('recruiter');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-orange-500 hover:text-orange-600 rounded-lg text-xs font-bold transition-all cursor-pointer text-gray-600 bg-white"
                    id="switch-to-recruiter-portal"
                  >
                    <Briefcase className="w-3.5 h-3.5" /> For Employers
                  </button>
                </div>
              )
            ) : (
              isRecruiterLoggedIn ? (
                <div className="hidden sm:flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${recruiter.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-semibold text-gray-600">Logged in as {recruiter.recruiterName} ({recruiter.companyName})</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setRecruiterView('login');
                      setPortal('candidate');
                      setView('login');
                      setUserRole('candidate');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-orange-500 hover:text-orange-600 rounded-lg text-xs font-bold transition-all cursor-pointer text-gray-600 bg-white"
                    id="switch-to-candidate-portal"
                  >
                    <User className="w-3.5 h-3.5" /> Driver Careers
                  </button>
                </div>
              )
            )}
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10" id="main-content-layout">
        <AnimatePresence mode="wait">
          
          {userRole === null ? (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="max-w-4xl mx-auto py-8 sm:py-12"
            >
              <div className="text-center max-w-2xl mx-auto mb-12">
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-none mb-4">
                  Connecting Fleet Owners with Certified Drivers
                </h1>
                <p className="text-sm sm:text-base text-gray-500 font-medium leading-relaxed">
                  JobHai is the leading regional compliance-first network for logistics and delivery hiring. Tell us who you are to get started.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Recruiter Card */}
                <motion.div
                  whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)' }}
                  className="bg-white border border-gray-150 rounded-3xl p-8 flex flex-col justify-between shadow-sm transition-all relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50/50 rounded-bl-full -z-0 transition-colors group-hover:bg-orange-50" />
                  
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6">
                      <Briefcase className="w-7 h-7" />
                    </div>
                    
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-orange-50 text-orange-700 border border-orange-100 mb-4">
                      For Fleet Owners & Employers
                    </span>
                    
                    <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">
                      Are you a Recruiter?
                    </h2>
                    
                    <p className="text-sm text-gray-400 mt-3 leading-relaxed font-medium">
                      Post regional logistics job openings, perform verified document compliance audits, schedule screener interviews, and manage incoming applications.
                    </p>

                    <ul className="mt-6 space-y-2.5 text-xs text-gray-500 font-medium">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>Unlimited dispatch job postings</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>Verified driving license check audits</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>Interactive screening compliance tracker</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setPortal('recruiter');
                      setRecruiterView('login');
                      setUserRole('recruiter');
                    }}
                    className="mt-8 w-full py-3.5 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    Post a Job & Sign In
                  </button>
                </motion.div>

                {/* Candidate Card */}
                <motion.div
                  whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)' }}
                  className="bg-white border border-gray-150 rounded-3xl p-8 flex flex-col justify-between shadow-sm transition-all relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50/50 rounded-bl-full -z-0 transition-colors group-hover:bg-orange-50" />
                  
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6">
                      <Truck className="w-7 h-7" />
                    </div>
                    
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-orange-50 text-orange-700 border border-orange-100 mb-4">
                      For Drivers & Delivery Agents
                    </span>
                    
                    <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">
                      Find a Job
                    </h2>
                    
                    <p className="text-sm text-gray-400 mt-3 leading-relaxed font-medium">
                      Search for local transport & delivery driver careers, upload and secure your driving credentials, and receive job interview offers.
                    </p>

                    <ul className="mt-6 space-y-2.5 text-xs text-gray-500 font-medium">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>Search verified fleet driver opportunities</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>Quick profile creation & instant apply</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>Real-time background vetting status checks</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setPortal('candidate');
                      setView('login');
                      setUserRole('candidate');
                    }}
                    className="mt-8 w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-orange-600/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    Find a Job & Sign In
                  </button>
                </motion.div>

              </div>
            </motion.div>
          ) : (
            <React.Fragment>
              {/* --- CANDIDATE PORTAL VIEWS --- */}
              {portal === 'candidate' && (
                <React.Fragment>
                  {view === 'login' && (
                    <motion.div
                      key="cand-login"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CandidateLogin 
                        onSuccess={handleCandidateAuthSuccess}
                        onNavigateToRegister={() => setView('register')}
                      />
                      <div className="max-w-md mx-auto text-center mt-4 flex flex-col gap-2.5">
                        <button
                          onClick={() => {
                            setPortal('recruiter');
                            setRecruiterView('login');
                            setUserRole('recruiter');
                          }}
                          className="text-xs font-bold text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
                        >
                          Are you a Recruiter? Access Recruiter Portal
                        </button>
                        <button
                          onClick={() => {
                            setUserRole(null);
                          }}
                          className="text-xs font-extrabold text-orange-600 hover:underline transition-all cursor-pointer"
                        >
                          ← Choose Another Account Type
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {view === 'register' && (
                    <motion.div
                      key="cand-register"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CandidateRegistration 
                        onSuccess={handleCandidateAuthSuccess}
                        onNavigateToLogin={() => setView('login')}
                      />
                    </motion.div>
                  )}

                  {view === 'dashboard' && candidate && (
                    <motion.div
                      key="cand-dashboard"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CandidateDashboard 
                        candidate={candidate}
                        token={token}
                        onEditProfile={() => setView('profile_edit')}
                        onLogout={handleCandidateLogout}
                        onManageDocuments={() => setView('documents')}
                        onUpdateProfile={handleCandidateProfileSaveSuccess}
                      />
                    </motion.div>
                  )}

                  {view === 'profile_edit' && candidate && token && (
                    <motion.div
                      key="cand-profile-edit"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CandidateProfileEdit 
                        initialProfile={candidate.profile}
                        token={token}
                        onSaveSuccess={handleCandidateProfileSaveSuccess}
                        onCancel={() => setView('dashboard')}
                      />
                    </motion.div>
                  )}

                  {view === 'documents' && candidate && token && (
                    <motion.div
                      key="cand-documents"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CandidateDocuments 
                        documents={candidate.documents || []}
                        token={token}
                        onBackToDashboard={() => setView('dashboard')}
                        onDocumentsUpdated={(updatedDocs) => {
                          setCandidate({
                            ...candidate,
                            documents: updatedDocs
                          });
                        }}
                      />
                    </motion.div>
                  )}
                </React.Fragment>
              )}

              {/* --- RECRUITER PORTAL VIEWS --- */}
              {portal === 'recruiter' && (
                <React.Fragment>
                  {recruiterView === 'login' && (
                    <motion.div
                      key="recruiter-login"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <RecruiterLogin 
                        onSuccess={handleRecruiterAuthSuccess}
                        onNavigateToRegister={() => setRecruiterView('register')}
                        onSwitchToCandidate={() => {
                          setPortal('candidate');
                          setView('login');
                          setUserRole('candidate');
                        }}
                      />
                      <div className="max-w-md mx-auto text-center mt-4">
                        <button
                          onClick={() => {
                            setUserRole(null);
                          }}
                          className="text-xs font-extrabold text-orange-600 hover:underline transition-all cursor-pointer"
                        >
                          ← Choose Another Account Type
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {recruiterView === 'register' && (
                    <motion.div
                      key="recruiter-register"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <RecruiterRegistration 
                        onSuccess={handleRecruiterAuthSuccess}
                        onNavigateToLogin={() => setRecruiterView('login')}
                        onSwitchToCandidate={() => {
                          setPortal('candidate');
                          setView('login');
                          setUserRole('candidate');
                        }}
                      />
                    </motion.div>
                  )}

                  {recruiterView === 'dashboard' && recruiter && recruiterToken && (
                    <motion.div
                      key="recruiter-dashboard"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <RecruiterDashboard 
                        recruiter={recruiter}
                        token={recruiterToken}
                        onLogout={handleRecruiterLogout}
                        onProfileUpdated={handleRecruiterProfileUpdated}
                      />
                    </motion.div>
                  )}
                </React.Fragment>
              )}
            </React.Fragment>
          )}

        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-150 py-6" id="global-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© 2026 JobHai Logistics. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="flex items-center gap-1 text-gray-500 font-medium">
              <CheckCircle className="w-3.5 h-3.5 text-orange-500" /> Module 1, 2 & 3 Complete
            </span>
          </div>
        </div>
      </footer>

      {/* Admin Panel Modal */}
      <AdminPanelModal 
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        onJobPosted={() => {
          // If candidate is logged in, reload jobs in background
          // We can dispatch a custom event or let the browser update automatically
          window.dispatchEvent(new Event('refresh-jobs'));
        }}
      />
    </div>
  );
}
