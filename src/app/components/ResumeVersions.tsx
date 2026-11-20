import { useEffect, useState } from 'react';
import {
  Job,
  OutcomeCounts,
  ResumeVersion,
  WORK_ARRANGEMENT_LABELS,
  formatApplicationInterviewRatio,
  resumePerformance,
} from '../../shared/types';
import { showToast } from '../toast';

function formatUploaded(value: string): string {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function tally(counts: OutcomeCounts): string {
  const applications = counts.applications === 1 ? '1 application' : `${counts.applications} applications`;
  const interviews = counts.interviews === 1 ? '1 interview' : `${counts.interviews} interviews`;
  return `${applications} · ${interviews}`;
}

function OutcomeCell({ label, counts }: { label: string; counts: OutcomeCounts }) {
  return (
    <div className="column">
      <p className="is-size-7 has-text-grey mb-1">{label}</p>
      <p className="has-text-weight-semibold mb-0">
        {formatApplicationInterviewRatio(counts.applications, counts.interviews)}
      </p>
      <p className="is-size-7 mb-0">{tally(counts)}</p>
    </div>
  );
}

export function ResumeVersions() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([window.careerkit.listResumeVersions(), window.careerkit.listJobs()])
      .then(([nextVersions, nextJobs]) => {
        setVersions(nextVersions);
        setJobs(nextJobs);
        setLoaded(true);
      })
      .catch(() => {
        showToast('Could not load tracked resumes', 'is-danger');
        setLoaded(true);
      });
  }, []);

  const upload = async () => {
    setUploading(true);
    try {
      const created = await window.careerkit.uploadResumeVersion();
      if (created) {
        setVersions((current) => [created, ...current]);
        showToast(`Tracking ${created.name}`);
      }
    } catch {
      showToast('Could not upload that resume', 'is-danger');
    } finally {
      setUploading(false);
    }
  };

  const saveName = async (id: string) => {
    const name = draft.trim();
    if (!name || busyId) return;
    setBusyId(id);
    try {
      const updated = await window.careerkit.renameResumeVersion(id, name);
      setVersions((current) => current.map((version) => (version.id === id ? updated : version)));
      setEditingId(null);
    } catch {
      showToast('Could not rename that resume', 'is-danger');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (version: ResumeVersion) => {
    if (busyId) return;
    setBusyId(version.id);
    try {
      await window.careerkit.deleteResumeVersion(version.id);
      setVersions((current) => current.filter((item) => item.id !== version.id));
      setJobs((current) =>
        current.map((job) => (job.resumeId === version.id ? { ...job, resumeId: null } : job))
      );
      setConfirmingId(null);
      showToast(`Stopped tracking ${version.name}`);
    } catch {
      showToast(`Could not delete ${version.name}`, 'is-danger');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="ck-resume-versions mb-5">
      <div className="level mb-3">
        <div className="level-left">
          <div>
            <h2 className="title is-5 mb-1">Tracked resumes</h2>
            <p className="is-size-7 has-text-grey mb-0">
              Upload each resume you send out. On a job, choose that resume and whether the role is
              remote or hybrid / onsite. The ratio is applications : interviews, and a job counts
              once it leaves Saved.
            </p>
          </div>
        </div>
        <div className="level-right">
          <button
            className={`button is-primary ${uploading ? 'is-loading' : ''}`}
            onClick={upload}
            disabled={uploading}
          >
            Upload resume
          </button>
        </div>
      </div>

      {!loaded && <progress className="progress is-small is-primary" max={100} />}

      {loaded && versions.length === 0 && (
        <p className="has-text-grey">No resumes uploaded yet.</p>
      )}

      {versions.map((version) => {
        const performance = resumePerformance(jobs, version.id);
        const rate =
          performance.overall.applications === 0
            ? null
            : `${Math.round((performance.overall.interviews / performance.overall.applications) * 100)}% of applications reached an interview`;
        const renaming = editingId === version.id;
        return (
          <article key={version.id} className="box">
            <div className="level mb-2">
              <div className="level-left">
                <div>
                  {renaming ? (
                    <div className="field has-addons mb-1">
                      <div className="control">
                        <input
                          className="input is-small"
                          value={draft}
                          aria-label="Resume name"
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveName(version.id);
                            if (event.key === 'Escape') setEditingId(null);
                          }}
                        />
                      </div>
                      <div className="control">
                        <button
                          className={`button is-small is-primary ${busyId === version.id ? 'is-loading' : ''}`}
                          onClick={() => saveName(version.id)}
                          disabled={!draft.trim() || busyId === version.id}
                        >
                          Save
                        </button>
                      </div>
                      <div className="control">
                        <button className="button is-small" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="has-text-weight-semibold mb-0">{version.name}</p>
                  )}
                  <p className="is-size-7 has-text-grey mb-0">
                    {version.fileName} · uploaded {formatUploaded(version.createdAt)}
                  </p>
                </div>
              </div>
              <div className="level-right">
                <div className="has-text-right">
                  <p className="title is-4 mb-0">
                    {formatApplicationInterviewRatio(
                      performance.overall.applications,
                      performance.overall.interviews
                    )}
                  </p>
                  <p className="is-size-7 has-text-grey mb-0">
                    {performance.overall.applications === 0
                      ? 'No applications yet'
                      : 'applications : interviews'}
                  </p>
                  {rate && <p className="is-size-7 mb-0">{rate}</p>}
                </div>
              </div>
            </div>

            <div className="columns is-mobile mb-1">
              <OutcomeCell label={WORK_ARRANGEMENT_LABELS.remote} counts={performance.remote} />
              <OutcomeCell
                label={WORK_ARRANGEMENT_LABELS.hybrid_onsite}
                counts={performance.hybridOnsite}
              />
            </div>
            <p className="is-size-7 mb-3">{tally(performance.overall)}</p>

            {performance.unspecified.applications > 0 && (
              <p className="is-size-7 has-text-grey mb-3">
                Work arrangement not set: {tally(performance.unspecified)} ·{' '}
                {formatApplicationInterviewRatio(
                  performance.unspecified.applications,
                  performance.unspecified.interviews
                )}
              </p>
            )}

            {confirmingId === version.id ? (
              <div className="is-flex is-align-items-center is-flex-wrap-wrap">
                <span className="is-size-7 has-text-danger mr-3">
                  Delete this resume? Applications stay in the tracker and lose this link.
                </span>
                <button
                  className={`button is-small is-danger ${busyId === version.id ? 'is-loading' : ''}`}
                  onClick={() => remove(version)}
                  disabled={busyId === version.id}
                >
                  Delete
                </button>
                <button
                  className="button is-small ml-2"
                  onClick={() => setConfirmingId(null)}
                  disabled={busyId === version.id}
                >
                  Keep
                </button>
              </div>
            ) : (
              <div className="buttons mb-0">
                <button
                  className="button is-small"
                  onClick={() => {
                    setDraft(version.name);
                    setEditingId(version.id);
                    setConfirmingId(null);
                  }}
                >
                  Rename
                </button>
                <button className="button is-small is-danger is-outlined" onClick={() => setConfirmingId(version.id)}>
                  Delete
                </button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
