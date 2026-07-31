import { DiscoveredJob, JobicyOptions, RemotiveOptions } from '../../shared/types';
import { REMOTIVE_CATEGORIES } from '../../shared/remotiveOptions';
import { extractSalaryText, formatSalaryRange } from '../../shared/salary';
import { decodeEntities, htmlToText } from './html';

export type SourceJob = Omit<
  DiscoveredJob,
  'score' | 'reasons' | 'inTracker' | 'blacklisted' | 'salaryMaxParsed'
>;

const FETCH_TIMEOUT_MS = 15000;

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: 'application/json', 'user-agent': 'CareerKit/1.0' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  location?: { name?: string };
  content?: string;
  company_name?: string;
  pay_input_ranges?: Array<{
    min_cents?: number;
    max_cents?: number;
    currency_type?: string;
    title?: string;
  }>;
}

export async function fetchGreenhouse(boardToken: string): Promise<SourceJob[]> {
  const data = await fetchJson<{ jobs: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`
  );
  return (data.jobs || []).map((job) => {
    const pay = job.pay_input_ranges?.[0];
    return {
      source: 'greenhouse' as const,
      externalId: String(job.id),
      title: job.title,
      company: job.company_name || boardToken,
      url: job.absolute_url,
      location: job.location?.name || '',
      postedAt: job.updated_at || null,
      // Greenhouse returns HTML-escaped HTML, so decode entities before stripping tags.
      description: htmlToText(decodeEntities(job.content || '')),
      salaryText: pay
        ? formatSalaryRange(
            pay.min_cents ? pay.min_cents / 100 : null,
            pay.max_cents ? pay.max_cents / 100 : null,
            pay.currency_type
          )
        : null,
    };
  });
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
}

export async function fetchLever(company: string): Promise<SourceJob[]> {
  const data = await fetchJson<LeverJob[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`
  );
  return (data || []).map((job) => {
    const salaryText = formatSalaryRange(
      job.salaryRange?.min ?? null,
      job.salaryRange?.max ?? null,
      job.salaryRange?.currency
    );
    return {
      source: 'lever' as const,
      externalId: job.id,
      title: job.text,
      company,
      url: job.hostedUrl,
      location: job.categories?.location || '',
      postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
      description: (job.descriptionPlain || '').slice(0, 5000),
      salaryText,
    };
  });
}

interface JobicyJob {
  id: number | string;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: number | string;
  annualSalaryMax?: number | string;
  salaryCurrency?: string;
}

export async function fetchJobicy(query: string, options: JobicyOptions): Promise<SourceJob[]> {
  const count = Math.min(100, Math.max(1, Math.round(options.count) || 50));
  const params = new URLSearchParams({ count: String(count) });
  if (query.trim()) params.set('tag', query.trim());
  if (options.geo) params.set('geo', options.geo);
  if (options.industry) params.set('industry', options.industry);
  const data = await fetchJson<{ jobs: JobicyJob[] }>(
    `https://jobicy.com/api/v2/remote-jobs?${params.toString()}`
  );
  return (data.jobs || []).map((job) => {
    // Jobicy reports annual salaries in USD unless salaryCurrency says otherwise.
    // Its API stopped returning the annualSalary fields entirely at some point,
    // so when they're absent, fall back to finding the salary in the
    // description text (where postings usually still state it).
    const description = htmlToText(job.jobDescription || job.jobExcerpt || '');
    const salaryText =
      formatSalaryRange(
        Number(job.annualSalaryMin) || null,
        Number(job.annualSalaryMax) || null,
        job.salaryCurrency || 'USD'
      ) ?? extractSalaryText(description);
    return {
      source: 'jobicy' as const,
      externalId: String(job.id),
      title: job.jobTitle,
      company: job.companyName,
      url: job.url,
      location: job.jobGeo || 'Remote',
      // Jobicy dates look like "2026-07-28 09:15:04" — make it ISO-parseable.
      postedAt: parseDate(job.pubDate ? job.pubDate.replace(' ', 'T') : null),
      description,
      salaryText,
    };
  });
}

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  url: string;
  category?: string;
  candidate_required_location?: string;
  publication_date?: string;
  description?: string;
  salary?: string;
}

// Remotive asks for at most ~4 API calls per day and blocks callers above
// 2 requests/minute — and in practice its API ignores every documented query
// parameter (search, category, limit all return the same latest listings).
// So: fetch the unfiltered feed once, cache it, and filter locally. Discovery
// applies the keyword filter; the category filter happens here using each
// job's `category` field.
let remotiveCache: { at: number; jobs: RemotiveJob[] } | null = null;
const REMOTIVE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchRemotiveFeed(): Promise<RemotiveJob[]> {
  if (remotiveCache && Date.now() - remotiveCache.at < REMOTIVE_CACHE_TTL_MS) {
    return remotiveCache.jobs;
  }
  let data: { jobs: RemotiveJob[] };
  try {
    data = await fetchJson<{ jobs: RemotiveJob[] }>('https://remotive.com/api/remote-jobs');
  } catch (error) {
    // Serve stale results rather than nothing if Remotive rate-limits us.
    if (remotiveCache) return remotiveCache.jobs;
    throw error;
  }
  remotiveCache = { at: Date.now(), jobs: data.jobs || [] };
  return remotiveCache.jobs;
}

export async function fetchRemotive(options: RemotiveOptions): Promise<SourceJob[]> {
  const feed = await fetchRemotiveFeed();
  const categoryName = REMOTIVE_CATEGORIES.find((c) => c.slug === options.category)?.name;
  const jobs = categoryName
    ? feed.filter((job) => (job.category || '').toLowerCase() === categoryName.toLowerCase())
    : feed;
  return jobs.map((job) => {
    const description = htmlToText(job.description || '');
    return {
      source: 'remotive' as const,
      externalId: String(job.id),
      title: job.title,
      company: job.company_name,
      url: job.url,
      location: job.candidate_required_location || 'Remote',
      postedAt: job.publication_date || null,
      description,
      // Remotive's salary field is frequently blank — fall back to the text.
      salaryText: job.salary || extractSalaryText(description),
    };
  });
}
