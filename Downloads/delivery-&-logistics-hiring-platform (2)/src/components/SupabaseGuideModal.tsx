import React from 'react';
import { 
  X, Copy, Check, Database, Key, Server, Terminal, 
  Activity, AlertCircle, AlertTriangle, CheckCircle2, 
  Wifi, FileText, RefreshCw, Lock
} from 'lucide-react';

interface SupabaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStatus?: { configured: boolean; active: boolean; mode: string; errorDetails?: string | null } | null;
  onRefreshStatus?: () => Promise<void>;
}

export default function SupabaseGuideModal({ isOpen, onClose, dbStatus, onRefreshStatus }: SupabaseGuideModalProps) {
  const [copiedText, setCopiedText] = React.useState<string | null>(null);
  const [reconnecting, setReconnecting] = React.useState(false);
  const [reconnectResult, setReconnectResult] = React.useState<{ success: boolean; errorDetails?: string | null } | null>(null);
  
  // Deep Diagnostics State
  const [diagnosticsLoading, setDiagnosticsLoading] = React.useState(false);
  const [diagnosticsData, setDiagnosticsData] = React.useState<any | null>(null);
  const [diagnosticsError, setDiagnosticsError] = React.useState<string | null>(null);

  // Live SQL Connection Ping State
  const [pingLoading, setPingLoading] = React.useState(false);
  const [pingResult, setPingResult] = React.useState<any | null>(null);
  const [pingError, setPingError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const runConnectionPing = async () => {
    setPingLoading(true);
    setPingResult(null);
    setPingError(null);
    try {
      const res = await fetch('/api/database-ping-sql');
      const data = await res.json();
      if (res.ok && data.success) {
        setPingResult(data);
      } else {
        setPingError(data.error || data.hint || 'Failed to execute database SQL ping.');
        if (data.hint || data.error) {
          setPingResult(data);
        }
      }
    } catch (err: any) {
      setPingError(err.message || 'Network error running SQL connection ping.');
    } finally {
      setPingLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    setDiagnosticsData(null);
    try {
      const res = await fetch('/api/database-diagnose');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      const data = await res.json();
      setDiagnosticsData(data);
    } catch (err: any) {
      setDiagnosticsError(err.message || 'Failed to fetch diagnostic details.');
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const triggerReconnect = async () => {
    setReconnecting(true);
    setReconnectResult(null);
    try {
      const res = await fetch('/api/database-reconnect', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setReconnectResult({ success: true });
        if (onRefreshStatus) await onRefreshStatus();
      } else {
        setReconnectResult({ success: false, errorDetails: data.errorDetails || 'Failed to establish cloud connection.' });
      }
    } catch (err: any) {
      setReconnectResult({ success: false, errorDetails: err.message || 'Network communication error.' });
    } finally {
      setReconnecting(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const sqlMigration = `-- 1. DROP EXISTING TABLES IF THEY ALREADY EXIST (CLEAN RESET)
-- This ensures you start with a fresh, clean database configuration.
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS recruiters CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;

-- 2. CREATE CORE DATABASE TABLES FOR YOUR RECRUITMENT PORTAL
-- Run these scripts directly in the Supabase SQL Editor

-- Candidates Table
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  email TEXT UNIQUE,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  profile JSONB DEFAULT '{}'::jsonb
);

-- Recruiters Table
CREATE TABLE IF NOT EXISTS recruiters (
  id TEXT PRIMARY KEY,
  "companyName" TEXT NOT NULL,
  "companyLogo" TEXT,
  "companyWebsite" TEXT,
  "recruiterName" TEXT,
  designation TEXT,
  mobile TEXT,
  email TEXT UNIQUE,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  status TEXT DEFAULT 'Approved',
  "createdAt" TEXT,
  "updatedAt" TEXT
);

-- Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  "recruiterId" TEXT NOT NULL,
  "companyName" TEXT,
  "companyLogo" TEXT,
  title TEXT NOT NULL,
  category TEXT,
  openings INTEGER,
  "employmentType" TEXT,
  state TEXT,
  city TEXT,
  area TEXT,
  "workLocation" TEXT,
  "minSalary" INTEGER,
  "maxSalary" INTEGER,
  "salaryType" TEXT,
  shift TEXT,
  "experienceRequired" INTEGER,
  "educationRequired" TEXT,
  "genderPreference" TEXT,
  "ageLimitMin" INTEGER,
  "ageLimitMax" INTEGER,
  "bikeRequired" TEXT,
  "drivingLicenseRequired" TEXT,
  "immediateJoining" TEXT,
  description TEXT,
  responsibilities TEXT,
  benefits TEXT,
  status TEXT DEFAULT 'Published',
  "applicationsCount" INTEGER DEFAULT 0,
  "viewsCount" INTEGER DEFAULT 0,
  "createdAt" TEXT,
  "updatedAt" TEXT
);

-- Applications Table
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "recruiterId" TEXT NOT NULL,
  "appliedDate" TEXT,
  "currentStatus" TEXT DEFAULT 'Applied',
  "withdrawStatus" TEXT DEFAULT 'Active',
  "lastUpdated" TEXT
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "uploadDate" TEXT,
  "verificationStatus" TEXT DEFAULT 'Pending'
);

-- 2. CREATE THE DATABASE PING DIAGNOSTIC FUNCTION
CREATE OR REPLACE FUNCTION ping_db()
RETURNS integer SECURITY DEFINER AS $$
BEGIN
  RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- 3. DISABLE ROW LEVEL SECURITY (RLS) FOR DEVELOPMENT OR CONFIGURE COMPREHENSIVE POLICIES
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;`;

  const envSample = `# Supabase Cloud Credentials
# Go to Supabase Project Settings -> API to copy your URL and Keys
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"`;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" id="supabase-guide-modal-overlay">
      <div 
        className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col"
        id="supabase-guide-modal"
      >
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 relative z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Supabase Postgres Cloud Database Integration
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Connect your workspace to persistent cloud storage on Supabase (Free Tier PostgreSQL)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            id="close-supabase-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Row: Quick status and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            
            {/* Status Card */}
            <div className="md:col-span-4 bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl space-y-3.5 flex flex-col justify-between h-full min-h-[170px] relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              <div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" /> Current Connection
                </h3>
                <div className="mt-2.5">
                  {dbStatus?.active ? (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 py-1.5 px-3 rounded-lg w-fit">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wide">Postgres Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 py-1.5 px-3 rounded-lg w-fit">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wide">Sandbox Fallback</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-normal mt-3">
                  {dbStatus?.active 
                    ? '🎉 Your application is successfully connected to Supabase and data is synchronized!' 
                    : 'Your server is using local sandbox state. In Sandbox Mode, all data is reset when the development server restarts.'}
                </p>
              </div>

              <div className="space-y-2 mt-2">
                <button
                  onClick={triggerReconnect}
                  disabled={reconnecting}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer"
                >
                  {reconnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      Sync & Reconnect
                    </>
                  )}
                </button>

                {reconnectResult && (
                  <div className={`p-2 rounded border text-[10px] font-bold ${
                    reconnectResult.success 
                      ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-400' 
                      : 'bg-red-950/20 border-red-800/60 text-red-400'
                  }`}>
                    {reconnectResult.success 
                      ? '✓ Connected successfully!' 
                      : `✗ Connection failed: ${reconnectResult.errorDetails}`}
                  </div>
                )}
              </div>
            </div>

            {/* Diagnostics Controls */}
            <div className="md:col-span-8 bg-slate-950/20 border border-slate-800/60 p-4 rounded-xl space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-slate-200 text-xs font-extrabold flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-500" /> Database Diagnostics & Tools
                  </h3>
                  <p className="text-[10.5px] text-slate-400">
                    Verify connectivity, test read/write speeds, and retrieve helpful troubleshooting suggestions.
                  </p>
                </div>
                <button
                  onClick={runDiagnostics}
                  disabled={diagnosticsLoading}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white disabled:opacity-50 font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {diagnosticsLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Diagnosing...
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      Run Cloud Diagnostic
                    </>
                  )}
                </button>
              </div>

              {/* Interactive SQL Query Test Ping Section */}
              <div className="relative z-10 bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-extrabold text-[11.5px] uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" /> Interactive PostgreSQL SQL Diagnostic Ping
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Executes an instant <code className="bg-slate-900 px-1 py-0.5 rounded text-pink-400 font-mono font-bold">SELECT 1</code> on your live Postgres database via RPC function test.
                    </p>
                  </div>
                  <button
                    onClick={runConnectionPing}
                    disabled={pingLoading}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white disabled:opacity-50 font-bold text-[11px] rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    {pingLoading ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Terminal className="w-3 h-3 text-emerald-500" />
                        Execute Ping Test
                      </>
                    )}
                  </button>
                </div>

                {pingResult && (
                  <div className={`p-3 rounded-lg border text-[11px] font-medium space-y-1.5 ${
                    pingResult.success 
                      ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300' 
                      : 'bg-amber-950/20 border-amber-800/60 text-amber-300'
                  }`}>
                    <div className="flex items-start gap-2">
                      {pingResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-bold">
                          {pingResult.success 
                            ? '🎉 Supabase Connection SQL Ping Success!' 
                            : '⚠️ Supabase RPC Issue Detected'}
                        </p>
                        <p className="text-[10px] text-slate-300 mt-0.5">
                          {pingResult.message || pingResult.error}
                        </p>
                      </div>
                    </div>

                    {pingResult.result !== undefined && (
                      <div className="mt-2 bg-slate-950/60 p-2 rounded border border-slate-800/80 font-mono text-[10px]">
                        <span className="text-slate-400 font-bold">PostgreSQL Response:</span>{' '}
                        <span className="text-emerald-400 font-black">{JSON.stringify(pingResult.result)}</span>
                      </div>
                    )}

                    {pingResult.hint && (
                      <div className="mt-2 bg-slate-950/30 p-2 rounded border border-slate-800/30 text-[10px] text-slate-400 leading-normal">
                        <span className="font-extrabold text-amber-400 uppercase tracking-wider block mb-1">💡 Troubleshooting Step:</span>
                        {pingResult.hint}
                      </div>
                    )}
                  </div>
                )}

                {pingError && !pingResult && (
                  <div className="bg-red-950/40 border border-red-900/60 text-red-300 p-3 rounded-lg text-[11px] font-bold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold">Execution Error</p>
                      <p className="text-[10px] font-medium text-red-400 mt-0.5">{pingError}</p>
                    </div>
                  </div>
                )}
              </div>

              {diagnosticsError && (
                <div className="bg-red-950/60 border border-red-900 text-red-300 p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 relative z-10">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {diagnosticsError}
                </div>
              )}

              {diagnosticsData && (
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-xs space-y-3 relative z-10 font-mono max-h-[250px] overflow-y-auto">
                  <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2">
                    <span className="font-bold uppercase text-[10px] text-emerald-500">Diagnostic Summary</span>
                    <span className="text-[9px]">{diagnosticsData.timestamp}</span>
                  </div>

                  <div className="text-slate-200 font-bold leading-normal">
                    Status: <span className={diagnosticsData.summary.includes('HEALTHY') ? 'text-emerald-400 font-black' : 'text-amber-400 font-black'}>{diagnosticsData.summary}</span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="text-slate-400 font-bold border-b border-slate-900 pb-1 mt-3">Environment State:</div>
                    <div>SUPABASE_URL: {diagnosticsData.env.SUPABASE_URL?.configured ? `✅ Loaded (${diagnosticsData.env.SUPABASE_URL.valueMasked})` : '❌ Missing'}</div>
                    <div>SUPABASE_ANON_KEY: {diagnosticsData.env.SUPABASE_ANON_KEY?.configured ? `✅ Loaded (${diagnosticsData.env.SUPABASE_ANON_KEY.valueMasked})` : '❌ Missing'}</div>
                    <div>SUPABASE_SERVICE_ROLE_KEY: {diagnosticsData.env.SUPABASE_SERVICE_ROLE_KEY?.configured ? `✅ Loaded (${diagnosticsData.env.SUPABASE_SERVICE_ROLE_KEY.valueMasked})` : '⚠️ Missing (Recommended but optional)'}</div>
                  </div>

                  {diagnosticsData.tables && (
                    <div className="space-y-1 text-[11px] mt-3">
                      <div className="text-slate-400 font-bold border-b border-slate-900 pb-1">Supabase PostgreSQL Tables Access:</div>
                      {Object.keys(diagnosticsData.tables).map((t) => (
                        <div key={t} className="flex justify-between">
                          <span>• {t}:</span>
                          <span className={diagnosticsData.tables[t].exists ? 'text-emerald-400' : 'text-red-400'}>
                            {diagnosticsData.tables[t].exists ? `✅ Active (${diagnosticsData.tables[t].recordsCount} records)` : `❌ Failed: ${diagnosticsData.tables[t].error}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {diagnosticsData.writePermission && (
                    <div className="text-[11px] mt-2">
                      <span className="text-slate-400 font-bold">Write Permissions:</span>{' '}
                      {diagnosticsData.writePermission.success ? (
                        <span className="text-emerald-400 font-bold">✅ Success (Read/Write/Delete OK)</span>
                      ) : (
                        <span className="text-red-400 font-bold">❌ Failed ({diagnosticsData.writePermission.error})</span>
                      )}
                    </div>
                  )}

                  {diagnosticsData.recommendations && diagnosticsData.recommendations.length > 0 && (
                    <div className="mt-3 bg-amber-950/20 border border-amber-900/60 p-3 rounded text-[11px] text-amber-200 font-sans font-medium space-y-1 leading-normal">
                      <span className="font-bold text-amber-400 uppercase tracking-wider block mb-1">Recommended Fixes:</span>
                      {diagnosticsData.recommendations.map((rec: string, i: number) => (
                        <div key={i} className="flex items-start gap-1">
                          <span className="text-amber-500 font-bold shrink-0">•</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Pricing Info Banner */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/25 p-4 rounded-xl flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-extrabold text-xs">Is Supabase Database Free?</h4>
              <p className="text-[11px] text-slate-300 leading-normal mt-1">
                <strong>Yes, absolutely!</strong> Supabase offers a generous, robust <strong>Free tier</strong> designed for developer exploration and smaller-scale apps:
              </p>
              <ul className="text-[10.5px] text-slate-400 list-disc pl-4 mt-2 space-y-1 leading-normal">
                <li><strong>Cloud Postgres Database:</strong> Stores up to <strong>500 MB of data</strong> completely free.</li>
                <li><strong>Unlimited Tables:</strong> Create unlimited relations, custom indexes, triggers, and full-text search.</li>
                <li><strong>Secure Access:</strong> Connect securely over client-side JS libraries or server-side Node.js SDK connections.</li>
                <li><strong>Zero Risk:</strong> No credit card is required to start your free project.</li>
              </ul>
            </div>
          </div>

          {/* Step-by-Step Installation Guide */}
          <div className="space-y-4">
            <h3 className="text-white text-sm font-extrabold flex items-center gap-1.5">
              <Server className="w-4 h-4 text-emerald-500" /> Step-by-Step Connection Instructions
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1 */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-xs">
                  1
                </div>
                <h4 className="font-extrabold text-xs text-white">Create a Free Supabase Project</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Go to the <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-bold">Supabase Console</a>, sign in with your GitHub account, and click <strong>"New project"</strong>. Select a region near you, choose a strong database password, and click Create.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-xs">
                  2
                </div>
                <h4 className="font-extrabold text-xs text-white">Run SQL Schema Migration</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  In your Supabase project console, click <strong>"SQL Editor"</strong> in the left sidebar, click <strong>"New query"</strong>, paste the complete SQL Migration script from below, and click <strong>Run</strong>. Note: This script automatically drops existing tables first to ensure a clean, fresh database reset.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-xs">
                  3
                </div>
                <h4 className="font-extrabold text-xs text-white">Retrieve API Keys & Credentials</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Go to <strong>Project Settings &gt; API</strong> in the left sidebar. Copy your Project URL, anon key, and service_role key.
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-xs">
                  4
                </div>
                <h4 className="font-extrabold text-xs text-white">Add Credentials to Workspace</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Open <strong>Settings &gt; Secrets</strong> in AI Studio (or edit your local <code className="text-emerald-400">.env</code> file). Add the keys under the variable names listed in the .env configuration snippet below.
                </p>
              </div>
            </div>
          </div>

          {/* Database SQL Migration Code Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-500" /> Database SQL Schema (Step 2 Script)
              </span>
              <button 
                onClick={() => handleCopy(sqlMigration, 'sql')}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedText === 'sql' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedText === 'sql' ? 'Copied migration script!' : 'Copy SQL schema'}
              </button>
            </div>
            
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-850 text-[10px] text-slate-400 font-mono">
                <span>postgresql-migration-schema.sql</span>
                <span className="text-slate-500">SQL SCRIPT</span>
              </div>
              <pre className="p-4 overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed max-h-[220px]">
                {sqlMigration}
              </pre>
            </div>
          </div>

          {/* Environment Variables Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-500" /> Environment Configurations (.env)
              </span>
              <button 
                onClick={() => handleCopy(envSample, 'env')}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedText === 'env' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedText === 'env' ? 'Copied env configuration!' : 'Copy env config'}
              </button>
            </div>
            
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-850 text-[10px] text-slate-400 font-mono">
                <span>.env configuration sample</span>
                <span className="text-slate-500">PROPERTIES FILE</span>
              </div>
              <pre className="p-4 overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed max-h-[220px]">
                {envSample}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> PostgreSQL client v2+ integrated securely.
          </div>
          <button 
            onClick={onClose}
            className="py-2 px-5 bg-slate-800 hover:bg-slate-750 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            id="close-guide-footer-btn"
          >
            Got It, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
