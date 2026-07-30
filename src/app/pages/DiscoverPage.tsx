import { useState } from 'react';
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

export function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<DiscoveredJob | null>(null);

  const search = async () => {
    setLoading(true);
    try {
      const result = await window.careerkit.discoverJobs(query);
      setJobs(result.jobs);
      setErrors(result.errors);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

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
              {searched && !loading && ` ${jobs.length} results.`}
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
                onKeyDown={(e) => e.key === 'Enter' && !loading && search()}
              />
            </div>
            <div className="control">
              <button
                className={`button is-primary ${loading ? 'is-loading' : ''}`}
                onClick={search}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="notification is-warning is-light py-3">
          <strong>Some sources failed:</strong> {errors.join(' · ')}
        </div>
      )}

      {searched && jobs.length === 0 && !loading && (
        <div className="notification is-light">
          No results. Try different keywords, or add Greenhouse boards / Lever companies in
          Preferences.
        </div>
      )}

      {!searched && !loading && (
        <div className="ck-empty-state">
          <p className="title is-5 mb-2">Find your next role</p>
          <p className="has-text-grey">
            Search Remotive and Jobicy plus any Greenhouse and Lever boards you follow in
            Preferences.
          </p>
        </div>
      )}

      <div className="ck-job-grid">
        {jobs.map((job) => {
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

      {detail && (
        <JobDetailModal job={detail} onClose={() => setDetail(null)} onImport={() => importJob(detail)} />
      )}
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
