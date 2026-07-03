import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Phone, Mail, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import { Candidate } from '../types';

interface CandidateRegistrationProps {
  onSuccess: (candidate: Candidate, token: string) => void;
  onNavigateToLogin: () => void;
}

export default function CandidateRegistration({ onSuccess, onNavigateToLogin }: CandidateRegistrationProps) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (!mobile.trim()) {
      setError('Mobile Number is required.');
      return;
    }
    if (!/^\d{10}$/.test(mobile.trim())) {
      setError('Mobile Number must be exactly 10 digits.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          mobile,
          email: email || undefined,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      onSuccess(data.candidate, data.token);
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-100/50 p-8"
      id="candidate-registration-card"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-50 text-orange-600 mb-4">
          <User className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Create Account</h2>
        <p className="text-sm text-gray-500 mt-1">Join the delivery & logistics driver network</p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2"
          id="registration-error-banner"
        >
          <span className="font-semibold">⚠️</span>
          <span>{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" id="registration-form">
        <div>
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <User className="w-5 h-5" />
            </span>
            <input
              type="text"
              required
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
              placeholder="e.g. Amit Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              id="reg-input-name"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Phone className="w-5 h-5" />
            </span>
            <input
              type="tel"
              required
              maxLength={10}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
              id="reg-input-mobile"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Email Address <span className="text-gray-400">(Optional)</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Mail className="w-5 h-5" />
            </span>
            <input
              type="email"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
              placeholder="e.g. amit@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              id="reg-input-email"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Lock className="w-5 h-5" />
            </span>
            <input
              type="password"
              required
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              id="reg-input-password"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Lock className="w-5 h-5" />
            </span>
            <input
              type="password"
              required
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              id="reg-input-confirmpassword"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer disabled:opacity-55"
          id="reg-submit-btn"
        >
          {loading ? 'Creating Account...' : 'Register'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500" id="registration-footer">
        Already have an account?{' '}
        <button
          onClick={onNavigateToLogin}
          className="text-orange-600 font-semibold hover:underline focus:outline-none"
          id="reg-to-login-btn"
        >
          Log in
        </button>
      </div>
    </motion.div>
  );
}
