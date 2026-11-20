import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_RESUME,
  InterviewStage,
  Job,
  NewJob,
  Preferences,
  Resume,
  ResumeBullet,
  ResumeVersion,
  WorkArrangement,
  isWorkArrangement,
  normalizeSectionOrder,
} from '../shared/types';

let db: Database.Database;

export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'careerkit.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      url TEXT,
      location TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      status TEXT NOT NULL DEFAULT 'saved',
      source TEXT NOT NULL DEFAULT 'manual',
      external_id TEXT,
      description TEXT,
      notes TEXT,
      applied_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_external
      ON jobs (source, external_id) WHERE external_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS documents (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  migrate();
}

/** Adds columns introduced after the initial schema to databases created before them. */
function migrate(): void {
  const columns = (db.prepare('PRAGMA table_info(jobs)').all() as Array<{ name: string }>).map(
    (c) => c.name
  );
  if (!columns.includes('interview_stages')) {
    db.exec(`ALTER TABLE jobs ADD COLUMN interview_stages TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!columns.includes('resume_id')) {
    db.exec(`ALTER TABLE jobs ADD COLUMN resume_id TEXT`);
  }
  if (!columns.includes('work_arrangement')) {
    db.exec(`ALTER TABLE jobs ADD COLUMN work_arrangement TEXT`);
  }
  // The off-tracker application log was removed; drop it from databases that created it.
  db.exec(`DROP TABLE IF EXISTS outside_applications`);
}

function parseStages(raw: string | null): InterviewStage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface JobRow {
  id: number;
  title: string;
  company: string;
  url: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  source: string;
  external_id: string | null;
  description: string | null;
  notes: string | null;
  applied_at: string | null;
  interview_stages: string | null;
  resume_id: string | null;
  work_arrangement: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    url: row.url,
    location: row.location,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    status: row.status as Job['status'],
    source: row.source as Job['source'],
    externalId: row.external_id,
    description: row.description,
    notes: row.notes,
    appliedAt: row.applied_at,
    interviewStages: parseStages(row.interview_stages),
    resumeId: row.resume_id,
    workArrangement: parseWorkArrangement(row.work_arrangement),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseWorkArrangement(raw: string | null): WorkArrangement | null {
  if (raw && isWorkArrangement(raw)) return raw;
  return null;
}

export function listJobs(): Job[] {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY updated_at DESC').all() as JobRow[];
  return rows.map(rowToJob);
}

export function getJob(id: number): Job {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
  if (!row) throw new Error(`Job ${id} not found`);
  return rowToJob(row);
}

export function createJob(job: NewJob): Job {
  const result = db
    .prepare(
      `INSERT INTO jobs (title, company, url, location, salary_min, salary_max, status, source, external_id, description, notes, applied_at, interview_stages, resume_id, work_arrangement)
       VALUES (@title, @company, @url, @location, @salaryMin, @salaryMax, @status, @source, @externalId, @description, @notes, @appliedAt, @interviewStages, @resumeId, @workArrangement)`
    )
    .run({
      title: job.title,
      company: job.company,
      url: job.url,
      location: job.location,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      status: job.status,
      source: job.source,
      externalId: job.externalId,
      description: job.description,
      notes: job.notes,
      appliedAt: job.appliedAt,
      interviewStages: JSON.stringify(job.interviewStages ?? []),
      resumeId: job.resumeId ?? null,
      workArrangement: job.workArrangement ?? null,
    });
  return getJob(Number(result.lastInsertRowid));
}

const JOB_COLUMNS: Record<string, string> = {
  title: 'title',
  company: 'company',
  url: 'url',
  location: 'location',
  salaryMin: 'salary_min',
  salaryMax: 'salary_max',
  status: 'status',
  source: 'source',
  externalId: 'external_id',
  description: 'description',
  notes: 'notes',
  appliedAt: 'applied_at',
  interviewStages: 'interview_stages',
  resumeId: 'resume_id',
  workArrangement: 'work_arrangement',
};

/** Columns stored as JSON text; values are serialized before binding. */
const JSON_COLUMNS = new Set<keyof NewJob>(['interviewStages']);

export function updateJob(id: number, changes: Partial<NewJob>): Job {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [key, column] of Object.entries(JOB_COLUMNS)) {
    if (key in changes) {
      sets.push(`${column} = @${key}`);
      const value = (changes as Record<string, unknown>)[key];
      params[key] = JSON_COLUMNS.has(key as keyof NewJob) ? JSON.stringify(value ?? []) : value;
    }
  }
  if (sets.length > 0) {
    sets.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  return getJob(id);
}

export function deleteJob(id: number): void {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
}

export function hasExternalJob(source: string, externalId: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM jobs WHERE source = ? AND external_id = ?')
    .get(source, externalId);
  return row !== undefined;
}

function getDocument<T>(key: string, fallback: T): T {
  const row = db.prepare('SELECT data FROM documents WHERE key = ?').get(key) as
    | { data: string }
    | undefined;
  if (!row) return fallback;
  try {
    return { ...fallback, ...JSON.parse(row.data) };
  } catch {
    return fallback;
  }
}

function saveDocument(key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO documents (key, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value));
}

export function getPreferences(): Preferences {
  return getDocument('preferences', DEFAULT_PREFERENCES);
}

export function savePreferences(prefs: Preferences): void {
  saveDocument('preferences', prefs);
}

/**
 * Migrates resumes saved before the include/exclude model: bare-string skills
 * and bullets become objects, and entries missing `included` default to true.
 */
function normalizeResume(resume: Resume): Resume {
  const withIncluded = <T extends { included: boolean }>(items: T[] | undefined): T[] =>
    (items ?? []).map((item) => ({ ...item, included: item.included !== false }));
  return {
    ...resume,
    includeSummary: resume.includeSummary !== false,
    skills: ((resume.skills ?? []) as Array<Resume['skills'][number] | string>).map((skill) =>
      typeof skill === 'string'
        ? { id: randomUUID(), name: skill, included: true }
        : { ...skill, included: skill.included !== false }
    ),
    experience: withIncluded(resume.experience).map((exp) => ({
      ...exp,
      bullets: ((exp.bullets ?? []) as Array<ResumeBullet | string>).map((bullet) =>
        typeof bullet === 'string'
          ? { id: randomUUID(), text: bullet, included: true }
          : { ...bullet, included: bullet.included !== false }
      ),
    })),
    education: withIncluded(resume.education),
    projects: withIncluded(resume.projects),
    sectionOrder: normalizeSectionOrder(resume.sectionOrder),
  };
}

export function getResume(): Resume {
  return normalizeResume(getDocument('resume', DEFAULT_RESUME));
}

export function saveResume(resume: Resume): void {
  saveDocument('resume', resume);
}

interface ResumeVersionRow {
  id: string;
  name: string;
  file_name: string;
  created_at: string;
}

function rowToResumeVersion(row: ResumeVersionRow): ResumeVersion {
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    createdAt: row.created_at,
  };
}

export function listResumeVersions(): ResumeVersion[] {
  const rows = db
    .prepare('SELECT id, name, file_name, created_at FROM resumes ORDER BY created_at DESC')
    .all() as ResumeVersionRow[];
  return rows.map(rowToResumeVersion);
}

function getResumeVersion(id: string): ResumeVersion {
  const row = db
    .prepare('SELECT id, name, file_name, created_at FROM resumes WHERE id = ?')
    .get(id) as ResumeVersionRow | undefined;
  if (!row) throw new Error('Resume not found.');
  return rowToResumeVersion(row);
}

/** Display name from a file name, with a numeric suffix when that name is taken. */
function uniqueResumeName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim() || fileName;
  const taken = new Set(
    (db.prepare('SELECT name FROM resumes').all() as Array<{ name: string }>).map((row) => row.name)
  );
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base} (${suffix})`)) suffix += 1;
  return `${base} (${suffix})`;
}

export function createResumeVersion(fileName: string): ResumeVersion {
  const id = randomUUID();
  db.prepare('INSERT INTO resumes (id, name, file_name) VALUES (?, ?, ?)').run(
    id,
    uniqueResumeName(fileName),
    fileName
  );
  return getResumeVersion(id);
}

export function renameResumeVersion(id: string, name: string): ResumeVersion {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Resume name cannot be empty.');
  const result = db.prepare('UPDATE resumes SET name = ? WHERE id = ?').run(trimmed, id);
  if (result.changes === 0) throw new Error('Resume not found.');
  return getResumeVersion(id);
}

export function deleteResumeVersion(id: string): void {
  const remove = db.transaction(() => {
    db.prepare('UPDATE jobs SET resume_id = NULL WHERE resume_id = ?').run(id);
    db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
  });
  remove();
}
