import { Preferences, Resume } from '../shared/types';
import { locationMatches } from '../shared/usStates';
import { containsPhrase } from '../shared/text';

export interface RankableJob {
  title: string;
  company: string;
  location: string;
  description: string;
  salaryText: string | null;
  postedAt: string | null;
}

export interface RankResult {
  score: number;
  reasons: string[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 1)
  );
}

/**
 * Scores a job posting 0-100 against the user's preferences and master resume.
 * The weights: skills 45, title 25, location/remote 15, salary 5, recency 10,
 * with a penalty for avoid-keywords. Reasons explain each contribution.
 */
export function rankJob(job: RankableJob, prefs: Preferences, resume: Resume): RankResult {
  const reasons: string[] = [];
  let score = 0;

  const text = `${job.title}\n${job.description}`.toLowerCase();
  const jobTitleLower = job.title.toLowerCase();
  const locationLower = job.location.toLowerCase();

  // Skills: union of preference skills and the full resume skill bank.
  const skills = Array.from(
    new Set(
      [...prefs.skills, ...resume.skills.map((s) => s.name)]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  if (skills.length > 0) {
    const hits = skills.filter((skill) => containsPhrase(text, skill));
    // Diminishing denominator: matching 6 of 20 listed skills is still a strong signal.
    const ratio = hits.length / Math.min(Math.max(skills.length, 1), 8);
    score += Math.round(45 * Math.min(1, ratio));
    if (hits.length > 0) {
      const shown = hits.slice(0, 6).join(', ');
      reasons.push(`Matches ${hits.length} of your skills (${shown}${hits.length > 6 ? ', …' : ''})`);
    }
  }

  // Title match against preferred titles.
  if (prefs.titles.length > 0) {
    let best = 0;
    let bestTitle = '';
    for (const prefTitle of prefs.titles) {
      const prefTokens = tokenize(prefTitle);
      if (prefTokens.size === 0) continue;
      const jobTokens = tokenize(jobTitleLower);
      let overlap = 0;
      prefTokens.forEach((t) => {
        if (jobTokens.has(t)) overlap += 1;
      });
      const ratio = overlap / prefTokens.size;
      if (ratio > best) {
        best = ratio;
        bestTitle = prefTitle;
      }
    }
    if (best > 0) {
      score += Math.round(25 * best);
      reasons.push(`Title is close to "${bestTitle}"`);
    }
  }

  // Location / remote.
  const looksRemote = /\bremote\b|\banywhere\b|\bworldwide\b/.test(locationLower);
  const locationMatch = prefs.locations.some(
    (loc) => loc.trim() && locationMatches(job.location, loc)
  );
  if (prefs.remote === 'remote') {
    if (looksRemote) {
      score += 15;
      reasons.push('Remote role, matching your remote preference');
    }
  } else if (locationMatch) {
    score += 15;
    reasons.push(`Located in one of your preferred locations (${job.location})`);
  } else if (prefs.remote === 'any' && looksRemote) {
    score += 10;
    reasons.push('Remote role');
  }

  // Salary: only when the posting exposes numbers we can compare.
  if (prefs.minSalary && job.salaryText) {
    const numbers = (job.salaryText.match(/\d[\d,]*/g) || [])
      .map((n) => parseInt(n.replace(/,/g, ''), 10))
      .map((n) => (n < 1000 ? n * 1000 : n));
    const max = Math.max(0, ...numbers);
    if (max >= prefs.minSalary) {
      score += 5;
      reasons.push(`Salary range (${job.salaryText}) meets your minimum`);
    }
  }

  // Recency.
  if (job.postedAt) {
    const ageDays = (Date.now() - new Date(job.postedAt).getTime()) / 86400000;
    if (ageDays >= 0 && ageDays <= 7) {
      score += 10;
      reasons.push('Posted within the last week');
    } else if (ageDays <= 30) {
      score += 5;
      reasons.push('Posted within the last month');
    }
  }

  // Avoid keywords.
  const avoided = prefs.avoidKeywords.filter(
    (kw) => kw.trim() && containsPhrase(text, kw.trim())
  );
  if (avoided.length > 0) {
    score -= Math.min(40, avoided.length * 20);
    reasons.push(`Contains keywords you avoid: ${avoided.join(', ')}`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
