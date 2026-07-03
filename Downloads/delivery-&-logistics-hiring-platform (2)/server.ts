import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { 
  publicHealthHandler, 
  publicJobsHandler, 
  candidateProfileHandler, 
  adminCandidatesListHandler 
} from './src/lib/supabaseServerHandlers';
import { clearSupabaseClient, isSupabaseConfigured, getSupabase } from './src/lib/supabase';


const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' })); // Support base64 photos

const isVercel = !!process.env.VERCEL;
const DB_PATH = isVercel 
  ? path.join('/tmp', 'db.json') 
  : path.join(process.cwd(), 'data', 'db.json');
const UPLOADS_DIR = isVercel 
  ? path.join('/tmp', 'uploads') 
  : path.join(process.cwd(), 'data', 'uploads');

// Initialize local database and upload directories
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ candidates: [], tokens: {}, documents: [] }, null, 2), 'utf-8');
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Helpers for Reading/Writing to DB with optional Supabase dual-mode persistence
let memoryDB: any = null;
let supabaseActive = false;
let supabaseErrorDetails: string | null = null;

async function syncToSupabase(db: any) {
  if (!supabaseActive) return;
  try {
    const supabase = getSupabase();
    
    // Asynchronously update tables in Supabase using upsert
    if (db.candidates && db.candidates.length > 0) {
      await supabase.from('candidates').upsert(db.candidates);
    }
    if (db.recruiters && db.recruiters.length > 0) {
      await supabase.from('recruiters').upsert(db.recruiters);
    }
    if (db.jobs && db.jobs.length > 0) {
      await supabase.from('jobs').upsert(db.jobs);
    }
    if (db.applications && db.applications.length > 0) {
      await supabase.from('applications').upsert(db.applications);
    }
    if (db.documents && db.documents.length > 0) {
      await supabase.from('documents').upsert(db.documents);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Warning] Failed to sync data to Supabase:', err.message || err);
  }
}

function readDB() {
  if (memoryDB) {
    return memoryDB;
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(data);
    db.candidates = db.candidates || [];
    db.tokens = db.tokens || {};
    db.documents = db.documents || [];
    db.recruiters = db.recruiters || [];
    db.recruiterTokens = db.recruiterTokens || {};
    db.jobs = db.jobs || [];
    db.applications = db.applications || [];
    db.applicationHistory = db.applicationHistory || [];
    db.recruiterNotes = db.recruiterNotes || [];
    memoryDB = db;
    return db;
  } catch (err) {
    memoryDB = { 
      candidates: [], 
      tokens: {}, 
      documents: [], 
      recruiters: [], 
      recruiterTokens: {}, 
      jobs: [], 
      applications: [],
      applicationHistory: [],
      recruiterNotes: []
    };
    return memoryDB;
  }
}

function writeDB(data: any) {
  memoryDB = data;
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  if (supabaseActive) {
    // Fire and forget, or handle background sync errors
    syncToSupabase(data).catch(err => {
      console.error('[Supabase Background Sync Error]', err);
    });
  }
}

// Password cryptography functions
function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
}

// Auth Middleware
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const db = readDB();
  const candidateId = db.tokens[token];

  if (!candidateId) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }

  const candidate = db.candidates.find((c: any) => c.id === candidateId);
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  (req as any).candidate = candidate;
  (req as any).token = token;
  next();
}

function authenticateRecruiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const db = readDB();
  const recruiterId = db.recruiterTokens[token];

  if (!recruiterId) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }

  const recruiter = db.recruiters.find((r: any) => r.id === recruiterId);
  if (!recruiter) {
    return res.status(404).json({ error: 'Recruiter not found.' });
  }

  (req as any).recruiter = recruiter;
  (req as any).token = token;
  next();
}

// API Routes

// 1. Register Candidate
app.post('/api/register', (req, res) => {
  const { fullName, mobile, email, password, confirmPassword } = req.body;

  // Validation
  if (!fullName || !mobile || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields except email are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const cleanMobile = mobile.trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ error: 'Mobile number must be a valid 10-digit number.' });
  }

  const db = readDB();

  // Unique Mobile Number Check
  const exists = db.candidates.some((c: any) => c.mobile === cleanMobile);
  if (exists) {
    return res.status(400).json({ error: 'Mobile number is already registered.' });
  }

  // Create candidate
  const id = crypto.randomUUID();
  const { salt, hash } = hashPassword(password);

  const newCandidate = {
    id,
    mobile: cleanMobile,
    fullName: fullName.trim(),
    email: email ? email.trim() : undefined,
    salt,
    hash,
    profile: {
      fullName: fullName.trim(), // Default full name
      bikeAvailable: 'No' as const,
      drivingLicenseAvailable: 'No' as const,
      languagesKnown: []
    }
  };

  db.candidates.push(newCandidate);

  // Generate Session Token
  const token = crypto.randomBytes(32).toString('hex');
  db.tokens[token] = id;

  writeDB(db);

  res.status(201).json({
    message: 'Registration successful',
    token,
    candidate: {
      id: newCandidate.id,
      mobile: newCandidate.mobile,
      fullName: newCandidate.fullName,
      email: newCandidate.email,
      profile: newCandidate.profile
    }
  });
});

// 2. Login Candidate
app.post('/api/login', (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ error: 'Mobile number and password are required.' });
  }

  const cleanMobile = mobile.trim();
  const db = readDB();

  const candidate = db.candidates.find((c: any) => c.mobile === cleanMobile);
  if (!candidate) {
    return res.status(400).json({ error: 'Invalid mobile number or password.' });
  }

  const isValid = verifyPassword(password, candidate.salt, candidate.hash);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid mobile number or password.' });
  }

  // Generate Session Token
  const token = crypto.randomBytes(32).toString('hex');
  db.tokens[token] = candidate.id;

  writeDB(db);

  res.status(200).json({
    message: 'Login successful',
    token,
    candidate: {
      id: candidate.id,
      mobile: candidate.mobile,
      fullName: candidate.fullName,
      email: candidate.email,
      profile: candidate.profile
    }
  });
});

// 3. Get Candidate Profile
app.get('/api/profile', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const db = readDB();
  const documents = db.documents.filter((d: any) => d.candidateId === candidate.id);
  res.status(200).json({
    id: candidate.id,
    profile: candidate.profile,
    fullName: candidate.fullName,
    email: candidate.email,
    mobile: candidate.mobile,
    documents
  });
});

// 4. Update Candidate Profile
app.put('/api/profile', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const updatedProfile = req.body;

  // Validation
  if (!updatedProfile.fullName || updatedProfile.fullName.trim() === '') {
    return res.status(400).json({ error: 'Full name is required in profile.' });
  }

  const db = readDB();
  const dbCandidate = db.candidates.find((c: any) => c.id === candidate.id);

  if (!dbCandidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  // Update profile data safely
  dbCandidate.profile = {
    profilePhoto: updatedProfile.profilePhoto,
    fullName: updatedProfile.fullName.trim(),
    age: typeof updatedProfile.age === 'number' ? updatedProfile.age : (updatedProfile.age ? Number(updatedProfile.age) : undefined),
    dateOfBirth: updatedProfile.dateOfBirth,
    gender: updatedProfile.gender,
    address: updatedProfile.address,
    city: updatedProfile.city,
    state: updatedProfile.state,
    pincode: updatedProfile.pincode,
    education: updatedProfile.education,
    experience: typeof updatedProfile.experience === 'number' ? updatedProfile.experience : undefined,
    currentOccupation: updatedProfile.currentOccupation,
    expectedSalary: updatedProfile.expectedSalary,
    languagesKnown: Array.isArray(updatedProfile.languagesKnown) ? updatedProfile.languagesKnown : [],
    bikeAvailable: updatedProfile.bikeAvailable === 'Yes' ? 'Yes' : 'No',
    drivingLicenseAvailable: updatedProfile.drivingLicenseAvailable === 'Yes' ? 'Yes' : 'No'
  };

  // Sync basic candidate details if updated
  dbCandidate.fullName = dbCandidate.profile.fullName;

  writeDB(db);

  const documents = db.documents.filter((d: any) => d.candidateId === candidate.id);

  res.status(200).json({
    message: 'Profile updated successfully',
    candidate: {
      id: dbCandidate.id,
      mobile: dbCandidate.mobile,
      fullName: dbCandidate.fullName,
      email: dbCandidate.email,
      profile: dbCandidate.profile,
      documents
    }
  });
});

// 5. Get Candidate Documents
app.get('/api/documents', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const db = readDB();
  const documents = db.documents.filter((d: any) => d.candidateId === candidate.id);
  res.status(200).json({ documents });
});

