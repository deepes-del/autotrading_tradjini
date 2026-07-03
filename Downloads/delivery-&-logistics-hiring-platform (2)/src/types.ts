export interface Profile {
  profilePhoto?: string;
  fullName: string;
  age?: number;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  education?: string;
  experience?: number; // in years
  currentOccupation?: string;
  expectedSalary?: string;
  languagesKnown?: string[];
  bikeAvailable?: 'Yes' | 'No';
  drivingLicenseAvailable?: 'Yes' | 'No';
}

export type DocumentType = 'aadhaar' | 'pan' | 'dl' | 'resume' | 'photo';

export interface CandidateDocument {
  id: string;
  candidateId: string;
  documentType: DocumentType;
  fileUrl: string;
  fileName: string;
  uploadDate: string;
  verificationStatus: 'Pending' | 'Approved' | 'Rejected';
}

export interface Candidate {
  id: string;
  mobile: string;
  fullName: string;
  email?: string;
  profile: Profile;
  documents?: CandidateDocument[];
}

export interface AuthState {
  candidate: Candidate | null;
  token: string | null;
}

export type RecruiterStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';

export interface Recruiter {
  id: string;
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  recruiterName: string;
  designation: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: RecruiterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecruiterAuthState {
  recruiter: Recruiter | null;
  token: string | null;
}

export interface Job {
  id: string;
  recruiterId: string;
  companyName: string;
  companyLogo?: string;
  
  // Basic Information
  title: string;
  category: string;
  openings: number;
  employmentType: 'Full Time' | 'Part Time' | 'Contract' | 'Temporary';
  
  // Location
  state: string;
  city: string;
  area: string;
  workLocation?: string;
  
  // Salary
  minSalary: number;
  maxSalary: number;
  salaryType: 'Monthly' | 'Weekly' | 'Daily';
  
  // Job Details
  shift: 'Day' | 'Night' | 'Rotational';
  experienceRequired: number; // in years
  educationRequired: string;
  genderPreference: 'Male' | 'Female' | 'Any';
  ageLimitMin: number;
  ageLimitMax: number;
  bikeRequired: 'Yes' | 'No';
  drivingLicenseRequired: 'Yes' | 'No';
  immediateJoining: 'Yes' | 'No';
  
  // Description
  description: string;
  responsibilities: string;
  benefits: string;
  
  // Status
  status: 'Draft' | 'Published' | 'Unpublished' | 'Closed';
  applicationsCount: number;
  viewsCount?: number;
  createdAt: string;
  updatedAt?: string;
}

