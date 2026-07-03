import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Upload, Trash2, Eye, RefreshCw, CheckCircle, 
  AlertTriangle, Clock, ArrowLeft, Calendar, FileDown, X, Shield, Info
} from 'lucide-react';
import { CandidateDocument, DocumentType } from '../types';

interface DocumentDefinition {
  key: DocumentType;
  label: string;
  description: string;
  allowedExts: string[];
  allowedLabel: string;
}

const DOCUMENT_TYPES: DocumentDefinition[] = [
  { 
    key: 'aadhaar', 
    label: 'Aadhaar Card', 
    description: 'National identification document (Front & Back merged or single sheet)', 
    allowedExts: ['.jpg', '.jpeg', '.png'], 
    allowedLabel: 'JPG, JPEG, PNG' 
  },
  { 
    key: 'pan', 
    label: 'PAN Card', 
    description: 'Permanent Account Number card issued by the Income Tax Department', 
    allowedExts: ['.jpg', '.jpeg', '.png'], 
    allowedLabel: 'JPG, JPEG, PNG' 
  },
  { 
    key: 'dl', 
    label: 'Driving License', 
    description: 'Valid motor vehicle driving license with visible license number', 
    allowedExts: ['.jpg', '.jpeg', '.png'], 
    allowedLabel: 'JPG, JPEG, PNG' 
  },
  { 
    key: 'resume', 
    label: 'Resume', 
    description: 'Updated professional CV detailing your past delivery or logistics experience', 
    allowedExts: ['.pdf'], 
    allowedLabel: 'PDF Only' 
  },
  { 
    key: 'photo', 
    label: 'Passport Size Photo', 
    description: 'Recent professional color passport-size photograph with a clear background', 
    allowedExts: ['.jpg', '.jpeg', '.png'], 
    allowedLabel: 'JPG, JPEG, PNG' 
  },
];

interface CandidateDocumentsProps {
  documents: CandidateDocument[];
  token: string;
  onBackToDashboard: () => void;
  onDocumentsUpdated: (updatedDocs: CandidateDocument[]) => void;
}

