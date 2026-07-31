import { useEffect, useMemo, useState } from 'react';
import { DiscoveredJob } from '../../shared/types';

function scoreClass(score: number): string {
  if (score >= 70) return 'ck-score-high';
  if (score >= 40) return 'ck-score-mid';
  return 'ck-score-low';
}

const SOURCE_LABELS: Record<DiscoveredJob['source'], string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  remotive: 'Remotive',
  jobicy: 'Jobicy',
};

type SortKey = 'fit' | 'newest' | 'company' | 'title';

const SORT_LABELS: Record<SortKey, string> = {
  fit: 'Best fit',
  newest: 'Newest',
  company: 'Company A–Z',
  title: 'Title A–Z',
};

const HOUR_MS = 60 * 60 * 1000;

const POSTED_OPTIONS: Array<{ hours: number; label: string }> = [
  { hours: 0, label: 'Any time' },
  { hours: 1, label: 'Last hour' },
  { hours: 6, label: 'Last 6 hours' },
  { hours: 24, label: 'Last 24 hours' },
  { hours: 3 * 24, label: 'Last 3 days' },
  { hours: 7 * 24, label: 'Last 7 days' },
  { hours: 30 * 24, label: 'Last 30 days' },
];

type SalaryFilter = 'any' | 'listed' | 'range';

const PAGE_SIZE = 30;