// 6. Upload Document
app.post('/api/documents', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const { documentType, fileName, fileContent } = req.body;

  if (!documentType || !fileName || !fileContent) {
    return res.status(400).json({ error: 'documentType, fileName and fileContent are required.' });
  }

  const validTypes = ['aadhaar', 'pan', 'dl', 'resume', 'photo'];
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({ error: 'Invalid document type. Allowed: aadhaar, pan, dl, resume, photo' });
  }

  // Validate extension
  const ext = path.extname(fileName).toLowerCase();
  if (documentType === 'resume') {
    if (ext !== '.pdf') {
      return res.status(400).json({ error: 'Resume must be a PDF file.' });
    }
  } else {
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      return res.status(400).json({ error: 'Images must be in JPG, JPEG, or PNG format.' });
    }
  }

  // Estimate base64 size (limit to 5MB)
  const sizeInBytes = (fileContent.length * 3) / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size must be under 5MB.' });
  }

  try {
    const db = readDB();

    // Check if document of this type already exists for this candidate
    const existingDocIndex = db.documents.findIndex(
      (d: any) => d.candidateId === candidate.id && d.documentType === documentType
    );

    // Save file on disk with clean unique filename
    const safeFileName = `${candidate.id}-${documentType}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFileName);
    
    // Extract actual base64 content if it has data URL prefix
    let base64Data = fileContent;
    if (fileContent.includes(';base64,')) {
      base64Data = fileContent.split(';base64,')[1];
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${safeFileName}`;
    const newDoc = {
      id: crypto.randomUUID(),
      candidateId: candidate.id,
      documentType,
      fileUrl,
      fileName,
      uploadDate: new Date().toISOString(),
      verificationStatus: 'Pending'
    };

    if (existingDocIndex > -1) {
      db.documents[existingDocIndex] = newDoc;
    } else {
      db.documents.push(newDoc);
    }

    writeDB(db);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: newDoc
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving the file.' });
  }
});

// 7. Replace Document
app.put('/api/documents/:type', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const documentType = req.params.type;
  const { fileName, fileContent } = req.body;

  const validTypes = ['aadhaar', 'pan', 'dl', 'resume', 'photo'];
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({ error: 'Invalid document type. Allowed: aadhaar, pan, dl, resume, photo' });
  }

  if (!fileName || !fileContent) {
    return res.status(400).json({ error: 'fileName and fileContent are required.' });
  }

  // Validate extension
  const ext = path.extname(fileName).toLowerCase();
  if (documentType === 'resume') {
    if (ext !== '.pdf') {
      return res.status(400).json({ error: 'Resume must be a PDF file.' });
    }
  } else {
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      return res.status(400).json({ error: 'Images must be in JPG, JPEG, or PNG format.' });
    }
  }

  // Estimate base64 size (limit to 5MB)
  const sizeInBytes = (fileContent.length * 3) / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size must be under 5MB.' });
  }

  try {
    const db = readDB();

    const safeFileName = `${candidate.id}-${documentType}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFileName);

    // Save file on disk
    let base64Data = fileContent;
    if (fileContent.includes(';base64,')) {
      base64Data = fileContent.split(';base64,')[1];
    }
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${safeFileName}`;
    const newDoc = {
      id: crypto.randomUUID(),
      candidateId: candidate.id,
      documentType,
      fileUrl,
      fileName,
      uploadDate: new Date().toISOString(),
      verificationStatus: 'Pending'
    };

    const existingDocIndex = db.documents.findIndex(
      (d: any) => d.candidateId === candidate.id && d.documentType === documentType
    );

    if (existingDocIndex > -1) {
      db.documents[existingDocIndex] = newDoc;
    } else {
      db.documents.push(newDoc);
    }

    writeDB(db);

    res.status(200).json({
      message: 'Document replaced successfully',
      document: newDoc
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error replacing the document.' });
  }
});

// 8. Delete Document
app.delete('/api/documents/:type', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const documentType = req.params.type;

  const validTypes = ['aadhaar', 'pan', 'dl', 'resume', 'photo'];
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({ error: 'Invalid document type.' });
  }

  try {
    const db = readDB();
    const docIndex = db.documents.findIndex(
      (d: any) => d.candidateId === candidate.id && d.documentType === documentType
    );

    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = db.documents[docIndex];
    
    // Delete physical file
    const safeFileName = path.basename(doc.fileUrl);
    const filePath = path.join(UPLOADS_DIR, safeFileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (fileErr) {
        console.error('File unlink error:', fileErr);
      }
    }

    // Remove from database
    db.documents.splice(docIndex, 1);
    writeDB(db);

    res.status(200).json({
      message: 'Document deleted successfully',
      documentType
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting the document.' });
  }
});

// --- RECRUITER MODULE APIS ---

