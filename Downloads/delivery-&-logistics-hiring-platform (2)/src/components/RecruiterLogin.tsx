import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, Key, Mail, ShieldAlert, Phone, Eye, EyeOff } from 'lucide-react';
import { Recruiter } from '../types';

interface RecruiterLoginProps {
  onSuccess: (recruiter: Recruiter, token: string) => void;
  onNavigateToRegister: () => void;
  onSwitchToCandidate: () => void;
}

export default function RecruiterLogin({ 
  onSuccess, 
  onNavigateToRegister,
  onSwitchToCandidate
}: RecruiterLoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please provide your mobile/email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/recruiter/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      onSuccess(data.recruiter, data.token);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto" id="recruiter-login-container">
      <div className="bg-white border border-gray-150 rounded-3xl p-8 shadow-xl shadow-gray-100/40">
        
        {/* Portal Info Badge */}
        <div className="flex justify-between items-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-100">
            Recruiter Portal
          </span>
          <button 
            type="button"
            onClick={onSwitchToCandidate}
            className="text-xs font-bold text-gray-500 hover:text-orange-600 transition-colors"
          >
            Apply as Candidate?
          </button>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Recruiter Sign In</h2>
          <p className="text-sm text-gray-400 mt-1">Manage ShiftCargo delivery openings and candidate compliance profiles</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs font-semibold rounded-2xl border border-red-100/60 flex items-start gap-2.5 leading-relaxed">
            <ShieldAlert className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email/Mobile field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Registered Mobile / Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. recruiter@company.com or 9876543210"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-2xl text-sm transition-all outline-none"
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Password</label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Key className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-2xl text-sm transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-orange-600/10 hover:shadow-orange-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Don't have an account yet?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-orange-600 font-bold hover:underline transition-all cursor-pointer"
            >
              Register your Company
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
