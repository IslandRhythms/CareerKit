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

export type InterviewStageType =
  | 'recruiter'
  | 'phone'
  | 'hiring_manager'
  | 'technical'
  | 'take_home'
  | 'onsite'
  | 'panel'
  | 'behavioral'
  | 'final'
  | 'other';

export const INTERVIEW_STAGE_TYPES: InterviewStageType[] = [
  'recruiter',
  'phone',
  'hiring_manager',
  'technical',
  'take_home',
  'onsite',
  'panel',
  'behavioral',
  'final',
  'other',
];

export const INTERVIEW_STAGE_TYPE_LABELS: Record<InterviewStageType, string> = {
  recruiter: 'Recruiter screen',
  phone: 'Phone screen',
  hiring_manager: 'Hiring manager',
  technical: 'Technical',
  take_home: 'Take-home',
  onsite: 'Onsite',
  panel: 'Panel',
  behavioral: 'Behavioral',
  final: 'Final round',
  other: 'Other',
};

/**
 * Lifecycle of a single interview round. `pending` = not yet scheduled,
 * `scheduled` = has a date, `completed` = done but awaiting a result.
 */
export type InterviewStageStatus = 'pending' | 'scheduled' | 'completed' | 'passed' | 'failed';

export const INTERVIEW_STAGE_STATUSES: InterviewStageStatus[] = [
  'pending',
  'scheduled',
  'completed',
  'passed',
  'failed',
];

export const INTERVIEW_STAGE_STATUS_LABELS: Record<InterviewStageStatus, string> = {
  pending: 'Not scheduled',
  scheduled: 'Scheduled',
  completed: 'Awaiting result',
  passed: 'Passed',
  failed: 'Failed',
};

export interface InterviewStage {
  id: string;
  type: InterviewStageType;
  /** Optional custom name (e.g. "System design w/ Priya"); falls back to the type label. */
  label: string;
  /** ISO datetime-local string ("YYYY-MM-DDTHH:mm") or date; null when unscheduled. */
  scheduledAt: string | null;
  status: InterviewStageStatus;
  notes: string;
}

/** Stage statuses that count as finished for progress purposes. */
export const FINISHED_STAGE_STATUSES: InterviewStageStatus[] = ['completed', 'passed', 'failed'];

export function stageDisplayName(stage: InterviewStage): string {
  return stage.label.trim() || INTERVIEW_STAGE_TYPE_LABELS[stage.type];
}

/**
 * Summarizes interview progress: how many stages are finished, which stage is
 * currently active (the first unfinished one), and whether any stage failed.
 */
export function summarizeStages(stages: InterviewStage[]): {
  total: number;
  finished: number;
  current: InterviewStage | null;
  nextScheduled: InterviewStage | null;
  failed: boolean;
} {
  const finished = stages.filter((s) => FINISHED_STAGE_STATUSES.includes(s.status)).length;
  const current = stages.find((s) => !FINISHED_STAGE_STATUSES.includes(s.status)) ?? null;
  const nextScheduled =
    stages
      .filter((s) => s.status === 'scheduled' && s.scheduledAt)
      .sort((a, b) => (a.scheduledAt as string).localeCompare(b.scheduledAt as string))[0] ?? null;
  return {
    total: stages.length,
    finished,
    current,
    nextScheduled,
    failed: stages.some((s) => s.status === 'failed'),
  };
}

/** Where the role is worked. Hybrid and onsite are tracked as one group. */
export type WorkArrangement = 'remote' | 'hybrid_onsite';

export const WORK_ARRANGEMENTS: WorkArrangement[] = ['remote', 'hybrid_onsite'];

export const WORK_ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  remote: 'Remote',
  hybrid_onsite: 'Hybrid / Onsite',
};

export function isWorkArrangement(value: string): value is WorkArrangement {
  return WORK_ARRANGEMENTS.some((arrangement) => arrangement === value);
}

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
  /** Ordered interview rounds for this job; empty until the user adds some. */
  interviewStages: InterviewStage[];
  /** Uploaded resume this application was sent with; null when not linked. */
  resumeId: string | null;
  /** Remote, or hybrid / onsite. Null until the user sets it. */
  workArrangement: WorkArrangement | null;
  createdAt: string;
  updatedAt: string;
}

export type NewJob = Omit<Job, 'id' | 'createdAt' | 'updatedAt'>;

