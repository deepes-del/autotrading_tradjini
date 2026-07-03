import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, User, MapPin, Mail, Phone, LogOut, CheckCircle, 
  Clock, ShieldAlert, AlertOctagon, Briefcase, ChevronRight, 
  LayoutDashboard, Settings, FileText, Send, HelpCircle, 
  Upload, Globe, Trash2, Edit2, Check, RefreshCw, X, Plus, Truck,
  Eye, Copy, Search, Filter, Calendar, FileMinus
} from 'lucide-react';
import { Recruiter } from '../types';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, BarChart, Bar, Cell, Legend
} from 'recharts';

interface RecruiterDashboardProps {
  recruiter: Recruiter;
  token: string;
  onLogout: () => void;
  onProfileUpdated: (updated: Recruiter) => void;
}

type TabType = 'dashboard' | 'profile' | 'jobs' | 'applications' | 'settings';

export default function RecruiterDashboard({ 
  recruiter, 
  token, 
  onLogout, 
  onProfileUpdated 
}: RecruiterDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Form states for profile editor
  const [companyName, setCompanyName] = useState(recruiter.companyName);
  const [companyLogo, setCompanyLogo] = useState(recruiter.companyLogo || '');
  const [companyWebsite, setCompanyWebsite] = useState(recruiter.companyWebsite || '');
  const [recruiterName, setRecruiterName] = useState(recruiter.recruiterName);
  const [designation, setDesignation] = useState(recruiter.designation);
  const [mobile, setMobile] = useState(recruiter.mobile);
  const [email, setEmail] = useState(recruiter.email);
  const [address, setAddress] = useState(recruiter.address);
  const [city, setCity] = useState(recruiter.city);
  const [state, setState] = useState(recruiter.state);
  const [pincode, setPincode] = useState(recruiter.pincode);
  const [logoUploading, setLogoUploading] = useState(false);
  const [approving, setApproving] = useState(false);

  // Jobs management states
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [viewingJob, setViewingJob] = useState<any | null>(null); // For "View" action
  
  // Job form inputs
  const [jobTitle, setJobTitle] = useState('');
  const [jobCategory, setJobCategory] = useState('Last-Mile Delivery');
  const [jobOpenings, setJobOpenings] = useState('1');
  const [jobEmploymentType, setJobEmploymentType] = useState<'Full Time' | 'Part Time' | 'Contract' | 'Temporary'>('Full Time');
  
  // Location
  const [jobState, setJobState] = useState('');
  const [jobCity, setJobCity] = useState('');
  const [jobArea, setJobArea] = useState('');
  const [jobWorkLocation, setJobWorkLocation] = useState('');
  
  // Salary
  const [jobMinSalary, setJobMinSalary] = useState('');
  const [jobMaxSalary, setJobMaxSalary] = useState('');
  const [jobSalaryType, setJobSalaryType] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  
  // Job Details / Requirements
  const [jobShift, setJobShift] = useState<'Day' | 'Night' | 'Rotational'>('Day');
  const [jobExperience, setJobExperience] = useState('0');
  const [jobEducation, setJobEducation] = useState('10th Pass');
  const [jobGenderPreference, setJobGenderPreference] = useState<'Male' | 'Female' | 'Any'>('Any');
  const [jobAgeLimitMin, setJobAgeLimitMin] = useState('18');
  const [jobAgeLimitMax, setJobAgeLimitMax] = useState('45');
  const [jobBikeRequired, setJobBikeRequired] = useState<'Yes' | 'No'>('No');
  const [jobDrivingLicense, setJobDrivingLicense] = useState<'Yes' | 'No'>('No');
  const [jobImmediateJoining, setJobImmediateJoining] = useState<'Yes' | 'No'>('No');
  
  // Description, Responsibilities & Benefits
  const [jobDescription, setJobDescription] = useState('');
  const [jobResponsibilities, setJobResponsibilities] = useState('');
  const [jobBenefits, setJobBenefits] = useState('');
  
  const [submittingJob, setSubmittingJob] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'Draft' | 'Published'>('Published');

  // Recruiter Applications Management States
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedAppDetail, setSelectedAppDetail] = useState<any | null>(null);
  const [loadingAppDetail, setLoadingAppDetail] = useState(false);
  
  // Notes and Status states
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Interview Schedule Dialog
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');

  // Application Filters & Search
  const [appFilterJob, setAppFilterJob] = useState('All');
  const [appFilterStatus, setAppFilterStatus] = useState('All');
  const [appFilterDate, setAppFilterDate] = useState('All'); // 'All' | 'Today' | 'Last 7 Days' | 'Last 30 Days'
  const [appFilterCity, setAppFilterCity] = useState('All');
  const [appFilterExperience, setAppFilterExperience] = useState('All'); // 'All' | 'Freshers' | '1-2 Years' | '3+ Years'
  const [appSearch, setAppSearch] = useState('');

  // Filters & Search for Jobs
  const [filterStatus, setFilterStatus] = useState<string>('All'); // 'All' | 'Active' | 'Draft' | 'Closed' | 'Published'
  const [searchTitle, setSearchTitle] = useState<string>('');
  const [searchCity, setSearchCity] = useState<string>('');

  const fetchApplications = async () => {
    setLoadingApps(true);
    try {
      const response = await fetch('/api/recruiter/applications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const fetchAppDetail = async (id: string) => {
    setLoadingAppDetail(true);
    try {
      const response = await fetch(`/api/recruiter/applications/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setSelectedAppDetail(data);
      } else {
        setError(data.error || 'Failed to fetch application details.');
      }
    } catch (err) {
      console.error('Error fetching application detail:', err);
      setError('Server error fetching application details.');
    } finally {
      setLoadingAppDetail(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdatingStatus(newStatus);
    try {
      const response = await fetch(`/api/recruiter/applications/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(`Status updated to ${newStatus} successfully!`);
        // Refresh detail
        fetchAppDetail(id);
        // Refresh master list
        fetchApplications();
        // Clear message after timeout
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to update status.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Server error updating status.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleAddNote = async (id: string) => {
    if (!noteText.trim()) return;
    setSubmittingNote(true);
    try {
      const response = await fetch(`/api/recruiter/applications/${id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ noteText })
      });
      const data = await response.json();
      if (response.ok) {
        setNoteText('');
        setSuccess('Private note added!');
        fetchAppDetail(id);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to add note.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Server error adding note.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSubmittingNote(false);
    }
  };

  // Compute filtered applications list
  const filteredApplications = applications.filter((app) => {
    // Search filter (name or mobile)
    if (appSearch) {
      const q = appSearch.toLowerCase();
      const nameMatch = app.candidateName?.toLowerCase().includes(q);
      const mobileMatch = app.candidateMobile?.toLowerCase().includes(q);
      if (!nameMatch && !mobileMatch) return false;
    }

    // Job filter
    if (appFilterJob !== 'All' && app.jobId !== appFilterJob) {
      return false;
    }

    // Status filter
    if (appFilterStatus !== 'All' && app.currentStatus !== appFilterStatus) {
      return false;
    }

    // City filter
    if (appFilterCity !== 'All' && app.candidateCity !== appFilterCity) {
      return false;
    }

    // Experience filter
    if (appFilterExperience !== 'All') {
      const exp = app.candidateExperience || 0;
      if (appFilterExperience === 'Freshers' && exp !== 0) return false;
      if (appFilterExperience === '1-2 Years' && (exp < 1 || exp > 2)) return false;
      if (appFilterExperience === '3+ Years' && exp < 3) return false;
    }

    // Date filter
    if (appFilterDate !== 'All') {
      const appliedDate = new Date(app.appliedDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      if (appFilterDate === 'Today') {
        if (appliedDate < today) return false;
      } else if (appFilterDate === 'Last 7 Days') {
        const diffDays = (today.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (appFilterDate === 'Last 30 Days') {
        const diffDays = (today.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) return false;
      }
    }

    return true;
  });

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const response = await fetch('/api/recruiter/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  React.useEffect(() => {
    fetchJobs();
    fetchApplications();
  }, []);

  const handleJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verify recruiter is approved
    if (recruiter.status !== 'Approved') {
      setError('Access Denied. Only Approved recruiters can create or manage jobs.');
      return;
    }

    // Required fields validation
    if (
      !jobTitle.trim() ||
      !jobCategory.trim() ||
      !jobOpenings.trim() ||
      !jobEmploymentType ||
      !jobState.trim() ||
      !jobCity.trim() ||
      !jobArea.trim() ||
      !jobMinSalary.trim() ||
      !jobMaxSalary.trim() ||
      !jobSalaryType ||
      !jobShift ||
      !jobExperience.trim() ||
      !jobEducation.trim() ||
      !jobGenderPreference ||
      !jobAgeLimitMin.trim() ||
      !jobAgeLimitMax.trim() ||
      !jobBikeRequired ||
      !jobDrivingLicense ||
      !jobImmediateJoining ||
      !jobDescription.trim() ||
      !jobResponsibilities.trim() ||
      !jobBenefits.trim()
    ) {
      setError('Please fill in all required fields marked with *');
      return;
    }

    setSubmittingJob(true);
    setError(null);
    setSuccess(null);

    const jobData = {
      title: jobTitle.trim(),
      category: jobCategory.trim(),
      openings: Number(jobOpenings),
      employmentType: jobEmploymentType,
      state: jobState.trim(),
      city: jobCity.trim(),
      area: jobArea.trim(),
      workLocation: jobWorkLocation.trim(),
      minSalary: Number(jobMinSalary),
      maxSalary: Number(jobMaxSalary),
      salaryType: jobSalaryType,
      shift: jobShift,
      experienceRequired: Number(jobExperience),
      educationRequired: jobEducation.trim(),
      genderPreference: jobGenderPreference,
      ageLimitMin: Number(jobAgeLimitMin),
      ageLimitMax: Number(jobAgeLimitMax),
      bikeRequired: jobBikeRequired,
      drivingLicenseRequired: jobDrivingLicense,
      immediateJoining: jobImmediateJoining,
      description: jobDescription.trim(),
      responsibilities: jobResponsibilities.trim(),
      benefits: jobBenefits.trim(),
      status: editingJob ? editingJob.status : submitStatus // either 'Draft' or 'Published'
    };

    try {
      const url = editingJob 
        ? `/api/recruiter/jobs/${editingJob.id}`
        : '/api/recruiter/jobs';
      const method = editingJob ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(jobData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save job listing.');
      }

      setSuccess(editingJob ? 'Job updated successfully!' : `Job saved as ${submitStatus === 'Draft' ? 'Draft' : 'Published'} successfully!`);
      
      // Reset form fields
      setShowJobForm(false);
      setEditingJob(null);
      
      setJobTitle('');
      setJobCategory('Last-Mile Delivery');
      setJobOpenings('1');
      setJobEmploymentType('Full Time');
      setJobState('');
      setJobCity('');
      setJobArea('');
      setJobWorkLocation('');
      setJobMinSalary('');
      setJobMaxSalary('');
      setJobSalaryType('Monthly');
      setJobShift('Day');
      setJobExperience('0');
      setJobEducation('10th Pass');
      setJobGenderPreference('Any');
      setJobAgeLimitMin('18');
      setJobAgeLimitMax('45');
      setJobBikeRequired('No');
      setJobDrivingLicense('No');
      setJobImmediateJoining('No');
      setJobDescription('');
      setJobResponsibilities('');
      setJobBenefits('');
      
      // Refresh list
      fetchJobs();
    } catch (err: any) {
      setError(err.message || 'Error saving job.');
    } finally {
      setSubmittingJob(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (recruiter.status !== 'Approved') {
      setError('Access Denied. Only Approved recruiters can delete job listings.');
      return;
    }

    if (!window.confirm('Are you sure you want to permanently delete this job opening? This action is irreversible.')) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/recruiter/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setSuccess('Job deleted successfully.');
        fetchJobs();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete job.');
      }
    } catch (err) {
      console.error(err);
      setError('Error deleting job.');
    }
  };

  const handleToggleJobStatusDirect = async (jobId: string, newStatus: string) => {
    if (recruiter.status !== 'Approved') {
      setError('Access Denied. Only Approved recruiters can change job status.');
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/recruiter/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(`Job status updated to "${newStatus}" successfully.`);
        fetchJobs();
      } else {
        setError(data.error || 'Failed to update job status.');
      }
    } catch (err) {
      console.error(err);
      setError('Error changing job status.');
    }
  };

  const handleDuplicateJob = (job: any) => {
    if (recruiter.status !== 'Approved') {
      setError('Access Denied. Only Approved recruiters can duplicate job listings.');
      return;
    }

    setEditingJob(null);
    setJobTitle(`${job.title} (Copy)`);
    setJobCategory(job.category || 'Last-Mile Delivery');
    setJobOpenings(String(job.openings || 1));
    setJobEmploymentType(job.employmentType || 'Full Time');
    setJobState(job.state || '');
    setJobCity(job.city || '');
    setJobArea(job.area || '');
    setJobWorkLocation(job.workLocation || '');
    setJobMinSalary(String(job.minSalary || ''));
    setJobMaxSalary(String(job.maxSalary || ''));
    setJobSalaryType(job.salaryType || 'Monthly');
    setJobShift(job.shift || 'Day');
    setJobExperience(String(job.experienceRequired || '0'));
    setJobEducation(job.educationRequired || '10th Pass');
    setJobGenderPreference(job.genderPreference || 'Any');
    setJobAgeLimitMin(String(job.ageLimitMin || '18'));
    setJobAgeLimitMax(String(job.ageLimitMax || '45'));
    setJobBikeRequired(job.bikeRequired || 'No');
    setJobDrivingLicense(job.drivingLicenseRequired || 'No');
    setJobImmediateJoining(job.immediateJoining || 'No');
    setJobDescription(job.description || '');
    setJobResponsibilities(job.responsibilities || '');
    setJobBenefits(job.benefits || '');
    
    setShowJobForm(true);
    setSuccess('Job details duplicated! Review and publish/save below.');
  };

  const handleStartEditJob = (job: any) => {
    if (recruiter.status !== 'Approved') {
      setError('Access Denied. Only Approved recruiters can edit job listings.');
      return;
    }

    setEditingJob(job);
    setJobTitle(job.title);
    setJobCategory(job.category || 'Last-Mile Delivery');
    setJobOpenings(String(job.openings || '1'));
    setJobEmploymentType(job.employmentType || 'Full Time');
    setJobState(job.state || '');
    setJobCity(job.city || '');
    setJobArea(job.area || '');
    setJobWorkLocation(job.workLocation || '');
    setJobMinSalary(String(job.minSalary || ''));
    setJobMaxSalary(String(job.maxSalary || ''));
    setJobSalaryType(job.salaryType || 'Monthly');
    setJobShift(job.shift || 'Day');
    setJobExperience(String(job.experienceRequired || '0'));
    setJobEducation(job.educationRequired || '10th Pass');
    setJobGenderPreference(job.genderPreference || 'Any');
    setJobAgeLimitMin(String(job.ageLimitMin || '18'));
    setJobAgeLimitMax(String(job.ageLimitMax || '45'));
    setJobBikeRequired(job.bikeRequired || 'No');
    setJobDrivingLicense(job.drivingLicenseRequired || 'No');
    setJobImmediateJoining(job.immediateJoining || 'No');
    setJobDescription(job.description || '');
    setJobResponsibilities(job.responsibilities || '');
    setJobBenefits(job.benefits || '');
    
    setShowJobForm(true);
  };

  const handleDirectApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      const response = await fetch('/api/dev/approve-recruiter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: recruiter.id, status: 'Approved' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve recruiter account.');
      }
      onProfileUpdated(data.recruiter);
    } catch (err: any) {
      setError(err.message || 'Error auto-approving recruiter.');
    } finally {
      setApproving(false);
    }
  };

  // Handle Logo Upload in profile edit
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        setError('Logo must be a JPG, JPEG, or PNG image.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo size should be under 2MB.');
        return;
      }

      setLogoUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCompanyLogo(event.target?.result as string);
        setLogoUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to load logo image.');
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Profile Completion Calculation
  const getProfileCompletion = (r: Recruiter) => {
    const fields = [
      { name: 'companyName', filled: !!r.companyName },
      { name: 'companyLogo', filled: !!r.companyLogo },
      { name: 'companyWebsite', filled: !!r.companyWebsite },
      { name: 'recruiterName', filled: !!r.recruiterName },
      { name: 'designation', filled: !!r.designation },
      { name: 'mobile', filled: !!r.mobile },
      { name: 'email', filled: !!r.email },
      { name: 'address', filled: !!r.address },
      { name: 'city', filled: !!r.city },
      { name: 'state', filled: !!r.state },
      { name: 'pincode', filled: !!r.pincode },
    ];
    const filledCount = fields.filter(f => f.filled).length;
    return Math.round((filledCount / fields.length) * 100);
  };

  const completionPercent = getProfileCompletion(recruiter);

  // Profile Update Submission
  const handleProfileUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (
      !companyName.trim() ||
      !recruiterName.trim() ||
      !designation.trim() ||
      !mobile.trim() ||
      !email.trim() ||
      !address.trim() ||
      !city.trim() ||
      !state.trim() ||
      !pincode.trim()
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    setUpdating(true);

    try {
      const response = await fetch('/api/recruiter/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyLogo,
          companyWebsite: companyWebsite.trim(),
          recruiterName: recruiterName.trim(),
          designation: designation.trim(),
          mobile: mobile.trim(),
          email: email.trim().toLowerCase(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update recruiter profile.');
      }

      onProfileUpdated(data.recruiter);
      setSuccess('Enterprise Profile updated successfully!');
      
      // Auto scroll to top to see success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Error updating profile.');
    } finally {
      setUpdating(false);
    }
  };

  // --- RENDER APPROVAL SYSTEM ---
  // If status is NOT Approved, show a full screen status panel
  if (recruiter.status !== 'Approved') {
    return (
      <div className="w-full max-w-4xl mx-auto" id="recruiter-status-view">
        <div className="bg-white border border-gray-150 rounded-3xl p-8 sm:p-12 shadow-xl shadow-gray-100/40 text-center">
          
          <div className="max-w-md mx-auto">
            {/* Status Visuals */}
            {recruiter.status === 'Pending' && (
              <div className="w-20 h-20 bg-amber-50 border border-amber-100 rounded-3xl flex items-center justify-center text-amber-600 mx-auto mb-6 shadow-md shadow-amber-500/5">
                <Clock className="w-10 h-10 animate-pulse" />
              </div>
            )}
            {recruiter.status === 'Rejected' && (
              <div className="w-20 h-20 bg-red-50 border border-red-100 rounded-3xl flex items-center justify-center text-red-600 mx-auto mb-6 shadow-md shadow-red-500/5">
                <ShieldAlert className="w-10 h-10" />
              </div>
            )}
            {recruiter.status === 'Suspended' && (
              <div className="w-20 h-20 bg-zinc-100 border border-zinc-200 rounded-3xl flex items-center justify-center text-zinc-600 mx-auto mb-6 shadow-md">
                <AlertOctagon className="w-10 h-10" />
              </div>
            )}

            {/* Badges */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
              recruiter.status === 'Pending' 
                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                : recruiter.status === 'Rejected'
                  ? 'bg-red-50 text-red-700 border border-red-100'
                  : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}>
              Status: {recruiter.status}
            </span>

            {/* Messages */}
            <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-3">
              {recruiter.status === 'Pending' && 'Your account is pending admin approval'}
              {recruiter.status === 'Rejected' && 'Enterprise Registration Rejected'}
              {recruiter.status === 'Suspended' && 'Recruiter Profile Suspended'}
            </h1>

            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              {recruiter.status === 'Pending' && (
                "Your registration request has been submitted successfully. Our ShiftCargo administrator panel is currently reviewing your logistical corporate credentials. Your dashboard will unlock automatically once approved. Expected review time: 1-2 business days."
              )}
              {recruiter.status === 'Rejected' && (
                "Unfortunately, your enterprise registration has been declined by our safety and vetting board. ShiftCargo enforces high standards for logistics companies recruiting on our network. Please contact recruiters@shiftcargo.com if you would like to appeal."
              )}
              {recruiter.status === 'Suspended' && (
                "This corporate portal has been temporarily suspended due to a compliance infraction or safety audit mismatch. Please contact ShiftCargo Corporate Vetting at compliance@shiftcargo.com to submit a reinstatement application."
              )}
            </p>

            {/* Quick Profile Summary Display */}
            <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-150 text-left text-xs mb-8 space-y-2">
              <p className="font-bold text-gray-800 uppercase tracking-wider text-[10px] pb-1.5 border-b border-gray-200">Registered Corporate Data</p>
              <p className="flex justify-between text-gray-600"><span className="font-medium text-gray-400">Enterprise:</span> <span className="font-semibold text-gray-800">{recruiter.companyName}</span></p>
              <p className="flex justify-between text-gray-600"><span className="font-medium text-gray-400">Representative:</span> <span className="font-semibold text-gray-800">{recruiter.recruiterName} ({recruiter.designation})</span></p>
              <p className="flex justify-between text-gray-600"><span className="font-medium text-gray-400">Corporate Email:</span> <span className="font-semibold text-gray-800">{recruiter.email}</span></p>
              <p className="flex justify-between text-gray-600"><span className="font-medium text-gray-400">Mobile contact:</span> <span className="font-semibold text-gray-800">{recruiter.mobile}</span></p>
            </div>

            {/* Control buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={onLogout}
                className="w-full py-3 px-5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>

              {/* Dev Only Fast Track Tool */}
              <div className="mt-4 p-4 bg-orange-50/50 border border-orange-100 rounded-2xl text-left">
                <p className="text-[10px] font-extrabold text-orange-800 uppercase tracking-widest mb-1">Developer Sandbox Tool</p>
                <p className="text-xs text-gray-600 mb-3">Click below to instantly approve this recruiter account and unlock the recruiter dashboard for evaluation.</p>
                <button
                  onClick={handleDirectApprove}
                  disabled={approving}
                  className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {approving ? (
                    <React.Fragment>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Approving...
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <Check className="w-4 h-4" /> Instant Sandbox Approval
                    </React.Fragment>
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  }

  // --- FILTERED JOBS HELPER ---
  const filteredJobs = () => {
    return jobs.filter((job) => {
      // Filter status
      if (filterStatus !== 'All') {
        if (filterStatus === 'Active') {
          if (job.status !== 'Published' && job.status !== 'Active') return false;
        } else {
          if (job.status !== filterStatus) return false;
        }
      }
      // Search title
      if (searchTitle.trim() && !job.title.toLowerCase().includes(searchTitle.toLowerCase())) {
        return false;
      }
      // Search city
      const cityVal = job.city || job.location || '';
      if (searchCity.trim() && !cityVal.toLowerCase().includes(searchCity.toLowerCase())) {
        return false;
      }
      return true;
    });
  };

  // --- RENDER APPROVED DASHBOARD ---
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-8" id="recruiter-approved-dashboard">
      
      {/* Sidebar Controls (Responsive Desktop Panel) */}
      <aside className="w-full lg:w-64 shrink-0" id="recruiter-dashboard-sidebar">
        <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-6 sticky top-24 shadow-sm">
          
          {/* Header info */}
          <div className="flex items-center gap-3">
            {recruiter.companyLogo ? (
              <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                <img src={recruiter.companyLogo} alt={recruiter.companyName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
            )}
            <div className="truncate">
              <h4 className="font-bold text-gray-900 text-xs leading-tight truncate">{recruiter.companyName}</h4>
              <p className="text-[10px] text-gray-400 truncate mt-0.5">{recruiter.recruiterName}</p>
            </div>
          </div>

          {/* Navigation link array */}
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'profile', label: 'Company Profile', icon: Building2 },
              { id: 'jobs', label: 'Jobs', icon: Briefcase, badge: jobs.length ? String(jobs.length) : undefined },
              { id: 'applications', label: 'Applications', icon: FileText, badge: applications.length ? String(applications.length) : undefined },
              { id: 'settings', label: 'Settings', icon: Settings, badge: 'Soon' },
            ].map((item) => {
              const IconComp = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    active 
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-600/10' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <IconComp className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-extrabold tracking-wider uppercase ${
                      active ? 'bg-orange-700 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Sign Out */}
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 transition-all flex items-center gap-2.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-500" /> Sign Out
            </button>
          </div>

        </div>
      </aside>

      {/* Main Tab Content Panel */}
      <main className="flex-1" id="recruiter-dashboard-content-panel">
        
        {/* Banner Alert Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-100 flex items-start gap-2"
            >
              <span>⚠️ {error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-100 flex items-start gap-2"
            >
              <span>✓ {success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic renders based on Active Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Welcome Badge Card */}
              <div className="bg-white border border-gray-150 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm" id="recruiter-welcome-card">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    <CheckCircle className="w-3 h-3 text-emerald-600" /> Vetting Approved
                  </span>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-2.5">Welcome, {recruiter.recruiterName}!</h2>
                  <p className="text-xs text-gray-500 mt-1">{recruiter.designation} at <span className="font-semibold text-gray-800">{recruiter.companyName}</span></p>
                </div>

                {/* Profile Completion Panel */}
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shrink-0 min-w-[240px]">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Profile Completed</span>
                    <span className="text-xl font-extrabold text-gray-900 mt-0.5 block">{completionPercent}%</span>
                  </div>
                  <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-orange-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" id="recruiter-stats-grid">
                {[
                  { label: 'Total Jobs', value: jobs.length },
                  { 
                    label: 'Total Job Views', 
                    value: jobs.reduce((sum: number, j: any) => sum + (j.viewsCount || 0), 0),
                    onClick: () => {
                      setActiveTab('jobs');
                    }
                  },
                  { 
                    label: 'Total Applications', 
                    value: applications.length,
                    onClick: () => {
                      setAppFilterStatus('All');
                      setActiveTab('applications');
                    }
                  },
                  { 
                    label: 'Shortlisted', 
                    value: applications.filter((app: any) => app.currentStatus === 'Shortlisted').length,
                    onClick: () => {
                      setAppFilterStatus('Shortlisted');
                      setActiveTab('applications');
                    }
                  },
                  { 
                    label: 'Rejected', 
                    value: applications.filter((app: any) => app.currentStatus === 'Rejected').length,
                    onClick: () => {
                      setAppFilterStatus('Rejected');
                      setActiveTab('applications');
                    }
                  },
                  { 
                    label: 'Hired', 
                    value: applications.filter((app: any) => app.currentStatus === 'Hired').length,
                    onClick: () => {
                      setAppFilterStatus('Hired');
                      setActiveTab('applications');
                    }
                  },
                ].map((stat, idx) => (
                  <div 
                    key={idx} 
                    onClick={stat.onClick}
                    className={`bg-white border border-gray-150 rounded-2xl p-5 shadow-sm text-center ${stat.onClick ? 'cursor-pointer hover:border-orange-500 hover:shadow-md transition-all' : ''}`}
                  >
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block leading-tight">{stat.label}</span>
                    <span className="text-3xl font-black text-gray-900 mt-2.5 block">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Real-time Application Trends Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="recruiter-trends-section">
                {/* Chart 1: Status Breakdown */}
                <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm">
                  <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider mb-4">Application Funnel Breakdown</h3>
                  {applications.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                      <FileMinus className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-xs font-semibold">No application data available yet</p>
                      <p className="text-[10px] text-gray-400 mt-1">When candidates apply to your jobs, funnel breakdown will populate here.</p>
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Applied', Count: applications.filter(a => a.currentStatus === 'Applied').length, fill: '#ea580c' },
                            { name: 'Contacted', Count: applications.filter(a => a.currentStatus === 'Contacted').length, fill: '#0284c7' },
                            { name: 'Shortlisted', Count: applications.filter(a => a.currentStatus === 'Shortlisted').length, fill: '#8b5cf6' },
                            { name: 'Interviews', Count: applications.filter(a => ['Interview Scheduled', 'Interview Completed'].includes(a.currentStatus)).length, fill: '#eab308' },
                            { name: 'Selected', Count: applications.filter(a => a.currentStatus === 'Selected').length, fill: '#059669' },
                            { name: 'Hired', Count: applications.filter(a => a.currentStatus === 'Hired').length, fill: '#10b981' },
                            { name: 'Rejected', Count: applications.filter(a => a.currentStatus === 'Rejected').length, fill: '#dc2626' }
                          ]}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                          <Bar dataKey="Count" radius={[4, 4, 0, 0]}>
                            {
                              [
                                '#ea580c', '#0284c7', '#8b5cf6', '#eab308', '#059669', '#10b981', '#dc2626'
                              ].map((color, idx) => (
                                <Cell key={`cell-${idx}`} fill={color} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Chart 2: Top Jobs Applications Distribution */}
                <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm">
                  <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider mb-4">Top Openings by Candidate Inflow</h3>
                  {jobs.length === 0 || applications.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                      <FileMinus className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-xs font-semibold">No application inflow data available yet</p>
                      <p className="text-[10px] text-gray-400 mt-1">When candidates apply to your jobs, local inflow graphs will populate here.</p>
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={jobs.map((job: any) => ({
                            Job: job.title.length > 15 ? job.title.substring(0, 15) + '...' : job.title,
                            Inflow: applications.filter(a => a.jobId === job.id).length
                          })).filter(j => j.Inflow > 0).slice(0, 5)}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ea580c" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="Job" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                          <Area type="monotone" dataKey="Inflow" stroke="#ea580c" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Steps / Activity helper panel */}
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm">
                <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider mb-4">Enterprise Launch Check</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-xs leading-normal">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Company registration complete</p>
                      <p className="text-gray-500">Your organization metadata is saved secure in the ShiftCargo driver broker ledger.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-xs leading-normal">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">ShiftCargo Vetting Verification</p>
                      <p className="text-gray-500">Logistics supervisor approved. Your company has unlimited licensing for posting logistical delivery openings.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-xs leading-normal">
                    <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[10px]">
                      3
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Verify company profile settings</p>
                      <p className="text-gray-500">Keep website addresses, contact numbers, and corporate headquarters location updated to build trust with candidates.</p>
                      <button 
                        onClick={() => setActiveTab('profile')}
                        className="text-orange-600 hover:text-orange-700 hover:underline font-bold mt-1.5 block cursor-pointer"
                      >
                        Check Corporate Settings →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <div className="bg-white border border-gray-150 rounded-3xl p-6 sm:p-8 shadow-sm">
                
                {/* Header title */}
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">Edit Corporate Profile</h3>
                  <p className="text-xs text-gray-400 mt-1">Manage public organization specs, representative contacts, and verification details</p>
                </div>

                <form onSubmit={handleProfileUpdateSubmit} className="space-y-6">
                  
                  {/* Company Logo Upload & Banner */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Logo</label>
                    <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      {companyLogo ? (
                        <div className="relative w-16 h-16 border border-gray-200 rounded-xl overflow-hidden bg-white shrink-0">
                          <img src={companyLogo} alt="Corporate Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => setCompanyLogo('')}
                            className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-white text-gray-400 shrink-0">
                          <Building2 className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex-1">
                        <input
                          type="file"
                          id="profile-logo-input"
                          accept=".jpg,.jpeg,.png"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('profile-logo-input')?.click()}
                          disabled={logoUploading}
                          className="py-2 px-4 border border-gray-200 hover:border-orange-500/30 hover:bg-orange-50/10 text-gray-700 hover:text-orange-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
                        >
                          {logoUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          {companyLogo ? 'Replace Logo' : 'Upload Corporate Logo'}
                        </button>
                        <p className="text-[10px] text-gray-400 mt-1.5">Supports JPG, JPEG, or PNG. Maximum size 2MB.</p>
                      </div>
                    </div>
                  </div>

                  {/* Section: Company Data */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-orange-600 uppercase tracking-wider pb-1.5 border-b border-gray-50">Company Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Name *</label>
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Website</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                            <Globe className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="url"
                            value={companyWebsite}
                            onChange={(e) => setCompanyWebsite(e.target.value)}
                            placeholder="e.g. https://apexlogs.com"
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Representative Details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-orange-600 uppercase tracking-wider pb-1.5 border-b border-gray-50">Representative Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Recruiter Name *</label>
                        <input
                          type="text"
                          required
                          value={recruiterName}
                          onChange={(e) => setRecruiterName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Designation / Role *</label>
                        <input
                          type="text"
                          required
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Mobile Number *</label>
                        <input
                          type="tel"
                          required
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section: Company Address */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-orange-600 uppercase tracking-wider pb-1.5 border-b border-gray-50">Headquarters Address</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Street Address *</label>
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">City *</label>
                          <input
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">State *</label>
                          <input
                            type="text"
                            required
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Pincode *</label>
                          <input
                            type="text"
                            required
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission and reset actions */}
                  <div className="pt-6 border-t border-gray-100 flex gap-3">
                    <button
                      type="submit"
                      disabled={updating || logoUploading}
                      className="py-2.5 px-6 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
                    >
                      {updating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save Profile Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Reset fields to recruiter details
                        setCompanyName(recruiter.companyName);
                        setCompanyLogo(recruiter.companyLogo || '');
                        setCompanyWebsite(recruiter.companyWebsite || '');
                        setRecruiterName(recruiter.recruiterName);
                        setDesignation(recruiter.designation);
                        setMobile(recruiter.mobile);
                        setEmail(recruiter.email);
                        setAddress(recruiter.address);
                        setCity(recruiter.city);
                        setState(recruiter.state);
                        setPincode(recruiter.pincode);
                        setSuccess('Reset completed.');
                        setError(null);
                      }}
                      className="py-2.5 px-5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Reset Form
                    </button>
                  </div>

                </form>

              </div>
            </motion.div>
          )}

          {/* JOB MANAGEMENT TAB */}
          {activeTab === 'jobs' && (
            <motion.div
              key="jobs-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Header Card */}
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">Enterprise Logistics Job Openings</h3>
                  <p className="text-xs text-gray-400 mt-1">Deploy, optimize, and manage logistical delivery openings for verified driver candidates.</p>
                </div>
                {!showJobForm && (
                  <button
                    onClick={() => {
                      setEditingJob(null);
                      setJobTitle('');
                      setJobCategory('Last-Mile Delivery');
                      setJobOpenings('1');
                      setJobEmploymentType('Full Time');
                      setJobState(recruiter.state || '');
                      setJobCity(recruiter.city || '');
                      setJobArea('');
                      setJobWorkLocation('');
                      setJobMinSalary('');
                      setJobMaxSalary('');
                      setJobSalaryType('Monthly');
                      setJobShift('Day');
                      setJobExperience('0');
                      setJobEducation('10th Pass');
                      setJobGenderPreference('Any');
                      setJobAgeLimitMin('18');
                      setJobAgeLimitMax('45');
                      setJobBikeRequired('No');
                      setJobDrivingLicense('No');
                      setJobImmediateJoining('No');
                      setJobDescription('');
                      setJobResponsibilities('');
                      setJobBenefits('');
                      setShowJobForm(true);
                    }}
                    className="py-2.5 px-5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-600/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Post a New Job
                  </button>
                )}
              </div>

              {/* View Overlay Modal */}
              {viewingJob && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6 relative shadow-2xl border border-gray-150">
                    <button
                      onClick={() => setViewingJob(null)}
                      className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="border-b border-gray-100 pb-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${
                          viewingJob.status === 'Published' || viewingJob.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : viewingJob.status === 'Draft'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}>
                          Status: {viewingJob.status}
                        </span>
                        <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                          {viewingJob.category}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight mt-3">{viewingJob.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">{recruiter.companyName} • Hub Location: {viewingJob.area}, {viewingJob.city}, {viewingJob.state}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Compensation</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">₹{viewingJob.minSalary} - ₹{viewingJob.maxSalary} / {viewingJob.salaryType}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Openings Available</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">{viewingJob.openings} positions</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Employment Type</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">{viewingJob.employmentType}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Shift Schedule</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">{viewingJob.shift} Shift</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Experience Req.</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">{viewingJob.experienceRequired === 0 ? 'Fresher Friendly' : `${viewingJob.experienceRequired} Years`}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Education</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">{viewingJob.educationRequired}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Gender Requirement</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">{viewingJob.genderPreference}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Age Bracket Limit</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">{viewingJob.ageLimitMin} - {viewingJob.ageLimitMax} Years</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Required Assets</p>
                        <p className="font-extrabold text-gray-800 mt-0.5">
                          Bike: {viewingJob.bikeRequired}, DL: {viewingJob.drivingLicenseRequired}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs">
                      <div>
                        <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-2 uppercase tracking-wide">Job Description</h4>
                        <p className="text-gray-600 whitespace-pre-line leading-relaxed">{viewingJob.description}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-2 uppercase tracking-wide">Key Responsibilities</h4>
                        <p className="text-gray-600 whitespace-pre-line leading-relaxed">{viewingJob.responsibilities}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-2 uppercase tracking-wide">Perks & Benefits</h4>
                        <p className="text-gray-600 whitespace-pre-line leading-relaxed">{viewingJob.benefits}</p>
                      </div>
                      {viewingJob.workLocation && (
                        <div>
                          <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-2 uppercase tracking-wide">Exact Hub Work Location</h4>
                          <p className="text-gray-600">{viewingJob.workLocation}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setViewingJob(null);
                          handleStartEditJob(viewingJob);
                        }}
                        className="py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all text-xs"
                      >
                        Edit Listing
                      </button>
                      <button
                        onClick={() => setViewingJob(null)}
                        className="py-2 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all text-xs"
                      >
                        Close Window
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showJobForm ? (
                /* CREATE / EDIT JOB FORM */
                <div className="bg-white border border-gray-150 rounded-3xl p-6 sm:p-8 shadow-sm">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
                    <h4 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                      {editingJob ? 'Edit Logistical Opening' : 'Post Logistical Opening'}
                    </h4>
                    <button
                      onClick={() => {
                        setShowJobForm(false);
                        setEditingJob(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleJobSubmit} className="space-y-8">
                    
                    {/* Section 1: Basic Information */}
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black uppercase text-orange-600 tracking-widest pb-1 border-b border-orange-50">1. Basic Opening Specs</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Job Title / Role Name *</label>
                          <input
                            type="text"
                            required
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            placeholder="e.g. Last Mile Delivery Associate"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Name (Auto-Filled)</label>
                          <input
                            type="text"
                            disabled
                            value={recruiter.companyName}
                            className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-500 rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Job Category *</label>
                          <select
                            required
                            value={jobCategory}
                            onChange={(e) => setJobCategory(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="Last-Mile Delivery">Last-Mile Delivery</option>
                            <option value="Line-Haul Trucking">Line-Haul Trucking</option>
                            <option value="Warehouse & Dispatch">Warehouse & Dispatch</option>
                            <option value="E-commerce Courier">E-commerce Courier</option>
                            <option value="FMCG Distribution">FMCG Distribution</option>
                            <option value="Other">Other Logistical Option</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Open Positions *</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={jobOpenings}
                              onChange={(e) => setJobOpenings(e.target.value)}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Employment Type *</label>
                            <select
                              required
                              value={jobEmploymentType}
                              onChange={(e) => setJobEmploymentType(e.target.value as any)}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                            >
                              <option value="Full Time">Full Time</option>
                              <option value="Part Time">Part Time</option>
                              <option value="Contract">Contract</option>
                              <option value="Temporary">Temporary</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Location */}
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black uppercase text-orange-600 tracking-widest pb-1 border-b border-orange-50">2. Deployment Geography</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">State *</label>
                          <input
                            type="text"
                            required
                            value={jobState}
                            onChange={(e) => setJobState(e.target.value)}
                            placeholder="e.g. Karnataka"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">City / Hub HQ *</label>
                          <input
                            type="text"
                            required
                            value={jobCity}
                            onChange={(e) => setJobCity(e.target.value)}
                            placeholder="e.g. Bengaluru"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Area / Locality *</label>
                          <input
                            type="text"
                            required
                            value={jobArea}
                            onChange={(e) => setJobArea(e.target.value)}
                            placeholder="e.g. Nelamangala Hub"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Work Hub Address (Optional)</label>
                          <input
                            type="text"
                            value={jobWorkLocation}
                            onChange={(e) => setJobWorkLocation(e.target.value)}
                            placeholder="e.g. Phase 2, Logistics Gate C, NH 48, Nelamangala Industrial Area"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Salary */}
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black uppercase text-orange-600 tracking-widest pb-1 border-b border-orange-50">3. Driver compensation budget</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Minimum Salary (₹) *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="e.g. 18000"
                            value={jobMinSalary}
                            onChange={(e) => setJobMinSalary(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Maximum Salary (₹) *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="e.g. 26000"
                            value={jobMaxSalary}
                            onChange={(e) => setJobMaxSalary(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Compensation Schedule *</label>
                          <select
                            required
                            value={jobSalaryType}
                            onChange={(e) => setJobSalaryType(e.target.value as any)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="Monthly">Monthly</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Daily">Daily</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Experience & Specifications */}
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black uppercase text-orange-600 tracking-widest pb-1 border-b border-orange-50">4. Fleet Criteria & Eligibility</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Shift *</label>
                          <select
                            required
                            value={jobShift}
                            onChange={(e) => setJobShift(e.target.value as any)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="Day">Day Shift</option>
                            <option value="Night">Night Shift</option>
                            <option value="Rotational">Rotational Shift</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Min Experience Required (Years) *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            max="30"
                            value={jobExperience}
                            onChange={(e) => setJobExperience(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Education Needed *</label>
                          <select
                            required
                            value={jobEducation}
                            onChange={(e) => setJobEducation(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="No Education Required">No Education Required</option>
                            <option value="10th Pass">10th Pass</option>
                            <option value="12th Pass">12th Pass</option>
                            <option value="Graduate">Graduate</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Gender Preference *</label>
                          <select
                            required
                            value={jobGenderPreference}
                            onChange={(e) => setJobGenderPreference(e.target.value as any)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="Any">Any Gender</option>
                            <option value="Male">Male Candidates Only</option>
                            <option value="Female">Female Candidates Only</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Min Age *</label>
                            <input
                              type="number"
                              required
                              min="18"
                              max="65"
                              value={jobAgeLimitMin}
                              onChange={(e) => setJobAgeLimitMin(e.target.value)}
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Max Age *</label>
                            <input
                              type="number"
                              required
                              min="18"
                              max="70"
                              value={jobAgeLimitMax}
                              onChange={(e) => setJobAgeLimitMax(e.target.value)}
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Personal Bike Needed? *</label>
                          <select
                            required
                            value={jobBikeRequired}
                            onChange={(e) => setJobBikeRequired(e.target.value as any)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Driving License Required? *</label>
                          <select
                            required
                            value={jobDrivingLicense}
                            onChange={(e) => setJobDrivingLicense(e.target.value as any)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Immediate Joining? *</label>
                          <select
                            required
                            value={jobImmediateJoining}
                            onChange={(e) => setJobImmediateJoining(e.target.value as any)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                          >
                            <option value="No">No (Standard Vetting)</option>
                            <option value="Yes">Yes (Immediate Batch)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Rich descriptions */}
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black uppercase text-orange-600 tracking-widest pb-1 border-b border-orange-50">5. Role Information & Requirements</h5>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Job Description *</label>
                          <textarea
                            required
                            rows={3}
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder="State what the role is, the client sector, and what vehicles they will pilot."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none leading-relaxed"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Detailed Responsibilities *</label>
                          <textarea
                            required
                            rows={3}
                            value={jobResponsibilities}
                            onChange={(e) => setJobResponsibilities(e.target.value)}
                            placeholder="E.g. Safe loading of FMCG, handling dispatch billing terminals, reporting hub discrepancies, executing 20 drops daily."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none leading-relaxed"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Perks & Benefits *</label>
                          <textarea
                            required
                            rows={3}
                            value={jobBenefits}
                            onChange={(e) => setJobBenefits(e.target.value)}
                            placeholder="E.g. PF & ESIC, free corporate meals, mileage reimbursements of ₹3.2 per KM, accidental insurance of ₹5 Lakhs."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions and status choice */}
                    <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                      <div className="flex gap-2 flex-1">
                        <button
                          type="submit"
                          onClick={() => setSubmitStatus('Published')}
                          disabled={submittingJob}
                          className="py-2.5 px-6 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
                        >
                          {submittingJob && submitStatus === 'Published' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {editingJob ? 'Save & Publish Job' : 'Publish Job'}
                        </button>

                        <button
                          type="submit"
                          onClick={() => setSubmitStatus('Draft')}
                          disabled={submittingJob}
                          className="py-2.5 px-6 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
                        >
                          {submittingJob && submitStatus === 'Draft' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          Save as Draft
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowJobForm(false);
                          setEditingJob(null);
                        }}
                        className="py-2.5 px-5 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                    </div>

                  </form>
                </div>
              ) : (
                /* LIVE JOBS LISTING VIEW */
                <div className="space-y-4">
                  {/* SEARCH FILTERS AND CONTROLS */}
                  <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      
                      {/* Search Job Title */}
                      <div className="relative w-full sm:flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={searchTitle}
                          onChange={(e) => setSearchTitle(e.target.value)}
                          placeholder="Search jobs by role title..."
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>

                      {/* Search City */}
                      <div className="relative w-full sm:w-64">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                          <MapPin className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={searchCity}
                          onChange={(e) => setSearchCity(e.target.value)}
                          placeholder="Search city..."
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                        />
                      </div>
                    </div>

                    {/* Status filtering row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-50 text-xs">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-2 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Status Filter:
                      </span>
                      {[
                        { id: 'All', label: 'All Jobs' },
                        { id: 'Active', label: 'Active / Published' },
                        { id: 'Draft', label: 'Drafts' },
                        { id: 'Closed', label: 'Closed' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => setFilterStatus(st.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition-all cursor-pointer ${
                            filterStatus === st.id 
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : 'bg-gray-50 text-gray-500 hover:text-gray-800 border border-gray-100'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* LOADING STATE */}
                  {loadingJobs ? (
                    <div className="bg-white border border-gray-150 rounded-3xl p-12 text-center shadow-sm">
                      <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-3" />
                      <p className="text-xs text-gray-500">Retrieving logistical openings ledger...</p>
                    </div>
                  ) : filteredJobs().length === 0 ? (
                    <div className="bg-white border border-gray-150 rounded-3xl p-12 text-center shadow-sm">
                      <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 mx-auto mb-6">
                        <Briefcase className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">No matching jobs found</h3>
                      <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
                        Try adjusting your search keywords, city filters, or status toggles to reveal your logistical openings.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredJobs().map((job) => (
                        <div key={job.id} className="bg-white border border-gray-150 rounded-2xl p-5 sm:p-6 shadow-sm hover:border-gray-250 transition-all">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            
                            <div className="space-y-2">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h4 className="font-black text-gray-900 text-sm tracking-tight">{job.title}</h4>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide border ${
                                  job.status === 'Published' || job.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                                    : job.status === 'Draft'
                                      ? 'bg-amber-50 text-amber-700 border-amber-150'
                                      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                                }`}>
                                  {job.status}
                                </span>
                                <span className="bg-gray-50 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full border border-gray-150 uppercase tracking-wide">
                                  {job.category}
                                </span>
                              </div>
                              
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> 
                                <span className="font-semibold text-gray-700">{job.area}</span>, {job.city}, {job.state}
                              </p>

                              <div className="flex items-center gap-2 mt-3 flex-wrap text-xs text-gray-600">
                                <span className="bg-orange-50/50 text-orange-800 font-extrabold px-2 py-0.5 rounded-md border border-orange-100">
                                  ₹{job.minSalary} - ₹{job.maxSalary} / {job.salaryType || 'Monthly'}
                                </span>
                                <span className="bg-gray-50 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-150">
                                  {job.openings || 1} open positions
                                </span>
                                <span className="bg-gray-50 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-150">
                                  {job.experienceRequired === 0 ? 'Fresher friendly' : `${job.experienceRequired}+ yrs Exp`}
                                </span>
                              </div>

                              <p className="text-xs text-gray-500 mt-2 line-clamp-2 max-w-xl leading-relaxed">
                                {job.description}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-400 font-semibold pt-1 border-t border-gray-50 mt-2">
                                <span className="flex items-center gap-1.5 bg-orange-50/50 text-orange-700 px-2 py-0.5 rounded border border-orange-100">
                                  <Briefcase className="w-3.5 h-3.5 text-orange-500" />
                                  Applied: <strong className="text-orange-900 font-black">{applications.filter((app: any) => app.jobId === job.id).length || job.applicationsCount || 0}</strong>
                                </span>
                                <span className="flex items-center gap-1.5 bg-indigo-50/50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                  <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                  Views: <strong className="text-indigo-900 font-black">{job.viewsCount || 0}</strong>
                                </span>
                                <span className="text-gray-400">Posted: <strong className="text-gray-700">{new Date(job.createdAt).toLocaleDateString()}</strong></span>
                                {job.immediateJoining === 'Yes' && (
                                  <span className="text-red-600 font-extrabold animate-pulse">🔥 Immediate Hiring</span>
                                )}
                              </div>
                            </div>

                            {/* Job actions group */}
                            <div className="flex flex-wrap md:flex-col gap-1.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-50 justify-start md:justify-end">
                              <div className="flex gap-1.5 w-full">
                                <button
                                  onClick={() => setViewingJob(job)}
                                  className="flex-1 p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all flex items-center justify-center gap-1 text-[11px] font-bold border border-gray-200 cursor-pointer"
                                  title="View Details"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View
                                </button>
                                
                                <button
                                  onClick={() => handleStartEditJob(job)}
                                  className="flex-1 p-2 bg-orange-50 hover:bg-orange-100/80 text-orange-700 rounded-xl transition-all flex items-center justify-center gap-1 text-[11px] font-bold border border-orange-100 cursor-pointer"
                                  title="Edit Listing"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Edit
                                </button>
                              </div>

                              <div className="flex gap-1.5 w-full">
                                <button
                                  onClick={() => handleDuplicateJob(job)}
                                  className="flex-1 p-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 rounded-xl transition-all flex items-center justify-center gap-1 text-[11px] font-bold border border-indigo-100 cursor-pointer"
                                  title="Duplicate as Draft"
                                >
                                  <Copy className="w-3.5 h-3.5" /> Copy
                                </button>

                                <button
                                  onClick={() => handleDeleteJob(job.id)}
                                  className="flex-1 p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all flex items-center justify-center gap-1 text-[11px] font-bold border border-red-100 cursor-pointer"
                                  title="Delete Opening"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>

                              {/* Direct Status Change Controls */}
                              <div className="grid grid-cols-3 gap-1 pt-1.5 w-full">
                                <button
                                  disabled={job.status === 'Published' || job.status === 'Active'}
                                  onClick={() => handleToggleJobStatusDirect(job.id, 'Published')}
                                  className="py-1 px-1.5 rounded-lg border border-gray-200 text-[10px] font-black text-center transition-all bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:bg-emerald-50/50 disabled:text-emerald-700 disabled:border-emerald-100 cursor-pointer"
                                >
                                  Publish
                                </button>
                                <button
                                  disabled={job.status === 'Draft'}
                                  onClick={() => handleToggleJobStatusDirect(job.id, 'Draft')}
                                  className="py-1 px-1.5 rounded-lg border border-gray-200 text-[10px] font-black text-center transition-all bg-gray-50 text-gray-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 disabled:bg-amber-50/50 disabled:text-amber-700 disabled:border-amber-100 cursor-pointer"
                                >
                                  Draft
                                </button>
                                <button
                                  disabled={job.status === 'Closed'}
                                  onClick={() => handleToggleJobStatusDirect(job.id, 'Closed')}
                                  className="py-1 px-1.5 rounded-lg border border-gray-200 text-[10px] font-black text-center transition-all bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:bg-red-50/50 disabled:text-red-700 disabled:border-red-100 cursor-pointer"
                                >
                                  Close
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'applications' && (
            <motion.div
              key="applications-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Applications', value: applications.length, color: 'border-slate-150 bg-slate-50/50 text-slate-900' },
                  { label: 'New / Applied', value: applications.filter(a => a.currentStatus === 'Applied').length, color: 'border-orange-100 bg-orange-50/30 text-orange-700' },
                  { label: 'Shortlisted', value: applications.filter(a => a.currentStatus === 'Shortlisted').length, color: 'border-violet-100 bg-violet-50/30 text-violet-700' },
                  { label: 'Rejected', value: applications.filter(a => a.currentStatus === 'Rejected').length, color: 'border-red-100 bg-red-50/30 text-red-700' },
                  { label: 'Hired', value: applications.filter(a => a.currentStatus === 'Hired').length, color: 'border-emerald-100 bg-emerald-50/30 text-emerald-700' },
                ].map((stat, idx) => (
                  <div key={idx} className={`border rounded-2xl p-4 shadow-sm text-center ${stat.color}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block leading-tight text-gray-400">{stat.label}</span>
                    <span className="text-2xl font-black mt-1.5 block">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Filters & Search Board */}
              <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search candidate or mobile..."
                      value={appSearch}
                      onChange={(e) => setAppSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-800"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        setAppFilterJob('All');
                        setAppFilterStatus('All');
                        setAppFilterDate('All');
                        setAppFilterCity('All');
                        setAppFilterExperience('All');
                        setAppSearch('');
                      }}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {/* Job Filter */}
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Filter by Job</label>
                    <select
                      value={appFilterJob}
                      onChange={(e) => setAppFilterJob(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="All">All Jobs</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>{job.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Filter by Status</label>
                    <select
                      value={appFilterStatus}
                      onChange={(e) => setAppFilterStatus(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Applied">Applied (New)</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Shortlisted">Shortlisted</option>
                      <option value="Interview Scheduled">Interview Scheduled</option>
                      <option value="Interview Completed">Interview Completed</option>
                      <option value="Selected">Selected</option>
                      <option value="Hired">Hired</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </select>
                  </div>

                  {/* Experience Filter */}
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Experience</label>
                    <select
                      value={appFilterExperience}
                      onChange={(e) => setAppFilterExperience(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="All">All Experience</option>
                      <option value="Freshers">Freshers (0 Yrs)</option>
                      <option value="1-2 Years">1-2 Years</option>
                      <option value="3+ Years">3+ Years</option>
                    </select>
                  </div>

                  {/* City Filter */}
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Candidate City</label>
                    <select
                      value={appFilterCity}
                      onChange={(e) => setAppFilterCity(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="All">All Cities</option>
                      {Array.from(new Set(applications.map(a => a.candidateCity).filter(Boolean))).map((city: any) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date Filter */}
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Applied Date</label>
                    <select
                      value={appFilterDate}
                      onChange={(e) => setAppFilterDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="All">All Time</option>
                      <option value="Today">Today</option>
                      <option value="Last 7 Days">Last 7 Days</option>
                      <option value="Last 30 Days">Last 30 Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
                {loadingApps ? (
                  <div className="py-20 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-orange-500 mb-2" />
                    Fetching incoming candidates list...
                  </div>
                ) : filteredApplications.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center">
                    <FileMinus className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-xs font-semibold">No applications found matching the current filters.</p>
                    <p className="text-[10px] text-gray-400 mt-1">Try resetting the filters or tweaking your search terms.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          <th className="py-3 px-5">Candidate Name</th>
                          <th className="py-3 px-5">Job Title</th>
                          <th className="py-3 px-5">Applied Date</th>
                          <th className="py-3 px-5 text-center">Experience</th>
                          <th className="py-3 px-5">Current City</th>
                          <th className="py-3 px-5">Current Status</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs font-medium text-slate-700">
                        {filteredApplications.map((app) => (
                          <tr key={app.id} className="hover:bg-gray-50/40 transition-colors">
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-3">
                                {app.candidateProfilePhoto ? (
                                  <img 
                                    src={app.candidateProfilePhoto} 
                                    alt={app.candidateName} 
                                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center font-extrabold text-[10px] uppercase">
                                    {app.candidateName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-slate-900 block">{app.candidateName}</span>
                                  <span className="text-[10px] text-gray-400 block">{app.candidateMobile}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-5">
                              <span className="font-bold text-slate-800 block">{app.jobTitle}</span>
                              <span className="text-[10px] text-gray-400 block">{app.jobCity}</span>
                            </td>
                            <td className="py-3 px-5 text-gray-500">
                              {new Date(app.appliedDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-5 text-center font-bold text-slate-800">
                              {app.candidateExperience} Yrs
                            </td>
                            <td className="py-3 px-5 text-gray-600">
                              {app.candidateCity || 'N/A'}
                            </td>
                            <td className="py-3 px-5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                                app.currentStatus === 'Applied' 
                                  ? 'bg-orange-50 text-orange-700 border-orange-150' 
                                  : app.currentStatus === 'Shortlisted' 
                                    ? 'bg-violet-50 text-violet-700 border-violet-150'
                                    : app.currentStatus === 'Rejected'
                                      ? 'bg-red-50 text-red-700 border-red-150'
                                      : app.currentStatus === 'Hired'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                                        : 'bg-blue-50 text-blue-700 border-blue-150'
                              }`}>
                                {app.currentStatus}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedAppId(app.id);
                                  fetchAppDetail(app.id);
                                }}
                                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-white text-[10px] font-extrabold rounded-xl shadow-sm transition-all cursor-pointer"
                              >
                                Review Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-gray-150 rounded-3xl p-12 text-center shadow-sm"
              id="settings-soon"
            >
              <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mx-auto mb-6">
                <Settings className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Enterprise Settings</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
                Vetting logs, multi-agent recruitment tokens, and account permission matrices are coming in the next release.
              </p>
              <span className="inline-block mt-6 px-3.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-orange-50 text-orange-700 border border-orange-100">
                Coming Soon
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Candidate Detail Modal */}
      {selectedAppDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-150 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center font-extrabold text-base uppercase">
                  {selectedAppDetail.candidate?.profile?.fullName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || 'C'}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {selectedAppDetail.candidate?.profile?.fullName || selectedAppDetail.candidate?.fullName || 'Review Candidate Profile'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Applying for: <span className="font-extrabold text-orange-600 uppercase tracking-tight">{selectedAppDetail.job?.title || 'Unknown Position'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedAppDetail(null);
                  setSelectedAppId(null);
                }}
                className="p-1.5 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scroll Container */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Side: Profile Information & Files (Col span 2) */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Personal and Demographics details */}
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Candidate Personal Dossier</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-400 block font-semibold">Mobile Contact</span>
                        <span className="font-extrabold text-slate-800">{selectedAppDetail.candidate?.mobile || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Email Identity</span>
                        <span className="font-extrabold text-slate-800">{selectedAppDetail.candidate?.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Age / Date of Birth</span>
                        <span className="font-extrabold text-slate-800">
                          {selectedAppDetail.candidate?.profile?.age || (selectedAppDetail.candidate?.profile?.dateOfBirth ? new Date(selectedAppDetail.candidate?.profile?.dateOfBirth).toLocaleDateString() : 'N/A')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Gender Group</span>
                        <span className="font-extrabold text-slate-800 uppercase tracking-wider">{selectedAppDetail.candidate?.profile?.gender || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-400 block font-semibold">Highest Education</span>
                        <span className="font-extrabold text-slate-800">{selectedAppDetail.candidate?.profile?.education || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Current Occupation</span>
                        <span className="font-extrabold text-slate-800">{selectedAppDetail.candidate?.profile?.currentOccupation || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Pincode & Address</span>
                        <span className="font-extrabold text-slate-800">
                          {selectedAppDetail.candidate?.profile?.city || selectedAppDetail.candidate?.profile?.state 
                            ? `${selectedAppDetail.candidate?.profile?.city || ''}, ${selectedAppDetail.candidate?.profile?.state || ''} - ${selectedAppDetail.candidate?.profile?.pincode || 'N/A'}`
                            : `Pincode: ${selectedAppDetail.candidate?.profile?.pincode || 'N/A'}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Expected Salary / Shift Preference</span>
                        <span className="font-extrabold text-slate-800">{selectedAppDetail.candidate?.profile?.expectedSalary || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Skills & Compliance Checks */}
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Logistics & Compliance Checks</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="p-3 bg-white border border-gray-100 rounded-xl text-center">
                        <span className="text-gray-400 block font-semibold text-[10px]">Has Bike</span>
                        <span className={`inline-block mt-1 font-black text-xs uppercase ${selectedAppDetail.candidate?.profile?.bikeAvailable === 'Yes' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {selectedAppDetail.candidate?.profile?.bikeAvailable || 'No'}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-gray-100 rounded-xl text-center">
                        <span className="text-gray-400 block font-semibold text-[10px]">Driving License</span>
                        <span className={`inline-block mt-1 font-black text-xs uppercase ${selectedAppDetail.candidate?.profile?.drivingLicenseAvailable === 'Yes' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {selectedAppDetail.candidate?.profile?.drivingLicenseAvailable || 'No'}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-gray-100 rounded-xl text-center">
                        <span className="text-gray-400 block font-semibold text-[10px]">Immediate Joiner</span>
                        <span className="inline-block mt-1 font-black text-xs uppercase text-slate-800">
                          {selectedAppDetail.candidate?.profile?.immediateJoining || 'No'}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-gray-100 rounded-xl text-center">
                        <span className="text-gray-400 block font-semibold text-[10px]">Languages</span>
                        <span className="inline-block mt-1 font-bold text-[10px] text-slate-700">
                          {selectedAppDetail.candidate?.profile?.languagesKnown?.join(', ') || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Uploaded Verification Documents */}
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Vetting Credentials & Certificates</h4>
                    {selectedAppDetail.candidate?.documents?.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No documents are required for this candidate.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedAppDetail.candidate?.documents?.map((doc: any) => (
                          <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2.5 shadow-xs">
                            <div className="min-w-0">
                              <span className="text-[10px] font-black uppercase text-orange-600 block leading-none mb-1">{doc.documentType}</span>
                              <span className="text-xs font-bold text-slate-800 block truncate leading-tight">{doc.fileName}</span>
                              <span className="text-[9px] text-gray-400 block mt-0.5">Uploaded: {new Date(doc.uploadDate).toLocaleDateString()}</span>
                            </div>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-[10px] font-extrabold rounded-lg shrink-0 transition-colors cursor-pointer text-center"
                            >
                              Open File
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* History Logs */}
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dispatcher Activity Logs</h4>
                    <div className="space-y-2.5">
                      {selectedAppDetail.history?.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No historical timeline updates recorded yet. Default state: Applied.</p>
                      ) : (
                        selectedAppDetail.history?.map((log: any) => (
                          <div key={log.id} className="text-xs flex items-start gap-2 border-b border-gray-100/50 pb-2">
                            <span className="text-orange-500 font-extrabold mt-0.5">•</span>
                            <div>
                              <p className="font-bold text-slate-800">
                                Changed status from <span className="text-gray-400">{log.previousStatus}</span> to <span className="text-orange-600">{log.newStatus}</span>
                              </p>
                              <p className="text-[9px] text-gray-400">
                                Logged by {log.changedBy} on {new Date(log.changedDate).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* Right Side: Recruiter Status Actions & Private Notes (Col span 1) */}
                <div className="space-y-6">
                  
                  {/* Action: Update Candidate Status */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Candidacy Control Board</h4>
                    
                    <div className="space-y-2">
                      <span className="text-xs text-gray-400 font-semibold block">Current Placement Status</span>
                      <div className="px-3 py-2 bg-slate-900 text-white font-extrabold rounded-xl text-center uppercase tracking-wider text-[11px]">
                        {selectedAppDetail.application?.currentStatus}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-400 font-semibold block">Dispatched Progress Triggers</span>
                      
                      <div className="flex flex-col gap-1.5">
                        {/* Status Quick Buttons */}
                        {selectedAppDetail.application?.currentStatus === 'Applied' && (
                          <button
                            onClick={() => handleStatusUpdate(selectedAppDetail.application.id, 'Contacted')}
                            className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black rounded-xl cursor-pointer"
                          >
                            Mark as Contacted
                          </button>
                        )}

                        {['Applied', 'Contacted'].includes(selectedAppDetail.application?.currentStatus) && (
                          <button
                            onClick={() => handleStatusUpdate(selectedAppDetail.application.id, 'Shortlisted')}
                            className="w-full py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-black rounded-xl cursor-pointer"
                          >
                            Shortlist Candidate
                          </button>
                        )}

                        {selectedAppDetail.application?.currentStatus !== 'Interview Scheduled' && selectedAppDetail.application?.currentStatus !== 'Hired' && selectedAppDetail.application?.currentStatus !== 'Rejected' && (
                          <button
                            onClick={() => setShowInterviewModal(true)}
                            className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-black rounded-xl cursor-pointer"
                          >
                            Schedule Interview
                          </button>
                        )}

                        {selectedAppDetail.application?.currentStatus === 'Interview Scheduled' && (
                          <button
                            onClick={() => handleStatusUpdate(selectedAppDetail.application.id, 'Interview Completed')}
                            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl cursor-pointer"
                          >
                            Mark Interview Completed
                          </button>
                        )}

                        {['Shortlisted', 'Interview Completed'].includes(selectedAppDetail.application?.currentStatus) && (
                          <button
                            onClick={() => handleStatusUpdate(selectedAppDetail.application.id, 'Selected')}
                            className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black rounded-xl cursor-pointer"
                          >
                            Mark Selected (Offer)
                          </button>
                        )}

                        {selectedAppDetail.application?.currentStatus === 'Selected' && (
                          <button
                            onClick={() => handleStatusUpdate(selectedAppDetail.application.id, 'Hired')}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-md"
                          >
                            Hire Candidate 🎉
                          </button>
                        )}

                        {selectedAppDetail.application?.currentStatus !== 'Hired' && selectedAppDetail.application?.currentStatus !== 'Rejected' && selectedAppDetail.application?.currentStatus !== 'Withdrawn' && (
                          <button
                            onClick={() => handleStatusUpdate(selectedAppDetail.application.id, 'Rejected')}
                            className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-xl cursor-pointer"
                          >
                            Reject Candidate
                          </button>
                        )}
                      </div>
                    </div>

                    {/* All statuses fallback select */}
                    <div className="space-y-1 pt-3 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Manual Force Placement</span>
                      <select
                        value={selectedAppDetail.application?.currentStatus}
                        onChange={(e) => handleStatusUpdate(selectedAppDetail.application.id, e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                      >
                        <option value="Applied">Applied</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Shortlisted">Shortlisted</option>
                        <option value="Interview Scheduled">Interview Scheduled</option>
                        <option value="Interview Completed">Interview Completed</option>
                        <option value="Selected">Selected</option>
                        <option value="Hired">Hired</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Withdrawn">Withdrawn</option>
                      </select>
                    </div>

                  </div>

                  {/* Private Recruiter Notes Board */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Internal Broker Notes</h4>
                    <span className="text-[9px] text-slate-400 italic block leading-relaxed mt-0.5">Notes added here are private and never shown to candidates.</span>
                    
                    {/* Add note form */}
                    <div className="space-y-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Write recruiter feedback or interview remarks..."
                        rows={3}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800"
                      />
                      <button
                        onClick={() => handleAddNote(selectedAppDetail.application.id)}
                        disabled={submittingNote || !noteText.trim()}
                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-extrabold rounded-lg transition-all cursor-pointer text-center"
                      >
                        {submittingNote ? 'Saving feedback...' : 'Log Private Note'}
                      </button>
                    </div>

                    {/* Notes listing */}
                    <div className="space-y-2.5 pt-3 border-t border-gray-100 max-h-56 overflow-y-auto">
                      {selectedAppDetail.notes?.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">No notes logged for this candidate yet.</p>
                      ) : (
                        selectedAppDetail.notes?.map((note: any) => (
                          <div key={note.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                            <p className="font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">"{note.noteText}"</p>
                            <p className="text-[9px] text-gray-400 mt-1.5 font-bold">
                              By {note.recruiterName || 'Screener'} on {new Date(note.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* Schedule Interview Modal overlay */}
      {showInterviewModal && selectedAppDetail && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Schedule Screening Interview</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Select Interview Date</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Select Time</label>
                <input
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowInterviewModal(false)}
                className="w-1/2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-black rounded-xl cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!interviewDate || !interviewTime) {
                    alert('Please select both date and time for the interview.');
                    return;
                  }
                  setShowInterviewModal(false);
                  
                  // Update status to Interview Scheduled
                  await handleStatusUpdate(selectedAppDetail.application.id, 'Interview Scheduled');
                  
                  // Add an automatic note
                  const noteBody = `Interview scheduled with candidate on ${new Date(interviewDate).toLocaleDateString()} at ${interviewTime}.`;
                  try {
                    await fetch(`/api/recruiter/applications/${selectedAppDetail.application.id}/notes`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ noteText: noteBody })
                    });
                    // Refresh
                    fetchAppDetail(selectedAppDetail.application.id);
                  } catch (err) {
                    console.error('Error auto-logging note:', err);
                  }
                }}
                className="w-1/2 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl cursor-pointer text-center shadow-md shadow-orange-600/10"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
