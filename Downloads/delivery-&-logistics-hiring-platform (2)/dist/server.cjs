var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);

// src/lib/supabaseServerHandlers.ts
var import_server = require("@supabase/server");
var publicHealthHandler = {
  fetch: (0, import_server.withSupabase)({ auth: "none" }, async (req, ctx) => {
    return Response.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Public endpoint accessed with 'none' auth mode. No credentials required.",
      authMode: ctx.authMode
    });
  })
};
var publicJobsHandler = {
  fetch: (0, import_server.withSupabase)({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { data, error } = await ctx.supabase.from("jobs").select("id, title, category, companyName, city, minSalary, maxSalary").limit(10);
      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({
        message: "Successfully retrieved jobs with 'publishable' auth mode.",
        authMode: ctx.authMode,
        jobs: data || []
      });
    } catch (err) {
      return Response.json({ error: err.message || "Failed to query jobs." }, { status: 500 });
    }
  })
};
var candidateProfileHandler = {
  fetch: (0, import_server.withSupabase)({ auth: "user" }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      const email = ctx.userClaims?.email;
      const { data, error } = await ctx.supabase.from("candidates").select("*").eq("id", userId || "").single();
      if (error) {
        return Response.json({
          message: "Auth validation succeeded! However, candidate profile record was not found or table is empty in Supabase.",
          authMode: ctx.authMode,
          userId,
          email,
          error: error.message,
          hint: "Make sure you registered your account or ran the Supabase SQL migration to create the candidates table."
        });
      }
      return Response.json({
        message: "Successfully fetched authenticated profile with 'user' auth mode!",
        authMode: ctx.authMode,
        userId,
        email,
        candidate: data
      });
    } catch (err) {
      return Response.json({ error: err.message || "Failed to retrieve candidate profile." }, { status: 500 });
    }
  })
};
var adminCandidatesListHandler = {
  fetch: (0, import_server.withSupabase)({ auth: "secret" }, async (req, ctx) => {
    try {
      const { data, error } = await ctx.supabaseAdmin.from("candidates").select("id, fullName, email, mobile").limit(50);
      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({
        message: "Successfully bypassed RLS to list candidates using 'secret' auth mode.",
        authMode: ctx.authMode,
        candidatesCount: data ? data.length : 0,
        candidates: data || []
      });
    } catch (err) {
      return Response.json({ error: err.message || "Failed to list candidates as admin." }, { status: 500 });
    }
  })
};

// src/lib/supabase.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_meta = {};
var supabaseClientInstance = null;
function clearSupabaseClient() {
  supabaseClientInstance = null;
}
function isSupabaseConfigured() {
  try {
    const isServer = typeof process !== "undefined" && process.env;
    const url = isServer ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : import_meta.env.VITE_SUPABASE_URL;
    const key = isServer ? process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : import_meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(url && key);
  } catch {
    return false;
  }
}
function getSupabase() {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }
  const isServer = typeof process !== "undefined" && process.env;
  const supabaseUrl = isServer ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : import_meta.env.VITE_SUPABASE_URL;
  const supabaseKey = isServer ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : import_meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not defined in the environment.");
  }
  if (!supabaseKey) {
    throw new Error("SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY is not defined in the environment.");
  }
  supabaseClientInstance = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return supabaseClientInstance;
}

