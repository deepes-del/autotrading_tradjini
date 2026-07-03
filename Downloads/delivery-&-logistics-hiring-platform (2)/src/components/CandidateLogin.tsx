import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, Lock, LogIn, ArrowRight } from 'lucide-react';
import { Candidate } from '../types';

interface CandidateLoginProps {
  onSuccess: (candidate: Candidate, token: string) => void;
  onNavigateToRegister: () => void;
}

export default function CandidateLogin({ onSuccess, onNavigateToRegister }: CandidateLoginProps) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobile: mobile.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      onSuccess(data.candidate, data.token);
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
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
      id="candidate-login-card"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-50 text-orange-600 mb-4">
          <LogIn className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Welcome Back</h2>
        <p className="text-sm text-gray-500 mt-1">Log in to manage your driver profile</p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2"
          id="login-error-banner"
        >
          <span className="font-semibold">⚠️</span>
          <span>{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
        <div>
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Mobile Number
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
              id="login-input-mobile"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Lock className="w-5 h-5" />
            </span>
            <input
              type="password"
              required
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              id="login-input-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer disabled:opacity-55"
          id="login-submit-btn"
        >
          {loading ? 'Logging in...' : 'Log In'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500" id="login-footer">
        Don't have an account?{' '}
        <button
          onClick={onNavigateToRegister}
          className="text-orange-600 font-semibold hover:underline focus:outline-none"
          id="login-to-reg-btn"
        >
          Register here
        </button>
      </div>
    </motion.div>
  );
}