export function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<DiscoveredJob | null>(null);
  const [minSalaryPref, setMinSalaryPref] = useState<number | null>(null);
  const [showScoring, setShowScoring] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [sort, setSort] = useState<SortKey>('fit');
  const [sourceFilter, setSourceFilter] = useState<'all' | DiscoveredJob['source']>('all');
  const [minScore, setMinScore] = useState(0);
  const [postedWithin, setPostedWithin] = useState(0); // hours; 0 = any time
  const [salaryFilter, setSalaryFilter] = useState<SalaryFilter>('any');
  const [hideSaved, setHideSaved] = useState(false);
  const [hideBlacklisted, setHideBlacklisted] = useState(false);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const result = await window.careerkit.discoverJobs(q);
      setJobs(result.jobs);
      setErrors(result.errors);
      setSearched(true);
      setVisibleCount(PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  };

  // Search immediately on landing: with an empty query the backend already
  // pulls every configured source and seeds Jobicy with the first desired
  // title, then ranks everything against preferences and resume skills.
  useEffect(() => {
    window.careerkit.getPreferences().then((p) => setMinSalaryPref(p.minSalary));
    search('');
  }, []);

  const filtersActive =
    sourceFilter !== 'all' ||
    minScore > 0 ||
    postedWithin > 0 ||
    salaryFilter !== 'any' ||
    hideSaved ||
    hideBlacklisted;

  const resetFilters = () => {
    setSourceFilter('all');
    setMinScore(0);
    setPostedWithin(0);
    setSalaryFilter('any');
    setHideSaved(false);
    setHideBlacklisted(false);
  };

  const visible = useMemo(() => {
    const now = Date.now();
    const salaryOk = (job: DiscoveredJob) => {
      if (salaryFilter === 'any') return true;
      if (job.salaryMaxParsed === null) return false;
      return salaryFilter === 'listed' || !minSalaryPref || job.salaryMaxParsed >= minSalaryPref;
    };
    const list = jobs.filter(
      (job) =>
        (sourceFilter === 'all' || job.source === sourceFilter) &&
        job.score >= minScore &&
        (!hideSaved || !job.inTracker) &&
        (!hideBlacklisted || !job.blacklisted) &&
        salaryOk(job) &&
        (postedWithin === 0 ||
          (job.postedAt !== null &&
            now - new Date(job.postedAt).getTime() <= postedWithin * HOUR_MS))
    );
    const time = (job: DiscoveredJob) => (job.postedAt ? new Date(job.postedAt).getTime() : 0);
    switch (sort) {
      case 'newest':
        return [...list].sort((a, b) => time(b) - time(a));
      case 'company':
        return [...list].sort(
          (a, b) => a.company.localeCompare(b.company) || b.score - a.score
        );
      case 'title':
        return [...list].sort((a, b) => a.title.localeCompare(b.title) || b.score - a.score);
      default:
        return list; // already ranked best-fit first by the backend
    }
  }, [jobs, sort, sourceFilter, minScore, postedWithin, salaryFilter, minSalaryPref, hideSaved, hideBlacklisted]);

  const shown = visible.slice(0, visibleCount);

  const importJob = async (job: DiscoveredJob) => {
    await window.careerkit.importDiscoveredJob(job);
    const markSaved = (j: DiscoveredJob) =>
      j.source === job.source && j.externalId === job.externalId ? { ...j, inTracker: true } : j;
    setJobs((current) => current.map(markSaved));
    setDetail((current) => (current ? markSaved(current) : current));
  };

  return (
    <div>
      <div className="level mb-4">
        <div className="level-left">
          <div>
            <h1 className="title is-3 mb-1">Discover Jobs</h1>
            <p className="subtitle is-6 has-text-grey mb-0">
              Ranked by fit against your preferences and resume.
              {searched &&
                !loading &&
                (filtersActive
                  ? ` Showing ${visible.length} of ${jobs.length} results.`
                  : ` ${jobs.length} results.`)}
            </p>
          </div>
        </div>
        <div className="level-right">
          <div className="field has-addons mb-0" style={{ width: '28rem', maxWidth: '100%' }}>
            <div className="control is-expanded">
              <input
                className="input"
                placeholder="Keywords, e.g. react developer (optional)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && search(query)}
              />
            </div>
            <div className="control">
              <button
                className={`button is-primary ${loading ? 'is-loading' : ''}`}
                onClick={() => search(query)}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {searched && (
        <div className="ck-filter-bar">
          <span className="ck-filter-group">
            <span className="ck-filter-label">Sort</span>
            <span className="select is-small">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </span>
          </span>
          <span className="ck-filter-group">
            <span className="ck-filter-label">Source</span>
            <span className="select is-small">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              >
                <option value="all">All sources</option>
                {(Object.keys(SOURCE_LABELS) as DiscoveredJob['source'][]).map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </span>
          </span>
          <span className="ck-filter-group">
            <span className="ck-filter-label">Min fit</span>
            <span className="select is-small">
              <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
                <option value={0}>Any</option>
                <option value={40}>40+</option>
                <option value={70}>70+</option>
              </select>
            </span>
          </span>
          <span className="ck-filter-group">
            <span className="ck-filter-label">Posted</span>
            <span className="select is-small">
              <select
                value={postedWithin}
                onChange={(e) => setPostedWithin(Number(e.target.value))}
              >
                {POSTED_OPTIONS.map((option) => (
                  <option key={option.hours} value={option.hours}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </span>
          <span className="ck-filter-group">
            <span className="ck-filter-label">Salary</span>
            <span className="select is-small">
              <select
                value={salaryFilter}
                onChange={(e) => setSalaryFilter(e.target.value as SalaryFilter)}
              >
                <option value="any">Any</option>
                <option value="listed">Salary listed</option>
                <option value="range" disabled={!minSalaryPref}>
                  {minSalaryPref
                    ? `Meets my minimum ($${minSalaryPref.toLocaleString()})`
                    : 'Meets my minimum (none set)'}
                </option>
              </select>
            </span>
          </span>
          <label className="checkbox is-size-7">
            <input
              type="checkbox"
              checked={hideSaved}
              onChange={(e) => setHideSaved(e.target.checked)}
            />{' '}
            Hide saved
          </label>
          <label className="checkbox is-size-7">
            <input
              type="checkbox"
              checked={hideBlacklisted}
              onChange={(e) => setHideBlacklisted(e.target.checked)}
            />{' '}
            Hide blacklisted
          </label>
          {filtersActive && (
            <a className="is-size-7" onClick={resetFilters}>
              Reset filters
            </a>
          )}
          <a
            className="is-size-7"
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowScoring(true)}
          >
            How is fit scored?
          </a>
        </div>
      )}

      {errors.length > 0 && (
        <div className="notification is-warning is-light py-3">
          <strong>Some sources failed:</strong> {errors.join(' · ')}
        </div>
      )}

      {loading && !searched && (
        <div className="ck-empty-state">
          <p className="title is-5 mb-3">Searching your job boards…</p>
          <progress
            className="progress is-primary"
            max={100}
            style={{ maxWidth: '24rem', margin: '0 auto' }}
          />
        </div>
      )}

      {searched && jobs.length === 0 && !loading && (
        <div className="notification is-light">
          No results. Try different keywords, or add Greenhouse boards / Lever companies in
          Preferences.
        </div>
      )}

      {searched && jobs.length > 0 && visible.length === 0 && !loading && (
        <div className="notification is-light">
          All {jobs.length} results are hidden by the current filters.{' '}
          <a onClick={resetFilters}>Reset filters</a>
        </div>
      )}

      <div className="ck-job-grid">
        {shown.map((job) => {
          const key = `${job.source}:${job.externalId}`;
          return (
            <div
              key={key}
              className={`ck-job-card ${job.blacklisted ? 'ck-blacklisted' : ''}`}
              onClick={() => setDetail(job)}
            >
              <div className="ck-job-card-top">
                <span className={`ck-score-pill ${scoreClass(job.score)}`}>{job.score}</span>
                <span className={`ck-job-source ck-src-${job.source}`}>
                  {SOURCE_LABELS[job.source]}
                </span>
                {job.blacklisted && <span className="ck-job-flag" title="Blacklisted company">⛔</span>}
                {job.inTracker && <span className="ck-job-flag" title="Already in tracker">✓</span>}
              </div>
              <p className="ck-job-title">{job.title}</p>
              <p className="ck-job-company">{job.company}</p>
              <p className="ck-job-meta">
                {[job.location, job.salaryText].filter(Boolean).join(' · ') || '—'}
              </p>
              <div className="ck-job-card-actions">
                <button
                  className="button is-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.careerkit.openExternal(job.url);
                  }}
                >
                  Open ↗
                </button>
                <button
                  className="button is-small is-primary"
                  disabled={job.inTracker}
                  onClick={(e) => {
                    e.stopPropagation();
                    importJob(job);
                  }}
                >
                  {job.inTracker ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length > visibleCount && (
        <div className="has-text-centered mt-4">
          <button
            className="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            Load {Math.min(PAGE_SIZE, visible.length - visibleCount)} more (
            {visible.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {detail && (
        <JobDetailModal job={detail} onClose={() => setDetail(null)} onImport={() => importJob(detail)} />
      )}
      {showScoring && <ScoringModal onClose={() => setShowScoring(false)} />}
    </div>
  );
}

function ScoringModal({ onClose }: { onClose(): void }) {
  const parts: Array<{ points: string; title: string; detail: string }> = [
    {
      points: 'up to 45',
      title: 'Skills',
      detail:
        'Your preference skills and your entire resume skill bank are matched against the posting title and description (whole-word matching, so "Java" won\'t match "JavaScript"). Matching around 8 skills earns full points — you don\'t need to hit every skill you listed.',
    },
    {
      points: 'up to 25',
      title: 'Title',
      detail:
        'The posting title is compared word-by-word against each of your desired job titles; the closest one counts. "Senior Software Engineer" matches "Software Engineer" strongly.',
    },
    {
      points: 'up to 15',
      title: 'Location & remote',
      detail:
        'Full points when the posting is remote and you prefer remote, or when it sits in one of your preferred locations. Remote roles still get 10 when you have no work-style preference.',
    },
    {
      points: 'up to 10',
      title: 'Recency',
      detail: '10 points if posted within the last week, 5 within the last month.',
    },
    {
      points: 'up to 5',
      title: 'Salary',
      detail:
        'Awarded when the posting lists a salary whose top end meets the minimum you set in Preferences.',
    },
    {
      points: '−20 each',
      title: 'Avoid keywords',
      detail:
        'Each avoid-keyword found in the posting subtracts 20 points (capped at −40). The final score is clamped to 0–100.',
    },
  ];
  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={onClose} />
      <div className="modal-card ck-modal">
        <header className="modal-card-head">
          <p className="modal-card-title title is-5 mb-0">How fit scores are calculated</p>
          <button className="delete" onClick={onClose} />
        </header>
        <section className="modal-card-body">
          <p className="mb-4">
            Every posting is scored 0–100 against your Preferences and your master resume. The
            score is the sum of these parts:
          </p>
          {parts.map((part) => (
            <div key={part.title} className="mb-3">
              <p className="mb-1">
                <span className="tag is-primary is-light mr-2">{part.points}</span>
                <strong>{part.title}</strong>
              </p>
              <p className="is-size-7 has-text-grey">{part.detail}</p>
            </div>
          ))}
          <p className="is-size-7 has-text-grey mt-4">
            Open any posting to see exactly which of these contributed under “Why this score”. To
            improve your matches, flesh out skills and desired titles in Preferences and keep your
            resume skill bank current.
          </p>
        </section>
        <footer className="modal-card-foot">
          <button className="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function JobDetailModal({
  job,
  onClose,
  onImport,
}: {
  job: DiscoveredJob;
  onClose(): void;
  onImport(): void;
}) {
  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={onClose} />
      <div className="modal-card ck-modal">
        <header className="modal-card-head">
          <div className="modal-card-title">
            <p className="title is-5 mb-1">{job.title}</p>
            <p className="subtitle is-6 has-text-grey mb-0">
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
            </p>
          </div>
          <button className="delete" onClick={onClose} />
        </header>
        <section className="modal-card-body">
          <div className="tags mb-3">
            {job.blacklisted && <span className="tag is-danger">⛔ Blacklisted</span>}
            <span className={`tag ck-score-pill ${scoreClass(job.score)}`}>Fit: {job.score}/100</span>
            <span className="tag">{SOURCE_LABELS[job.source]}</span>
            {job.salaryText && <span className="tag">{job.salaryText}</span>}
            {job.postedAt && (
              <span className="tag">Posted {new Date(job.postedAt).toLocaleDateString()}</span>
            )}
          </div>
          {job.reasons.length > 0 && (
            <>
              <p className="has-text-weight-semibold mb-1">Why this score</p>
              <ul className="ck-reasons is-size-7 has-text-grey mb-4">
                {job.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          {job.description && (
            <>
              <p className="has-text-weight-semibold mb-1">Description</p>
              <pre className="ck-description p-3">{job.description}</pre>
            </>
          )}
        </section>
        <footer className="modal-card-foot">
          <button
            className="button is-link"
            onClick={() => window.careerkit.openExternal(job.url)}
          >
            Open posting ↗
          </button>
          <button className="button is-primary" disabled={job.inTracker} onClick={onImport}>
            {job.inTracker ? '✓ In Tracker' : 'Save to Tracker'}
          </button>
          <button className="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