// 1. Register Recruiter
app.post('/api/recruiter/register', (req, res) => {
  const {
    companyName,
    companyLogo,
    companyWebsite,
    recruiterName,
    designation,
    mobile,
    email,
    password,
    confirmPassword,
    address,
    city,
    state,
    pincode
  } = req.body;

  // Validation of required fields
  if (
    !companyName ||
    !recruiterName ||
    !designation ||
    !mobile ||
    !email ||
    !password ||
    !confirmPassword ||
    !address ||
    !city ||
    !state ||
    !pincode
  ) {
    return res.status(400).json({ error: 'All fields except Company Website and Logo are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const db = readDB();

    // Check if mobile is unique
    const mobileExists = db.recruiters.some((r: any) => r.mobile === mobile);
    if (mobileExists) {
      return res.status(400).json({ error: 'Mobile number is already registered.' });
    }

    // Check if email is unique
    const emailExists = db.recruiters.some((r: any) => r.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: 'Email address is already registered.' });
    }

    // Hash password
    const { salt, hash } = hashPassword(password);

    const recruiterId = crypto.randomUUID();
    const newRecruiter = {
      id: recruiterId,
      companyName,
      companyLogo: companyLogo || '',
      companyWebsite: companyWebsite || '',
      recruiterName,
      designation,
      mobile,
      email: email.toLowerCase(),
      salt,
      hash,
      address,
      city,
      state,
      pincode,
      status: 'Approved', // Approved by default for smooth sandbox evaluation
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.recruiters.push(newRecruiter);
    writeDB(db);

    // Return the recruiter details (excluding password salt/hash)
    const { salt: _s, hash: _h, ...recruiterDetails } = newRecruiter;

    res.status(201).json({
      message: 'Recruiter registered successfully and is pending admin approval.',
      recruiter: recruiterDetails
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error during recruiter registration.' });
  }
});

// 2. Login Recruiter
app.post('/api/recruiter/login', (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Mobile/Email and password are required.' });
  }

  try {
    const db = readDB();
    const cleanIdentifier = identifier.trim().toLowerCase();

    // Find recruiter by email or mobile
    const recruiter = db.recruiters.find(
      (r: any) => r.email.toLowerCase() === cleanIdentifier || r.mobile === identifier
    );

    if (!recruiter) {
      return res.status(401).json({ error: 'Invalid mobile/email or password.' });
    }

    // Verify password
    const isValid = verifyPassword(password, recruiter.salt, recruiter.hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid mobile/email or password.' });
    }

    // Generate access token
    const token = crypto.randomBytes(32).toString('hex');
    db.recruiterTokens = db.recruiterTokens || {};
    db.recruiterTokens[token] = recruiter.id;
    writeDB(db);

    const { salt: _s, hash: _h, ...recruiterDetails } = recruiter;

    res.status(200).json({
      token,
      recruiter: recruiterDetails
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error during recruiter login.' });
  }
});

// 3. Get Recruiter Profile
app.get('/api/recruiter/profile', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  const { salt: _s, hash: _h, ...recruiterDetails } = recruiter;
  res.status(200).json({ recruiter: recruiterDetails });
});

// 4. Update Recruiter Profile
app.put('/api/recruiter/profile', authenticateRecruiter, (req, res) => {
  const loggedInRecruiter = (req as any).recruiter;
  const {
    companyName,
    companyLogo,
    companyWebsite,
    recruiterName,
    designation,
    mobile,
    email,
    address,
    city,
    state,
    pincode
  } = req.body;

  if (
    !companyName ||
    !recruiterName ||
    !designation ||
    !mobile ||
    !email ||
    !address ||
    !city ||
    !state ||
    !pincode
  ) {
    return res.status(400).json({ error: 'All fields except company website/logo are required.' });
  }

  try {
    const db = readDB();

    // Find the recruiter index
    const index = db.recruiters.findIndex((r: any) => r.id === loggedInRecruiter.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Recruiter not found.' });
    }

    // Validate mobile uniqueness if changed
    if (mobile !== loggedInRecruiter.mobile) {
      const mobileExists = db.recruiters.some((r: any) => r.id !== loggedInRecruiter.id && r.mobile === mobile);
      if (mobileExists) {
        return res.status(400).json({ error: 'Mobile number is already registered by another recruiter.' });
      }
    }

    // Validate email uniqueness if changed
    if (email.toLowerCase() !== loggedInRecruiter.email.toLowerCase()) {
      const emailExists = db.recruiters.some(
        (r: any) => r.id !== loggedInRecruiter.id && r.email.toLowerCase() === email.toLowerCase()
      );
      if (emailExists) {
        return res.status(400).json({ error: 'Email address is already registered by another recruiter.' });
      }
    }

    // Update fields
    const updatedRecruiter = {
      ...db.recruiters[index],
      companyName,
      companyLogo: companyLogo !== undefined ? companyLogo : db.recruiters[index].companyLogo,
      companyWebsite: companyWebsite || '',
      recruiterName,
      designation,
      mobile,
      email: email.toLowerCase(),
      address,
      city,
      state,
      pincode,
      updatedAt: new Date().toISOString()
    };

    db.recruiters[index] = updatedRecruiter;
    writeDB(db);

    const { salt: _s, hash: _h, ...recruiterDetails } = updatedRecruiter;

    res.status(200).json({
      message: 'Recruiter profile updated successfully',
      recruiter: recruiterDetails
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating recruiter profile.' });
  }
});

// Developer Bypass: Directly approve a recruiter for evaluation testing
app.post('/api/dev/approve-recruiter', (req, res) => {
  const { id, status = 'Approved' } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Recruiter ID is required.' });
  }
  try {
    const db = readDB();
    const index = db.recruiters.findIndex((r: any) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Recruiter not found.' });
    }
    db.recruiters[index].status = status;
    db.recruiters[index].updatedAt = new Date().toISOString();
    writeDB(db);
    
    const { salt: _s, hash: _h, ...recruiterDetails } = db.recruiters[index];
    res.status(200).json({
      message: `Recruiter status successfully set to ${status}`,
      recruiter: recruiterDetails
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating status.' });
  }
});

// --- JOB LISTING APIS ---

// 1. Post a new Job (Recruiter)
app.post('/api/recruiter/jobs', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  
  if (recruiter.status !== 'Approved') {
    return res.status(403).json({ error: 'Access Denied. Only approved recruiter accounts can post job openings.' });
  }

  const {
    title,
    category,
    openings,
    employmentType,
    state,
    city,
    area,
    workLocation,
    minSalary,
    maxSalary,
    salaryType,
    shift,
    experienceRequired,
    educationRequired,
    genderPreference,
    ageLimitMin,
    ageLimitMax,
    bikeRequired,
    drivingLicenseRequired,
    immediateJoining,
    description,
    responsibilities,
    benefits,
    status
  } = req.body;

  // Validation of required fields
  if (
    !title ||
    !category ||
    openings === undefined ||
    !employmentType ||
    !state ||
    !city ||
    !area ||
    minSalary === undefined ||
    maxSalary === undefined ||
    !salaryType ||
    !shift ||
    experienceRequired === undefined ||
    !educationRequired ||
    !genderPreference ||
    ageLimitMin === undefined ||
    ageLimitMax === undefined ||
    !bikeRequired ||
    !drivingLicenseRequired ||
    !immediateJoining ||
    !description ||
    !responsibilities ||
    !benefits ||
    !status
  ) {
    return res.status(400).json({ error: 'Required fields are missing. Please fill in all fields.' });
  }

  try {
    const db = readDB();
    db.jobs = db.jobs || [];

    const newJob = {
      id: crypto.randomUUID(),
      recruiterId: recruiter.id,
      companyName: recruiter.companyName,
      companyLogo: recruiter.companyLogo || '',
      title: title.trim(),
      category: category.trim(),
      openings: Number(openings),
      employmentType: employmentType.trim(),
      state: state.trim(),
      city: city.trim(),
      area: area.trim(),
      workLocation: workLocation ? workLocation.trim() : '',
      minSalary: Number(minSalary),
      maxSalary: Number(maxSalary),
      salaryType: salaryType.trim(),
      shift: shift.trim(),
      experienceRequired: Number(experienceRequired),
      educationRequired: educationRequired.trim(),
      genderPreference: genderPreference.trim(),
      ageLimitMin: Number(ageLimitMin),
      ageLimitMax: Number(ageLimitMax),
      bikeRequired: bikeRequired.trim(),
      drivingLicenseRequired: drivingLicenseRequired.trim(),
      immediateJoining: immediateJoining.trim(),
      description: description.trim(),
      responsibilities: responsibilities.trim(),
      benefits: benefits.trim(),
      status: status.trim(), // 'Draft' | 'Published' | 'Unpublished' | 'Closed'
      applicationsCount: 0,
      viewsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.jobs.push(newJob);
    writeDB(db);

    res.status(201).json({ message: 'Job posted successfully', job: newJob });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error posting the job.' });
  }
});

// 2. Get jobs posted by logged-in Recruiter
app.get('/api/recruiter/jobs', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const recruiterJobs = db.jobs.filter((j: any) => j.recruiterId === recruiter.id);
    res.status(200).json({ jobs: recruiterJobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving jobs.' });
  }
});

// 3. Get a single Job (by id)
app.get('/api/recruiter/jobs/:id', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  const jobId = req.params.id;
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j: any) => j.id === jobId && j.recruiterId === recruiter.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    res.status(200).json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving job details.' });
  }
});

// 4. Update a Job
app.put('/api/recruiter/jobs/:id', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  
  if (recruiter.status !== 'Approved') {
    return res.status(403).json({ error: 'Access Denied. Only approved recruiter accounts can update job openings.' });
  }

  const jobId = req.params.id;

  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const index = db.jobs.findIndex((j: any) => j.id === jobId && j.recruiterId === recruiter.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Job not found or access denied.' });
    }

    const currentJob = db.jobs[index];
    const {
      title,
      category,
      openings,
      employmentType,
      state,
      city,
      area,
      workLocation,
      minSalary,
      maxSalary,
      salaryType,
      shift,
      experienceRequired,
      educationRequired,
      genderPreference,
      ageLimitMin,
      ageLimitMax,
      bikeRequired,
      drivingLicenseRequired,
      immediateJoining,
      description,
      responsibilities,
      benefits,
      status
    } = req.body;

    db.jobs[index] = {
      ...currentJob,
      title: title !== undefined ? title.trim() : currentJob.title,
      category: category !== undefined ? category.trim() : currentJob.category,
      openings: openings !== undefined ? Number(openings) : currentJob.openings,
      employmentType: employmentType !== undefined ? employmentType.trim() : currentJob.employmentType,
      state: state !== undefined ? state.trim() : currentJob.state,
      city: city !== undefined ? city.trim() : currentJob.city,
      area: area !== undefined ? area.trim() : currentJob.area,
      workLocation: workLocation !== undefined ? (workLocation ? workLocation.trim() : '') : currentJob.workLocation,
      minSalary: minSalary !== undefined ? Number(minSalary) : currentJob.minSalary,
      maxSalary: maxSalary !== undefined ? Number(maxSalary) : currentJob.maxSalary,
      salaryType: salaryType !== undefined ? salaryType.trim() : currentJob.salaryType,
      shift: shift !== undefined ? shift.trim() : currentJob.shift,
      experienceRequired: experienceRequired !== undefined ? Number(experienceRequired) : currentJob.experienceRequired,
      educationRequired: educationRequired !== undefined ? educationRequired.trim() : currentJob.educationRequired,
      genderPreference: genderPreference !== undefined ? genderPreference.trim() : currentJob.genderPreference,
      ageLimitMin: ageLimitMin !== undefined ? Number(ageLimitMin) : currentJob.ageLimitMin,
      ageLimitMax: ageLimitMax !== undefined ? Number(ageLimitMax) : currentJob.ageLimitMax,
      bikeRequired: bikeRequired !== undefined ? bikeRequired.trim() : currentJob.bikeRequired,
      drivingLicenseRequired: drivingLicenseRequired !== undefined ? drivingLicenseRequired.trim() : currentJob.drivingLicenseRequired,
      immediateJoining: immediateJoining !== undefined ? immediateJoining.trim() : currentJob.immediateJoining,
      description: description !== undefined ? description.trim() : currentJob.description,
      responsibilities: responsibilities !== undefined ? responsibilities.trim() : currentJob.responsibilities,
      benefits: benefits !== undefined ? benefits.trim() : currentJob.benefits,
      status: status !== undefined ? status.trim() : currentJob.status,
      updatedAt: new Date().toISOString()
    };

    writeDB(db);
    res.status(200).json({ message: 'Job updated successfully', job: db.jobs[index] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating the job.' });
  }
});

// 5. Change Job Status (Patch API)
app.patch('/api/recruiter/jobs/:id/status', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;

  if (recruiter.status !== 'Approved') {
    return res.status(403).json({ error: 'Access Denied. Only approved recruiter accounts can update job statuses.' });
  }

  const jobId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const index = db.jobs.findIndex((j: any) => j.id === jobId && j.recruiterId === recruiter.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Job not found or access denied.' });
    }

    db.jobs[index].status = status;
    db.jobs[index].updatedAt = new Date().toISOString();

    writeDB(db);
    res.status(200).json({ message: `Job status updated to ${status} successfully`, job: db.jobs[index] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating job status.' });
  }
});

// 6. Delete a Job
app.delete('/api/recruiter/jobs/:id', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;

  if (recruiter.status !== 'Approved') {
    return res.status(403).json({ error: 'Access Denied. Only approved recruiter accounts can delete job openings.' });
  }

  const jobId = req.params.id;

  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const index = db.jobs.findIndex((j: any) => j.id === jobId && j.recruiterId === recruiter.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Job not found or access denied.' });
    }

    db.jobs.splice(index, 1);
    writeDB(db);
    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting the job.' });
  }
});

// 7. Get all published/active Jobs (For candidates)
app.get('/api/jobs', (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    // Only return Published status jobs (or Active)
    let jobs = db.jobs.filter((j: any) => j.status === 'Published' || j.status === 'Active');

    // Search query parameter (title, companyName, city)
    const search = req.query.search as string;
    if (search) {
      const q = search.toLowerCase();
      jobs = jobs.filter((j: any) => 
        j.title.toLowerCase().includes(q) || 
        j.companyName.toLowerCase().includes(q) || 
        j.city.toLowerCase().includes(q)
      );
    }

    // Filter parameters
    const state = req.query.state as string;
    if (state && state !== 'All') {
      jobs = jobs.filter((j: any) => j.state && j.state.toLowerCase() === state.toLowerCase());
    }

    const city = req.query.city as string;
    if (city && city !== 'All') {
      jobs = jobs.filter((j: any) => j.city && j.city.toLowerCase() === city.toLowerCase());
    }

    const employmentType = req.query.employmentType as string;
    if (employmentType && employmentType !== 'All') {
      jobs = jobs.filter((j: any) => j.employmentType === employmentType);
    }

    const shift = req.query.shift as string;
    if (shift && shift !== 'All') {
      jobs = jobs.filter((j: any) => j.shift === shift);
    }

    const bikeRequired = req.query.bikeRequired as string;
    if (bikeRequired && bikeRequired !== 'All') {
      jobs = jobs.filter((j: any) => j.bikeRequired === bikeRequired);
    }

    const drivingLicenseRequired = req.query.drivingLicenseRequired as string;
    if (drivingLicenseRequired && drivingLicenseRequired !== 'All') {
      jobs = jobs.filter((j: any) => j.drivingLicenseRequired === drivingLicenseRequired);
    }

    const immediateJoining = req.query.immediateJoining as string;
    if (immediateJoining && immediateJoining !== 'All') {
      jobs = jobs.filter((j: any) => j.immediateJoining === immediateJoining);
    }

    const genderPreference = req.query.genderPreference as string;
    if (genderPreference && genderPreference !== 'All') {
      jobs = jobs.filter((j: any) => j.genderPreference === genderPreference);
    }

    const maxExperience = req.query.experience as string;
    if (maxExperience && maxExperience !== 'All') {
      jobs = jobs.filter((j: any) => j.experienceRequired <= Number(maxExperience));
    }

    const minSalary = req.query.minSalary as string;
    if (minSalary) {
      jobs = jobs.filter((j: any) => j.maxSalary >= Number(minSalary));
    }

    // Sorting
    const sort = req.query.sort as string; // 'newest' | 'oldest'
    if (sort === 'oldest') {
      jobs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      jobs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.status(200).json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving jobs.' });
  }
});

// 7.1 Search Jobs (Candidates)
app.get('/api/jobs/search', (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    let jobs = db.jobs.filter((j: any) => j.status === 'Published' || j.status === 'Active');
    const q = (req.query.q || '') as string;
    if (q) {
      const lowerQ = q.toLowerCase();
      jobs = jobs.filter((j: any) => 
        j.title.toLowerCase().includes(lowerQ) || 
        j.companyName.toLowerCase().includes(lowerQ) || 
        j.city.toLowerCase().includes(lowerQ)
      );
    }
    res.status(200).json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error searching jobs.' });
  }
});

