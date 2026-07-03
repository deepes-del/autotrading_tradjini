import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Calendar, MapPin, Check, Save, ArrowLeft, Info, HelpCircle } from 'lucide-react';
import { Profile } from '../types';

interface CandidateProfileEditProps {
  initialProfile: Profile;
  token: string;
  onSaveSuccess: (updatedProfile: Profile) => void;
  onCancel: () => void;
}

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export default function CandidateProfileEdit({ initialProfile, token, onSaveSuccess, onCancel }: CandidateProfileEditProps) {
  const [fullName, setFullName] = useState(initialProfile.fullName || '');
  const [age, setAge] = useState<string>(initialProfile.age ? String(initialProfile.age) : '');
  const [gender, setGender] = useState(initialProfile.gender || '');
  const [pincode, setPincode] = useState(initialProfile.pincode || '');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form Submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    const parsedAge = age ? parseInt(age, 10) : undefined;
    if (parsedAge !== undefined) {
      if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
        setError('Please enter a valid age between 1 and 120.');
        return;
      }
    }

    if (pincode && !/^\d{6}$/.test(pincode)) {
      setError('Pincode must be a 6-digit number.');
      return;
    }

    setLoading(true);

    const updatedProfile: Profile = {
      fullName: fullName.trim(),
      age: parsedAge,
      gender: gender || undefined,
      pincode: pincode || undefined,
    };

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedProfile)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      onSaveSuccess(data.candidate.profile);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto" id="profile-edit-section">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6" id="profile-edit-header">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
          id="profile-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Update Your Profile</h1>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-150 rounded-2xl shadow-xl shadow-gray-100/40 overflow-hidden" id="profile-edit-form">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-sm font-extrabold text-slate-800 tracking-wider uppercase flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Candidate Profile Information
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-medium">Please provide your details below. No documents are required.</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-100 flex items-start gap-2" id="profile-error-banner">
              <span className="font-semibold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  id="profile-input-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Age */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Age
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    placeholder="e.g. 25"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    id="profile-input-age"
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Gender
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  id="profile-input-gender"
                >
                  <option value="">Select Gender</option>
                  {GENDER_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Pincode
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <MapPin className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  placeholder="e.g. 560001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  id="profile-input-pincode"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 sm:p-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between" id="profile-edit-footer">
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" /> Fast apply is active.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-5 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              id="profile-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 py-2.5 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-orange-600/10 cursor-pointer disabled:opacity-55"
              id="profile-save-btn"
            >
              <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
