import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Calendar, MapPin, Briefcase, GraduationCap, 
  IndianRupee, Languages, Bike, FileText, CheckCircle, 
  AlertCircle, Edit2, LogOut, Phone, Mail, Sparkles, AlertTriangle, Upload,
  Search, SlidersHorizontal, ArrowUpDown, Clock, Building, UserCheck, ShieldAlert,
  FileMinus, ExternalLink, ChevronRight, X, Info, RefreshCw,
  RotateCcw, Heart, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Candidate, Profile } from '../types';

interface CandidateDashboardProps {
  candidate: Candidate;
  token: string | null;
  onEditProfile: () => void;
  onLogout: () => void;
  onManageDocuments: () => void;
  onUpdateProfile?: (updatedProfile: Profile) => void;
}

export default function CandidateDashboard({ 
  candidate, 
  token,
  onEditProfile, 
  onLogout,
  onManageDocuments,
  onUpdateProfile
}: CandidateDashboardProps) {
  const { profile, mobile, email } = candidate;

  // Navigation state
  const [activeTab, setActiveTab] = React.useState<'overview' | 'find_jobs' | 'applications'>('find_jobs');

  // Core API Lists state
  const [activeJobs, setActiveJobs] = React.useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);
  const [myApplications, setMyApplications] = React.useState<any[]>([]);
  const [loadingApps, setLoadingApps] = React.useState(false);
  const [documents, setDocuments] = React.useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = React.useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedState, setSelectedState] = React.useState('All');
  const [selectedCity, setSelectedCity] = React.useState('All');
  const [selectedSalary, setSelectedSalary] = React.useState(0);
  const [selectedEmpType, setSelectedEmpType] = React.useState('All');
  const [selectedExperience, setSelectedExperience] = React.useState('All');
  const [selectedShift, setSelectedShift] = React.useState('All');
  const [selectedBike, setSelectedBike] = React.useState('All');
  const [selectedLicense, setSelectedLicense] = React.useState('All');
  const [selectedJoining, setSelectedJoining] = React.useState('All');
  const [selectedGender, setSelectedGender] = React.useState('All');
  const [sortOrder, setSortOrder] = React.useState('newest'); // 'newest' | 'oldest'

  // Swipe vs Grid View State
  const [viewMode, setViewMode] = React.useState<'swipe' | 'grid'>('swipe');
  const [currentSwipeIndex, setCurrentSwipeIndex] = React.useState(0);
  const [swipeTrigger, setSwipeTrigger] = React.useState<'left' | 'right' | null>(null);
  const [swipedJobHistory, setSwipedJobHistory] = React.useState<number[]>([]); // Track index history for rewind capability
  const [dragOffset, setDragOffset] = React.useState(0);

  // Reset swipe card index when any filter changes
  React.useEffect(() => {
    setCurrentSwipeIndex(0);
    setSwipedJobHistory([]);
    setSwipeTrigger(null);
  }, [searchQuery, selectedState, selectedCity, selectedSalary, selectedEmpType, selectedExperience, selectedShift, selectedBike, selectedLicense, selectedJoining, selectedGender, sortOrder]);

  // Modal Detail State
  const [selectedJob, setSelectedJob] = React.useState<any | null>(null);
  const [selectedApp, setSelectedApp] = React.useState<any | null>(null);
  const [appTimeline, setAppTimeline] = React.useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(false);

  React.useEffect(() => {
    if (selectedApp) {
      setLoadingTimeline(true);
      fetch(`/api/applications/${selectedApp.id}/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setAppTimeline(data.timeline || []);
        })
        .catch(err => console.error('Error fetching timeline:', err))
        .finally(() => setLoadingTimeline(false));
    } else {
      setAppTimeline([]);
    }
  }, [selectedApp, token]);

  // Status alerts & Complete verification states
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null);
  const [missingRequirements, setMissingRequirements] = React.useState<{ profile: string[], docs: string[] } | null>(null);

  // Action loaders
  const [applyingJobId, setApplyingJobId] = React.useState<string | null>(null);
  const [withdrawingAppId, setWithdrawingAppId] = React.useState<string | null>(null);

  // Instant Fast Apply States
  const [jobForInstantApply, setJobForInstantApply] = React.useState<any | null>(null);
  const [instantFullName, setInstantFullName] = React.useState('');
  const [instantAge, setInstantAge] = React.useState('');
  const [instantGender, setInstantGender] = React.useState('');
  const [instantPincode, setInstantPincode] = React.useState('');
  const [instantError, setInstantError] = React.useState<string | null>(null);
  const [instantLoading, setInstantLoading] = React.useState(false);

  // Fetch functions
  const fetchJobs = React.useCallback(() => {
    setLoadingJobs(true);
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => {
        setActiveJobs(data.jobs || []);
      })
      .catch(err => console.error('Error fetching jobs:', err))
      .finally(() => setLoadingJobs(false));
  }, []);

  const fetchMyApplications = React.useCallback(() => {
    if (!token) return;
    setLoadingApps(true);
    fetch('/api/applications/my', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setMyApplications(data.applications || []);
      })
      .catch(err => console.error('Error fetching applications:', err))
      .finally(() => setLoadingApps(false));
  }, [token]);

  const fetchDocuments = React.useCallback(() => {
    if (!token) return;
    setLoadingDocs(true);
    fetch('/api/documents', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setDocuments(data.documents || []);
      })
      .catch(err => console.error('Error fetching documents:', err))
      .finally(() => setLoadingDocs(false));
  }, [token]);

  // Load stats & details on mount
  React.useEffect(() => {
    fetchJobs();
    fetchMyApplications();
    fetchDocuments();

    const handleRefresh = () => {
      fetchJobs();
    };
    window.addEventListener('refresh-jobs', handleRefresh);
    return () => {
      window.removeEventListener('refresh-jobs', handleRefresh);
    };
  }, [fetchJobs, fetchMyApplications, fetchDocuments]);

  // Profile checklist
  const checklist = [
    { key: 'fullName', label: 'Full Name', done: !!profile.fullName?.trim() },
    { key: 'age', label: 'Age', done: typeof profile.age === 'number' || (!!profile.age && String(profile.age).trim() !== '') },
    { key: 'gender', label: 'Gender Selection', done: !!profile.gender },
    { key: 'pincode', label: '6-digit Pincode', done: !!profile.pincode?.trim() },
  ];

  const completedCount = checklist.filter((item) => item.done).length;
  const totalCount = checklist.length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);
  const isProfileIncomplete = completionPercentage < 100;

  // Documents checklist
  const documentChecklist: any[] = [];

  const totalDocs = 0;
  const uploadedDocsCount = 0;
  const isDocsIncomplete = false;

  // Dynamically populated filter option arrays
  const uniqueStates = React.useMemo(() => {
    const states = activeJobs.map(j => j.state).filter(Boolean);
    return ['All', ...Array.from(new Set(states))];
  }, [activeJobs]);

  const uniqueCities = React.useMemo(() => {
    const cities = activeJobs
      .filter(j => selectedState === 'All' || (j.state || '').toLowerCase() === selectedState.toLowerCase())
      .map(j => j.city)
      .filter(Boolean);
    return ['All', ...Array.from(new Set(cities))];
  }, [activeJobs, selectedState]);

  // Client-side dynamic instant-search filtering & sorting
  const filteredJobsList = React.useMemo(() => {
    let result = [...activeJobs];

    // Filter status strictly (Only Published or Active)
    result = result.filter(j => j.status === 'Published' || j.status === 'Active');

    // Instant Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j => 
        j.title.toLowerCase().includes(q) ||
        j.companyName.toLowerCase().includes(q) ||
        (j.city || '').toLowerCase().includes(q)
      );
    }

    // State Filter
    if (selectedState !== 'All') {
      result = result.filter(j => (j.state || '').toLowerCase() === selectedState.toLowerCase());
    }

    // City Filter
    if (selectedCity !== 'All') {
      result = result.filter(j => (j.city || '').toLowerCase() === selectedCity.toLowerCase());
    }

    // Salary Filter
    if (selectedSalary > 0) {
      result = result.filter(j => (j.maxSalary || j.minSalary || 0) >= selectedSalary);
    }

    // Employment Type
    if (selectedEmpType !== 'All') {
      result = result.filter(j => j.employmentType === selectedEmpType);
    }

    // Experience Limit
    if (selectedExperience !== 'All') {
      const maxExp = parseInt(selectedExperience, 10);
      result = result.filter(j => (j.experienceRequired || 0) <= maxExp);
    }

    // Shift
    if (selectedShift !== 'All') {
      result = result.filter(j => j.shift === selectedShift);
    }

    // Bike requirement
    if (selectedBike !== 'All') {
      result = result.filter(j => j.bikeRequired === selectedBike);
    }

    // Driving License
    if (selectedLicense !== 'All') {
      result = result.filter(j => j.drivingLicenseRequired === selectedLicense);
    }

    // Immediate Joining
    if (selectedJoining !== 'All') {
      result = result.filter(j => j.immediateJoining === selectedJoining);
    }

    // Gender
    if (selectedGender !== 'All') {
      result = result.filter(j => j.genderPreference === selectedGender);
    }

    // Sorting
    if (sortOrder === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [activeJobs, searchQuery, selectedState, selectedCity, selectedSalary, selectedEmpType, selectedExperience, selectedShift, selectedBike, selectedLicense, selectedJoining, selectedGender, sortOrder]);

  // Swipe Action Helpers
  const handleSwipeLeft = () => {
    setSwipeTrigger('left');
    setTimeout(() => {
      setSwipedJobHistory(prev => [...prev, currentSwipeIndex]);
      setCurrentSwipeIndex(prev => prev + 1);
      setSwipeTrigger(null);
    }, 200);
  };

  const handleSwipeRight = async (job: any) => {
    setSwipeTrigger('right');
    await handleApplyNow(job);
    setTimeout(() => {
      setSwipedJobHistory(prev => [...prev, currentSwipeIndex]);
      setCurrentSwipeIndex(prev => prev + 1);
      setSwipeTrigger(null);
    }, 200);
  };

  const handleRewind = () => {
    if (swipedJobHistory.length > 0) {
      const prevHistory = [...swipedJobHistory];
      const prevIndex = prevHistory.pop();
      setSwipedJobHistory(prevHistory);
      if (prevIndex !== undefined) {
        setCurrentSwipeIndex(prevIndex);
      }
      setSwipeTrigger(null);
    }
  };

  // Apply Action Trigger
  const handleApplyNow = async (job: any) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setMissingRequirements(null);

    // Check if the 4 key fields are complete
    const isNameDone = !!profile.fullName?.trim();
    const isAgeDone = typeof profile.age === 'number' || (!!profile.age && String(profile.age).trim() !== '');
    const isGenderDone = !!profile.gender;
    const isPincodeDone = !!profile.pincode?.trim() && /^\d{6}$/.test(profile.pincode.trim());

    if (!isNameDone || !isAgeDone || !isGenderDone || !isPincodeDone) {
      // Open the Instant Apply popup to fill missing fields
      setInstantFullName(profile.fullName || '');
      setInstantAge(profile.age ? String(profile.age) : '');
      setInstantGender(profile.gender || '');
      setInstantPincode(profile.pincode || '');
      setInstantError(null);
      setJobForInstantApply(job);
      return;
    }

    // Submit application immediately
    setApplyingJobId(job.id);
    try {
      const response = await fetch(`/api/jobs/${job.id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: job.id })
      });

      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error || 'Failed to submit application.');
        return;
      }

      setSubmitSuccess('Application submitted successfully.');
      fetchMyApplications();
      fetchJobs();

      // Close details modal if open
      if (selectedJob) {
        setSelectedJob(null);
      }

      // Automatically clear success banner after 5s
      setTimeout(() => {
        setSubmitSuccess(null);
      }, 5000);
    } catch (err) {
      console.error(err);
      setSubmitError('A connection issue occurred. Please check your network and apply again.');
    } finally {
      setApplyingJobId(null);
    }
  };

  // Submit Fast Apply details & then apply
  const handleInstantApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstantError(null);

    if (!instantFullName.trim()) {
      setInstantError('Full Name is required.');
      return;
    }

    const parsedAge = instantAge ? parseInt(instantAge, 10) : undefined;
    if (parsedAge === undefined || isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
      setInstantError('Please enter a valid age between 1 and 120.');
      return;
    }

    if (!instantGender) {
      setInstantError('Please select your gender.');
      return;
    }

    if (!instantPincode || !/^\d{6}$/.test(instantPincode)) {
      setInstantError('Pincode must be a 6-digit number.');
      return;
    }

    setInstantLoading(true);

    try {
      // 1. Save profile information
      const updatedProfile: Profile = {
        fullName: instantFullName.trim(),
        age: parsedAge,
        gender: instantGender,
        pincode: instantPincode,
      };

      const profileResponse = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedProfile)
      });

      const profileData = await profileResponse.json();
      if (!profileResponse.ok) {
        throw new Error(profileData.error || 'Failed to update profile details.');
      }

      // Update local state in parent App component
      if (onUpdateProfile) {
        onUpdateProfile(profileData.candidate.profile);
      }

      // 2. Submit job application
      const applyResponse = await fetch(`/api/jobs/${jobForInstantApply.id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: jobForInstantApply.id })
      });

      const applyData = await applyResponse.json();
      if (!applyResponse.ok) {
        throw new Error(applyData.error || 'Failed to submit application.');
      }

      setSubmitSuccess('Application submitted successfully.');
      setJobForInstantApply(null);
      fetchMyApplications();
      fetchJobs();

      if (selectedJob) {
        setSelectedJob(null);
      }

      setTimeout(() => {
        setSubmitSuccess(null);
      }, 5000);
    } catch (err: any) {
      setInstantError(err.message || 'An error occurred during fast apply.');
    } finally {
      setInstantLoading(false);
    }
  };

  const handleViewDetails = (job: any) => {
    setSelectedJob(job);
    fetch(`/api/jobs/${job.id}/view`, { method: 'POST' }).catch(err => {
      console.error('Error tracking job view:', err);
    });
  };

  // Withdraw Action Trigger
  const handleWithdrawApp = async (applicationId: string) => {
    if (!window.confirm('Are you sure you want to withdraw this application? This will permanently cancel your candidacy for this opening.')) {
      return;
    }

    setSubmitError(null);
    setSubmitSuccess(null);
    setWithdrawingAppId(applicationId);

    try {
      const response = await fetch(`/api/applications/${applicationId}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error || 'Failed to withdraw application.');
        return;
      }

      setSubmitSuccess('Application withdrawn successfully.');
      fetchMyApplications();
      fetchJobs();

      // Update active modal status if open
      if (selectedApp && selectedApp.id === applicationId) {
        setSelectedApp(prev => prev ? { ...prev, currentStatus: 'Withdrawn', withdrawStatus: 'Withdrawn' } : null);
      }

      setTimeout(() => {
        setSubmitSuccess(null);
      }, 5000);
    } catch (err) {
      console.error(err);
      setSubmitError('A connection issue occurred. Could not withdraw application.');
    } finally {
      setWithdrawingAppId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      id="candidate-portal-wrapper"
    >
      {/* Upper Brand / Welcome bar */}
      <div 
        className="relative overflow-hidden rounded-2xl bg-slate-950 text-white p-6 border border-slate-800 shadow-xl"
        id="dashboard-header-banner"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-orange-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-orange-500/15 border-2 border-orange-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              {profile.profilePhoto ? (
                <img src={profile.profilePhoto} alt={profile.fullName} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
              ) : (
                <User className="w-6 h-6 text-orange-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">Welcome, {profile.fullName || 'Driver Candidate'}!</h1>
                <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
              </div>
              <p className="text-slate-400 text-xs mt-1">Delivery Logistics Network • ID: <span className="font-mono text-orange-300">{candidate.id.slice(0, 8)}</span></p>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={onEditProfile}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-600/10 transition-colors cursor-pointer"
              id="dashboard-edit-top-btn"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition-colors cursor-pointer"
              id="dashboard-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </div>      {/* Persistent Navigation Tabs Bar */}
      <div className="flex border-b border-gray-200 bg-white p-1 rounded-xl shadow-sm gap-1" id="candidate-sub-navbar">
        <button
          onClick={() => { setActiveTab('find_jobs'); setSubmitError(null); }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'find_jobs'
              ? 'bg-slate-950 text-white shadow'
              : 'text-gray-500 hover:text-slate-900 hover:bg-gray-50'
          }`}
          id="nav-tab-find-jobs"
        >
          <Search className="w-4 h-4" />
          Find Jobs
          {activeJobs.length > 0 && (
            <span className={`text-[10px] py-0.5 px-1.5 rounded-full font-black ${activeTab === 'find_jobs' ? 'bg-orange-50 text-white' : 'bg-orange-50 text-orange-600'}`}>
              {activeJobs.filter(j => j.status === 'Published' || j.status === 'Active').length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('applications'); setSubmitError(null); }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'applications'
              ? 'bg-slate-950 text-white shadow'
              : 'text-gray-500 hover:text-slate-900 hover:bg-gray-50'
          }`}
          id="nav-tab-my-applications"
        >
          <Briefcase className="w-4 h-4" />
          My Applications
          {myApplications.length > 0 && (
            <span className={`text-[10px] py-0.5 px-1.5 rounded-full font-black ${activeTab === 'applications' ? 'bg-orange-50 text-white' : 'bg-orange-50 text-orange-600'}`}>
              {myApplications.length}
            </span>
          )}
        </button>
      </div>

      {/* Error & Success Messages */}
      <AnimatePresence mode="wait">
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 border border-red-150 rounded-xl text-xs font-bold text-red-700 flex items-start gap-2"
            id="candidate-error-banner"
          >
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </motion.div>
        )}
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-150 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2"
            id="candidate-success-banner"
          >
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{submitSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RENDER TAB 1: OVERVIEW & PROFILE CHECKLISTS */}
      {activeTab === 'overview' && (
        <motion.div
          key="overview-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          id="tab-overview-content"
        >
          {/* Side columns: Scores & Checklists */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Completion Score */}
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-6" id="completeness-panel">
              <h3 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase mb-5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-orange-500" /> Profile Completion
              </h3>

              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-black text-slate-900">{completionPercentage}%</span>
                <span className="text-[11px] font-extrabold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{completedCount} of {totalCount} Filled</span>
              </div>

              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-6">
                <div 
                  className="bg-orange-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              {isProfileIncomplete ? (
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl" id="incomplete-cta-box">
                  <p className="text-xs text-orange-800 leading-relaxed font-semibold mb-3 flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-orange-600 mt-0.5" />
                    Your profile is incomplete. Delivery recruiters prioritize candidates with 100% completed profiles.
                  </p>
                  <button
                    onClick={onEditProfile}
                    className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer text-center shadow-sm"
                    id="dashboard-complete-now-btn"
                  >
                    Complete Profile Now
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5" id="complete-celebration-box">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-extrabold text-emerald-800">100% Profile Complete!</h4>
                    <p className="text-[11px] text-emerald-700 leading-relaxed mt-1">Excellent! Your verified profile and driver checklist is fully completed and ready for employer dispatch.</p>
                  </div>
                </div>
              )}

              {/* Profile Fields List */}
              <div className="space-y-3 mt-6 border-t border-gray-100 pt-5" id="completeness-checklist">
                <h4 className="text-xs font-bold text-gray-700">Detailed Checklist</h4>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {checklist.map((item) => (
                    <div key={item.key} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-gray-500">{item.label}</span>
                      <span 
                        className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          item.done 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}
                      >
                        {item.done ? 'Filled' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Documents are no longer requested */}
          </div>

          {/* Right column: Profile card info */}
          <div className="lg:col-span-2 space-y-6" id="profile-detail-panel">
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-gray-100 pb-5 mb-6">
                <h3 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase flex items-center gap-2">
                  <User className="w-4 h-4 text-orange-500" /> Verified Credentials Details
                </h3>
                <button
                  onClick={onEditProfile}
                  className="flex items-center gap-1 text-xs font-extrabold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                  id="dashboard-edit-detail-link"
                >
                  <Edit2 className="w-3 h-3" /> Edit Details
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-5">
                  <div className="flex items-center gap-3.5 py-1">
                    <div className="w-9 h-9 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Full Name</p>
                      <p className="text-sm font-bold text-slate-800">{profile.fullName || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 py-1">
                    <div className="w-9 h-9 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Age</p>
                      <p className="text-sm font-bold text-slate-800">{profile.age || <span className="text-gray-400 italic font-normal text-sm">Not added</span>}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 py-1">
                    <div className="w-9 h-9 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Gender</p>
                      <p className="text-sm font-bold text-slate-800">{profile.gender || <span className="text-gray-400 italic font-normal text-sm">Not added</span>}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 py-1">
                    <div className="w-9 h-9 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pincode</p>
                      <p className="text-sm font-bold text-slate-800">{profile.pincode || <span className="text-gray-400 italic font-normal text-sm">Not added</span>}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4" />

                  <div className="flex items-center gap-3.5 py-1">
                    <div className="w-9 h-9 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Mobile Phone</p>
                      <p className="text-sm font-bold text-slate-800">{mobile}</p>
                    </div>
                  </div>

                  {email && (
                    <div className="flex items-center gap-3.5 py-1">
                      <div className="w-9 h-9 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Email Address</p>
                        <p className="text-sm font-bold text-slate-800">{email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* RENDER TAB 2: FIND JOBS PAGE */}
      {activeTab === 'find_jobs' && (
        <motion.div
          key="find-jobs-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-6"
          id="tab-find-jobs-content"
        >
          {/* Filtering Accordion / Search Card */}
          <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-4 order-2">
            
            {/* Direct Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs by Job Title, Company Name, or City..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 hover:bg-gray-100/50 focus:bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-150 focus:border-orange-500 focus:outline-none transition-all placeholder:text-gray-400"
                id="jobs-search-input"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-900 cursor-pointer text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Panel Grid */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-3">
                <SlidersHorizontal className="w-3.5 h-3.5 text-orange-500" /> Advanced Filter Toolkit
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs font-bold text-slate-700">
                {/* State dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">State</label>
                  <select
                    value={selectedState}
                    onChange={(e) => { setSelectedState(e.target.value); setSelectedCity('All'); }}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    {uniqueStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* City dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">City</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    {uniqueCities.map(ct => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>

                {/* Minimum Monthly Salary */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Min Salary (Monthly)</label>
                  <select
                    value={selectedSalary}
                    onChange={(e) => setSelectedSalary(Number(e.target.value))}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value={0}>Any Salary</option>
                    <option value={10000}>₹ 10,000+</option>
                    <option value={15000}>₹ 15,000+</option>
                    <option value={20000}>₹ 20,000+</option>
                    <option value={25000}>₹ 25,000+</option>
                    <option value={30000}>₹ 30,000+</option>
                  </select>
                </div>

                {/* Employment Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Employment Type</label>
                  <select
                    value={selectedEmpType}
                    onChange={(e) => setSelectedEmpType(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value="All">All Types</option>
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Temporary</option>
                  </select>
                </div>

                {/* Experience Limit */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Experience (Max Required)</label>
                  <select
                    value={selectedExperience}
                    onChange={(e) => setSelectedExperience(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value="All">Any Experience</option>
                    <option value="0">Freshers Only (0 Years)</option>
                    <option value="1">1 Year or Less</option>
                    <option value="2">2 Years or Less</option>
                    <option value="3">3 Years or Less</option>
                  </select>
                </div>

                {/* Shift */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Preferred Shift</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value="All">All Shifts</option>
                    <option value="Day Shift">Day Shift</option>
                    <option value="Night Shift">Night Shift</option>
                    <option value="Rotational Shift">Rotational</option>
                  </select>
                </div>

                {/* Bike Required */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Bike Required?</label>
                  <select
                    value={selectedBike}
                    onChange={(e) => setSelectedBike(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value="All">All Options</option>
                    <option value="Yes">Yes Required</option>
                    <option value="No">No Bike Required</option>
                  </select>
                </div>

                {/* Driving License Required */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">License Required?</label>
                  <select
                    value={selectedLicense}
                    onChange={(e) => setSelectedLicense(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value="All">All Options</option>
                    <option value="Yes">License Mandatory</option>
                    <option value="No">No License Needed</option>
                  </select>
                </div>

                {/* Immediate Joining */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Immediate Joining?</label>
                  <select
                    value={selectedJoining}
                    onChange={(e) => setSelectedJoining(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value="All">All Options</option>
                    <option value="Yes">Immediate Only</option>
                    <option value="No">Standard Timeline</option>
                  </select>
                </div>

                {/* Gender Preference */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Gender Preference</label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-150 rounded-lg focus:outline-none focus:border-orange-500 transition-all font-bold"
                  >
                    <option value="All">All Preferences</option>
                    <option value="Any">Any Gender</option>
                    <option value="Male Only">Male Only</option>
                    <option value="Female Only">Female Only</option>
                  </select>
                </div>

                {/* Sorting and alignment */}
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Posting Order</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSortOrder('newest')}
                      className={`flex-1 py-2 px-3 border rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${sortOrder === 'newest' ? 'bg-slate-950 border-slate-950 text-white' : 'bg-gray-50 border-gray-150 text-gray-600 hover:bg-gray-100'}`}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" /> Newest First
                    </button>
                    <button
                      onClick={() => setSortOrder('oldest')}
                      className={`flex-1 py-2 px-3 border rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${sortOrder === 'oldest' ? 'bg-slate-950 border-slate-950 text-white' : 'bg-gray-50 border-gray-150 text-gray-600 hover:bg-gray-100'}`}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" /> Oldest First
                    </button>
                  </div>
                </div>

              </div>

              {/* Reset button wrapper */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedState('All');
                    setSelectedCity('All');
                    setSelectedSalary(0);
                    setSelectedEmpType('All');
                    setSelectedExperience('All');
                    setSelectedShift('All');
                    setSelectedBike('All');
                    setSelectedLicense('All');
                    setSelectedJoining('All');
                    setSelectedGender('All');
                    setSortOrder('newest');
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-orange-600 border border-dashed border-gray-200 hover:border-orange-200 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          </div>

          {/* Results Info and Cards Display */}
          <div id="jobs-grid-section" className="order-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-gray-50 border border-gray-150 p-3 rounded-2xl">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
                Found {filteredJobsList.length} matching jobs
              </span>

              {/* Toggle controls to easily flip between modern Swipe deck or standard list Grid */}
              <div className="flex bg-white border border-gray-200 p-0.5 rounded-xl shadow-sm self-start sm:self-auto">
                <button
                  onClick={() => setViewMode('swipe')}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'swipe'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-gray-500 hover:text-slate-800 hover:bg-gray-50'
                  }`}
                  id="viewmode-toggle-swipe"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Swipe Cards
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-gray-500 hover:text-slate-800 hover:bg-gray-50'
                  }`}
                  id="viewmode-toggle-grid"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Grid List
                </button>
              </div>
            </div>

            {loadingJobs ? (
              <div className="py-24 text-center bg-white rounded-2xl border border-gray-150 shadow-sm">
                <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-gray-400 mt-3 uppercase tracking-wide">Syncing Logistics Dispatch Grid...</p>
              </div>
            ) : filteredJobsList.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl border border-gray-150 shadow-sm" id="empty-jobs-view">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h4 className="font-extrabold text-slate-800 text-sm uppercase">No matching jobs found</h4>
                <p className="text-xs text-gray-400 max-w-sm mx-auto mt-2 leading-relaxed">
                  Try adjusting your keywords, widening your search location filters, or resetting the specific dispatch requirements.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedState('All');
                    setSelectedCity('All');
                    setSelectedSalary(0);
                    setSelectedEmpType('All');
                    setSelectedExperience('All');
                    setSelectedShift('All');
                    setSelectedBike('All');
                    setSelectedLicense('All');
                    setSelectedJoining('All');
                    setSelectedGender('All');
                  }}
                  className="mt-5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-orange-600/10"
                >
                  Clear All Filters
                </button>
              </div>
            ) : viewMode === 'swipe' ? (
              // Swipe/Tinder layout: One by one
              <div className="py-4 select-none relative max-w-lg mx-auto" id="swipe-deck-container">
                <AnimatePresence mode="wait">
                  {currentSwipeIndex >= filteredJobsList.length ? (
                    // OUT OF CARDS VIEW
                    <motion.div
                      key="out-of-cards"
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white border border-gray-150 rounded-3xl p-8 text-center shadow-lg border-b-4 border-b-orange-500/20 py-16"
                    >
                      <Sparkles className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-bounce" />
                      <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">You've Swiped 'Em All!</h4>
                      <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
                        You have swiped through all {filteredJobsList.length} matching openings. Adjust your search filters above to load more regional dispatches or restart!
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                        <button
                          onClick={() => {
                            setCurrentSwipeIndex(0);
                            setSwipedJobHistory([]);
                          }}
                          className="px-5 py-3 bg-slate-950 hover:bg-slate-900 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Re-Swipe All Jobs
                        </button>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedState('All');
                            setSelectedCity('All');
                            setSelectedSalary(0);
                            setSelectedEmpType('All');
                            setSelectedExperience('All');
                            setSelectedShift('All');
                            setSelectedBike('All');
                            setSelectedLicense('All');
                            setSelectedJoining('All');
                            setSelectedGender('All');
                          }}
                          className="px-5 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-150 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                          Reset Filters
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    // ACTIVE CARD VIEW
                    (() => {
                      const job = filteredJobsList[currentSwipeIndex];
                      const alreadyApplied = myApplications.some(app => app.jobId === job.id && app.withdrawStatus !== 'Withdrawn');
                      
                      return (
                        <div className="space-y-6">
                          {/* Swipe Card Indicator Status Bar */}
                          <div className="flex justify-between items-center px-2">
                            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                              Card {currentSwipeIndex + 1} of {filteredJobsList.length}
                            </span>
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(filteredJobsList.length, 10) }).map((_, i) => (
                                <span 
                                  key={i} 
                                  className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSwipeIndex ? 'w-5 bg-orange-500' : 'w-1.5 bg-gray-200'}`} 
                                />
                              ))}
                              {filteredJobsList.length > 10 && <span className="text-[9px] font-black text-gray-400 self-center pl-1">+</span>}
                            </div>
                          </div>

                          <div className="relative">
                            {/* Swiping gesture card */}
                            <motion.div
                              key={job.id}
                              drag="x"
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={0.65}
                              onDrag={(e, info) => setDragOffset(info.offset.x)}
                              onDragEnd={(e, info) => {
                                setDragOffset(0);
                                if (info.offset.x > 140) {
                                  if (!alreadyApplied && job.status !== 'Closed') {
                                    handleSwipeRight(job);
                                  } else {
                                    handleSwipeLeft();
                                  }
                                } else if (info.offset.x < -140) {
                                  handleSwipeLeft();
                                }
                              }}
                              initial={{ scale: 0.95, opacity: 0, y: 15 }}
                              animate={{ 
                                scale: 1, 
                                opacity: 1, 
                                y: 0,
                                x: swipeTrigger === 'left' ? -350 : swipeTrigger === 'right' ? 350 : 0,
                                rotate: swipeTrigger === 'left' ? -15 : swipeTrigger === 'right' ? 15 : 0,
                              }}
                              exit={{ 
                                scale: 0.92, 
                                opacity: 0, 
                                x: swipeTrigger === 'left' ? -300 : swipeTrigger === 'right' ? 300 : 0,
                                rotate: swipeTrigger === 'left' ? -12 : swipeTrigger === 'right' ? 12 : 0,
                              }}
                              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                              className="bg-white border border-gray-150 rounded-3xl shadow-xl p-6 relative min-h-[490px] touch-none cursor-grab active:cursor-grabbing flex flex-col justify-between border-b-4 border-b-orange-600/30 overflow-hidden"
                            >
                              {/* Visual stamps overlay when dragging */}
                              <AnimatePresence>
                                {dragOffset > 40 && (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: Math.min(dragOffset / 120, 0.9), scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-emerald-500/10 border-4 border-emerald-500 flex items-center justify-center rounded-3xl z-30 pointer-events-none"
                                  >
                                    <div className="border-4 border-emerald-500 text-emerald-600 text-xl font-black px-6 py-2 rounded-xl rotate-12 uppercase tracking-widest shadow-lg bg-white">
                                      {alreadyApplied ? 'SKIP' : 'APPLY NOW 💚'}
                                    </div>
                                  </motion.div>
                                )}
                                {dragOffset < -40 && (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: Math.min(-dragOffset / 120, 0.9), scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-red-500/10 border-4 border-red-500 flex items-center justify-center rounded-3xl z-30 pointer-events-none"
                                  >
                                    <div className="border-4 border-red-500 text-red-600 text-xl font-black px-6 py-2 rounded-xl -rotate-12 uppercase tracking-widest shadow-lg bg-white">
                                      SKIP ❌
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div>
                                {/* Row 1: Company Logo, Status, Date */}
                                <div className="flex items-start justify-between gap-3 mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                      {job.companyLogo ? (
                                        <img src={job.companyLogo} alt={job.companyName} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                                      ) : (
                                        <Building className="w-6 h-6 text-gray-400" />
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-xs font-black uppercase text-orange-600 block leading-tight tracking-wider">{job.companyName}</span>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mt-1">
                                        Posted {new Date(job.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <span className={`text-[9px] font-black tracking-widest uppercase py-1 px-2.5 rounded-full ${job.status === 'Closed' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                    {job.status === 'Closed' ? 'Closed' : 'Active'}
                                  </span>
                                </div>

                                {/* Row 2: Job Title */}
                                <h3 className="font-black text-slate-900 text-base leading-snug tracking-tight mb-1.5">{job.title}</h3>
                                
                                {/* Row 3: Location */}
                                <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-wide">
                                  <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                                  {job.area ? `${job.area}, ` : ''}{job.city}, {job.state}
                                </p>

                                {/* Row 4: Core Attributes Grid (2x2) */}
                                <div className="grid grid-cols-2 gap-2.5 mt-5 text-[10px] font-bold text-slate-700">
                                  <div className="p-2.5 bg-gray-50 rounded-xl flex flex-col border border-gray-100/50">
                                    <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Employment</span>
                                    <span className="line-clamp-1 text-slate-800">{job.employmentType || 'Full Time'}</span>
                                  </div>
                                  <div className="p-2.5 bg-gray-50 rounded-xl flex flex-col border border-gray-100/50">
                                    <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Preferred Shift</span>
                                    <span className="line-clamp-1 text-slate-800">{job.shift || 'Day Shift'}</span>
                                  </div>
                                  <div className="p-2.5 bg-gray-50 rounded-xl flex flex-col border border-gray-100/50">
                                    <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Experience Limit</span>
                                    <span className="text-slate-800">{job.experienceRequired === 0 ? 'Fresher Friendly' : `${job.experienceRequired}+ Yr Exp`}</span>
                                  </div>
                                  <div className="p-2.5 bg-gray-50 rounded-xl flex flex-col border border-gray-100/50">
                                    <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Open Positions</span>
                                    <span className="text-slate-800">{job.openings || '1'} Open Role{job.openings > 1 ? 's' : ''}</span>
                                  </div>
                                </div>

                                {/* Special Logistics Badges if applicable */}
                                <div className="flex flex-wrap gap-1.5 mt-4">
                                  {job.bikeRequired === 'Yes' && (
                                    <span className="text-[8px] font-black tracking-wider uppercase py-1 px-2.5 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg flex items-center gap-1">
                                      <Bike className="w-3 h-3" /> Bike Mandatory
                                    </span>
                                  )}
                                  {job.drivingLicenseRequired === 'Yes' && (
                                    <span className="text-[8px] font-black tracking-wider uppercase py-1 px-2.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg flex items-center gap-1">
                                      <FileText className="w-3 h-3" /> License Required
                                    </span>
                                  )}
                                  {job.immediateJoining === 'Yes' && (
                                    <span className="text-[8px] font-black tracking-wider uppercase py-1 px-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> Immediate Joinee
                                    </span>
                                  )}
                                </div>

                                {/* Expandable Scrollable Description */}
                                <div className="mt-4.5 border-t border-gray-100 pt-3">
                                  <span className="text-[8px] text-gray-400 uppercase font-black block mb-1">Job Description Overview</span>
                                  <p className="text-[11px] text-gray-500 leading-relaxed max-h-[76px] overflow-y-auto pr-1">
                                    {job.description}
                                  </p>
                                </div>
                              </div>

                              {/* Card Bottom Panel: Salary highlight and interactive details trigger */}
                              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
                                <div className="text-xs font-black text-slate-800 shrink-0">
                                  <span className="text-[8px] font-bold text-gray-400 block uppercase leading-none mb-1.5">Monthly Salary</span>
                                  <span className="text-sm font-extrabold text-slate-900">
                                    ₹ {job.minSalary ? `${job.minSalary.toLocaleString()} - ${job.maxSalary.toLocaleString()}` : (job.salary || 'Best in Class')}
                                  </span>
                                </div>

                                <button
                                  onClick={() => handleViewDetails(job)}
                                  className="py-1.5 px-3 bg-gray-50 hover:bg-gray-100 text-slate-700 text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-gray-150 shadow-sm"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> Details
                                </button>
                              </div>
                            </motion.div>
                          </div>

                          {/* Tinder Action Buttons Footer Controls */}
                          <div className="flex items-center justify-center gap-4.5 pt-2" id="tinder-action-controls">
                            {/* Rewind/Back button */}
                            <button
                              onClick={handleRewind}
                              disabled={swipedJobHistory.length === 0}
                              className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all shadow-sm ${
                                swipedJobHistory.length > 0 
                                  ? 'bg-white border-gray-200 text-orange-500 hover:border-orange-200 hover:scale-105 active:scale-95 cursor-pointer' 
                                  : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                              }`}
                              title="Rewind / Go Back"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            {/* Dislike/Skip button */}
                            <button
                              onClick={handleSwipeLeft}
                              className="w-14 h-14 bg-white border border-red-150 text-red-500 hover:bg-red-50 hover:scale-110 active:scale-95 rounded-full flex items-center justify-center transition-all shadow-md shadow-red-100/20 cursor-pointer"
                              title="Skip/Dislike (Swipe Left)"
                            >
                              <ThumbsDown className="w-6 h-6" />
                            </button>

                            {/* Like/Apply button */}
                            {alreadyApplied ? (
                              <div className="py-3 px-5 bg-emerald-50 text-emerald-700 border border-emerald-150 text-xs font-black rounded-full shadow-inner tracking-wider flex items-center gap-1">
                                Applied ✓
                              </div>
                            ) : job.status === 'Closed' ? (
                              <div className="py-3 px-5 bg-gray-50 text-gray-400 border border-gray-150 text-xs font-black rounded-full">
                                Closed
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSwipeRight(job)}
                                disabled={applyingJobId === job.id}
                                className="w-14 h-14 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white hover:scale-110 active:scale-95 rounded-full flex items-center justify-center transition-all shadow-lg shadow-orange-600/30 cursor-pointer"
                                title="Apply Now (Swipe Right)"
                              >
                                {applyingJobId === job.id ? (
                                  <RefreshCw className="w-6 h-6 animate-spin" />
                                ) : (
                                  <ThumbsUp className="w-6 h-6" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Floating tip helper */}
                          <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest leading-none mt-2">
                            💡 Pro-tip: Drag cards <strong className="text-red-400 font-extrabold">Left</strong> to Skip or <strong className="text-emerald-500 font-extrabold">Right</strong> to Apply!
                          </p>
                        </div>
                      );
                    })()
                  )}
                </AnimatePresence>
              </div>
            ) : (
              // GRID VIEW LIST
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredJobsList.map((job) => {
                  const alreadyApplied = myApplications.some(app => app.jobId === job.id && app.withdrawStatus !== 'Withdrawn');
                  
                  return (
                    <div 
                      key={job.id} 
                      className="p-5 border border-gray-150 rounded-2xl bg-white hover:border-orange-300 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
                      id={`job-card-${job.id}`}
                    >
                      <div>
                        {/* Company branding row */}
                        <div className="flex items-start justify-between gap-3 mb-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                              {job.companyLogo ? (
                                <img src={job.companyLogo} alt={job.companyName} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                              ) : (
                                <Building className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <span className="text-[10px] font-black uppercase text-orange-600 block leading-tight">{job.companyName}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mt-0.5">
                                Posted {new Date(job.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[9px] font-black tracking-widest uppercase py-0.5 px-2 rounded-full ${job.status === 'Closed' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                            {job.status === 'Closed' ? 'Closed' : 'Active'}
                          </span>
                        </div>

                        {/* Title & Position */}
                        <h4 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-1">{job.title}</h4>
                        
                        {/* Location details */}
                        <p className="text-[11px] font-bold text-gray-400 mt-1 flex items-center gap-1 uppercase">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {job.area ? `${job.area}, ` : ''}{job.city}, {job.state}
                        </p>

                        {/* Core features grid */}
                        <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold text-slate-700">
                          <div className="p-2 bg-gray-50 rounded-lg flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Employment Type</span>
                            <span className="line-clamp-1">{job.employmentType || 'Full Time'}</span>
                          </div>
                          <div className="p-2 bg-gray-50 rounded-lg flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Preferred Shift</span>
                            <span className="line-clamp-1">{job.shift || 'Day Shift'}</span>
                          </div>
                          <div className="p-2 bg-gray-50 rounded-lg flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Experience Required</span>
                            <span>{job.experienceRequired === 0 ? 'Fresher Friendly' : `${job.experienceRequired}+ Yr Exp`}</span>
                          </div>
                          <div className="p-2 bg-gray-50 rounded-lg flex flex-col">
                            <span className="text-[8px] text-gray-400 uppercase leading-none mb-1">Open Positions</span>
                            <span>{job.openings || '1'} Opening{job.openings > 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        {/* Description clip */}
                        <p className="text-xs text-gray-500 mt-3 leading-relaxed line-clamp-2 border-t border-gray-50 pt-2.5">
                          {job.description}
                        </p>
                      </div>

                      {/* Footer salary and actions */}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
                        <div className="text-xs font-black text-slate-800 shrink-0">
                          <span className="text-[9px] font-bold text-gray-400 block uppercase leading-none mb-1">Monthly Salary</span>
                          ₹ {job.minSalary ? `${job.minSalary.toLocaleString()} - ${job.maxSalary.toLocaleString()}` : (job.salary || 'Best in Class')}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(job)}
                            className="py-2 px-2.5 bg-gray-50 hover:bg-gray-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-gray-150"
                            id={`view-details-btn-${job.id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Details
                          </button>
                          
                          {alreadyApplied ? (
                            <span className="py-2 px-3 bg-emerald-50 text-emerald-700 border border-emerald-150 text-xs font-black rounded-xl">
                              Applied ✓
                            </span>
                          ) : job.status === 'Closed' ? (
                            <span className="py-2 px-3 bg-gray-100 text-gray-400 border border-gray-150 text-xs font-black rounded-xl">
                              Closed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApplyNow(job)}
                              disabled={applyingJobId === job.id}
                              className="py-2 px-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md shadow-orange-600/10 flex items-center gap-1"
                              id={`apply-now-btn-${job.id}`}
                            >
                              {applyingJobId === job.id ? 'Applying...' : 'Apply Now'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* RENDER TAB 3: MY APPLICATIONS */}
      {activeTab === 'applications' && (
        <motion.div
          key="applications-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="space-y-6"
          id="tab-my-applications-content"
        >
          <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-5 mb-6 gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-orange-500" /> Active Dispatches Tracking
                </h3>
                <p className="text-xs text-gray-400 mt-1">Real-time dispatcher status audits, application milestones, and withdraw panel.</p>
              </div>
              <span className="bg-orange-50 text-orange-700 border border-orange-100 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto">
                {myApplications.length} Application{myApplications.length !== 1 ? 's' : ''} Record{myApplications.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loadingApps ? (
              <div className="py-16 text-center text-xs text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
                Querying application dispatch state...
              </div>
            ) : myApplications.length === 0 ? (
              <div className="py-16 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200" id="empty-applications-view">
                <FileMinus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h4 className="font-extrabold text-slate-700 text-sm uppercase">No applied dispatches</h4>
                <p className="text-xs max-w-sm mx-auto mt-2 leading-relaxed">
                  You have not submitted applications for any regional logistics roles yet. Head over to the Find Jobs dispatcher grid to search local openings.
                </p>
                <button
                  onClick={() => setActiveTab('find_jobs')}
                  className="mt-5 text-xs font-black bg-slate-950 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-slate-950/10"
                >
                  Explore Job Ledger
                </button>
              </div>
            ) : (
              <div className="space-y-4" id="applications-list-container">
                {myApplications.map((app) => (
                  <div 
                    key={app.id}
                    className="p-5 border border-gray-150 rounded-2xl bg-white hover:border-gray-300 transition-all shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                    id={`app-item-${app.id}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Company logo branding */}
                      <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {app.companyLogo ? (
                          <img src={app.companyLogo} alt={app.companyName} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                        ) : (
                          <Building className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      <div>
                        {/* Company & position info */}
                        <span className="text-[10px] font-black uppercase text-orange-600 block leading-tight">{app.companyName}</span>
                        <h4 className="font-extrabold text-slate-900 text-sm leading-snug mt-1">{app.jobTitle}</h4>
                        
                        {/* Date row */}
                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1.5 flex-wrap">
                          <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3 text-gray-400" /> Applied: {new Date(app.appliedDate).toLocaleDateString()}</span>
                          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3 text-gray-400" /> Updated: {new Date(app.lastUpdated).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & actions row */}
                    <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto border-t md:border-t-0 border-gray-50 pt-3 md:pt-0">
                      <div className="flex flex-col text-left md:text-right">
                        <span className="text-[8px] text-gray-400 font-extrabold uppercase leading-none mb-1">Dispatch Status</span>
                        <span 
                          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest inline-block text-center border ${
                            app.currentStatus === 'Withdrawn'
                              ? 'bg-red-50 text-red-700 border-red-150'
                              : app.currentStatus === 'Applied'
                              ? 'bg-orange-50 text-orange-700 border-orange-150 animate-pulse'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-150'
                          }`}
                        >
                          {app.currentStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="py-2 px-3 bg-gray-50 hover:bg-gray-100 text-slate-700 text-xs font-bold border border-gray-150 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          id={`view-app-details-${app.id}`}
                        >
                          Details <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                        
                        {app.currentStatus === 'Applied' && app.withdrawStatus !== 'Withdrawn' && (
                          <button
                            onClick={() => handleWithdrawApp(app.id)}
                            disabled={withdrawingAppId === app.id}
                            className="py-2 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs font-bold rounded-xl border border-red-100 transition-all cursor-pointer flex items-center gap-1"
                            id={`withdraw-app-${app.id}`}
                          >
                            {withdrawingAppId === app.id ? 'Withdrawing...' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* MODAL 1: JOB DETAILS PREVIEW */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="job-details-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-100 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 relative"
              id="job-details-modal-content"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedJob(null)}
                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-slate-900 cursor-pointer shadow-sm transition-all"
                id="close-job-modal-btn"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Branding and Title */}
              <div className="flex items-start gap-4 border-b border-gray-100 pb-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {selectedJob.companyLogo ? (
                    <img src={selectedJob.companyLogo} alt={selectedJob.companyName} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                  ) : (
                    <Building className="w-7 h-7 text-gray-400" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-orange-600 tracking-wide block">{selectedJob.companyName}</span>
                  <h3 className="text-lg font-black text-slate-900 leading-snug mt-1 pr-8">{selectedJob.title}</h3>
                  <p className="text-xs font-bold text-gray-400 mt-1 flex items-center gap-1 uppercase">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {selectedJob.area ? `${selectedJob.area}, ` : ''}{selectedJob.city}, {selectedJob.state}
                  </p>
                </div>
              </div>

              {/* Multi-section content container */}
              <div className="space-y-6 text-xs text-slate-700 leading-relaxed font-medium">
                
                {/* Section 1: Detailed description */}
                <div>
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2.5">Job Description</h4>
                  <p className="whitespace-pre-line text-slate-600 bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                    {selectedJob.description}
                  </p>
                </div>

                {/* Section 2: Key Responsibilities */}
                {selectedJob.responsibilities && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2.5">Key Responsibilities</h4>
                    <p className="whitespace-pre-line text-slate-600 bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                      {selectedJob.responsibilities}
                    </p>
                  </div>
                )}

                {/* Section 3: Requirements */}
                {(selectedJob.educationRequired || selectedJob.experienceRequired !== undefined) && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2.5">Job Requirements & Vetting</h4>
                    <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-2xl space-y-2 text-slate-600">
                      <p><strong>Education:</strong> {selectedJob.educationRequired || 'No minimal education requirement'}</p>
                      <p><strong>Experience:</strong> {selectedJob.experienceRequired === 0 ? 'Freshers / No past experience required' : `${selectedJob.experienceRequired}+ Year${selectedJob.experienceRequired === 1 ? '' : 's'} required`}</p>
                      {selectedJob.genderPreference && <p><strong>Gender Preference:</strong> {selectedJob.genderPreference}</p>}
                    </div>
                  </div>
                )}

                {/* Section 4: Benefits */}
                {selectedJob.benefits && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2.5">Benefits & Perks</h4>
                    <p className="whitespace-pre-line text-slate-600 bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                      {selectedJob.benefits}
                    </p>
                  </div>
                )}

                {/* Section 5: Dispatch details grid */}
                <div>
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-3">Compliance & Logistics Metrics</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-slate-700">
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Employment</span>
                      <span className="font-extrabold">{selectedJob.employmentType || 'Full Time'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Salary Type</span>
                      <span className="font-extrabold">{selectedJob.salaryType || 'Monthly'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Shift Hours</span>
                      <span className="font-extrabold">{selectedJob.shift || 'Day Shift'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Bike Required?</span>
                      <span className={`font-extrabold px-1.5 py-0.5 rounded text-[10px] inline-block mt-0.5 ${selectedJob.bikeRequired === 'Yes' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {selectedJob.bikeRequired || 'No'}
                      </span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">License Required?</span>
                      <span className={`font-extrabold px-1.5 py-0.5 rounded text-[10px] inline-block mt-0.5 ${selectedJob.drivingLicenseRequired === 'Yes' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {selectedJob.drivingLicenseRequired || 'No'}
                      </span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Immediate Joining?</span>
                      <span className={`font-extrabold px-1.5 py-0.5 rounded text-[10px] inline-block mt-0.5 ${selectedJob.immediateJoining === 'Yes' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                        {selectedJob.immediateJoining || 'No'}
                      </span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Open Positions</span>
                      <span className="font-extrabold">{selectedJob.openings || '1'} Available</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Age Limits</span>
                      <span className="font-extrabold">{selectedJob.ageLimitMin ? `${selectedJob.ageLimitMin} - ${selectedJob.ageLimitMax}` : '18 - 45'} Years</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Recruiter Agent</span>
                      <span className="font-extrabold text-slate-500 italic">Vetted Logistics Broker</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Bar */}
              <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between gap-4">
                <div className="text-slate-800 font-black">
                  <span className="text-[9px] text-gray-400 uppercase font-bold block leading-none mb-1">Total Compensation Range</span>
                  <span className="text-base sm:text-lg">
                    ₹ {selectedJob.minSalary ? `${selectedJob.minSalary.toLocaleString()} - ${selectedJob.maxSalary.toLocaleString()}` : (selectedJob.salary || 'Salary Disclosed on Vetting Call')}
                  </span>
                </div>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer border border-gray-150"
                  >
                    Cancel
                  </button>

                  {myApplications.some(app => app.jobId === selectedJob.id && app.withdrawStatus !== 'Withdrawn') ? (
                    <span className="py-2.5 px-5 bg-emerald-50 text-emerald-700 border border-emerald-150 text-xs font-black rounded-xl flex items-center">
                      Applied Verified ✓
                    </span>
                  ) : selectedJob.status === 'Closed' ? (
                    <span className="py-2.5 px-5 bg-gray-100 text-gray-400 border border-gray-150 text-xs font-black rounded-xl">
                      Listing Closed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApplyNow(selectedJob)}
                      disabled={applyingJobId === selectedJob.id}
                      className="py-2.5 px-5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-600/15"
                      id={`modal-apply-btn-${selectedJob.id}`}
                    >
                      {applyingJobId === selectedJob.id ? 'Submitting...' : 'Apply Now'}
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: APPLICATION TIMELINE DETAILS */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="app-details-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-100 rounded-3xl w-full max-w-xl shadow-2xl p-6 sm:p-8 relative"
              id="app-details-modal-content"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedApp(null)}
                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-slate-900 cursor-pointer shadow-sm transition-all"
                id="close-app-modal-btn"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-base font-black text-slate-900 border-b border-gray-100 pb-4 mb-5 uppercase tracking-wide flex items-center gap-2">
                <Info className="w-5 h-5 text-orange-500" /> Dispatch Audit Details
              </h3>

              {/* Job Summary box */}
              <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl mb-6">
                <span className="text-[9px] font-black uppercase text-orange-600 block leading-tight">{selectedApp.companyName}</span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-1">{selectedApp.jobTitle}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {selectedApp.jobCity && selectedApp.jobState ? `${selectedApp.jobCity}, ${selectedApp.jobState}` : 'Regional Logistics Center'}
                </p>
              </div>

              {/* Application Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-700 mb-6 bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Application Date</span>
                  <span>{new Date(selectedApp.appliedDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Last Activity Audit</span>
                  <span>{new Date(selectedApp.lastUpdated).toLocaleDateString()}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-gray-100">
                  <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Current Dispatch Status</span>
                  <span className={`px-2.5 py-0.5 border text-[9px] font-extrabold uppercase tracking-widest rounded-full ${selectedApp.currentStatus === 'Withdrawn' ? 'bg-red-50 text-red-700 border-red-150' : 'bg-orange-50 text-orange-700 border-orange-150'}`}>
                    {selectedApp.currentStatus}
                  </span>
                </div>
              </div>

              {/* Dynamic Status Progress Flow */}
              <div className="mb-6">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-4">Application Progress Flow</h4>
                {selectedApp.currentStatus === 'Withdrawn' ? (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold uppercase text-[10px]">Application Withdrawn</p>
                      <p className="text-[11px] leading-relaxed mt-1 font-medium text-red-600">You have withdrawn your application. No further action will be taken.</p>
                    </div>
                  </div>
                ) : selectedApp.currentStatus === 'Rejected' ? (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <p className="font-extrabold uppercase text-[10px]">Application Reviewed</p>
                      <p className="text-[11px] leading-relaxed mt-1 font-medium text-red-600">The recruiter has reviewed your application and decided not to move forward with your profile at this time.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between relative mt-2 px-2">
                    {/* Background Line */}
                    <div className="absolute top-[13px] left-8 right-8 h-0.5 bg-gray-200 -z-10" />
                    
                    {[
                      { id: 'Applied', label: 'Applied' },
                      { id: 'Shortlisted', label: 'Shortlisted' },
                      { id: 'Interview Scheduled', label: 'Interview' },
                      { id: 'Selected', label: 'Selected' },
                      { id: 'Hired', label: 'Hired' }
                    ].map((step, idx) => {
                      // Determine status index in progression
                      const statuses = [
                        'Applied', 'Contacted', 'Shortlisted', 'Interview Scheduled', 
                        'Interview Completed', 'Selected', 'Hired'
                      ];
                      const currentIdx = statuses.indexOf(selectedApp.currentStatus);
                      
                      let isDone = false;
                      let isCurrent = false;

                      if (selectedApp.currentStatus === 'Hired') {
                        isDone = true;
                        isCurrent = idx === 4;
                      } else if (idx === 0) {
                        isDone = true;
                        isCurrent = selectedApp.currentStatus === 'Applied';
                      } else if (idx === 1) {
                        isDone = currentIdx >= 1; // Contacted, Shortlisted, etc
                        isCurrent = selectedApp.currentStatus === 'Shortlisted' || selectedApp.currentStatus === 'Contacted';
                      } else if (idx === 2) {
                        isDone = currentIdx >= 3; // Interview Scheduled, etc
                        isCurrent = selectedApp.currentStatus === 'Interview Scheduled' || selectedApp.currentStatus === 'Interview Completed';
                      } else if (idx === 3) {
                        isDone = currentIdx >= 5; // Selected, etc
                        isCurrent = selectedApp.currentStatus === 'Selected';
                      } else if (idx === 4) {
                        isDone = selectedApp.currentStatus === 'Hired';
                        isCurrent = selectedApp.currentStatus === 'Hired';
                      }

                      return (
                        <div key={step.id} className="flex flex-col items-center flex-1 text-center">
                          <div 
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                              isDone 
                                ? 'bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-600/25' 
                                : 'bg-white border-gray-200 text-gray-400'
                            } ${isCurrent ? 'ring-4 ring-orange-50' : ''}`}
                          >
                            {isDone ? '✓' : idx + 1}
                          </div>
                          <span className={`text-[9px] font-black uppercase mt-1.5 block tracking-tight ${isCurrent ? 'text-orange-600' : isDone ? 'text-slate-800' : 'text-gray-400'}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status Audit History List */}
              <div className="border-t border-gray-100 pt-5 mt-6">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-3">Status Audit History</h4>
                {loadingTimeline ? (
                  <div className="py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500" />
                    Syncing history...
                  </div>
                ) : appTimeline.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic">No previous status updates recorded. Application is currently in "Applied" state.</p>
                ) : (
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                    {appTimeline.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-2.5 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-[11px]">
                            Status changed from <span className="text-gray-400">{log.previousStatus}</span> to <span className="text-orange-600">{log.newStatus}</span>
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            Changed by {log.changedBy} on {new Date(log.changedDate).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between gap-4">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-white text-xs font-black rounded-xl shadow-lg cursor-pointer text-center"
                >
                  Close Audit Sheet
                </button>
                
                {selectedApp.currentStatus === 'Applied' && selectedApp.withdrawStatus !== 'Withdrawn' && (
                  <button
                    onClick={() => handleWithdrawApp(selectedApp.id)}
                    disabled={withdrawingAppId === selectedApp.id}
                    className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-xs font-bold rounded-xl cursor-pointer shrink-0 transition-all"
                  >
                    Withdraw Application
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: INCOMPLETE CHECKLIST ERROR OVERLAY */}
      <AnimatePresence>
        {missingRequirements && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="incomplete-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-100 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-8 relative"
              id="incomplete-modal-content"
            >
              {/* Close Button */}
              <button
                onClick={() => setMissingRequirements(null)}
                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-slate-900 cursor-pointer shadow-sm transition-all"
                id="close-incomplete-modal-btn"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-5">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-black text-slate-900 tracking-tight">Application Blocked: Incomplete Profile</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed font-medium">
                Recruiters require your Full Name, Age, Gender, and Pincode to submit an application. Please resolve the following pending items:
              </p>

              <div className="mt-5 space-y-4 max-h-60 overflow-y-auto pr-1">
                {/* Missing Profile Items */}
                {missingRequirements.profile.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Pending Profile Fields ({missingRequirements.profile.length})
                    </span>
                    <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl space-y-1.5 text-slate-700 text-xs font-semibold">
                      {missingRequirements.profile.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-orange-500 font-bold">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Docs */}
                {missingRequirements.docs.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Missing Document Vault Files ({missingRequirements.docs.length})
                    </span>
                    <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl space-y-1.5 text-slate-700 text-xs font-semibold">
                      {missingRequirements.docs.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-red-500 font-bold">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-5 border-t border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setMissingRequirements(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>

                {missingRequirements.profile.length > 0 ? (
                  <button
                    onClick={() => {
                      setMissingRequirements(null);
                      setActiveTab('overview');
                      onEditProfile();
                    }}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center shadow-lg shadow-orange-600/10 flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Fill Profile Now
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMissingRequirements(null);
                      onManageDocuments();
                    }}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center shadow-lg shadow-orange-600/10 flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Vault Now
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: INSTANT FAST APPLY MODAL */}
      <AnimatePresence>
        {jobForInstantApply && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="instant-apply-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white border border-gray-100 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
              id="instant-apply-content"
            >
              <form onSubmit={handleInstantApplySubmit} className="flex flex-col" id="instant-apply-form">
                {/* Header */}
                <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-gray-100 bg-orange-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full tracking-wider">Fast Apply Active</span>
                    <button
                      type="button"
                      onClick={() => setJobForInstantApply(null)}
                      className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-slate-900 cursor-pointer shadow-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Confirm Your Candidate Details</h3>
                  <p className="text-xs text-gray-400 mt-1 font-medium">To apply for <span className="font-extrabold text-slate-800">{jobForInstantApply.title}</span>, please provide these 4 fields. No documents required.</p>
                </div>

                {/* Body Form */}
                <div className="p-6 sm:p-8 space-y-4">
                  {instantError && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-100" id="instant-apply-error">
                      ⚠️ {instantError}
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        placeholder="e.g. John Doe"
                        value={instantFullName}
                        onChange={(e) => setInstantFullName(e.target.value)}
                        id="instant-input-name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Age */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                        Age <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                          <Calendar className="w-4 h-4" />
                        </span>
                        <input
                          type="number"
                          required
                          min="1"
                          max="120"
                          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                          placeholder="e.g. 25"
                          value={instantAge}
                          onChange={(e) => setInstantAge(e.target.value)}
                          id="instant-input-age"
                        />
                      </div>
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer"
                        value={instantGender}
                        onChange={(e) => setInstantGender(e.target.value)}
                        id="instant-input-gender"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Pincode */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                        <MapPin className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        placeholder="e.g. 560001"
                        value={instantPincode}
                        onChange={(e) => setInstantPincode(e.target.value.replace(/\D/g, ''))}
                        id="instant-input-pincode"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 sm:px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setJobForInstantApply(null)}
                    className="py-2 px-4 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={instantLoading}
                    className="py-2 px-5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-orange-600/10 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    id="instant-apply-submit-btn"
                  >
                    {instantLoading ? 'Applying...' : 'Apply Immediately'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