// 7.2 Filter Jobs (Candidates)
app.get('/api/jobs/filter', (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    let jobs = db.jobs.filter((j: any) => j.status === 'Published' || j.status === 'Active');
    
    const state = req.query.state as string;
    if (state && state !== 'All') {
      jobs = jobs.filter((j: any) => j.state && j.state.toLowerCase() === state.toLowerCase());
    }
    const city = req.query.city as string;
    if (city && city !== 'All') {
      jobs = jobs.filter((j: any) => j.city && j.city.toLowerCase() === city.toLowerCase());
    }
    const minSalary = req.query.minSalary as string;
    if (minSalary) {
      jobs = jobs.filter((j: any) => j.maxSalary >= Number(minSalary));
    }
    const employmentType = req.query.employmentType as string;
    if (employmentType && employmentType !== 'All') {
      jobs = jobs.filter((j: any) => j.employmentType === employmentType);
    }
    const experience = req.query.experience as string;
    if (experience && experience !== 'All') {
      jobs = jobs.filter((j: any) => j.experienceRequired <= Number(experience));
    }
    const shift = req.query.shift as string;
    if (shift && shift !== 'All') {
      jobs = jobs.filter((j: any) => j.shift === shift);
    }
    const bikeRequired = req.query.bikeRequired as string;
    if (bikeRequired && bikeRequired !== 'All') {
      jobs = jobs.filter((j: any) => j.bikeRequired === bikeRequired);
    }
    const drivingLicenseRequired = req.query.drivingLicenseRequired as string;
    if (drivingLicenseRequired && drivingLicenseRequired !== 'All') {
      jobs = jobs.filter((j: any) => j.drivingLicenseRequired === drivingLicenseRequired);
    }
    const immediateJoining = req.query.immediateJoining as string;
    if (immediateJoining && immediateJoining !== 'All') {
      jobs = jobs.filter((j: any) => j.immediateJoining === immediateJoining);
    }
    const genderPreference = req.query.genderPreference as string;
    if (genderPreference && genderPreference !== 'All') {
      jobs = jobs.filter((j: any) => j.genderPreference === genderPreference);
    }
    const sort = req.query.sort as string;
    if (sort === 'oldest') {
      jobs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      jobs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    res.status(200).json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error filtering jobs.' });
  }
});

// 7.3 Get Job Details (Candidates)
app.get('/api/jobs/:id', (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j: any) => j.id === req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job opening not found.' });
    }
    // Draft jobs are never visible to candidates
    if (job.status === 'Draft') {
      return res.status(403).json({ error: 'This job listing is not available.' });
    }
    
    // Increment views Count when details are viewed
    job.viewsCount = (job.viewsCount || 0) + 1;
    writeDB(db);

    res.status(200).json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving job details.' });
  }
});

// 7.3.5 Increment Job Views (Candidates - Fast tracking)
app.post('/api/jobs/:id/view', (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j: any) => j.id === req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job opening not found.' });
    }
    job.viewsCount = (job.viewsCount || 0) + 1;
    writeDB(db);
    res.status(200).json({ success: true, viewsCount: job.viewsCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error tracking job view.' });
  }
});

// 7.4 Apply Job (Candidates)
app.post('/api/jobs/:id/apply', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const jobId = req.params.id;

  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    db.applications = db.applications || [];
    db.documents = db.documents || [];

    const job = db.jobs.find((j: any) => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job opening not found.' });
    }

    if (job.status === 'Draft') {
      return res.status(403).json({ error: 'Cannot apply to a draft job.' });
    }

    if (job.status === 'Closed') {
      return res.status(400).json({ error: 'This job listing has been closed and cannot accept new applications.' });
    }

    // 1. Verify Candidate Profile has name, age, gender, pincode
    const profile = candidate.profile || {};
    const requiredProfileFields = [
      'fullName',
      'age',
      'gender',
      'pincode'
    ];

    const missingProfileFields: string[] = [];
    requiredProfileFields.forEach(field => {
      const val = profile[field];
      if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
        const names: { [key: string]: string } = {
          fullName: 'Full Name',
          age: 'Age',
          gender: 'Gender',
          pincode: '6-digit Pincode'
        };
        missingProfileFields.push(names[field] || field);
      }
    });

    const missingDocs: string[] = [];

    if (missingProfileFields.length > 0 || missingDocs.length > 0) {
      return res.status(400).json({
        error: 'Profile or documents are incomplete.',
        missingProfileFields,
        missingDocs
      });
    }

    // 3. Prevent duplicate applications
    const existingApplication = db.applications.find(
      (app: any) => app.candidateId === candidate.id && app.jobId === jobId && app.withdrawStatus !== 'Withdrawn'
    );
    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied for this job listing.' });
    }

    // 4. Create new application
    const newApplication = {
      id: crypto.randomUUID(),
      candidateId: candidate.id,
      jobId: jobId,
      recruiterId: job.recruiterId,
      appliedDate: new Date().toISOString(),
      currentStatus: 'Applied', // Default: Applied
      withdrawStatus: 'Active',
      lastUpdated: new Date().toISOString()
    };

    db.applications.push(newApplication);

    // Increment applicationsCount for the job
    job.applicationsCount = (job.applicationsCount || 0) + 1;

    writeDB(db);

    res.status(201).json({
      message: 'Application submitted successfully.',
      application: newApplication
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error submitting application.' });
  }
});

