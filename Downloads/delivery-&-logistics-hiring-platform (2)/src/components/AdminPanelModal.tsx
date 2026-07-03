import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ShieldAlert, Plus, Users, Briefcase, CheckCircle2, RefreshCw, Sparkles, Building2, User, Key, Phone, Mail, FileText, Check, HelpCircle, MapPin, IndianRupee, Trash2 } from 'lucide-react';
import { Recruiter } from '../types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobPosted?: () => void;
}

export default function AdminPanelModal({ isOpen, onClose, onJobPosted }: AdminPanelModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'recruiters' | 'post-job' | 'delivery-man'>('recruiters');
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Recruiter form state
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('JobHai2026!');

  // Job form state
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobCategory, setJobCategory] = useState('Cargo Delivery');
  const [openings, setOpenings] = useState('5');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [state, setState] = useState('Maharashtra');
  const [city, setCity] = useState('Mumbai');
  const [area, setArea] = useState('Andheri East');
  const [workLocation, setWorkLocation] = useState('On-site');
  const [minSalary, setMinSalary] = useState('25000');
  const [maxSalary, setMaxSalary] = useState('40000');
  const [salaryType, setSalaryType] = useState('Monthly');
  const [shift, setShift] = useState('Day Shift');
  const [experienceRequired, setExperienceRequired] = useState('1');
  const [educationRequired, setEducationRequired] = useState('10th Pass or below');
  const [genderPreference, setGenderPreference] = useState('No Preference');
  const [ageLimitMin, setAgeLimitMin] = useState('18');
  const [ageLimitMax, setAgeLimitMax] = useState('45');
  const [bikeRequired, setBikeRequired] = useState('No');
  const [drivingLicenseRequired, setDrivingLicenseRequired] = useState('Commercial (HMV)');
  const [immediateJoining, setImmediateJoining] = useState('Yes');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [benefits, setBenefits] = useState('');

  // Delivery Man (Candidate) Form State
  const [candName, setCandName] = useState('');
  const [candMobile, setCandMobile] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candAge, setCandAge] = useState('24');
  const [candGender, setCandGender] = useState('Male Only');
  const [candPincode, setCandPincode] = useState('400059');
  const [candExperience, setCandExperience] = useState('2');
  const [candEducation, setCandEducation] = useState('12th Pass');
  const [candBike, setCandBike] = useState('Yes');
  const [candLicense, setCandLicense] = useState('Two Wheeler');

  // Linking State
  const [selectedLinkCandidateId, setSelectedLinkCandidateId] = useState('');
  const [selectedLinkJobId, setSelectedLinkJobId] = useState('');

  const fetchRecruiters = async () => {
    try {
      const res = await fetch('/api/admin/recruiters');
      if (res.ok) {
        const data = await res.json();
        setRecruiters(data);
        if (data.length > 0 && !selectedRecruiterId) {
          setSelectedRecruiterId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching recruiters:', err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/admin/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        if (data.length > 0 && !selectedLinkJobId) {
          setSelectedLinkJobId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/admin/candidates');
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
        if (data.length > 0 && !selectedLinkCandidateId) {
          setSelectedLinkCandidateId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/admin/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchRecruiters(), fetchJobs(), fetchCandidates(), fetchApplications()]);
    } catch (err: any) {
      setError('Failed to refresh administrative tables.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecruiter = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this recruiter? This will also remove all of their job posts and applicant entries.')) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/recruiters/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete recruiter.');
      setSuccess('Recruiter and all associated postings deleted successfully.');
      refreshAllData();
      if (onJobPosted) onJobPosted();
    } catch (err: any) {
      setError(err.message || 'Error deleting recruiter.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this candidate? This will also delete all of their job application entries.')) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/candidates/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete candidate.');
      setSuccess('Delivery candidate and their application history deleted successfully.');
      refreshAllData();
      if (onJobPosted) onJobPosted();
    } catch (err: any) {
      setError(err.message || 'Error deleting candidate.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this candidate\'s interest link?')) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove interest application.');
      setSuccess('Job interest application link deleted successfully.');
      refreshAllData();
      if (onJobPosted) onJobPosted();
    } catch (err: any) {
      setError(err.message || 'Error deleting application link.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAllData();
      setSuccess(null);
    }
  }, [isOpen]);

  const handleCreateRecruiter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/recruiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, contactPerson, email, mobile, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create recruiter.');
      }

      setSuccess(`Success! Created Recruiter account for "${data.recruiter.companyName}" (Approved).`);
      setCompanyName('');
      setContactPerson('');
      setEmail('');
      setMobile('');
      
      refreshAllData();
    } catch (err: any) {
      setError(err.message || 'Error creating recruiter.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedRecruiterId) {
      setError('Please select or create a recruiter first!');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterId: selectedRecruiterId,
          title: jobTitle,
          category: jobCategory,
          openings: Number(openings),
          employmentType,
          state,
          city,
          area,
          workLocation,
          minSalary: Number(minSalary),
          maxSalary: Number(maxSalary),
          salaryType,
          shift,
          experienceRequired: Number(experienceRequired),
          educationRequired,
          genderPreference,
          ageLimitMin: Number(ageLimitMin),
          ageLimitMax: Number(ageLimitMax),
          bikeRequired,
          drivingLicenseRequired,
          immediateJoining,
          description,
          responsibilities,
          benefits,
          status: 'Published'
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post job.');
      }

      setSuccess(`Successfully posted job "${data.job.title}" under ${data.job.companyName}!`);
      
      setJobTitle('');
      setDescription('');
      setResponsibilities('');
      setBenefits('');

      refreshAllData();

      if (onJobPosted) {
        onJobPosted();
      }
    } catch (err: any) {
      setError(err.message || 'Error posting job.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: candName,
          mobile: candMobile,
          email: candEmail || undefined,
          age: candAge,
          gender: candGender,
          pincode: candPincode,
          experience: candExperience,
          education: candEducation,
          bikeAvailable: candBike,
          drivingLicenseAvailable: candLicense
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create candidate profile.');
      }

      setSuccess(`Successfully registered Delivery Man: "${data.candidate.fullName}"! Details are fully active.`);
      setCandName('');
      setCandMobile('');
      setCandEmail('');

      refreshAllData();
    } catch (err: any) {
      setError(err.message || 'Error creating delivery person profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedLinkCandidateId || !selectedLinkJobId) {
      setError('Please select both a candidate and a job opening.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: selectedLinkCandidateId,
          jobId: selectedLinkJobId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link candidate interest.');
      }

      setSuccess(`Successfully linked Delivery Man interest data! Recruiter will see this application instantly on their dashboard.`);
      refreshAllData();

      if (onJobPosted) {
        onJobPosted();
      }
    } catch (err: any) {
      setError(err.message || 'Error saving interest data.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomCandidate = () => {
    const names = [
      { name: 'Ramesh Kumar', gender: 'Male Only', email: 'ramesh.k@gmail.com' },
      { name: 'Sanjay Yadav', gender: 'Male Only', email: 'sanjay.y@hotmail.com' },
      { name: 'Karan Singh', gender: 'Male Only', email: 'karan.singh@outlook.com' },
      { name: 'Arjun Patil', gender: 'Male Only', email: 'arjun.patil@yahoo.com' },
      { name: 'Deepak Rao', gender: 'Male Only', email: 'deepak.rao@gmail.com' },
      { name: 'Anjali Verma', gender: 'Female Only', email: 'anjali.v@gmail.com' },
      { name: 'Priya Sharma', gender: 'Female Only', email: 'priya.s@gmail.com' },
      { name: 'Siddharth Gupta', gender: 'No Preference', email: 'sid.gupta@gmail.com' }
    ];

    const chosen = names[Math.floor(Math.random() * names.length)];
    const randomMobile = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
    const randomAge = (19 + Math.floor(Math.random() * 20)).toString();
    const randomPincode = (400001 + Math.floor(Math.random() * 95)).toString();
    const randomExp = Math.floor(Math.random() * 5).toString();

    const edus = ['10th Pass or below', '12th Pass', 'Diploma', 'Graduate'];
    const randomEdu = edus[Math.floor(Math.random() * edus.length)];

    const bikeOpts = ['Yes', 'No'];
    const randomBike = bikeOpts[Math.floor(Math.random() * bikeOpts.length)];

    const licOpts = ['Two Wheeler', 'Commercial (HMV)', 'LMV (Car)', 'None'];
    const randomLic = licOpts[Math.floor(Math.random() * licOpts.length)];

    setCandName(chosen.name);
    setCandMobile(randomMobile);
    setCandEmail(chosen.email);
    setCandAge(randomAge);
    setCandGender(chosen.gender === 'No Preference' ? 'Male Only' : chosen.gender);
    setCandPincode(randomPincode);
    setCandExperience(randomExp);
    setCandEducation(randomEdu);
    setCandBike(randomBike);
    setCandLicense(randomLic);
  };

  const loadJobTemplate = (type: 'driver' | 'loader' | 'rider') => {
    if (type === 'driver') {
      setJobTitle('Heavy Cargo Truck Driver (Interstate)');
      setJobCategory('Cargo Delivery');
      setOpenings('6');
      setEmploymentType('Full-time');
      setWorkLocation('On-site');
      setMinSalary('30000');
      setMaxSalary('45000');
      setSalaryType('Monthly');
      setShift('Flexible');
      setExperienceRequired('3');
      setEducationRequired('10th Pass or below');
      setGenderPreference('Male Only');
      setAgeLimitMin('21');
      setAgeLimitMax('50');
      setBikeRequired('No');
      setDrivingLicenseRequired('Commercial (HMV)');
      setImmediateJoining('Yes');
      setDescription('Seeking an experienced heavy cargo transport operator for multi-state logistical deliveries. Responsible for maintaining road-log manifests and safe driving protocols.');
      setResponsibilities('Drive long-haul heavy trailer vehicles across commercial highway networks safely. Secure delivery loads, inspect cargo containers, and record logbook entries.');
      setBenefits('Interstate trip allowances, medical insurance cover, safe-driving mileage bonuses, and free company lodgings.');
    } else if (type === 'loader') {
      setJobTitle('Cargo Loading Specialist & Handler');
      setJobCategory('Warehouse Logistics');
      setOpenings('12');
      setEmploymentType('Full-time');
      setWorkLocation('On-site');
      setMinSalary('18000');
      setMaxSalary('24000');
      setSalaryType('Monthly');
      setShift('Night Shift');
      setExperienceRequired('0');
      setEducationRequired('10th Pass or below');
      setGenderPreference('No Preference');
      setAgeLimitMin('18');
      setAgeLimitMax('35');
      setBikeRequired('No');
      setDrivingLicenseRequired('None');
      setImmediateJoining('Yes');
      setDescription('Urgent hiring for physical sorting, cataloging, and loading assistants at our central transit freight yard. Physical fitness and punctuality are required.');
      setResponsibilities('Load and unload physical cargo pallets manually or with manual lifts. Cross-reference packaging barcodes with transit route registers.');
      setBenefits('Overtime shift premiums, performance safety incentives, and free training certifications.');
    } else if (type === 'rider') {
      setJobTitle('E-Commerce Delivery Rider (Last-Mile)');
      setJobCategory('Last-Mile Delivery');
      setOpenings('15');
      setEmploymentType('Part-time');
      setWorkLocation('On-site');
      setMinSalary('15000');
      setMaxSalary('25000');
      setSalaryType('Monthly');
      setShift('Day Shift');
      setExperienceRequired('1');
      setEducationRequired('12th Pass');
      setGenderPreference('No Preference');
      setAgeLimitMin('18');
      setAgeLimitMax('40');
      setBikeRequired('Yes');
      setDrivingLicenseRequired('Two Wheeler');
      setImmediateJoining('Yes');
      setDescription('Deliver consumer cargo packages to residential addresses within local municipal sectors. High efficiency routes optimized by JobHai maps.');
      setResponsibilities('Collect delivery parcels from local hub. Ride safely to customers and confirm deliveries via recipient signatures on the portal app.');
      setBenefits('Per-delivery petrol fuel allowances, flexible weekly timetables, and top-tier app routing equipment.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="admin-panel-modal">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-5xl w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                  JobHai Master Admin Panel
                  <span className="text-[10px] font-black uppercase bg-orange-600 px-2 py-0.5 rounded-full text-white animate-pulse">Developer Mode</span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">Instantly add corporate recruiters, publish jobs, and seed delivery man job interest applications directly.</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub Navigation */}
          <div className="bg-slate-50 border-b border-slate-150 flex flex-wrap px-6 py-2 gap-2">
            <button
              onClick={() => { setActiveSubTab('recruiters'); setSuccess(null); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'recruiters' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Recruiters ({recruiters.length})
            </button>
            <button
              onClick={() => { setActiveSubTab('post-job'); setSuccess(null); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'post-job' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Direct Job Posting Tool
            </button>
            <button
              onClick={() => { setActiveSubTab('delivery-man'); setSuccess(null); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'delivery-man' 
                  ? 'bg-orange-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Delivery Man Interest Data ({candidates.length})
            </button>
          </div>

          {/* Main Body */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            
            {/* Notifications */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-150 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{success}</span>
              </div>
            )}

            {activeSubTab === 'recruiters' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 border border-slate-150 rounded-2xl">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">Recruiter Fleet Directory</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Manage existing recruitment agencies or instantly seed a verified partner with one click.</p>
                  </div>
                  <button
                    onClick={refreshAllData}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Directory
                  </button>
                </div>

                <div className="bg-white border border-slate-150 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <Users className="w-4 h-4 text-orange-500" />
                      Existing Corporate Fleets
                    </h4>

                    {recruiters.length === 0 ? (
                      <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl text-slate-400">
                        <p className="text-xs font-extrabold uppercase">No Recruiters Found</p>
                        <p className="text-[10px] mt-1">There are no recruiter accounts registered in the system database.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                        {recruiters.map((r) => (
                          <div 
                            key={r.id} 
                            className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs transition-all"
                          >
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-800 truncate">{r.companyName}</p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-semibold">
                                <span>{r.contactPerson}</span>
                                <span>•</span>
                                <span>{r.email}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {r.status}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecruiter(r.id)}
                                disabled={isLoading}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Delete Recruiter"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 font-medium leading-normal mt-3">
                    💡 <strong>JobHai Fleet System:</strong> All registered recruiter accounts automatically skip screening stages. You can post job openings on their behalf immediately.
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'post-job' && (
              <form onSubmit={handlePostJob} className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wide">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    Instant Job Templates
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Click any job role preset below to prefill standard operational criteria automatically:</p>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => loadJobTemplate('driver')}
                      className="px-3.5 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100/80 text-amber-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      🚚 Interstate Heavy Trucker Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => loadJobTemplate('loader')}
                      className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100/80 text-indigo-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      📦 Transit Yard Freight Handler Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => loadJobTemplate('rider')}
                      className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/80 text-emerald-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      🛵 E-Commerce Delivery Rider Preset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Target Recruiter Company</label>
                      <select
                        required
                        value={selectedRecruiterId}
                        onChange={(e) => setSelectedRecruiterId(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-bold text-slate-800 cursor-pointer"
                      >
                        <option value="">-- Select Recruiter --</option>
                        {recruiters.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.companyName} (Managed by {r.contactPerson})
                          </option>
                        ))}
                      </select>
                      {recruiters.length === 0 && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ Please create a recruiter account first!</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Job Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Last-Mile Delivery Associate"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-bold text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Category</label>
                        <select
                          value={jobCategory}
                          onChange={(e) => setJobCategory(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="Cargo Delivery">Cargo Delivery</option>
                          <option value="Warehouse Logistics">Warehouse Logistics</option>
                          <option value="Last-Mile Delivery">Last-Mile Delivery</option>
                          <option value="Fleet Management">Fleet Management</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">No. of Openings</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={openings}
                          onChange={(e) => setOpenings(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Job Type</label>
                        <select
                          value={employmentType}
                          onChange={(e) => setEmploymentType(e.target.value)}
                          className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="Full-time">Full-time</option>
                          <option value="Part-time">Part-time</option>
                          <option value="Contract">Contract</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Location Style</label>
                        <select
                          value={workLocation}
                          onChange={(e) => setWorkLocation(e.target.value)}
                          className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="On-site">On-site</option>
                          <option value="Hybrid">Hybrid</option>
                          <option value="Remote">Remote</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Joining</label>
                        <select
                          value={immediateJoining}
                          onChange={(e) => setImmediateJoining(e.target.value)}
                          className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="Yes">Immediate</option>
                          <option value="No">15-30 Days</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">State</label>
                        <input
                          type="text"
                          required
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">City</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Area</label>
                        <input
                          type="text"
                          required
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Min Salary</label>
                        <input
                          type="number"
                          required
                          value={minSalary}
                          onChange={(e) => setMinSalary(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Max Salary</label>
                        <input
                          type="number"
                          required
                          value={maxSalary}
                          onChange={(e) => setMaxSalary(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Salary Base</label>
                        <select
                          value={salaryType}
                          onChange={(e) => setSalaryType(e.target.value)}
                          className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="Monthly">Monthly</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Per Delivery">Per Delivery</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Experience Required</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={experienceRequired}
                          onChange={(e) => setExperienceRequired(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Education</label>
                        <select
                          value={educationRequired}
                          onChange={(e) => setEducationRequired(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="10th Pass or below">10th Pass or below</option>
                          <option value="12th Pass">12th Pass</option>
                          <option value="Diploma">Diploma</option>
                          <option value="Graduate">Graduate</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Driving License</label>
                        <select
                          value={drivingLicenseRequired}
                          onChange={(e) => setDrivingLicenseRequired(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="Commercial (HMV)">Commercial (HMV)</option>
                          <option value="Two Wheeler">Two Wheeler</option>
                          <option value="LMV (Car)">LMV (Car)</option>
                          <option value="None">None</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Requires Own Bike?</label>
                        <select
                          value={bikeRequired}
                          onChange={(e) => setBikeRequired(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Gender Preference</label>
                        <select
                          value={genderPreference}
                          onChange={(e) => setGenderPreference(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="No Preference">No Preference</option>
                          <option value="Male Only">Male Only</option>
                          <option value="Female Only">Female Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Shift</label>
                        <select
                          value={shift}
                          onChange={(e) => setShift(e.target.value)}
                          className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        >
                          <option value="Day Shift">Day Shift</option>
                          <option value="Night Shift">Night Shift</option>
                          <option value="Rotational">Rotational</option>
                          <option value="Flexible">Flexible</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Job Description</label>
                      <textarea
                        required
                        placeholder="Outline duties, locations, load specifications..."
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-medium text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Responsibilities</label>
                      <textarea
                        required
                        placeholder="e.g. Ensure cargo is fully strapped down, complete daily delivery schedules..."
                        rows={2}
                        value={responsibilities}
                        onChange={(e) => setResponsibilities(e.target.value)}
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-medium text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Benefits</label>
                      <textarea
                        required
                        placeholder="e.g. Health coverage, weekly mileage bonuses, provident fund..."
                        rows={2}
                        value={benefits}
                        onChange={(e) => setBenefits(e.target.value)}
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-medium text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || recruiters.length === 0}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-slate-900/10"
                  >
                    {isLoading ? 'Posting...' : '🚀 Post Job Opening'}
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'delivery-man' && (
              <div className="space-y-8">
                
                {/* Intro details */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-orange-50 border border-orange-200 p-4 rounded-2xl">
                  <div>
                    <h3 className="text-sm font-extrabold text-orange-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-orange-600 animate-bounce" />
                      Add Job-Interested Delivery Personnel
                    </h3>
                    <p className="text-xs text-orange-800 mt-0.5">
                      Bypass-register delivery drivers & riders. Instantly connect them to any recruiter's active job listing below to simulate active candidate applications!
                    </p>
                  </div>
                  <button
                    onClick={refreshAllData}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-orange-200 hover:bg-orange-50 text-orange-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Tables
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Register delivery man */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-orange-500" />
                        Register Candidate Profile
                      </h4>
                      <button
                        type="button"
                        onClick={generateRandomCandidate}
                        className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-1 rounded-md transition-all cursor-pointer"
                      >
                        ⚡ Random Preset Generator
                      </button>
                    </div>

                    <form onSubmit={handleCreateCandidate} className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="Ramesh Kumar"
                            value={candName}
                            onChange={(e) => setCandName(e.target.value)}
                            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-medium text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Mobile No. (10 digits)</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              required
                              placeholder="9876543210"
                              value={candMobile}
                              onChange={(e) => setCandMobile(e.target.value)}
                              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-medium text-slate-800"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Email (Optional)</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                              type="email"
                              placeholder="ramesh@gmail.com"
                              value={candEmail}
                              onChange={(e) => setCandEmail(e.target.value)}
                              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-hidden font-medium text-slate-800"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Age</label>
                          <input
                            type="number"
                            required
                            min="18"
                            max="60"
                            value={candAge}
                            onChange={(e) => setCandAge(e.target.value)}
                            className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Gender</label>
                          <select
                            value={candGender}
                            onChange={(e) => setCandGender(e.target.value)}
                            className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                          >
                            <option value="Male Only">Male</option>
                            <option value="Female Only">Female</option>
                            <option value="No Preference">No Preference</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Pincode</label>
                          <input
                            type="text"
                            required
                            placeholder="400001"
                            value={candPincode}
                            onChange={(e) => setCandPincode(e.target.value)}
                            className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Experience (Yrs)</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={candExperience}
                            onChange={(e) => setCandExperience(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Education Level</label>
                          <select
                            value={candEducation}
                            onChange={(e) => setCandEducation(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                          >
                            <option value="10th Pass or below">10th Pass or below</option>
                            <option value="12th Pass">12th Pass</option>
                            <option value="Diploma">Diploma</option>
                            <option value="Graduate">Graduate</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Owns Bike?</label>
                          <select
                            value={candBike}
                            onChange={(e) => setCandBike(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Driving License</label>
                          <select
                            value={candLicense}
                            onChange={(e) => setCandLicense(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                          >
                            <option value="Two Wheeler">Two Wheeler</option>
                            <option value="Commercial (HMV)">Commercial (HMV)</option>
                            <option value="LMV (Car)">LMV (Car)</option>
                            <option value="None">None</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-xs"
                      >
                        {isLoading ? 'Creating...' : '➕ Register Delivery Candidate'}
                      </button>
                    </form>
                  </div>

                  {/* Connect / Submit Job Interest Application */}
                  <div className="space-y-6">
                    
                    {/* Link Form */}
                    <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                      <h4 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-orange-400" />
                        Inject Recruiter Job Interest (Apply)
                      </h4>

                      <form onSubmit={handleLinkInterest} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">1. Choose Delivery Candidate</label>
                          <select
                            required
                            value={selectedLinkCandidateId}
                            onChange={(e) => setSelectedLinkCandidateId(e.target.value)}
                            className="w-full text-xs px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:border-orange-500 focus:outline-hidden font-bold text-white cursor-pointer"
                          >
                            <option value="">-- Choose Candidate --</option>
                            {candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.fullName} ({c.mobile}) - {c.profile?.drivingLicenseAvailable || 'No License'}
                              </option>
                            ))}
                          </select>
                          {candidates.length === 0 && (
                            <p className="text-[10px] text-red-400 font-semibold mt-1">⚠️ Please create a delivery man candidate first!</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">2. Select Recruiter Job Opening</label>
                          <select
                            required
                            value={selectedLinkJobId}
                            onChange={(e) => setSelectedLinkJobId(e.target.value)}
                            className="w-full text-xs px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:border-orange-500 focus:outline-hidden font-bold text-white cursor-pointer"
                          >
                            <option value="">-- Choose Job Opening --</option>
                            {jobs.map((j) => (
                              <option key={j.id} value={j.id}>
                                [{j.companyName}] {j.title} ({j.city})
                              </option>
                            ))}
                          </select>
                          {jobs.length === 0 && (
                            <p className="text-[10px] text-red-400 font-semibold mt-1">⚠️ No job listings posted yet. Post a job first!</p>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading || candidates.length === 0 || jobs.length === 0}
                          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-orange-500/25"
                        >
                          {isLoading ? 'Linking interest...' : '⚡ Submit Candidate Interest!'}
                        </button>
                      </form>
                    </div>

                    {/* Quick Database Status Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-600 font-medium">
                      <p className="font-extrabold text-slate-800 flex items-center gap-1 uppercase text-[10px] tracking-wide">
                        <Users className="w-4 h-4 text-orange-500" />
                        Active Database Registries
                      </p>
                      <div className="grid grid-cols-3 gap-3 pt-1 text-center font-bold">
                        <div className="bg-white border border-slate-200 p-2 rounded-xl">
                          <span className="block text-lg text-slate-900">{recruiters.length}</span>
                          <span className="text-[9px] text-slate-400 font-black uppercase">Fleets</span>
                        </div>
                        <div className="bg-white border border-slate-200 p-2 rounded-xl">
                          <span className="block text-lg text-slate-900">{jobs.length}</span>
                          <span className="text-[9px] text-slate-400 font-black uppercase">Jobs</span>
                        </div>
                        <div className="bg-white border border-slate-200 p-2 rounded-xl">
                          <span className="block text-lg text-slate-900">{candidates.length}</span>
                          <span className="text-[9px] text-slate-400 font-black uppercase">Delivery Men</span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Dual pools at bottom */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Candidates List table */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-3 shadow-xs flex flex-col h-[320px]">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                      <Users className="w-4 h-4 text-orange-500" />
                      Delivery Personnel Pool ({candidates.length})
                    </h4>

                    {candidates.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-center py-8 text-slate-400 text-xs">
                        No delivery men registered in the database yet. Click "Random Preset Generator" above to instantly build one!
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                        {candidates.map((c) => (
                          <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-300 transition-all">
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-800 truncate">{c.fullName}</p>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{c.mobile} • {c.profile?.age} Yrs • {c.profile?.gender === 'Male Only' ? 'Male' : c.profile?.gender === 'Female Only' ? 'Female' : 'No Preference'}</p>
                              <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] font-extrabold">
                                <span className="px-1 py-0.5 rounded-md bg-slate-200 text-slate-700">📍 Pin {c.profile?.pincode}</span>
                                <span className="px-1 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-100">🏍️ {c.profile?.bikeAvailable}</span>
                                <span className="px-1 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">🪪 {c.profile?.drivingLicenseAvailable || 'None'}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCandidate(c.id)}
                              disabled={isLoading}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
                              title="Delete Candidate"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Active Job Interest Links table */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-3 shadow-xs flex flex-col h-[320px]">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                      <Briefcase className="w-4 h-4 text-orange-500" />
                      Delivery Man Interest Data ({applications.length})
                    </h4>

                    {applications.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-center py-8 text-slate-400 text-xs">
                        No job interest applications linked yet. Inject an interest link using the form above!
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                        {applications.map((app) => (
                          <div key={app.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-300 transition-all">
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-800 truncate">{app.candidateName}</p>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{app.candidateMobile}</p>
                              <div className="mt-1.5 text-[10px] font-bold text-slate-700 flex items-center gap-1">
                                <span className="text-orange-600 font-extrabold shrink-0">Interested in:</span>
                                <span className="truncate">[{app.companyName}] {app.jobTitle}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteApplication(app.id)}
                              disabled={isLoading}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
                              title="Delete Interest Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Footer stats */}
          <div className="bg-slate-50 border-t border-slate-150 p-4 flex items-center justify-between text-[10px] text-slate-500 font-bold px-6">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Direct Data Injection Active
            </span>
            <span>JobHai v3.2.0-master</span>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
