import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Building2, User, MapPin, Key, ShieldCheck, Mail, Phone, 
  ArrowLeft, Upload, Globe, Briefcase, RefreshCw, X 
} from 'lucide-react';
import { Recruiter } from '../types';

interface RecruiterRegistrationProps {
  onSuccess: (recruiter: Recruiter, token: string) => void;
  onNavigateToLogin: () => void;
  onSwitchToCandidate: () => void;
}

export default function RecruiterRegistration({ 
  onSuccess, 
  onNavigateToLogin,
  onSwitchToCandidate
}: RecruiterRegistrationProps) {
  // Company Info
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');

  // Recruiter Info
  const [recruiterName, setRecruiterName] = useState('');
  const [designation, setDesignation] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Company Address
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // States
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  // Convert logo file to base64
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validation
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

  const handleRemoveLogo = () => {
    setCompanyLogo('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate Required Fields
    if (
      !companyName.trim() ||
      !recruiterName.trim() ||
      !designation.trim() ||
      !mobile.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword ||
      !address.trim() ||
      !city.trim() ||
      !state.trim() ||
      !pincode.trim()
    ) {
      setError('Please fill in all required fields marked with *.');
      return;
    }

    // Passwords Match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Phone Format
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/recruiter/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyLogo,
          companyWebsite: companyWebsite.trim(),
          recruiterName: recruiterName.trim(),
          designation: designation.trim(),
          mobile: cleanMobile,
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed. Please check details.');
      }

      // Automatically log in or show registration completion.
      // Wait, let's login right away if the backend registers.
      // Since status is "Pending", logging in will return status: 'Pending'.
      // Our dashboard handles the 'Pending' screen perfectly!
      // Let's call the login API automatically to get the token, or wait, does the register API return the token? No, let's execute login now.
      const loginResponse = await fetch('/api/recruiter/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier: email.trim().toLowerCase(),
          password
        })
      });

      const loginData = await loginResponse.json();
      if (loginResponse.ok) {
        onSuccess(loginData.recruiter, loginData.token);
      } else {
        // Fallback if login fails, redirect to login page with success alert
        alert('Registered successfully! Please log in.');
        onNavigateToLogin();
      }

    } catch (err: any) {
      setError(err.message || 'Server error during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto" id="recruiter-reg-container">
      
      {/* Back button */}
      <button
        onClick={onNavigateToLogin}
        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-950 transition-colors mb-6 cursor-pointer"
        id="reg-back-btn"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Recruiter Login
      </button>

      <div className="bg-white border border-gray-150 rounded-3xl p-8 shadow-xl shadow-gray-100/40">
        
        {/* Header portal info */}
        <div className="flex justify-between items-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-100">
            ShiftCargo Enterprise
          </span>
          <button 
            type="button"
            onClick={onSwitchToCandidate}
            className="text-xs font-bold text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
          >
            Apply as Candidate?
          </button>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Register Recruiter Company</h2>
          <p className="text-sm text-gray-400 mt-1">Join the premier ShiftCargo freight delivery network to recruit compliance-verified drivers and handlers.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs font-semibold rounded-2xl border border-red-100/60 leading-relaxed flex items-start gap-2.5">
            <span className="text-red-600 shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Company Information */}
          <div className="space-y-4" id="reg-company-section">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">Company Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Name *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Logistical Solutions"
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

            {/* Logo upload block */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Logo</label>
              <div className="flex items-center gap-4">
                {companyLogo ? (
                  <div className="relative w-16 h-16 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                    <img src={companyLogo} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-gray-50 text-gray-400 shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1">
                  <input
                    type="file"
                    id="logo-input"
                    accept=".jpg,.jpeg,.png"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('logo-input')?.click()}
                    disabled={logoUploading}
                    className="py-2 px-4 border border-gray-200 hover:border-orange-500/30 hover:bg-orange-50/10 text-gray-700 hover:text-orange-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  >
                    {logoUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {companyLogo ? 'Change Logo' : 'Upload Corporate Logo'}
                  </button>
                  <p className="text-[10px] text-gray-400 mt-1.5">Supports JPG, JPEG, or PNG. Maximum size 2MB.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Recruiter Personal Details */}
          <div className="space-y-4" id="reg-recruiter-section">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <User className="w-5 h-5 text-orange-600" />
              <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">Recruiter Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Recruiter Name *</label>
                <input
                  type="text"
                  required
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Designation / Role *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Briefcase className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. HR Manager, Talent Acquisition"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Mobile Number *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Corporate Email Address *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Password *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Key className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Confirm Password *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Company Address */}
          <div className="space-y-4" id="reg-address-section">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">Company Address</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Street Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="HQ Block / Suite No, Building Name, Industrial Area"
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
                  placeholder="e.g. Mumbai"
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
                  placeholder="e.g. Maharashtra"
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
                  placeholder="6-digit ZIP code"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl text-xs transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading || logoUploading}
              className="flex-1 py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-orange-600/15 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating Enterprise Profile...
                </>
              ) : (
                'Register Corporate Account'
              )}
            </button>

            <button
              type="button"
              onClick={onNavigateToLogin}
              className="py-3 px-6 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-2xl transition-all text-center cursor-pointer"
            >
              Cancel
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