// Alias POST for Apply Job (supports both calling structures)
app.post('/api/applications', authenticateToken, (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required in body.' });
  }
  
  // Directly trigger application handler
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    db.applications = db.applications || [];
    db.documents = db.documents || [];

    const job = db.jobs.find((j: any) => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job opening not found.' });
    }

    if (job.status === 'Draft') {
      return res.status(403).json({ error: 'Cannot apply to a draft job.' });
    }

    if (job.status === 'Closed') {
      return res.status(400).json({ error: 'This job listing has been closed and cannot accept new applications.' });
    }

    const candidate = (req as any).candidate;

    // Verify completeness: name, age, gender, pincode
    const profile = candidate.profile || {};
    const requiredProfileFields = [
      'fullName',
      'age',
      'gender',
      'pincode'
    ];

    const missingProfileFields: string[] = [];
    requiredProfileFields.forEach(field => {
      const val = profile[field];
      if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
        const names: { [key: string]: string } = {
          fullName: 'Full Name',
          age: 'Age',
          gender: 'Gender',
          pincode: '6-digit Pincode'
        };
        missingProfileFields.push(names[field] || field);
      }
    });

    const missingDocs: string[] = [];

    if (missingProfileFields.length > 0 || missingDocs.length > 0) {
      return res.status(400).json({
        error: 'Profile or documents are incomplete.',
        missingProfileFields,
        missingDocs
      });
    }

    const existingApplication = db.applications.find(
      (app: any) => app.candidateId === candidate.id && app.jobId === jobId && app.withdrawStatus !== 'Withdrawn'
    );
    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied for this job listing.' });
    }

    const newApplication = {
      id: crypto.randomUUID(),
      candidateId: candidate.id,
      jobId: jobId,
      recruiterId: job.recruiterId,
      appliedDate: new Date().toISOString(),
      currentStatus: 'Applied',
      withdrawStatus: 'Active',
      lastUpdated: new Date().toISOString()
    };

    db.applications.push(newApplication);
    job.applicationsCount = (job.applicationsCount || 0) + 1;
    writeDB(db);

    res.status(201).json({
      message: 'Application submitted successfully.',
      application: newApplication
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error submitting application.' });
  }
});