/** A resume file the user uploaded so applications can be attributed to it. */
export interface ResumeVersion {
  id: string;
  /** Display name. Starts as the file name without its extension. */
  name: string;
  fileName: string;
  createdAt: string;
}

const APPLICATION_STATUSES: JobStatus[] = ['applied', 'interview', 'offer', 'rejected'];

/** Saved jobs are not applications yet. */
export function jobIsApplication(job: Job): boolean {
  return APPLICATION_STATUSES.includes(job.status);
}

/**
 * Reached an interview when the job is in Interview or Offer, or when a round
 * was scheduled or finished (including a later rejection). A round still marked
 * "not scheduled" does not count.
 */
export function jobReachedInterview(job: Job): boolean {
  if (job.status === 'interview' || job.status === 'offer') return true;
  return job.interviewStages.some((stage) => stage.status !== 'pending');
}

export interface OutcomeCounts {
  applications: number;
  interviews: number;
}

export interface ResumePerformance {
  overall: OutcomeCounts;
  remote: OutcomeCounts;
  hybridOnsite: OutcomeCounts;
  unspecified: OutcomeCounts;
}

function emptyOutcome(): OutcomeCounts {
  return { applications: 0, interviews: 0 };
}

function addOutcome(counts: OutcomeCounts, interviewed: boolean): void {
  counts.applications += 1;
  if (interviewed) counts.interviews += 1;
}

/** Applications and interviews attributed to one uploaded resume. */
export function resumePerformance(jobs: Job[], resumeId: string): ResumePerformance {
  const performance: ResumePerformance = {
    overall: emptyOutcome(),
    remote: emptyOutcome(),
    hybridOnsite: emptyOutcome(),
    unspecified: emptyOutcome(),
  };
  for (const job of jobs) {
    if (job.resumeId !== resumeId || !jobIsApplication(job)) continue;
    const interviewed = jobReachedInterview(job);
    addOutcome(performance.overall, interviewed);
    if (job.workArrangement === 'remote') addOutcome(performance.remote, interviewed);
    else if (job.workArrangement === 'hybrid_onsite') addOutcome(performance.hybridOnsite, interviewed);
    else addOutcome(performance.unspecified, interviewed);
  }
  return performance;
}

/** Reduced applications : interviews, such as "4 : 1". "—" when there are no applications. */
export function formatApplicationInterviewRatio(applications: number, interviews: number): string {
  if (applications === 0) return '—';
  if (interviews === 0) return `${applications} : 0`;
  const divisor = greatestCommonDivisor(applications, interviews);
  return `${applications / divisor} : ${interviews / divisor}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

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

export type ResumeSectionKey = 'summary' | 'skills' | 'experience' | 'education' | 'projects';

export const RESUME_SECTION_KEYS: ResumeSectionKey[] = [
  'summary',
  'skills',
  'experience',
  'education',
  'projects',
];

export const RESUME_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
};

/**
 * Returns a complete, de-duplicated section order: any keys the stored order
 * is missing are appended in default order, unknown keys are dropped.
 */
export function normalizeSectionOrder(order: unknown): ResumeSectionKey[] {
  const seen = new Set<ResumeSectionKey>();
  const result: ResumeSectionKey[] = [];
  const candidates = Array.isArray(order) ? [...order, ...RESUME_SECTION_KEYS] : RESUME_SECTION_KEYS;
  for (const key of candidates) {
    if (RESUME_SECTION_KEYS.includes(key as ResumeSectionKey) && !seen.has(key as ResumeSectionKey)) {
      seen.add(key as ResumeSectionKey);
      result.push(key as ResumeSectionKey);
    }
  }
  return result;
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
  /** Order the sections appear in, both in the editor and on the generated resume. */
  sectionOrder: ResumeSectionKey[];
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
  sectionOrder: [...RESUME_SECTION_KEYS],
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
  listResumeVersions(): Promise<ResumeVersion[]>;
  uploadResumeVersion(): Promise<ResumeVersion | null>;
  renameResumeVersion(id: string, name: string): Promise<ResumeVersion>;
  deleteResumeVersion(id: string): Promise<void>;
  discoverJobs(query: string): Promise<DiscoverResult>;
  importDiscoveredJob(job: DiscoveredJob): Promise<Job>;
  openExternal(url: string): Promise<void>;
}
