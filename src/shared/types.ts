export type JobStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export const JOB_STATUSES: JobStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

export type JobSource = 'manual' | 'greenhouse' | 'lever' | 'remotive' | 'jobicy';

export interface Job {
  id: number;
  title: string;
  company: string;
  url: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: JobStatus;
  source: JobSource;
  externalId: string | null;
  description: string | null;
  notes: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewJob = Omit<Job, 'id' | 'createdAt' | 'updatedAt'>;

export type RemotePreference = 'any' | 'remote' | 'onsite';

export interface ThemeSettings {
  mode: 'system' | 'light' | 'dark';
  /** Accent color as a hex string, e.g. "#6366f1". */
  primary: string;
}

export const DEFAULT_THEME: ThemeSettings = { mode: 'system', primary: '#f97316' };

export interface RemotiveOptions {
  /** Category slug for Remotive's `category` parameter; empty = all. */
  category: string;
}

export interface JobicyOptions {
  /** 1-100, Jobicy's `count` parameter. */
  count: number;
  /** Region slug for Jobicy's `geo` parameter; empty = anywhere. */
  geo: string;
  /** Category slug for Jobicy's `industry` parameter; empty = all. */
  industry: string;
}

export interface Preferences {
  titles: string[];
  locations: string[];
  remote: RemotePreference;
  minSalary: number | null;
  skills: string[];
  avoidKeywords: string[];
  blacklistedCompanies: string[];
  greenhouseBoards: string[];
  leverCompanies: string[];
  jobicy: JobicyOptions;
  remotive: RemotiveOptions;
  theme: ThemeSettings;
}

export const DEFAULT_PREFERENCES: Preferences = {
  titles: [],
  locations: [],
  remote: 'any',
  minSalary: null,
  skills: [],
  avoidKeywords: [],
  blacklistedCompanies: [],
  greenhouseBoards: [],
  leverCompanies: [],
  jobicy: { count: 50, geo: '', industry: '' },
  remotive: { category: '' },
  theme: DEFAULT_THEME,
};

export interface ResumeBullet {
  id: string;
  text: string;
  /** Whether this bullet appears under its experience on the generated resume. */
  included: boolean;
}

export interface ResumeExperience {
  id: string;
  company: string;
  title: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  bullets: ResumeBullet[];
  /** Whether this entry appears on the generated resume. */
  included: boolean;
}

export interface ResumeEducation {
  id: string;
  school: string;
  degree: string;
  field: string;
  start: string;
  end: string;
  included: boolean;
}

export interface ResumeProject {
  id: string;
  name: string;
  url: string;
  description: string;
  included: boolean;
}

export interface ResumeSkill {
  id: string;
  name: string;
  included: boolean;
}

/**
 * The master resume is a bank of everything the user has ever done; each entry
 * carries an `included` flag controlling whether it appears on the generated resume.
 */
export interface Resume {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  includeSummary: boolean;
  skills: ResumeSkill[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  projects: ResumeProject[];
}

export const DEFAULT_RESUME: Resume = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  links: [],
  summary: '',
  includeSummary: true,
  skills: [],
  experience: [],
  education: [],
  projects: [],
};

/**
 * Result of parsing an uploaded resume file. `resume` is best-effort parsed
 * content the renderer merges into the master resume; `warnings` describes
 * anything the parser could not confidently extract.
 */
export interface ResumeImportResult {
  fileName: string;
  resume: Resume;
  warnings: string[];
}

export interface DiscoveredJob {
  source: Exclude<JobSource, 'manual'>;
  externalId: string;
  title: string;
  company: string;
  url: string;
  location: string;
  postedAt: string | null;
  description: string;
  salaryText: string | null;
  /** Highest number parsed from salaryText, normalized to a yearly figure; null when unparseable. */
  salaryMaxParsed: number | null;
  score: number;
  reasons: string[];
  inTracker: boolean;
  blacklisted: boolean;
}

export interface DiscoverResult {
  jobs: DiscoveredJob[];
  errors: string[];
}

export interface CareerKitApi {
  listJobs(): Promise<Job[]>;
  createJob(job: NewJob): Promise<Job>;
  updateJob(id: number, changes: Partial<NewJob>): Promise<Job>;
  deleteJob(id: number): Promise<void>;
  getPreferences(): Promise<Preferences>;
  savePreferences(prefs: Preferences): Promise<void>;
  getResume(): Promise<Resume>;
  saveResume(resume: Resume): Promise<void>;
  importResume(): Promise<ResumeImportResult | null>;
  discoverJobs(query: string): Promise<DiscoverResult>;
  importDiscoveredJob(job: DiscoveredJob): Promise<Job>;
  openExternal(url: string): Promise<void>;
}