// server.ts
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
var isVercel = !!process.env.VERCEL;
var DB_PATH = isVercel ? import_path.default.join("/tmp", "db.json") : import_path.default.join(process.cwd(), "data", "db.json");
var UPLOADS_DIR = isVercel ? import_path.default.join("/tmp", "uploads") : import_path.default.join(process.cwd(), "data", "uploads");
if (!import_fs.default.existsSync(import_path.default.dirname(DB_PATH))) {
  import_fs.default.mkdirSync(import_path.default.dirname(DB_PATH), { recursive: true });
}
if (!import_fs.default.existsSync(DB_PATH)) {
  import_fs.default.writeFileSync(DB_PATH, JSON.stringify({ candidates: [], tokens: {}, documents: [] }, null, 2), "utf-8");
}
if (!import_fs.default.existsSync(UPLOADS_DIR)) {
  import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", import_express.default.static(UPLOADS_DIR));
var memoryDB = null;
var supabaseActive = false;
var supabaseErrorDetails = null;
async function syncToSupabase(db) {
  if (!supabaseActive) return;
  try {
    const supabase = getSupabase();
    if (db.candidates && db.candidates.length > 0) {
      await supabase.from("candidates").upsert(db.candidates);
    }
    if (db.recruiters && db.recruiters.length > 0) {
      await supabase.from("recruiters").upsert(db.recruiters);
    }
    if (db.jobs && db.jobs.length > 0) {
      await supabase.from("jobs").upsert(db.jobs);
    }
    if (db.applications && db.applications.length > 0) {
      await supabase.from("applications").upsert(db.applications);
    }
    if (db.documents && db.documents.length > 0) {
      await supabase.from("documents").upsert(db.documents);
    }
  } catch (err) {
    console.warn("[Supabase Sync Warning] Failed to sync data to Supabase:", err.message || err);
  }
}
function readDB() {
  if (memoryDB) {
    return memoryDB;
  }
  try {
    const data = import_fs.default.readFileSync(DB_PATH, "utf-8");
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
function writeDB(data) {
  memoryDB = data;
  import_fs.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  if (supabaseActive) {
    syncToSupabase(data).catch((err) => {
      console.error("[Supabase Background Sync Error]", err);
    });
  }
}
function hashPassword(password) {
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const hash = import_crypto.default.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const verifyHash = import_crypto.default.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return verifyHash === hash;
}
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  const db = readDB();
  const candidateId = db.tokens[token];
  if (!candidateId) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
  const candidate = db.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    return res.status(404).json({ error: "Candidate not found." });
  }
  req.candidate = candidate;
  req.token = token;
  next();
}
function authenticateRecruiter(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  const db = readDB();
  const recruiterId = db.recruiterTokens[token];
  if (!recruiterId) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
  const recruiter = db.recruiters.find((r) => r.id === recruiterId);
  if (!recruiter) {
    return res.status(404).json({ error: "Recruiter not found." });
  }
  req.recruiter = recruiter;
  req.token = token;
  next();
}
app.post("/api/register", (req, res) => {
  const { fullName, mobile, email, password, confirmPassword } = req.body;
  if (!fullName || !mobile || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields except email are required." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  const cleanMobile = mobile.trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ error: "Mobile number must be a valid 10-digit number." });
  }
  const db = readDB();
  const exists = db.candidates.some((c) => c.mobile === cleanMobile);
  if (exists) {
    return res.status(400).json({ error: "Mobile number is already registered." });
  }
  const id = import_crypto.default.randomUUID();
  const { salt, hash } = hashPassword(password);
  const newCandidate = {
    id,
    mobile: cleanMobile,
    fullName: fullName.trim(),
    email: email ? email.trim() : void 0,
    salt,
    hash,
    profile: {
      fullName: fullName.trim(),
      // Default full name
      bikeAvailable: "No",
      drivingLicenseAvailable: "No",
      languagesKnown: []
    }
  };
  db.candidates.push(newCandidate);
  const token = import_crypto.default.randomBytes(32).toString("hex");
  db.tokens[token] = id;
  writeDB(db);
  res.status(201).json({
    message: "Registration successful",
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
app.post("/api/login", (req, res) => {
  const { mobile, password } = req.body;
  if (!mobile || !password) {
    return res.status(400).json({ error: "Mobile number and password are required." });
  }
  const cleanMobile = mobile.trim();
  const db = readDB();
  const candidate = db.candidates.find((c) => c.mobile === cleanMobile);
  if (!candidate) {
    return res.status(400).json({ error: "Invalid mobile number or password." });
  }
  const isValid = verifyPassword(password, candidate.salt, candidate.hash);
  if (!isValid) {
    return res.status(400).json({ error: "Invalid mobile number or password." });
  }
  const token = import_crypto.default.randomBytes(32).toString("hex");
  db.tokens[token] = candidate.id;
  writeDB(db);
  res.status(200).json({
    message: "Login successful",
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
app.get("/api/profile", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const db = readDB();
  const documents = db.documents.filter((d) => d.candidateId === candidate.id);
  res.status(200).json({
    id: candidate.id,
    profile: candidate.profile,
    fullName: candidate.fullName,
    email: candidate.email,
    mobile: candidate.mobile,
    documents
  });
});
app.put("/api/profile", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const updatedProfile = req.body;
  if (!updatedProfile.fullName || updatedProfile.fullName.trim() === "") {
    return res.status(400).json({ error: "Full name is required in profile." });
  }
  const db = readDB();
  const dbCandidate = db.candidates.find((c) => c.id === candidate.id);
  if (!dbCandidate) {
    return res.status(404).json({ error: "Candidate not found." });
  }
  dbCandidate.profile = {
    profilePhoto: updatedProfile.profilePhoto,
    fullName: updatedProfile.fullName.trim(),
    age: typeof updatedProfile.age === "number" ? updatedProfile.age : updatedProfile.age ? Number(updatedProfile.age) : void 0,
    dateOfBirth: updatedProfile.dateOfBirth,
    gender: updatedProfile.gender,
    address: updatedProfile.address,
    city: updatedProfile.city,
    state: updatedProfile.state,
    pincode: updatedProfile.pincode,
    education: updatedProfile.education,
    experience: typeof updatedProfile.experience === "number" ? updatedProfile.experience : void 0,
    currentOccupation: updatedProfile.currentOccupation,
    expectedSalary: updatedProfile.expectedSalary,
    languagesKnown: Array.isArray(updatedProfile.languagesKnown) ? updatedProfile.languagesKnown : [],
    bikeAvailable: updatedProfile.bikeAvailable === "Yes" ? "Yes" : "No",
    drivingLicenseAvailable: updatedProfile.drivingLicenseAvailable === "Yes" ? "Yes" : "No"
  };
  dbCandidate.fullName = dbCandidate.profile.fullName;
  writeDB(db);
  const documents = db.documents.filter((d) => d.candidateId === candidate.id);
  res.status(200).json({
    message: "Profile updated successfully",
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
app.get("/api/documents", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const db = readDB();
  const documents = db.documents.filter((d) => d.candidateId === candidate.id);
  res.status(200).json({ documents });
});
app.post("/api/documents", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const { documentType, fileName, fileContent } = req.body;
  if (!documentType || !fileName || !fileContent) {
    return res.status(400).json({ error: "documentType, fileName and fileContent are required." });
  }
  const validTypes = ["aadhaar", "pan", "dl", "resume", "photo"];
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({ error: "Invalid document type. Allowed: aadhaar, pan, dl, resume, photo" });
  }
  const ext = import_path.default.extname(fileName).toLowerCase();
  if (documentType === "resume") {
    if (ext !== ".pdf") {
      return res.status(400).json({ error: "Resume must be a PDF file." });
    }
  } else {
    if (![".jpg", ".jpeg", ".png"].includes(ext)) {
      return res.status(400).json({ error: "Images must be in JPG, JPEG, or PNG format." });
    }
  }
  const sizeInBytes = fileContent.length * 3 / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "File size must be under 5MB." });
  }
  try {
    const db = readDB();
    const existingDocIndex = db.documents.findIndex(
      (d) => d.candidateId === candidate.id && d.documentType === documentType
    );
    const safeFileName = `${candidate.id}-${documentType}${ext}`;
    const filePath = import_path.default.join(UPLOADS_DIR, safeFileName);
    let base64Data = fileContent;
    if (fileContent.includes(";base64,")) {
      base64Data = fileContent.split(";base64,")[1];
    }
    const buffer = Buffer.from(base64Data, "base64");
    import_fs.default.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/${safeFileName}`;
    const newDoc = {
      id: import_crypto.default.randomUUID(),
      candidateId: candidate.id,
      documentType,
      fileUrl,
      fileName,
      uploadDate: (/* @__PURE__ */ new Date()).toISOString(),
      verificationStatus: "Pending"
    };
    if (existingDocIndex > -1) {
      db.documents[existingDocIndex] = newDoc;
    } else {
      db.documents.push(newDoc);
    }
    writeDB(db);
    res.status(201).json({
      message: "Document uploaded successfully",
      document: newDoc
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error saving the file." });
  }
});
app.put("/api/documents/:type", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const documentType = req.params.type;
  const { fileName, fileContent } = req.body;
  const validTypes = ["aadhaar", "pan", "dl", "resume", "photo"];
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({ error: "Invalid document type. Allowed: aadhaar, pan, dl, resume, photo" });
  }
  if (!fileName || !fileContent) {
    return res.status(400).json({ error: "fileName and fileContent are required." });
  }
  const ext = import_path.default.extname(fileName).toLowerCase();
  if (documentType === "resume") {
    if (ext !== ".pdf") {
      return res.status(400).json({ error: "Resume must be a PDF file." });
    }
  } else {
    if (![".jpg", ".jpeg", ".png"].includes(ext)) {
      return res.status(400).json({ error: "Images must be in JPG, JPEG, or PNG format." });
    }
  }
  const sizeInBytes = fileContent.length * 3 / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "File size must be under 5MB." });
  }
  try {
    const db = readDB();
    const safeFileName = `${candidate.id}-${documentType}${ext}`;
    const filePath = import_path.default.join(UPLOADS_DIR, safeFileName);
    let base64Data = fileContent;
    if (fileContent.includes(";base64,")) {
      base64Data = fileContent.split(";base64,")[1];
    }
    const buffer = Buffer.from(base64Data, "base64");
    import_fs.default.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/${safeFileName}`;
    const newDoc = {
      id: import_crypto.default.randomUUID(),
      candidateId: candidate.id,
      documentType,
      fileUrl,
      fileName,
      uploadDate: (/* @__PURE__ */ new Date()).toISOString(),
      verificationStatus: "Pending"
    };
    const existingDocIndex = db.documents.findIndex(
      (d) => d.candidateId === candidate.id && d.documentType === documentType
    );
    if (existingDocIndex > -1) {
      db.documents[existingDocIndex] = newDoc;
    } else {
      db.documents.push(newDoc);
    }
    writeDB(db);
    res.status(200).json({
      message: "Document replaced successfully",
      document: newDoc
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error replacing the document." });
  }
});
app.delete("/api/documents/:type", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const documentType = req.params.type;
  const validTypes = ["aadhaar", "pan", "dl", "resume", "photo"];
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({ error: "Invalid document type." });
  }
  try {
    const db = readDB();
    const docIndex = db.documents.findIndex(
      (d) => d.candidateId === candidate.id && d.documentType === documentType
    );
    if (docIndex === -1) {
      return res.status(404).json({ error: "Document not found." });
    }
    const doc = db.documents[docIndex];
    const safeFileName = import_path.default.basename(doc.fileUrl);
    const filePath = import_path.default.join(UPLOADS_DIR, safeFileName);
    if (import_fs.default.existsSync(filePath)) {
      try {
        import_fs.default.unlinkSync(filePath);
      } catch (fileErr) {
        console.error("File unlink error:", fileErr);
      }
    }
    db.documents.splice(docIndex, 1);
    writeDB(db);
    res.status(200).json({
      message: "Document deleted successfully",
      documentType
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error deleting the document." });
  }
});
app.post("/api/recruiter/register", (req, res) => {
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
  if (!companyName || !recruiterName || !designation || !mobile || !email || !password || !confirmPassword || !address || !city || !state || !pincode) {
    return res.status(400).json({ error: "All fields except Company Website and Logo are required." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  try {
    const db = readDB();
    const mobileExists = db.recruiters.some((r) => r.mobile === mobile);
    if (mobileExists) {
      return res.status(400).json({ error: "Mobile number is already registered." });
    }
    const emailExists = db.recruiters.some((r) => r.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: "Email address is already registered." });
    }
    const { salt, hash } = hashPassword(password);
    const recruiterId = import_crypto.default.randomUUID();
    const newRecruiter = {
      id: recruiterId,
      companyName,
      companyLogo: companyLogo || "",
      companyWebsite: companyWebsite || "",
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
      status: "Approved",
      // Approved by default for smooth sandbox evaluation
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.recruiters.push(newRecruiter);
    writeDB(db);
    const { salt: _s, hash: _h, ...recruiterDetails } = newRecruiter;
    res.status(201).json({
      message: "Recruiter registered successfully and is pending admin approval.",
      recruiter: recruiterDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during recruiter registration." });
  }
});
app.post("/api/recruiter/login", (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Mobile/Email and password are required." });
  }
  try {
    const db = readDB();
    const cleanIdentifier = identifier.trim().toLowerCase();
    const recruiter = db.recruiters.find(
      (r) => r.email.toLowerCase() === cleanIdentifier || r.mobile === identifier
    );
    if (!recruiter) {
      return res.status(401).json({ error: "Invalid mobile/email or password." });
    }
    const isValid = verifyPassword(password, recruiter.salt, recruiter.hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid mobile/email or password." });
    }
    const token = import_crypto.default.randomBytes(32).toString("hex");
    db.recruiterTokens = db.recruiterTokens || {};
    db.recruiterTokens[token] = recruiter.id;
    writeDB(db);
    const { salt: _s, hash: _h, ...recruiterDetails } = recruiter;
    res.status(200).json({
      token,
      recruiter: recruiterDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during recruiter login." });
  }
});
app.get("/api/recruiter/profile", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  const { salt: _s, hash: _h, ...recruiterDetails } = recruiter;
  res.status(200).json({ recruiter: recruiterDetails });
});
app.put("/api/recruiter/profile", authenticateRecruiter, (req, res) => {
  const loggedInRecruiter = req.recruiter;
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
  if (!companyName || !recruiterName || !designation || !mobile || !email || !address || !city || !state || !pincode) {
    return res.status(400).json({ error: "All fields except company website/logo are required." });
  }
  try {
    const db = readDB();
    const index = db.recruiters.findIndex((r) => r.id === loggedInRecruiter.id);
    if (index === -1) {
      return res.status(404).json({ error: "Recruiter not found." });
    }
    if (mobile !== loggedInRecruiter.mobile) {
      const mobileExists = db.recruiters.some((r) => r.id !== loggedInRecruiter.id && r.mobile === mobile);
      if (mobileExists) {
        return res.status(400).json({ error: "Mobile number is already registered by another recruiter." });
      }
    }
    if (email.toLowerCase() !== loggedInRecruiter.email.toLowerCase()) {
      const emailExists = db.recruiters.some(
        (r) => r.id !== loggedInRecruiter.id && r.email.toLowerCase() === email.toLowerCase()
      );
      if (emailExists) {
        return res.status(400).json({ error: "Email address is already registered by another recruiter." });
      }
    }
    const updatedRecruiter = {
      ...db.recruiters[index],
      companyName,
      companyLogo: companyLogo !== void 0 ? companyLogo : db.recruiters[index].companyLogo,
      companyWebsite: companyWebsite || "",
      recruiterName,
      designation,
      mobile,
      email: email.toLowerCase(),
      address,
      city,
      state,
      pincode,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.recruiters[index] = updatedRecruiter;
    writeDB(db);
    const { salt: _s, hash: _h, ...recruiterDetails } = updatedRecruiter;
    res.status(200).json({
      message: "Recruiter profile updated successfully",
      recruiter: recruiterDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error updating recruiter profile." });
  }
});
app.post("/api/dev/approve-recruiter", (req, res) => {
  const { id, status = "Approved" } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Recruiter ID is required." });
  }
  try {
    const db = readDB();
    const index = db.recruiters.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Recruiter not found." });
    }
    db.recruiters[index].status = status;
    db.recruiters[index].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    writeDB(db);
    const { salt: _s, hash: _h, ...recruiterDetails } = db.recruiters[index];
    res.status(200).json({
      message: `Recruiter status successfully set to ${status}`,
      recruiter: recruiterDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error updating status." });
  }
});
app.post("/api/recruiter/jobs", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  if (recruiter.status !== "Approved") {
    return res.status(403).json({ error: "Access Denied. Only approved recruiter accounts can post job openings." });
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
  if (!title || !category || openings === void 0 || !employmentType || !state || !city || !area || minSalary === void 0 || maxSalary === void 0 || !salaryType || !shift || experienceRequired === void 0 || !educationRequired || !genderPreference || ageLimitMin === void 0 || ageLimitMax === void 0 || !bikeRequired || !drivingLicenseRequired || !immediateJoining || !description || !responsibilities || !benefits || !status) {
    return res.status(400).json({ error: "Required fields are missing. Please fill in all fields." });
  }
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const newJob = {
      id: import_crypto.default.randomUUID(),
      recruiterId: recruiter.id,
      companyName: recruiter.companyName,
      companyLogo: recruiter.companyLogo || "",
      title: title.trim(),
      category: category.trim(),
      openings: Number(openings),
      employmentType: employmentType.trim(),
      state: state.trim(),
      city: city.trim(),
      area: area.trim(),
      workLocation: workLocation ? workLocation.trim() : "",
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
      // 'Draft' | 'Published' | 'Unpublished' | 'Closed'
      applicationsCount: 0,
      viewsCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.jobs.push(newJob);
    writeDB(db);
    res.status(201).json({ message: "Job posted successfully", job: newJob });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error posting the job." });
  }
});
app.get("/api/recruiter/jobs", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const recruiterJobs = db.jobs.filter((j) => j.recruiterId === recruiter.id);
    res.status(200).json({ jobs: recruiterJobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving jobs." });
  }
});
app.get("/api/recruiter/jobs/:id", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  const jobId = req.params.id;
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j) => j.id === jobId && j.recruiterId === recruiter.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    res.status(200).json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving job details." });
  }
});
app.put("/api/recruiter/jobs/:id", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  if (recruiter.status !== "Approved") {
    return res.status(403).json({ error: "Access Denied. Only approved recruiter accounts can update job openings." });
  }
  const jobId = req.params.id;
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const index = db.jobs.findIndex((j) => j.id === jobId && j.recruiterId === recruiter.id);
    if (index === -1) {
      return res.status(404).json({ error: "Job not found or access denied." });
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
      title: title !== void 0 ? title.trim() : currentJob.title,
      category: category !== void 0 ? category.trim() : currentJob.category,
      openings: openings !== void 0 ? Number(openings) : currentJob.openings,
      employmentType: employmentType !== void 0 ? employmentType.trim() : currentJob.employmentType,
      state: state !== void 0 ? state.trim() : currentJob.state,
      city: city !== void 0 ? city.trim() : currentJob.city,
      area: area !== void 0 ? area.trim() : currentJob.area,
      workLocation: workLocation !== void 0 ? workLocation ? workLocation.trim() : "" : currentJob.workLocation,
      minSalary: minSalary !== void 0 ? Number(minSalary) : currentJob.minSalary,
      maxSalary: maxSalary !== void 0 ? Number(maxSalary) : currentJob.maxSalary,
      salaryType: salaryType !== void 0 ? salaryType.trim() : currentJob.salaryType,
      shift: shift !== void 0 ? shift.trim() : currentJob.shift,
      experienceRequired: experienceRequired !== void 0 ? Number(experienceRequired) : currentJob.experienceRequired,
      educationRequired: educationRequired !== void 0 ? educationRequired.trim() : currentJob.educationRequired,
      genderPreference: genderPreference !== void 0 ? genderPreference.trim() : currentJob.genderPreference,
      ageLimitMin: ageLimitMin !== void 0 ? Number(ageLimitMin) : currentJob.ageLimitMin,
      ageLimitMax: ageLimitMax !== void 0 ? Number(ageLimitMax) : currentJob.ageLimitMax,
      bikeRequired: bikeRequired !== void 0 ? bikeRequired.trim() : currentJob.bikeRequired,
      drivingLicenseRequired: drivingLicenseRequired !== void 0 ? drivingLicenseRequired.trim() : currentJob.drivingLicenseRequired,
      immediateJoining: immediateJoining !== void 0 ? immediateJoining.trim() : currentJob.immediateJoining,
      description: description !== void 0 ? description.trim() : currentJob.description,
      responsibilities: responsibilities !== void 0 ? responsibilities.trim() : currentJob.responsibilities,
      benefits: benefits !== void 0 ? benefits.trim() : currentJob.benefits,
      status: status !== void 0 ? status.trim() : currentJob.status,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    writeDB(db);
    res.status(200).json({ message: "Job updated successfully", job: db.jobs[index] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error updating the job." });
  }
});
app.patch("/api/recruiter/jobs/:id/status", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  if (recruiter.status !== "Approved") {
    return res.status(403).json({ error: "Access Denied. Only approved recruiter accounts can update job statuses." });
  }
  const jobId = req.params.id;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "Status is required." });
  }
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const index = db.jobs.findIndex((j) => j.id === jobId && j.recruiterId === recruiter.id);
    if (index === -1) {
      return res.status(404).json({ error: "Job not found or access denied." });
    }
    db.jobs[index].status = status;
    db.jobs[index].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    writeDB(db);
    res.status(200).json({ message: `Job status updated to ${status} successfully`, job: db.jobs[index] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error updating job status." });
  }
});
app.delete("/api/recruiter/jobs/:id", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  if (recruiter.status !== "Approved") {
    return res.status(403).json({ error: "Access Denied. Only approved recruiter accounts can delete job openings." });
  }
  const jobId = req.params.id;
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const index = db.jobs.findIndex((j) => j.id === jobId && j.recruiterId === recruiter.id);
    if (index === -1) {
      return res.status(404).json({ error: "Job not found or access denied." });
    }
    db.jobs.splice(index, 1);
    writeDB(db);
    res.status(200).json({ message: "Job deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error deleting the job." });
  }
});
app.get("/api/jobs", (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    let jobs = db.jobs.filter((j) => j.status === "Published" || j.status === "Active");
    const search = req.query.search;
    if (search) {
      const q = search.toLowerCase();
      jobs = jobs.filter(
        (j) => j.title.toLowerCase().includes(q) || j.companyName.toLowerCase().includes(q) || j.city.toLowerCase().includes(q)
      );
    }
    const state = req.query.state;
    if (state && state !== "All") {
      jobs = jobs.filter((j) => j.state && j.state.toLowerCase() === state.toLowerCase());
    }
    const city = req.query.city;
    if (city && city !== "All") {
      jobs = jobs.filter((j) => j.city && j.city.toLowerCase() === city.toLowerCase());
    }
    const employmentType = req.query.employmentType;
    if (employmentType && employmentType !== "All") {
      jobs = jobs.filter((j) => j.employmentType === employmentType);
    }
    const shift = req.query.shift;
    if (shift && shift !== "All") {
      jobs = jobs.filter((j) => j.shift === shift);
    }
    const bikeRequired = req.query.bikeRequired;
    if (bikeRequired && bikeRequired !== "All") {
      jobs = jobs.filter((j) => j.bikeRequired === bikeRequired);
    }
    const drivingLicenseRequired = req.query.drivingLicenseRequired;
    if (drivingLicenseRequired && drivingLicenseRequired !== "All") {
      jobs = jobs.filter((j) => j.drivingLicenseRequired === drivingLicenseRequired);
    }
    const immediateJoining = req.query.immediateJoining;
    if (immediateJoining && immediateJoining !== "All") {
      jobs = jobs.filter((j) => j.immediateJoining === immediateJoining);
    }
    const genderPreference = req.query.genderPreference;
    if (genderPreference && genderPreference !== "All") {
      jobs = jobs.filter((j) => j.genderPreference === genderPreference);
    }
    const maxExperience = req.query.experience;
    if (maxExperience && maxExperience !== "All") {
      jobs = jobs.filter((j) => j.experienceRequired <= Number(maxExperience));
    }
    const minSalary = req.query.minSalary;
    if (minSalary) {
      jobs = jobs.filter((j) => j.maxSalary >= Number(minSalary));
    }
    const sort = req.query.sort;
    if (sort === "oldest") {
      jobs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    res.status(200).json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving jobs." });
  }
});
app.get("/api/jobs/search", (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    let jobs = db.jobs.filter((j) => j.status === "Published" || j.status === "Active");
    const q = req.query.q || "";
    if (q) {
      const lowerQ = q.toLowerCase();
      jobs = jobs.filter(
        (j) => j.title.toLowerCase().includes(lowerQ) || j.companyName.toLowerCase().includes(lowerQ) || j.city.toLowerCase().includes(lowerQ)
      );
    }
    res.status(200).json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error searching jobs." });
  }
});
app.get("/api/jobs/filter", (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    let jobs = db.jobs.filter((j) => j.status === "Published" || j.status === "Active");
    const state = req.query.state;
    if (state && state !== "All") {
      jobs = jobs.filter((j) => j.state && j.state.toLowerCase() === state.toLowerCase());
    }
    const city = req.query.city;
    if (city && city !== "All") {
      jobs = jobs.filter((j) => j.city && j.city.toLowerCase() === city.toLowerCase());
    }
    const minSalary = req.query.minSalary;
    if (minSalary) {
      jobs = jobs.filter((j) => j.maxSalary >= Number(minSalary));
    }
    const employmentType = req.query.employmentType;
    if (employmentType && employmentType !== "All") {
      jobs = jobs.filter((j) => j.employmentType === employmentType);
    }
    const experience = req.query.experience;
    if (experience && experience !== "All") {
      jobs = jobs.filter((j) => j.experienceRequired <= Number(experience));
    }
    const shift = req.query.shift;
    if (shift && shift !== "All") {
      jobs = jobs.filter((j) => j.shift === shift);
    }
    const bikeRequired = req.query.bikeRequired;
    if (bikeRequired && bikeRequired !== "All") {
      jobs = jobs.filter((j) => j.bikeRequired === bikeRequired);
    }
    const drivingLicenseRequired = req.query.drivingLicenseRequired;
    if (drivingLicenseRequired && drivingLicenseRequired !== "All") {
      jobs = jobs.filter((j) => j.drivingLicenseRequired === drivingLicenseRequired);
    }
    const immediateJoining = req.query.immediateJoining;
    if (immediateJoining && immediateJoining !== "All") {
      jobs = jobs.filter((j) => j.immediateJoining === immediateJoining);
    }
    const genderPreference = req.query.genderPreference;
    if (genderPreference && genderPreference !== "All") {
      jobs = jobs.filter((j) => j.genderPreference === genderPreference);
    }
    const sort = req.query.sort;
    if (sort === "oldest") {
      jobs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    res.status(200).json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error filtering jobs." });
  }
});
app.get("/api/jobs/:id", (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job opening not found." });
    }
    if (job.status === "Draft") {
      return res.status(403).json({ error: "This job listing is not available." });
    }
    job.viewsCount = (job.viewsCount || 0) + 1;
    writeDB(db);
    res.status(200).json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving job details." });
  }
});
app.post("/api/jobs/:id/view", (req, res) => {
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job opening not found." });
    }
    job.viewsCount = (job.viewsCount || 0) + 1;
    writeDB(db);
    res.status(200).json({ success: true, viewsCount: job.viewsCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error tracking job view." });
  }
});
app.post("/api/jobs/:id/apply", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const jobId = req.params.id;
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    db.applications = db.applications || [];
    db.documents = db.documents || [];
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: "Job opening not found." });
    }
    if (job.status === "Draft") {
      return res.status(403).json({ error: "Cannot apply to a draft job." });
    }
    if (job.status === "Closed") {
      return res.status(400).json({ error: "This job listing has been closed and cannot accept new applications." });
    }
    const profile = candidate.profile || {};
    const requiredProfileFields = [
      "fullName",
      "age",
      "gender",
      "pincode"
    ];
    const missingProfileFields = [];
    requiredProfileFields.forEach((field) => {
      const val = profile[field];
      if (val === void 0 || val === null || typeof val === "string" && !val.trim()) {
        const names = {
          fullName: "Full Name",
          age: "Age",
          gender: "Gender",
          pincode: "6-digit Pincode"
        };
        missingProfileFields.push(names[field] || field);
      }
    });
    const missingDocs = [];
    if (missingProfileFields.length > 0 || missingDocs.length > 0) {
      return res.status(400).json({
        error: "Profile or documents are incomplete.",
        missingProfileFields,
        missingDocs
      });
    }
    const existingApplication = db.applications.find(
      (app2) => app2.candidateId === candidate.id && app2.jobId === jobId && app2.withdrawStatus !== "Withdrawn"
    );
    if (existingApplication) {
      return res.status(400).json({ error: "You have already applied for this job listing." });
    }
    const newApplication = {
      id: import_crypto.default.randomUUID(),
      candidateId: candidate.id,
      jobId,
      recruiterId: job.recruiterId,
      appliedDate: (/* @__PURE__ */ new Date()).toISOString(),
      currentStatus: "Applied",
      // Default: Applied
      withdrawStatus: "Active",
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.applications.push(newApplication);
    job.applicationsCount = (job.applicationsCount || 0) + 1;
    writeDB(db);
    res.status(201).json({
      message: "Application submitted successfully.",
      application: newApplication
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error submitting application." });
  }
});
app.post("/api/applications", authenticateToken, (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: "jobId is required in body." });
  }
  try {
    const db = readDB();
    db.jobs = db.jobs || [];
    db.applications = db.applications || [];
    db.documents = db.documents || [];
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: "Job opening not found." });
    }
    if (job.status === "Draft") {
      return res.status(403).json({ error: "Cannot apply to a draft job." });
    }
    if (job.status === "Closed") {
      return res.status(400).json({ error: "This job listing has been closed and cannot accept new applications." });
    }
    const candidate = req.candidate;
    const profile = candidate.profile || {};
    const requiredProfileFields = [
      "fullName",
      "age",
      "gender",
      "pincode"
    ];
    const missingProfileFields = [];
    requiredProfileFields.forEach((field) => {
      const val = profile[field];
      if (val === void 0 || val === null || typeof val === "string" && !val.trim()) {
        const names = {
          fullName: "Full Name",
          age: "Age",
          gender: "Gender",
          pincode: "6-digit Pincode"
        };
        missingProfileFields.push(names[field] || field);
      }
    });
    const missingDocs = [];
    if (missingProfileFields.length > 0 || missingDocs.length > 0) {
      return res.status(400).json({
        error: "Profile or documents are incomplete.",
        missingProfileFields,
        missingDocs
      });
    }
    const existingApplication = db.applications.find(
      (app2) => app2.candidateId === candidate.id && app2.jobId === jobId && app2.withdrawStatus !== "Withdrawn"
    );
    if (existingApplication) {
      return res.status(400).json({ error: "You have already applied for this job listing." });
    }
    const newApplication = {
      id: import_crypto.default.randomUUID(),
      candidateId: candidate.id,
      jobId,
      recruiterId: job.recruiterId,
      appliedDate: (/* @__PURE__ */ new Date()).toISOString(),
      currentStatus: "Applied",
      withdrawStatus: "Active",
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.applications.push(newApplication);
    job.applicationsCount = (job.applicationsCount || 0) + 1;
    writeDB(db);
    res.status(201).json({
      message: "Application submitted successfully.",
      application: newApplication
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error submitting application." });
  }
});
app.get("/api/applications/my", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  try {
    const db = readDB();
    db.applications = db.applications || [];
    db.jobs = db.jobs || [];
    const myApps = db.applications.filter((app2) => app2.candidateId === candidate.id);
    const detailedApps = myApps.map((app2) => {
      const job = db.jobs.find((j) => j.id === app2.jobId) || {};
      return {
        ...app2,
        jobTitle: job.title || "Unknown Position",
        companyName: job.companyName || "Unknown Company",
        companyLogo: job.companyLogo || "",
        jobCity: job.city || "",
        jobState: job.state || "",
        jobSalary: job.minSalary ? `\u20B9${job.minSalary} - \u20B9${job.maxSalary}` : job.salary || "N/A",
        jobSalaryType: job.salaryType || "",
        jobEmploymentType: job.employmentType || "",
        jobShift: job.shift || "",
        jobExperienceRequired: job.experienceRequired || 0,
        jobOpenings: job.openings || 1,
        jobDescription: job.description || "",
        jobResponsibilities: job.responsibilities || "",
        jobRequirements: job.educationRequired || "",
        jobBenefits: job.benefits || "",
        jobWorkingHours: job.workingHours || "Standard Shift hours",
        jobAgeLimit: job.ageLimitMin ? `${job.ageLimitMin} - ${job.ageLimitMax} Years` : "18 - 45 Years",
        jobBikeRequirement: job.bikeRequired || "No",
        jobDrivingLicenseRequirement: job.drivingLicenseRequired || "No",
        jobRecruiterName: job.recruiterName || ""
      };
    });
    res.status(200).json({ applications: detailedApps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving applications." });
  }
});
app.get("/api/my-applications", authenticateToken, (req, res) => {
  try {
    const db = readDB();
    const candidate = req.candidate;
    db.applications = db.applications || [];
    db.jobs = db.jobs || [];
    const myApps = db.applications.filter((app2) => app2.candidateId === candidate.id);
    const detailedApps = myApps.map((app2) => {
      const job = db.jobs.find((j) => j.id === app2.jobId) || {};
      return {
        ...app2,
        jobTitle: job.title || "Unknown Position",
        companyName: job.companyName || "Unknown Company",
        companyLogo: job.companyLogo || "",
        jobCity: job.city || "",
        jobState: job.state || "",
        jobSalary: job.minSalary ? `\u20B9${job.minSalary} - \u20B9${job.maxSalary}` : job.salary || "N/A",
        jobSalaryType: job.salaryType || "",
        jobEmploymentType: job.employmentType || "",
        jobShift: job.shift || "",
        jobExperienceRequired: job.experienceRequired || 0,
        jobOpenings: job.openings || 1,
        jobDescription: job.description || "",
        jobResponsibilities: job.responsibilities || "",
        jobRequirements: job.educationRequired || "",
        jobBenefits: job.benefits || "",
        jobWorkingHours: job.workingHours || "Standard Shift hours",
        jobAgeLimit: job.ageLimitMin ? `${job.ageLimitMin} - ${job.ageLimitMax} Years` : "18 - 45 Years",
        jobBikeRequirement: job.bikeRequired || "No",
        jobDrivingLicenseRequirement: job.drivingLicenseRequired || "No",
        jobRecruiterName: job.recruiterName || ""
      };
    });
    res.status(200).json({ applications: detailedApps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving applications." });
  }
});
app.post("/api/applications/:id/withdraw", authenticateToken, (req, res) => {
  const candidate = req.candidate;
  const appId = req.params.id;
  try {
    const db = readDB();
    db.applications = db.applications || [];
    const appIndex = db.applications.findIndex((app2) => app2.id === appId && app2.candidateId === candidate.id);
    if (appIndex === -1) {
      return res.status(404).json({ error: "Application not found." });
    }
    const application = db.applications[appIndex];
    if (application.currentStatus !== "Applied") {
      return res.status(400).json({ error: "Cannot withdraw applications that have already progressed past Applied status." });
    }
    application.currentStatus = "Withdrawn";
    application.withdrawStatus = "Withdrawn";
    application.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    db.jobs = db.jobs || [];
    const job = db.jobs.find((j) => j.id === application.jobId);
    if (job && job.applicationsCount > 0) {
      job.applicationsCount -= 1;
    }
    writeDB(db);
    res.status(200).json({
      message: "Application withdrawn successfully.",
      application
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error withdrawing application." });
  }
});
app.get("/api/recruiter/applications", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  try {
    const db = readDB();
    const myJobs = db.jobs.filter((j) => j.recruiterId === recruiter.id);
    const myJobIds = myJobs.map((j) => j.id);
    const myApps = db.applications.filter((app2) => myJobIds.includes(app2.jobId));
    const detailedApps = myApps.map((app2) => {
      const job = db.jobs.find((j) => j.id === app2.jobId) || {};
      const candidate = db.candidates.find((c) => c.id === app2.candidateId) || {};
      const profile = candidate.profile || {};
      return {
        ...app2,
        jobTitle: job.title || "Unknown Position",
        jobCity: job.city || "",
        candidateName: profile.fullName || candidate.fullName || "Unknown Candidate",
        candidateMobile: candidate.mobile || "",
        candidateEmail: candidate.email || "",
        candidateProfilePhoto: profile.profilePhoto || "",
        candidateExperience: profile.experience !== void 0 ? profile.experience : 0,
        candidateCity: profile.city || "",
        candidateState: profile.state || ""
      };
    });
    res.status(200).json({ applications: detailedApps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving recruiter applications." });
  }
});
app.get("/api/recruiter/applications/:id", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  const appId = req.params.id;
  try {
    const db = readDB();
    const application = db.applications.find((a) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }
    const job = db.jobs.find((j) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: "Unauthorized to view this application." });
    }
    const candidate = db.candidates.find((c) => c.id === application.candidateId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }
    const docs = db.documents.filter((d) => d.candidateId === application.candidateId);
    const notes = db.recruiterNotes.filter((n) => n.applicationId === appId);
    const history = db.applicationHistory.filter((h) => h.applicationId === appId);
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
    res.status(500).json({ error: "Server error retrieving application details." });
  }
});
app.post("/api/recruiter/applications/:id/status", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  const appId = req.params.id;
  const { status: newStatus } = req.body;
  const allowedStatuses = [
    "Applied",
    "Contacted",
    "Shortlisted",
    "Interview Scheduled",
    "Interview Completed",
    "Selected",
    "Hired",
    "Rejected",
    "Withdrawn"
  ];
  if (!newStatus || !allowedStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status. Allowed statuses are: ${allowedStatuses.join(", ")}` });
  }
  try {
    const db = readDB();
    const application = db.applications.find((a) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }
    const job = db.jobs.find((j) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: "Unauthorized to modify this application." });
    }
    const oldStatus = application.currentStatus;
    application.currentStatus = newStatus;
    application.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    const historyEntry = {
      id: import_crypto.default.randomUUID(),
      applicationId: appId,
      previousStatus: oldStatus,
      newStatus,
      changedBy: recruiter.recruiterName || "Recruiter",
      changedByRole: "Recruiter",
      changedDate: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.applicationHistory = db.applicationHistory || [];
    db.applicationHistory.push(historyEntry);
    writeDB(db);
    res.status(200).json({
      message: "Status updated successfully.",
      application,
      historyEntry
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error updating application status." });
  }
});
app.post("/api/recruiter/applications/:id/notes", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  const appId = req.params.id;
  const { noteText } = req.body;
  if (!noteText || !noteText.trim()) {
    return res.status(400).json({ error: "Note text cannot be empty." });
  }
  try {
    const db = readDB();
    const application = db.applications.find((a) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }
    const job = db.jobs.find((j) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: "Unauthorized to add notes to this application." });
    }
    const newNote = {
      id: import_crypto.default.randomUUID(),
      applicationId: appId,
      recruiterId: recruiter.id,
      noteText: noteText.trim(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.recruiterNotes = db.recruiterNotes || [];
    db.recruiterNotes.push(newNote);
    writeDB(db);
    res.status(201).json({
      message: "Note added successfully.",
      note: newNote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error adding recruiter note." });
  }
});
app.get("/api/recruiter/applications/:id/notes", authenticateRecruiter, (req, res) => {
  const recruiter = req.recruiter;
  const appId = req.params.id;
  try {
    const db = readDB();
    const application = db.applications.find((a) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }
    const job = db.jobs.find((j) => j.id === application.jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      return res.status(403).json({ error: "Unauthorized to view notes for this application." });
    }
    const notes = db.recruiterNotes.filter((n) => n.applicationId === appId);
    res.status(200).json({ notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving recruiter notes." });
  }
});
app.get("/api/applications/:id/timeline", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  const appId = req.params.id;
  try {
    const db = readDB();
    const application = db.applications.find((a) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }
    const candidateId = db.tokens[token];
    const recruiterId = db.recruiterTokens[token];
    let authorized = false;
    if (candidateId && application.candidateId === candidateId) {
      authorized = true;
    } else if (recruiterId) {
      const job = db.jobs.find((j) => j.id === application.jobId);
      if (job && job.recruiterId === recruiterId) {
        authorized = true;
      }
    }
    if (!authorized) {
      return res.status(403).json({ error: "Unauthorized to view this application timeline." });
    }
    const timeline = db.applicationHistory.filter((h) => h.applicationId === appId);
    timeline.sort((a, b) => new Date(a.changedDate).getTime() - new Date(b.changedDate).getTime());
    res.status(200).json({ timeline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error retrieving status timeline." });
  }
});
function adaptWebFetch(handler) {
  return async (req, res) => {
    try {
      const protocol = req.protocol || "http";
      const host = req.get("host") || "localhost:3000";
      const url = `${protocol}://${host}${req.originalUrl}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.append(key, value.toString());
          }
        }
      }
      let body = void 0;
      if (!["GET", "HEAD"].includes(req.method) && req.body) {
        body = JSON.stringify(req.body);
        headers.set("content-type", "application/json");
      }
      const webRequest = new Request(url, {
        method: req.method,
        headers,
        body
      });
      const webResponse = await handler(webRequest);
      res.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const responseText = await webResponse.text();
      res.send(responseText);
    } catch (err) {
      console.error("[Supabase Server Adapt Error]", err);
      res.status(500).json({
        error: err.message || "Internal server error in adapted handler.",
        hint: "Make sure your SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY are configured correctly in your environment."
      });
    }
  };
}
app.all("/api/supabase-server/health", adaptWebFetch(publicHealthHandler.fetch));
app.all("/api/supabase-server/jobs", adaptWebFetch(publicJobsHandler.fetch));
app.all("/api/supabase-server/profile", adaptWebFetch(candidateProfileHandler.fetch));
app.all("/api/supabase-server/admin/candidates", adaptWebFetch(adminCandidatesListHandler.fetch));
app.get("/api/database-status", async (req, res) => {
  try {
    res.json({
      configured: isSupabaseConfigured(),
      active: supabaseActive,
      mode: supabaseActive ? "supabase-cloud" : "local-json-fallback",
      dbPath: DB_PATH,
      errorDetails: supabaseErrorDetails
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Error checking status." });
  }
});
app.post("/api/database-reconnect", async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: err.message || "Error executing reconnect." });
  }
});
app.get("/api/database-ping-sql", async (req, res) => {
  try {
    clearSupabaseClient();
    if (!isSupabaseConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Supabase credentials are not configured."
      });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("ping_db");
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
      message: "Successfully executed SELECT 1 inside your Supabase PostgreSQL database!"
    });
  } catch (err) {
    return res.json({
      success: false,
      query: 'SELECT 1 via rpc("ping_db")',
      error: err.message || "Failed to execute ping query."
    });
  }
});
app.get("/api/database-diagnose", async (req, res) => {
  try {
    clearSupabaseClient();
  } catch (e) {
  }
  const diagnostics = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    env: {
      SUPABASE_URL: { configured: false, valueMasked: null, formatValid: false },
      SUPABASE_ANON_KEY: { configured: false, valueMasked: null, formatValid: false },
      SUPABASE_SERVICE_ROLE_KEY: { configured: false, valueMasked: null, formatValid: false }
    },
    network: { canResolveUrl: false, pingTest: null, error: null },
    tables: {},
    writePermission: { success: false, error: null },
    summary: "",
    recommendations: []
  };
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url) {
    diagnostics.env.SUPABASE_URL.configured = true;
    diagnostics.env.SUPABASE_URL.valueMasked = url.length > 15 ? url.substring(0, 12) + "..." + url.substring(url.length - 4) : "***";
    diagnostics.env.SUPABASE_URL.formatValid = url.startsWith("https://") && url.includes(".supabase.co");
  }
  if (anonKey) {
    diagnostics.env.SUPABASE_ANON_KEY.configured = true;
    diagnostics.env.SUPABASE_ANON_KEY.valueMasked = anonKey.length > 20 ? anonKey.substring(0, 8) + "..." + anonKey.substring(anonKey.length - 8) : "***";
    diagnostics.env.SUPABASE_ANON_KEY.formatValid = anonKey.length > 50;
  }
  if (serviceRoleKey) {
    diagnostics.env.SUPABASE_SERVICE_ROLE_KEY.configured = true;
    diagnostics.env.SUPABASE_SERVICE_ROLE_KEY.valueMasked = serviceRoleKey.length > 20 ? serviceRoleKey.substring(0, 8) + "..." + serviceRoleKey.substring(serviceRoleKey.length - 8) : "***";
    diagnostics.env.SUPABASE_SERVICE_ROLE_KEY.formatValid = serviceRoleKey.length > 50;
  }
  if (!url || !anonKey && !serviceRoleKey) {
    diagnostics.summary = "CRITICAL: Supabase credentials are not configured in your environment.";
    diagnostics.recommendations.push("Go to AI Studio Settings -> Secrets, and add SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).");
    return res.json(diagnostics);
  }
  try {
    const start = Date.now();
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        "apikey": anonKey || serviceRoleKey || ""
      }
    });
    const duration = Date.now() - start;
    diagnostics.network.canResolveUrl = true;
    diagnostics.network.pingTest = `${duration}ms (HTTP ${response.status})`;
  } catch (err) {
    diagnostics.network.error = err.message || err;
    diagnostics.recommendations.push("Verify that your SUPABASE_URL is correct, starts with https://, and has no typos. The network timed out or refused connection.");
  }
  try {
    const supabase = getSupabase();
    const tablesToTest = ["candidates", "recruiters", "jobs", "applications", "documents"];
    for (const tableName of tablesToTest) {
      try {
        const { error, data } = await supabase.from(tableName).select("id").limit(1);
        if (error) {
          diagnostics.tables[tableName] = {
            exists: false,
            error: error.message,
            code: error.code
          };
          if (error.code === "42P01") {
            diagnostics.recommendations.push(`Table "${tableName}" is missing. Paste the SQL script from Step 2 into your Supabase SQL Editor and run it.`);
          }
        } else {
          diagnostics.tables[tableName] = {
            exists: true,
            recordsCount: data ? data.length : 0
          };
        }
      } catch (tableErr) {
        diagnostics.tables[tableName] = {
          exists: false,
          error: tableErr.message || tableErr
        };
      }
    }
    if (diagnostics.tables["candidates"] && diagnostics.tables["candidates"].exists) {
      const testId = "00000000-0000-0000-0000-000000000000";
      try {
        const { error: insertError } = await supabase.from("candidates").upsert({
          id: testId,
          fullName: "Supabase Diagnostic Test Candidate",
          mobile: "9999999999",
          salt: "dummy",
          hash: "dummy",
          profile: { languagesKnown: [] }
        });
        if (insertError) {
          diagnostics.writePermission.error = insertError.message;
          diagnostics.recommendations.push(`Write failed on "candidates": ${insertError.message}. Ensure Row Level Security (RLS) is disabled or policies are configured to permit writes.`);
        } else {
          diagnostics.writePermission.success = true;
          await supabase.from("candidates").delete().eq("id", testId);
        }
      } catch (writeErr) {
        diagnostics.writePermission.error = writeErr.message || writeErr;
      }
    } else {
      diagnostics.writePermission.error = "Skipped write test because candidates table does not exist.";
    }
  } catch (supabaseErr) {
    diagnostics.summary = "FAILED: Could not initialize Supabase JS Client.";
    diagnostics.error = supabaseErr.message || supabaseErr;
    return res.json(diagnostics);
  }
  const totalTables = Object.keys(diagnostics.tables).length;
  const activeTables = Object.values(diagnostics.tables).filter((t) => t.exists).length;
  if (activeTables === totalTables && diagnostics.writePermission.success) {
    diagnostics.summary = "HEALTHY: Supabase cloud is fully active, tables are initialized, and read/write tests passed successfully!";
  } else if (activeTables > 0) {
    diagnostics.summary = `PARTIAL: Connected successfully, but only ${activeTables}/${totalTables} tables exist. Please ensure all tables are created.`;
  } else if (diagnostics.network.canResolveUrl) {
    diagnostics.summary = "CONNECTED: Supabase network is responsive, but your tables do not exist. Please run the SQL schema migration.";
  } else {
    diagnostics.summary = "DISCONNECTED: Could not reach Supabase. Check your SUPABASE_URL and internet connectivity.";
  }
  diagnostics.recommendations = Array.from(new Set(diagnostics.recommendations));
  res.json(diagnostics);
});
async function initDatabase() {
  const db = readDB();
  try {
    if (isSupabaseConfigured()) {
      console.log("[Database Init] Supabase config found. Validating cloud connection...");
      const supabase = getSupabase();
      const { error } = await supabase.from("candidates").select("id").limit(1);
      if (error) {
        supabaseActive = false;
        supabaseErrorDetails = error.message;
        console.warn("[Database Init] Linked to Supabase, but some tables are missing or need migration.");
        console.warn("[Database Init] Details:", error.message);
        console.warn("[Database Init] Using local JSON database as fallback. Run SQL Schema in Supabase console to enable persistent cloud storage.");
      } else {
        console.log("[Database Init] Connected successfully! Synchronizing cloud records with memory cache...");
        supabaseActive = true;
        supabaseErrorDetails = null;
        const [
          { data: candidates },
          { data: recruiters },
          { data: jobs },
          { data: applications },
          { data: dDocs }
        ] = await Promise.all([
          supabase.from("candidates").select("*"),
          supabase.from("recruiters").select("*"),
          supabase.from("jobs").select("*"),
          supabase.from("applications").select("*"),
          supabase.from("documents").select("*")
        ]);
        if (candidates) db.candidates = candidates;
        if (recruiters) db.recruiters = recruiters;
        if (jobs) db.jobs = jobs;
        if (applications) db.applications = applications;
        if (dDocs) db.documents = dDocs;
        memoryDB = db;
        import_fs.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
        console.log("[Database Init] Sync completed successfully! Cloud database is fully active.");
      }
    } else {
      supabaseActive = false;
      supabaseErrorDetails = "Supabase credentials not configured in environment (SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are missing).";
      console.log("[Database Init] Supabase credentials not configured in environment. Using standard local file system database.");
    }
  } catch (err) {
    supabaseActive = false;
    supabaseErrorDetails = err.message || "Failed to initialize Supabase connection.";
    console.warn("[Database Init] Failed to load Supabase modules, falling back to local storage:", err.message || err);
  }
}
app.get("/api/admin/recruiters", (req, res) => {
  try {
    const db = readDB();
    const safeRecruiters = (db.recruiters || []).map(({ salt, hash, ...r }) => r);
    res.json(safeRecruiters);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve recruiters" });
  }
});
app.post("/api/admin/recruiters", (req, res) => {
  const { companyName, contactPerson, email, mobile, password } = req.body;
  if (!companyName || !contactPerson || !email || !mobile || !password) {
    return res.status(400).json({ error: "All fields are required to create a recruiter." });
  }
  try {
    const db = readDB();
    db.recruiters = db.recruiters || [];
    if (db.recruiters.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: "A recruiter with this email already exists." });
    }
    if (db.recruiters.some((r) => r.mobile === mobile)) {
      return res.status(400).json({ error: "A recruiter with this mobile number already exists." });
    }
    const { salt, hash } = hashPassword(password);
    const newRecruiter = {
      id: import_crypto.default.randomUUID(),
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      salt,
      hash,
      status: "Approved",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.recruiters.push(newRecruiter);
    writeDB(db);
    const { salt: _s, hash: _h, ...safeRecruiter } = newRecruiter;
    res.status(201).json({ message: "Recruiter added successfully", recruiter: safeRecruiter });
  } catch (err) {
    res.status(500).json({ error: "Server error creating recruiter" });
  }
});
app.post("/api/admin/jobs", (req, res) => {
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
  if (!recruiterId || !title || !category || openings === void 0 || !employmentType || !state || !city || !area || minSalary === void 0 || maxSalary === void 0 || !salaryType || !shift || experienceRequired === void 0 || !educationRequired || !genderPreference || ageLimitMin === void 0 || ageLimitMax === void 0 || !bikeRequired || !drivingLicenseRequired || !immediateJoining || !description || !responsibilities || !benefits || !status) {
    return res.status(400).json({ error: "Required fields are missing. Please complete the form." });
  }
  try {
    const db = readDB();
    const recruiter = (db.recruiters || []).find((r) => r.id === recruiterId);
    if (!recruiter) {
      return res.status(404).json({ error: "Recruiter not found." });
    }
    db.jobs = db.jobs || [];
    const newJob = {
      id: import_crypto.default.randomUUID(),
      recruiterId: recruiter.id,
      companyName: recruiter.companyName,
      companyLogo: recruiter.companyLogo || "",
      title: title.trim(),
      category: category.trim(),
      openings: Number(openings),
      employmentType: employmentType.trim(),
      state: state.trim(),
      city: city.trim(),
      area: area.trim(),
      workLocation: workLocation ? workLocation.trim() : "",
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.jobs.push(newJob);
    writeDB(db);
    res.status(201).json({ message: "Job posted successfully via Admin Panel!", job: newJob });
  } catch (err) {
    res.status(500).json({ error: "Server error posting the job." });
  }
});
app.get("/api/admin/jobs", (req, res) => {
  try {
    const db = readDB();
    res.json(db.jobs || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve jobs" });
  }
});
app.get("/api/admin/candidates", (req, res) => {
  try {
    const db = readDB();
    const safeCandidates = (db.candidates || []).map(({ salt, hash, ...c }) => c);
    res.json(safeCandidates);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve candidates" });
  }
});
app.post("/api/admin/candidates", (req, res) => {
  const { fullName, mobile, email, age, gender, pincode, experience, education, bikeAvailable, drivingLicenseAvailable } = req.body;
  if (!fullName || !mobile || !age || !gender || !pincode) {
    return res.status(400).json({ error: "Full Name, Mobile, Age, Gender, and Pincode are required." });
  }
  const cleanMobile = mobile.trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ error: "Mobile number must be a valid 10-digit number." });
  }
  try {
    const db = readDB();
    db.candidates = db.candidates || [];
    if (db.candidates.some((c) => c.mobile === cleanMobile)) {
      return res.status(400).json({ error: "A candidate with this mobile number already exists." });
    }
    const { salt, hash } = hashPassword("DeliveryMan2026!");
    const newCandidate = {
      id: import_crypto.default.randomUUID(),
      fullName: fullName.trim(),
      mobile: cleanMobile,
      email: email ? email.trim().toLowerCase() : void 0,
      salt,
      hash,
      profile: {
        fullName: fullName.trim(),
        age: Number(age),
        gender: gender.trim(),
        pincode: pincode.trim(),
        experience: Number(experience || 0),
        education: education || "10th Pass or below",
        bikeAvailable: bikeAvailable || "No",
        drivingLicenseAvailable: drivingLicenseAvailable || "None",
        languagesKnown: ["Hindi", "English"]
      }
    };
    db.candidates.push(newCandidate);
    writeDB(db);
    const { salt: _s, hash: _h, ...safeCandidate } = newCandidate;
    res.status(201).json({ message: "Candidate added successfully", candidate: safeCandidate });
  } catch (err) {
    res.status(500).json({ error: "Server error registering candidate" });
  }
});
app.post("/api/admin/applications", (req, res) => {
  const { candidateId, jobId } = req.body;
  if (!candidateId || !jobId) {
    return res.status(400).json({ error: "candidateId and jobId are required." });
  }
  try {
    const db = readDB();
    db.candidates = db.candidates || [];
    db.jobs = db.jobs || [];
    db.applications = db.applications || [];
    const candidate = db.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: "Job opening not found." });
    }
    const duplicate = db.applications.some(
      (app2) => app2.candidateId === candidateId && app2.jobId === jobId && app2.withdrawStatus !== "Withdrawn"
    );
    if (duplicate) {
      return res.status(400).json({ error: "This delivery man is already linked to this job." });
    }
    const newApplication = {
      id: import_crypto.default.randomUUID(),
      candidateId: candidate.id,
      jobId: job.id,
      recruiterId: job.recruiterId,
      appliedDate: (/* @__PURE__ */ new Date()).toISOString(),
      currentStatus: "Applied",
      withdrawStatus: "Active",
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.applications.push(newApplication);
    job.applicationsCount = (job.applicationsCount || 0) + 1;
    writeDB(db);
    res.status(201).json({ message: "Interest registered successfully!", application: newApplication });
  } catch (err) {
    res.status(500).json({ error: "Server error linking interest data." });
  }
});
app.get("/api/admin/applications", (req, res) => {
  try {
    const db = readDB();
    const apps = db.applications || [];
    const detailedApps = apps.map((app2) => {
      const job = (db.jobs || []).find((j) => j.id === app2.jobId) || {};
      const candidate = (db.candidates || []).find((c) => c.id === app2.candidateId) || {};
      return {
        ...app2,
        jobTitle: job.title || "Unknown Position",
        companyName: job.companyName || "Unknown Fleet",
        candidateName: candidate.profile?.fullName || candidate.fullName || "Unknown Candidate",
        candidateMobile: candidate.mobile || ""
      };
    });
    res.json(detailedApps);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve application interest records" });
  }
});
app.delete("/api/admin/applications/:id", (req, res) => {
  const { id } = req.params;
  try {
    const db = readDB();
    db.applications = db.applications || [];
    const appIndex = db.applications.findIndex((app2) => app2.id === id);
    if (appIndex === -1) {
      return res.status(404).json({ error: "Application interest record not found." });
    }
    const application = db.applications[appIndex];
    const job = (db.jobs || []).find((j) => j.id === application.jobId);
    if (job && job.applicationsCount > 0) {
      job.applicationsCount -= 1;
    }
    db.applications.splice(appIndex, 1);
    writeDB(db);
    res.json({ message: "Interest link removed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove interest link" });
  }
});
app.delete("/api/admin/recruiters/:id", (req, res) => {
  const { id } = req.params;
  try {
    const db = readDB();
    db.recruiters = (db.recruiters || []).filter((r) => r.id !== id);
    const deletedJobIds = (db.jobs || []).filter((j) => j.recruiterId === id).map((j) => j.id);
    db.jobs = (db.jobs || []).filter((j) => j.recruiterId !== id);
    db.applications = (db.applications || []).filter(
      (app2) => !deletedJobIds.includes(app2.jobId) && app2.recruiterId !== id
    );
    writeDB(db);
    res.json({ message: "Recruiter and their associated jobs/applications deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete recruiter" });
  }
});
app.delete("/api/admin/candidates/:id", (req, res) => {
  const { id } = req.params;
  try {
    const db = readDB();
    db.candidates = (db.candidates || []).filter((c) => c.id !== id);
    db.applications = (db.applications || []).filter((app2) => app2.candidateId !== id);
    writeDB(db);
    res.json({ message: "Delivery candidate and their interest data deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete delivery candidate" });
  }
});
async function startServer() {
  await initDatabase();
  if (process.env.VERCEL) {
    console.log("[Server] Running in Vercel environment. Skipping local app.listen().");
    return;
  }
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
var server_default = app;
//# sourceMappingURL=server.cjs.map