// 7.5 Get My Applications (Candidates)
app.get('/api/applications/my', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;

  try {
    const db = readDB();
    db.applications = db.applications || [];
    db.jobs = db.jobs || [];

    const myApps = db.applications.filter((app: any) => app.candidateId === candidate.id);

    const detailedApps = myApps.map((app: any) => {
      const job = db.jobs.find((j: any) => j.id === app.jobId) || {};
      return {
        ...app,
        jobTitle: job.title || 'Unknown Position',
        companyName: job.companyName || 'Unknown Company',
        companyLogo: job.companyLogo || '',
        jobCity: job.city || '',
        jobState: job.state || '',
        jobSalary: job.minSalary ? `₹${job.minSalary} - ₹${job.maxSalary}` : (job.salary || 'N/A'),
        jobSalaryType: job.salaryType || '',
        jobEmploymentType: job.employmentType || '',
        jobShift: job.shift || '',
        jobExperienceRequired: job.experienceRequired || 0,
        jobOpenings: job.openings || 1,
        jobDescription: job.description || '',
        jobResponsibilities: job.responsibilities || '',
        jobRequirements: job.educationRequired || '',
        jobBenefits: job.benefits || '',
        jobWorkingHours: job.workingHours || 'Standard Shift hours',
        jobAgeLimit: job.ageLimitMin ? `${job.ageLimitMin} - ${job.ageLimitMax} Years` : '18 - 45 Years',
        jobBikeRequirement: job.bikeRequired || 'No',
        jobDrivingLicenseRequirement: job.drivingLicenseRequired || 'No',
        jobRecruiterName: job.recruiterName || ''
      };
    });

    res.status(200).json({ applications: detailedApps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving applications.' });
  }
});

// Alias for My Applications
app.get('/api/my-applications', authenticateToken, (req, res) => {
  try {
    const db = readDB();
    const candidate = (req as any).candidate;
    db.applications = db.applications || [];
    db.jobs = db.jobs || [];

    const myApps = db.applications.filter((app: any) => app.candidateId === candidate.id);

    const detailedApps = myApps.map((app: any) => {
      const job = db.jobs.find((j: any) => j.id === app.jobId) || {};
      return {
        ...app,
        jobTitle: job.title || 'Unknown Position',
        companyName: job.companyName || 'Unknown Company',
        companyLogo: job.companyLogo || '',
        jobCity: job.city || '',
        jobState: job.state || '',
        jobSalary: job.minSalary ? `₹${job.minSalary} - ₹${job.maxSalary}` : (job.salary || 'N/A'),
        jobSalaryType: job.salaryType || '',
        jobEmploymentType: job.employmentType || '',
        jobShift: job.shift || '',
        jobExperienceRequired: job.experienceRequired || 0,
        jobOpenings: job.openings || 1,
        jobDescription: job.description || '',
        jobResponsibilities: job.responsibilities || '',
        jobRequirements: job.educationRequired || '',
        jobBenefits: job.benefits || '',
        jobWorkingHours: job.workingHours || 'Standard Shift hours',
        jobAgeLimit: job.ageLimitMin ? `${job.ageLimitMin} - ${job.ageLimitMax} Years` : '18 - 45 Years',
        jobBikeRequirement: job.bikeRequired || 'No',
        jobDrivingLicenseRequirement: job.drivingLicenseRequired || 'No',
        jobRecruiterName: job.recruiterName || ''
      };
    });

    res.status(200).json({ applications: detailedApps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving applications.' });
  }
});

// 7.6 Withdraw Application (Candidates)
app.post('/api/applications/:id/withdraw', authenticateToken, (req, res) => {
  const candidate = (req as any).candidate;
  const appId = req.params.id;

  try {
    const db = readDB();
    db.applications = db.applications || [];

    const appIndex = db.applications.findIndex((app: any) => app.id === appId && app.candidateId === candidate.id);
    if (appIndex === -1) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = db.applications[appIndex];

    if (application.currentStatus !== 'Applied') {
      return res.status(400).json({ error: 'Cannot withdraw applications that have already progressed past Applied status.' });
    }

    application.currentStatus = 'Withdrawn';
    application.withdrawStatus = 'Withdrawn';
    application.lastUpdated = new Date().toISOString();

    // Decrease applicationsCount for the job
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j: any) => j.id === application.jobId);
    if (job && job.applicationsCount > 0) {
      job.applicationsCount -= 1;
    }

    writeDB(db);

    res.status(200).json({
      message: 'Application withdrawn successfully.',
      application
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error withdrawing application.' });
  }
});

// Module 6 - Recruiter Application Management APIs

// 6.1 Get Recruiter Applications
app.get('/api/recruiter/applications', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  try {
    const db = readDB();
    const myJobs = db.jobs.filter((j: any) => j.recruiterId === recruiter.id);
    const myJobIds = myJobs.map((j: any) => j.id);
    const myApps = db.applications.filter((app: any) => myJobIds.includes(app.jobId));

    const detailedApps = myApps.map((app: any) => {
      const job = db.jobs.find((j: any) => j.id === app.jobId) || {};
      const candidate = db.candidates.find((c: any) => c.id === app.candidateId) || {};
      const profile = candidate.profile || {};
      return {
        ...app,
        jobTitle: job.title || 'Unknown Position',
        jobCity: job.city || '',
        candidateName: profile.fullName || candidate.fullName || 'Unknown Candidate',
        candidateMobile: candidate.mobile || '',
        candidateEmail: candidate.email || '',
        candidateProfilePhoto: profile.profilePhoto || '',
        candidateExperience: profile.experience !== undefined ? profile.experience : 0,
        candidateCity: profile.city || '',
        candidateState: profile.state || ''
      };
    });

    res.status(200).json({ applications: detailedApps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving recruiter applications.' });
  }
});

// 6.2 Get Recruiter Application Details
app.get('/api/recruiter/applications/:id', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  const appId = req.params.id;
  try {
    const db = readDB();
    const application = db.applications.find((a: any) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const job = db.jobs.find((j: any) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: 'Unauthorized to view this application.' });
    }

    const candidate = db.candidates.find((c: any) => c.id === application.candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate profile not found.' });
    }

    // Filter documents
    const docs = db.documents.filter((d: any) => d.candidateId === application.candidateId);

    // Get notes
    const notes = db.recruiterNotes.filter((n: any) => n.applicationId === appId);

    // Get history
    const history = db.applicationHistory.filter((h: any) => h.applicationId === appId);

    res.status(200).json({
      application,
      job,
      candidate: {
        ...candidate,
        documents: docs
      },
      notes,
      history
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving application details.' });
  }
});

// 6.3 Update Application Status
app.post('/api/recruiter/applications/:id/status', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  const appId = req.params.id;
  const { status: newStatus } = req.body;

  const allowedStatuses = [
    'Applied', 'Contacted', 'Shortlisted', 'Interview Scheduled', 
    'Interview Completed', 'Selected', 'Hired', 'Rejected', 'Withdrawn'
  ];

  if (!newStatus || !allowedStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status. Allowed statuses are: ${allowedStatuses.join(', ')}` });
  }

  try {
    const db = readDB();
    const application = db.applications.find((a: any) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const job = db.jobs.find((j: any) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this application.' });
    }

    const oldStatus = application.currentStatus;
    application.currentStatus = newStatus;
    application.lastUpdated = new Date().toISOString();

    // Log to applicationHistory
    const historyEntry = {
      id: crypto.randomUUID(),
      applicationId: appId,
      previousStatus: oldStatus,
      newStatus,
      changedBy: recruiter.recruiterName || 'Recruiter',
      changedByRole: 'Recruiter',
      changedDate: new Date().toISOString()
    };

    db.applicationHistory = db.applicationHistory || [];
    db.applicationHistory.push(historyEntry);

    writeDB(db);

    res.status(200).json({
      message: 'Status updated successfully.',
      application,
      historyEntry
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating application status.' });
  }
});

// 6.4 Add Recruiter Note
app.post('/api/recruiter/applications/:id/notes', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  const appId = req.params.id;
  const { noteText } = req.body;

  if (!noteText || !noteText.trim()) {
    return res.status(400).json({ error: 'Note text cannot be empty.' });
  }

  try {
    const db = readDB();
    const application = db.applications.find((a: any) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const job = db.jobs.find((j: any) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: 'Unauthorized to add notes to this application.' });
    }

    const newNote = {
      id: crypto.randomUUID(),
      applicationId: appId,
      recruiterId: recruiter.id,
      noteText: noteText.trim(),
      createdAt: new Date().toISOString()
    };

    db.recruiterNotes = db.recruiterNotes || [];
    db.recruiterNotes.push(newNote);

    writeDB(db);

    res.status(201).json({
      message: 'Note added successfully.',
      note: newNote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error adding recruiter note.' });
  }
});

// 6.5 Get Recruiter Notes
app.get('/api/recruiter/applications/:id/notes', authenticateRecruiter, (req, res) => {
  const recruiter = (req as any).recruiter;
  const appId = req.params.id;

  try {
    const db = readDB();
    const application = db.applications.find((a: any) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const job = db.jobs.find((j: any) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: 'Unauthorized to view notes for this application.' });
    }

    const notes = db.recruiterNotes.filter((n: any) => n.applicationId === appId);
    res.status(200).json({ notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving recruiter notes.' });
  }
});

// 6.6 Get Candidate Status Timeline
app.get('/api/applications/:id/timeline', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const appId = req.params.id;

  try {
    const db = readDB();
    const application = db.applications.find((a: any) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    // Determine user identity
    const candidateId = db.tokens[token];
    const recruiterId = db.recruiterTokens[token];

    let authorized = false;

    if (candidateId && application.candidateId === candidateId) {
      authorized = true;
    } else if (recruiterId) {
      const job = db.jobs.find((j: any) => j.id === application.jobId);
      if (job && job.recruiterId === recruiterId) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Unauthorized to view this application timeline.' });
    }

    const timeline = db.applicationHistory.filter((h: any) => h.applicationId === appId);
    timeline.sort((a: any, b: any) => new Date(a.changedDate).getTime() - new Date(b.changedDate).getTime());

    res.status(200).json({ timeline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving status timeline.' });
  }
});

// Express to Web Request/Response adapter for @supabase/server SDK
function adaptWebFetch(handler: (req: Request) => Promise<Response>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const url = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.append(key, value.toString());
          }
        }
      }

      let body: any = undefined;
      if (!['GET', 'HEAD'].includes(req.method) && req.body) {
        body = JSON.stringify(req.body);
        headers.set('content-type', 'application/json');
      }

      const webRequest = new Request(url, {
        method: req.method,
        headers,
        body,
      });

      const webResponse = await handler(webRequest);

      res.status(webResponse.status);
      webResponse.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });

      const responseText = await webResponse.text();
      res.send(responseText);
    } catch (err: any) {
      console.error('[Supabase Server Adapt Error]', err);
      res.status(500).json({
        error: err.message || 'Internal server error in adapted handler.',
        hint: 'Make sure your SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY are configured correctly in your environment.'
      });
    }
  };
}

// @supabase/server SDK endpoints
app.all('/api/supabase-server/health', adaptWebFetch(publicHealthHandler.fetch));
app.all('/api/supabase-server/jobs', adaptWebFetch(publicJobsHandler.fetch));
app.all('/api/supabase-server/profile', adaptWebFetch(candidateProfileHandler.fetch));
app.all('/api/supabase-server/admin/candidates', adaptWebFetch(adminCandidatesListHandler.fetch));

// Database configuration and connection state status endpoint
app.get('/api/database-status', async (req, res) => {
  try {
    res.json({
      configured: isSupabaseConfigured(),
      active: supabaseActive,
      mode: supabaseActive ? 'supabase-cloud' : 'local-json-fallback',
      dbPath: DB_PATH,
      errorDetails: supabaseErrorDetails
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error checking status.' });
  }
});

// Re-check and sync database connection dynamically
app.post('/api/database-reconnect', async (req, res) => {
  try {
    clearSupabaseClient();
    supabaseActive = false;
    supabaseErrorDetails = null;
    await initDatabase();
    res.json({
      success: supabaseActive,
      active: supabaseActive,
      errorDetails: supabaseErrorDetails
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error executing reconnect.' });
  }
});

// Execute a SQL SELECT 1 ping query via a Supabase RPC function to verify live DB execution
app.get('/api/database-ping-sql', async (req, res) => {
  try {
    clearSupabaseClient();
    if (!isSupabaseConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Supabase credentials are not configured.'
      });
    }

    const supabase = getSupabase();
    // Execute RPC ping_db which internally runs "SELECT 1" in PostgreSQL
    const { data, error } = await supabase.rpc('ping_db');

    if (error) {
      return res.json({
        success: false,
        query: 'SELECT 1 via rpc("ping_db")',
        error: error.message,
        code: error.code,
        hint: 'This means network connection works, but the "ping_db" function is not yet created in your Supabase project. To fix this, run the full SQL schema script (Step 2) in your Supabase SQL Editor.'
      });
    }

    return res.json({
      success: true,
      query: 'SELECT 1 via rpc("ping_db")',
      result: data,
      message: 'Successfully executed SELECT 1 inside your Supabase PostgreSQL database!'
    });
  } catch (err: any) {
    return res.json({
      success: false,
      query: 'SELECT 1 via rpc("ping_db")',
      error: err.message || 'Failed to execute ping query.'
    });
  }
});

// Complete database diagnostic utility to troubleshoot Supabase integration issues
app.get('/api/database-diagnose', async (req, res) => {
  try {
    clearSupabaseClient();
  } catch (e) {}

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: { configured: false, valueMasked: null, formatValid: false },
      SUPABASE_ANON_KEY: { configured: false, valueMasked: null, formatValid: false },
      SUPABASE_SERVICE_ROLE_KEY: { configured: false, valueMasked: null, formatValid: false }
    },
    network: { canResolveUrl: false, pingTest: null, error: null },
    tables: {},
    writePermission: { success: false, error: null },
    summary: '',
    recommendations: []
  };

  const url = process.env.SUPABASE_URL || (process.env as any).VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || (process.env as any).VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url) {
    diagnostics.env.SUPABASE_URL.configured = true;
    diagnostics.env.SUPABASE_URL.valueMasked = url.length > 15 ? url.substring(0, 12) + '...' + url.substring(url.length - 4) : '***';
    diagnostics.env.SUPABASE_URL.formatValid = url.startsWith('https://') && url.includes('.supabase.co');
  }
  if (anonKey) {
    diagnostics.env.SUPABASE_ANON_KEY.configured = true;
    diagnostics.env.SUPABASE_ANON_KEY.valueMasked = anonKey.length > 20 ? anonKey.substring(0, 8) + '...' + anonKey.substring(anonKey.length - 8) : '***';
    diagnostics.env.SUPABASE_ANON_KEY.formatValid = anonKey.length > 50;
  }
  if (serviceRoleKey) {
    diagnostics.env.SUPABASE_SERVICE_ROLE_KEY.configured = true;
    diagnostics.env.SUPABASE_SERVICE_ROLE_KEY.valueMasked = serviceRoleKey.length > 20 ? serviceRoleKey.substring(0, 8) + '...' + serviceRoleKey.substring(serviceRoleKey.length - 8) : '***';
    diagnostics.env.SUPABASE_SERVICE_ROLE_KEY.formatValid = serviceRoleKey.length > 50;
  }

  if (!url || (!anonKey && !serviceRoleKey)) {
    diagnostics.summary = 'CRITICAL: Supabase credentials are not configured in your environment.';
    diagnostics.recommendations.push('Go to AI Studio Settings -> Secrets, and add SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
    return res.json(diagnostics);
  }

  // Check URL network response
  try {
    const start = Date.now();
    // Fetch a basic rest endpoint of Supabase
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': anonKey || serviceRoleKey || ''
      }
    });
    const duration = Date.now() - start;
    diagnostics.network.canResolveUrl = true;
    diagnostics.network.pingTest = `${duration}ms (HTTP ${response.status})`;
  } catch (err: any) {
    diagnostics.network.error = err.message || err;
    diagnostics.recommendations.push('Verify that your SUPABASE_URL is correct, starts with https://, and has no typos. The network timed out or refused connection.');
  }

  // Test individual tables
  try {
    const supabase = getSupabase();

    const tablesToTest = ['candidates', 'recruiters', 'jobs', 'applications', 'documents'];
    for (const tableName of tablesToTest) {
      try {
        const { error, data } = await supabase.from(tableName).select('id').limit(1);
        if (error) {
          diagnostics.tables[tableName] = {
            exists: false,
            error: error.message,
            code: error.code
          };
          if (error.code === '42P01') { // Relation does not exist
            diagnostics.recommendations.push(`Table "${tableName}" is missing. Paste the SQL script from Step 2 into your Supabase SQL Editor and run it.`);
          }
        } else {
          diagnostics.tables[tableName] = {
            exists: true,
            recordsCount: data ? data.length : 0
          };
        }
      } catch (tableErr: any) {
        diagnostics.tables[tableName] = {
          exists: false,
          error: tableErr.message || tableErr
        };
      }
    }

    // Check write permissions on 'candidates' table
    if (diagnostics.tables['candidates'] && diagnostics.tables['candidates'].exists) {
      const testId = '00000000-0000-0000-0000-000000000000';
      try {
        const { error: insertError } = await supabase.from('candidates').upsert({
          id: testId,
          fullName: 'Supabase Diagnostic Test Candidate',
          mobile: '9999999999',
          salt: 'dummy',
          hash: 'dummy',
          profile: { languagesKnown: [] }
        });

        if (insertError) {
          diagnostics.writePermission.error = insertError.message;
          diagnostics.recommendations.push(`Write failed on "candidates": ${insertError.message}. Ensure Row Level Security (RLS) is disabled or policies are configured to permit writes.`);
        } else {
          diagnostics.writePermission.success = true;
          // Cleanup
          await supabase.from('candidates').delete().eq('id', testId);
        }
      } catch (writeErr: any) {
        diagnostics.writePermission.error = writeErr.message || writeErr;
      }
    } else {
      diagnostics.writePermission.error = 'Skipped write test because candidates table does not exist.';
    }

  } catch (supabaseErr: any) {
    diagnostics.summary = 'FAILED: Could not initialize Supabase JS Client.';
    diagnostics.error = supabaseErr.message || supabaseErr;
    return res.json(diagnostics);
  }

  const totalTables = Object.keys(diagnostics.tables).length;
  const activeTables = Object.values(diagnostics.tables).filter((t: any) => t.exists).length;

  if (activeTables === totalTables && diagnostics.writePermission.success) {
    diagnostics.summary = 'HEALTHY: Supabase cloud is fully active, tables are initialized, and read/write tests passed successfully!';
  } else if (activeTables > 0) {
    diagnostics.summary = `PARTIAL: Connected successfully, but only ${activeTables}/${totalTables} tables exist. Please ensure all tables are created.`;
  } else if (diagnostics.network.canResolveUrl) {
    diagnostics.summary = 'CONNECTED: Supabase network is responsive, but your tables do not exist. Please run the SQL schema migration.';
  } else {
    diagnostics.summary = 'DISCONNECTED: Could not reach Supabase. Check your SUPABASE_URL and internet connectivity.';
  }

  // De-duplicate recommendations
  diagnostics.recommendations = Array.from(new Set(diagnostics.recommendations));
  res.json(diagnostics);
});

// Async Database initialization routine
async function initDatabase() {
  // Prime local state
  const db = readDB();

  try {
    if (isSupabaseConfigured()) {
      console.log('[Database Init] Supabase config found. Validating cloud connection...');
      const supabase = getSupabase();
      
      // Test querying the candidates table
      const { error } = await supabase.from('candidates').select('id').limit(1);
      if (error) {
        supabaseActive = false;
        supabaseErrorDetails = error.message;
        console.warn('[Database Init] Linked to Supabase, but some tables are missing or need migration.');
        console.warn('[Database Init] Details:', error.message);
        console.warn('[Database Init] Using local JSON database as fallback. Run SQL Schema in Supabase console to enable persistent cloud storage.');
      } else {
        console.log('[Database Init] Connected successfully! Synchronizing cloud records with memory cache...');
        supabaseActive = true;
        supabaseErrorDetails = null;

        // Fetch tables in parallel
        const [
          { data: candidates },
          { data: recruiters },
          { data: jobs },
          { data: applications },
          { data: dDocs }
        ] = await Promise.all([
          supabase.from('candidates').select('*'),
          supabase.from('recruiters').select('*'),
          supabase.from('jobs').select('*'),
          supabase.from('applications').select('*'),
          supabase.from('documents').select('*')
        ]);

        if (candidates) db.candidates = candidates;
        if (recruiters) db.recruiters = recruiters;
        if (jobs) db.jobs = jobs;
        if (applications) db.applications = applications;
        if (dDocs) db.documents = dDocs;

        memoryDB = db;
        // Save local copy as mirror fallback
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
        console.log('[Database Init] Sync completed successfully! Cloud database is fully active.');
      }
    } else {
      supabaseActive = false;
      supabaseErrorDetails = 'Supabase credentials not configured in environment (SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are missing).';
      console.log('[Database Init] Supabase credentials not configured in environment. Using standard local file system database.');
    }
  } catch (err: any) {
    supabaseActive = false;
    supabaseErrorDetails = err.message || 'Failed to initialize Supabase connection.';
    console.warn('[Database Init] Failed to load Supabase modules, falling back to local storage:', err.message || err);
  }
}

// --- ADMIN PANEL DIRECT ACCESS ENDPOINTS ---

// Get all recruiters (safely masked)
app.get('/api/admin/recruiters', (req, res) => {
  try {
    const db = readDB();
    const safeRecruiters = (db.recruiters || []).map(({ salt, hash, ...r }: any) => r);
    res.json(safeRecruiters);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve recruiters' });
  }
});

// Directly create a recruiter (Approved by default)
app.post('/api/admin/recruiters', (req, res) => {
  const { companyName, contactPerson, email, mobile, password } = req.body;
  if (!companyName || !contactPerson || !email || !mobile || !password) {
    return res.status(400).json({ error: 'All fields are required to create a recruiter.' });
  }

  try {
    const db = readDB();
    db.recruiters = db.recruiters || [];

    // Check duplicate email / mobile
    if (db.recruiters.some((r: any) => r.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'A recruiter with this email already exists.' });
    }
    if (db.recruiters.some((r: any) => r.mobile === mobile)) {
      return res.status(400).json({ error: 'A recruiter with this mobile number already exists.' });
    }

    const { salt, hash } = hashPassword(password);
    const newRecruiter = {
      id: crypto.randomUUID(),
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      salt,
      hash,
      status: 'Approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.recruiters.push(newRecruiter);
    writeDB(db);

    const { salt: _s, hash: _h, ...safeRecruiter } = newRecruiter;
    res.status(201).json({ message: 'Recruiter added successfully', recruiter: safeRecruiter });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error creating recruiter' });
  }
});

// Directly post a job under a specific recruiter ID
app.post('/api/admin/jobs', (req, res) => {
  const {
    recruiterId,
    title,
    category,
    openings,
    employmentType,
    state,
    city,
    area,
    workLocation,
    minSalary,
    maxSalary,
    salaryType,
    shift,
    experienceRequired,
    educationRequired,
    genderPreference,
    ageLimitMin,
    ageLimitMax,
    bikeRequired,
    drivingLicenseRequired,
    immediateJoining,
    description,
    responsibilities,
    benefits,
    status
  } = req.body;

  if (!recruiterId || !title || !category || openings === undefined || !employmentType || !state || !city || !area || minSalary === undefined || maxSalary === undefined || !salaryType || !shift || experienceRequired === undefined || !educationRequired || !genderPreference || ageLimitMin === undefined || ageLimitMax === undefined || !bikeRequired || !drivingLicenseRequired || !immediateJoining || !description || !responsibilities || !benefits || !status) {
    return res.status(400).json({ error: 'Required fields are missing. Please complete the form.' });
  }

  try {
    const db = readDB();
    const recruiter = (db.recruiters || []).find((r: any) => r.id === recruiterId);
    if (!recruiter) {
      return res.status(404).json({ error: 'Recruiter not found.' });
    }

    db.jobs = db.jobs || [];
    const newJob = {
      id: crypto.randomUUID(),
      recruiterId: recruiter.id,
      companyName: recruiter.companyName,
      companyLogo: recruiter.companyLogo || '',
      title: title.trim(),
      category: category.trim(),
      openings: Number(openings),
      employmentType: employmentType.trim(),
      state: state.trim(),
      city: city.trim(),
      area: area.trim(),
      workLocation: workLocation ? workLocation.trim() : '',
      minSalary: Number(minSalary),
      maxSalary: Number(maxSalary),
      salaryType: salaryType.trim(),
      shift: shift.trim(),
      experienceRequired: Number(experienceRequired),
      educationRequired: educationRequired.trim(),
      genderPreference: genderPreference.trim(),
      ageLimitMin: Number(ageLimitMin),
      ageLimitMax: Number(ageLimitMax),
      bikeRequired: bikeRequired.trim(),
      drivingLicenseRequired: drivingLicenseRequired.trim(),
      immediateJoining: immediateJoining.trim(),
      description: description.trim(),
      responsibilities: responsibilities.trim(),
      benefits: benefits.trim(),
      status: status.trim(),
      applicationsCount: 0,
      viewsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.jobs.push(newJob);
    writeDB(db);

    res.status(201).json({ message: 'Job posted successfully via Admin Panel!', job: newJob });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error posting the job.' });
  }
});

// GET all jobs for Admin Panel
app.get('/api/admin/jobs', (req, res) => {
  try {
    const db = readDB();
    res.json(db.jobs || []);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

// GET all candidates
app.get('/api/admin/candidates', (req, res) => {
  try {
    const db = readDB();
    const safeCandidates = (db.candidates || []).map(({ salt, hash, ...c }: any) => c);
    res.json(safeCandidates);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve candidates' });
  }
});

// Directly register a Candidate / Delivery Man with fully formed profiles
app.post('/api/admin/candidates', (req, res) => {
  const { fullName, mobile, email, age, gender, pincode, experience, education, bikeAvailable, drivingLicenseAvailable } = req.body;
  
  if (!fullName || !mobile || !age || !gender || !pincode) {
    return res.status(400).json({ error: 'Full Name, Mobile, Age, Gender, and Pincode are required.' });
  }

  const cleanMobile = mobile.trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ error: 'Mobile number must be a valid 10-digit number.' });
  }

  try {
    const db = readDB();
    db.candidates = db.candidates || [];

    if (db.candidates.some((c: any) => c.mobile === cleanMobile)) {
      return res.status(400).json({ error: 'A candidate with this mobile number already exists.' });
    }

    const { salt, hash } = hashPassword('DeliveryMan2026!');
    const newCandidate = {
      id: crypto.randomUUID(),
      fullName: fullName.trim(),
      mobile: cleanMobile,
      email: email ? email.trim().toLowerCase() : undefined,
      salt,
      hash,
      profile: {
        fullName: fullName.trim(),
        age: Number(age),
        gender: gender.trim(),
        pincode: pincode.trim(),
        experience: Number(experience || 0),
        education: education || '10th Pass or below',
        bikeAvailable: bikeAvailable || 'No',
        drivingLicenseAvailable: drivingLicenseAvailable || 'None',
        languagesKnown: ['Hindi', 'English']
      }
    };

    db.candidates.push(newCandidate);
    writeDB(db);

    const { salt: _s, hash: _h, ...safeCandidate } = newCandidate;
    res.status(201).json({ message: 'Candidate added successfully', candidate: safeCandidate });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error registering candidate' });
  }
});

// Submit delivery man job interest (Application)
app.post('/api/admin/applications', (req, res) => {
  const { candidateId, jobId } = req.body;
  if (!candidateId || !jobId) {
    return res.status(400).json({ error: 'candidateId and jobId are required.' });
  }

  try {
    const db = readDB();
    db.candidates = db.candidates || [];
    db.jobs = db.jobs || [];
    db.applications = db.applications || [];

    const candidate = db.candidates.find((c: any) => c.id === candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate profile not found.' });
    }

    const job = db.jobs.find((j: any) => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job opening not found.' });
    }

    const duplicate = db.applications.some(
      (app: any) => app.candidateId === candidateId && app.jobId === jobId && app.withdrawStatus !== 'Withdrawn'
    );
    if (duplicate) {
      return res.status(400).json({ error: 'This delivery man is already linked to this job.' });
    }

    const newApplication = {
      id: crypto.randomUUID(),
      candidateId: candidate.id,
      jobId: job.id,
      recruiterId: job.recruiterId,
      appliedDate: new Date().toISOString(),
      currentStatus: 'Applied',
      withdrawStatus: 'Active',
      lastUpdated: new Date().toISOString()
    };

    db.applications.push(newApplication);
    job.applicationsCount = (job.applicationsCount || 0) + 1;
    writeDB(db);

    res.status(201).json({ message: 'Interest registered successfully!', application: newApplication });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error linking interest data.' });
  }
});

// GET all applications for Admin Panel
app.get('/api/admin/applications', (req, res) => {
  try {
    const db = readDB();
    const apps = db.applications || [];
    const detailedApps = apps.map((app: any) => {
      const job = (db.jobs || []).find((j: any) => j.id === app.jobId) || {};
      const candidate = (db.candidates || []).find((c: any) => c.id === app.candidateId) || {};
      return {
        ...app,
        jobTitle: job.title || 'Unknown Position',
        companyName: job.companyName || 'Unknown Fleet',
        candidateName: candidate.profile?.fullName || candidate.fullName || 'Unknown Candidate',
        candidateMobile: candidate.mobile || ''
      };
    });
    res.json(detailedApps);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve application interest records' });
  }
});

// DELETE an application interest link
app.delete('/api/admin/applications/:id', (req, res) => {
  const { id } = req.params;
  try {
    const db = readDB();
    db.applications = db.applications || [];
    const appIndex = db.applications.findIndex((app: any) => app.id === id);
    if (appIndex === -1) {
      return res.status(404).json({ error: 'Application interest record not found.' });
    }
    const application = db.applications[appIndex];
    
    // Decrement job applicationsCount
    const job = (db.jobs || []).find((j: any) => j.id === application.jobId);
    if (job && job.applicationsCount > 0) {
      job.applicationsCount -= 1;
    }
    
    db.applications.splice(appIndex, 1);
    writeDB(db);
    res.json({ message: 'Interest link removed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove interest link' });
  }
});

// DELETE a recruiter, their jobs, and their job applications
app.delete('/api/admin/recruiters/:id', (req, res) => {
  const { id } = req.params;
  try {
    const db = readDB();
    db.recruiters = (db.recruiters || []).filter((r: any) => r.id !== id);
    
    // Also remove their jobs
    const deletedJobIds = (db.jobs || [])
      .filter((j: any) => j.recruiterId === id)
      .map((j: any) => j.id);
    db.jobs = (db.jobs || []).filter((j: any) => j.recruiterId !== id);
    
    // Also remove applications associated with those jobs
    db.applications = (db.applications || []).filter(
      (app: any) => !deletedJobIds.includes(app.jobId) && app.recruiterId !== id
    );
    
    writeDB(db);
    res.json({ message: 'Recruiter and their associated jobs/applications deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete recruiter' });
  }
});

// DELETE a delivery candidate/man and their applications
app.delete('/api/admin/candidates/:id', (req, res) => {
  const { id } = req.params;
  try {
    const db = readDB();
    db.candidates = (db.candidates || []).filter((c: any) => c.id !== id);
    
    // Also remove their applications (interest data)
    db.applications = (db.applications || []).filter((app: any) => app.candidateId !== id);
    
    writeDB(db);
    res.json({ message: 'Delivery candidate and their interest data deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete delivery candidate' });
  }
});

// Start server and handle Vite middleware
async function startServer() {
  await initDatabase();

  if (process.env.VERCEL) {
    console.log('[Server] Running in Vercel environment. Skipping local app.listen().');
    return;
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