export default function CandidateDocuments({ 
  documents, 
  token, 
  onBackToDashboard, 
  onDocumentsUpdated 
}: CandidateDocumentsProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<DocumentType | null>(null);
  const [dragOverKey, setDragOverKey] = useState<DocumentType | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CandidateDocument | null>(null);

  const fileInputRefs = useRef<{ [key in DocumentType]?: HTMLInputElement | null }>({});

  const getDocOfKey = (key: DocumentType) => {
    return documents.find(d => d.documentType === key);
  };

  // Process File Upload (validation + base64 encoding + API call)
  const handleUploadFile = async (key: DocumentType, file: File, isReplace: boolean = false) => {
    setError(null);
    setSuccess(null);

    const def = DOCUMENT_TYPES.find(d => d.key === key);
    if (!def) return;

    // 1. Validate File Extension
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!def.allowedExts.includes(fileExt)) {
      setError(`Unsupported file type for ${def.label}. Please upload ${def.allowedLabel}.`);
      return;
    }

    // 2. Validate File Size (Max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`File is too large. Maximum size allowed is 5MB.`);
      return;
    }

    setUploadingKey(key);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Content = e.target?.result as string;
      if (!base64Content) {
        setError('Failed to read file content.');
        setUploadingKey(null);
        return;
      }

      try {
        const url = isReplace ? `/api/documents/${key}` : '/api/documents';
        const method = isReplace ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            documentType: key,
            fileName: file.name,
            fileContent: base64Content
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload document.');
        }

        // Fetch refreshed document list
        const listRes = await fetch('/api/documents', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const listData = await listRes.json();
        
        onDocumentsUpdated(listData.documents);
        setSuccess(`${def.label} ${isReplace ? 'replaced' : 'uploaded'} successfully!`);
      } catch (err: any) {
        setError(err.message || 'Failed to upload file.');
      } finally {
        setUploadingKey(null);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (key: DocumentType, e: React.ChangeEvent<HTMLInputElement>, isReplace: boolean) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(key, e.target.files[0], isReplace);
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent, key: DocumentType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(key);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
  };

  const handleDrop = (e: React.DragEvent, key: DocumentType, isReplace: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(key, e.dataTransfer.files[0], isReplace);
    }
  };

  // Delete Handler
  const handleDelete = async (key: DocumentType) => {
    if (!window.confirm(`Are you sure you want to delete your uploaded ${DOCUMENT_TYPES.find(d=>d.key===key)?.label}?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/documents/${key}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete document.');
      }

      // Fetch refreshed document list
      const listRes = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const listData = await listRes.json();
      
      onDocumentsUpdated(listData.documents);
      setSuccess(`${DOCUMENT_TYPES.find(d => d.key === key)?.label} deleted successfully.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete file.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
            <AlertTriangle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
            <Clock className="w-3 h-3" /> Under Review
          </span>
        );
    }
  };

  // Progress metrics
  const totalRequired = DOCUMENT_TYPES.length;
  const uploadedCount = documents.length;
  const missingCount = totalRequired - uploadedCount;
  const progressPercentage = Math.round((uploadedCount / totalRequired) * 100);

  return (
    <div className="w-full max-w-5xl mx-auto" id="documents-section">
      {/* Top Banner Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8" id="documents-header">
        <div>
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer mb-2"
            id="docs-back-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Required Documents</h1>
          <p className="text-sm text-gray-500">Please provide high-resolution copies of your credentials for verification</p>
        </div>

        {/* Dynamic overall progress badge card */}
        <div className="bg-white border border-gray-150 rounded-xl px-5 py-3.5 flex items-center gap-4 shadow-sm" id="docs-summary-indicator">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Documents Progress</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-extrabold text-gray-900">{progressPercentage}%</span>
              <span className="text-xs text-gray-400 font-medium">({uploadedCount}/{totalRequired} files)</span>
            </div>
          </div>
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="bg-orange-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="mb-6 p-4 bg-orange-50/50 border border-orange-100/60 rounded-2xl flex items-start gap-3 text-xs text-orange-800 leading-relaxed">
        <Shield className="w-4.5 h-4.5 text-orange-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Safe & Encrypted Storage:</span> Your personal files are stored securely in our isolated, encrypted workspace environment. Documents are only visible to verified ShiftCargo logistical managers and our automated compliance auditors.
        </div>
      </div>

      {/* Error & Success Messages */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2"
            id="docs-error-banner"
          >
            <span className="font-semibold">⚠️</span>
            <span>{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100 flex items-start gap-2 font-medium"
            id="docs-success-banner"
          >
            <span className="font-semibold">✓</span>
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="documents-grid-container">
        {DOCUMENT_TYPES.map((def) => {
          const uploaded = getDocOfKey(def.key);
          const isUploading = uploadingKey === def.key;
          const isDragging = dragOverKey === def.key;

          return (
            <div
              key={def.key}
              onDragOver={(e) => handleDragOver(e, def.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, def.key, !!uploaded)}
              className={`bg-white border rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between ${
                isDragging 
                  ? 'border-orange-500 bg-orange-50/20 scale-[1.01] shadow-lg shadow-orange-500/5' 
                  : uploaded 
                    ? 'border-gray-150 shadow-sm hover:shadow-md' 
                    : 'border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50'
              }`}
              id={`doc-card-${def.key}`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${uploaded ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{def.label}</h3>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-wider">{def.allowedLabel}</p>
                    </div>
                  </div>

                  {uploaded && getStatusBadge(uploaded.verificationStatus)}
                </div>

                <p className="text-xs text-gray-500 leading-relaxed mb-6">{def.description}</p>
              </div>

              {/* Action or Upload block */}
              <div>
                <input 
                  type="file"
                  ref={el => { fileInputRefs.current[def.key] = el; }}
                  onChange={(e) => handleFileChange(def.key, e, !!uploaded)}
                  accept={def.allowedExts.join(',')}
                  className="hidden"
                />

                {isUploading ? (
                  <div className="flex items-center justify-center gap-2.5 py-4 bg-gray-50 rounded-xl border border-gray-150">
                    <RefreshCw className="w-4 h-4 text-orange-600 animate-spin" />
                    <span className="text-xs font-semibold text-gray-600">Uploading File...</span>
                  </div>
                ) : uploaded ? (
                  <div className="space-y-4" id={`doc-uploaded-controls-${def.key}`}>
                    {/* Metadata display */}
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 flex items-center justify-between">
                      <div className="truncate max-w-[190px]">
                        <p className="font-bold text-gray-800 truncate" title={uploaded.fileName}>{uploaded.fileName}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> Uploaded {new Date(uploaded.uploadDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      
                      {/* Micro actions inside uploaded metadata box */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPreviewDoc(uploaded)}
                          className="p-1.5 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
                          title="Preview document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={uploaded.fileUrl}
                          download={uploaded.fileName}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center"
                          title="Download document"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Footer replace/delete triggers */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRefs.current[def.key]?.click()}
                        className="flex-1 py-2 px-3 border border-gray-200 hover:border-orange-500/30 hover:bg-orange-50/10 text-gray-700 hover:text-orange-600 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Replace
                      </button>
                      <button
                        onClick={() => handleDelete(def.key)}
                        className="py-2 px-3 border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-xl transition-all cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRefs.current[def.key]?.click()}
                    className="border border-dashed border-gray-300 hover:border-orange-500 hover:bg-white p-5 rounded-xl text-center cursor-pointer transition-all duration-200 group"
                  >
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-orange-500 mx-auto mb-2 transition-colors" />
                    <p className="text-xs font-semibold text-gray-700 group-hover:text-orange-600 transition-colors">Drag file here or browse</p>
                    <p className="text-[10px] text-gray-400 mt-1">Supports file up to 5MB</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Extra help instructions footer note */}
      <div className="mt-8 bg-white border border-gray-150 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-gray-800">What happens next?</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Once uploaded, documents enter verification review. You can safely change, replace, or download them at any time using this interface.</p>
          </div>
        </div>
        <button
          onClick={onBackToDashboard}
          className="py-2 px-5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
        >
          Return to Dashboard
        </button>
      </div>

      {/* Full Screen Image/PDF Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
            id="docs-preview-modal"
          >
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden relative shadow-2xl">
              
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {DOCUMENT_TYPES.find(d => d.key === previewDoc.documentType)?.label} Preview
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[280px] sm:max-w-md">{previewDoc.fileName}</p>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content body based on format */}
              <div className="flex-1 bg-gray-100 p-6 flex items-center justify-center overflow-auto min-h-[300px]">
                {previewDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                  <embed 
                    src={previewDoc.fileUrl} 
                    type="application/pdf" 
                    className="w-full h-[55vh] rounded-lg border border-gray-200"
                  />
                ) : (
                  <img 
                    src={previewDoc.fileUrl} 
                    alt="Document preview" 
                    className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-md"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Footer actions */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Uploaded {new Date(previewDoc.uploadDate).toLocaleString()}</span>
                <div className="flex gap-2">
                  <a
                    href={previewDoc.fileUrl}
                    download={previewDoc.fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-4 border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Download
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="py-2 px-4 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
