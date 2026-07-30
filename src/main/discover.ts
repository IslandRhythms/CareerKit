import { DiscoveredJob, DiscoverResult } from '../shared/types';
import { matchesQuery } from '../shared/text';
import { getPreferences, getResume, hasExternalJob } from './db';
import { rankJob } from './ranking';
import {
  fetchGreenhouse,
  fetchJobicy,
  fetchLever,
  fetchRemotive,
  SourceJob,
} from './integrations/sources';

export async function discoverJobs(query: string): Promise<DiscoverResult> {
  const prefs = getPreferences();
  const resume = getResume();
  const errors: string[] = [];

  const effectiveQuery = query || prefs.titles[0] || '';
  const tasks: Array<{ label: string; promise: Promise<SourceJob[]> }> = [
    { label: 'Remotive', promise: fetchRemotive(prefs.remotive) },
    { label: 'Jobicy', promise: fetchJobicy(effectiveQuery, prefs.jobicy) },
    ...prefs.greenhouseBoards.map((board) => ({
      label: `Greenhouse (${board})`,
      promise: fetchGreenhouse(board),
    })),
    ...prefs.leverCompanies.map((company) => ({
      label: `Lever (${company})`,
      promise: fetchLever(company),
    })),
  ];

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));
  const all: SourceJob[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(`${tasks[i].label}: ${message}`);
    }
  });

  // Enforce the keyword query client-side. Remotive's `search` parameter is
  // unreliable (it returns unrelated postings), and the company boards don't
  // search at all. Jobicy is exempt: its server-side `tag` search works and can
  // match posting tags that never appear in the visible text.
  const filtered = query.trim()
    ? all.filter(
        (job) =>
          job.source === 'jobicy' || matchesQuery(`${job.title}\n${job.description}`, query)
      )
    : all;

  const blacklist = prefs.blacklistedCompanies
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const isBlacklisted = (company: string) =>
    blacklist.some((banned) => company.toLowerCase().includes(banned));

  const seen = new Set<string>();
  const jobs: DiscoveredJob[] = [];
  for (const job of filtered) {
    const key = `${job.source}:${job.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { score, reasons } = rankJob(job, prefs, resume);
    jobs.push({
      ...job,
      score,
      reasons,
      inTracker: hasExternalJob(job.source, job.externalId),
      blacklisted: isBlacklisted(job.company),
    });
  }

  jobs.sort((a, b) => b.score - a.score);
  return { jobs: jobs.slice(0, 100), errors };
}
