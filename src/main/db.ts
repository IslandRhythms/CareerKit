import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_RESUME,
  Job,
  NewJob,
  Preferences,
  Resume,
  ResumeBullet,
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
  `);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
      `INSERT INTO jobs (title, company, url, location, salary_min, salary_max, status, source, external_id, description, notes, applied_at)
       VALUES (@title, @company, @url, @location, @salaryMin, @salaryMax, @status, @source, @externalId, @description, @notes, @appliedAt)`
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
};

export function updateJob(id: number, changes: Partial<NewJob>): Job {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [key, column] of Object.entries(JOB_COLUMNS)) {
    if (key in changes) {
      sets.push(`${column} = @${key}`);
      params[key] = (changes as Record<string, unknown>)[key];
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
  };
}

export function getResume(): Resume {
  return normalizeResume(getDocument('resume', DEFAULT_RESUME));
}

export function saveResume(resume: Resume): void {
  saveDocument('resume', resume);
}
