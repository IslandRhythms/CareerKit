import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  Job,
  JobStatus,
  NewJob,
} from '../../shared/types';
import { US_STATES } from '../../shared/usStates';
import { showToast } from '../toast';

const EMPTY_FORM: NewJob = {
  title: '',
  company: '',
  url: null,
  location: null,
  salaryMin: null,
  salaryMax: null,
  status: 'saved',
  source: 'manual',
  externalId: null,
  description: null,
  notes: null,
  appliedAt: null,
};

export function TrackerPage({ onJobsChanged }: { onJobsChanged(): void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  const [dragOver, setDragOver] = useState<JobStatus | null>(null);

  const reload = () =>
    window.careerkit.listJobs().then((next) => {
      setJobs(next);
      onJobsChanged();
    });
  useEffect(() => {
    reload();
  }, []);

  const moveJob = async (id: number, status: JobStatus) => {
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === status) return;
    const changes: Partial<NewJob> = { status };
    if (status === 'applied' && !job.appliedAt) {
      changes.appliedAt = new Date().toISOString().slice(0, 10);
    }
    try {
      await window.careerkit.updateJob(id, changes);
      showToast(`Moved ${job.title} to ${JOB_STATUS_LABELS[status]}`);
      reload();
    } catch {
      showToast(`Could not move ${job.title}`, 'is-danger');
    }
  };

  return (
    <div>
      <div className="level mb-4">
        <div className="level-left">
          <h1 className="title is-3">Job Tracker</h1>
        </div>
        <div className="level-right">
          <button className="button is-primary" onClick={() => setEditing('new')}>
            + Add Job
          </button>
        </div>
      </div>

      <div className="ck-board">
        {JOB_STATUSES.map((status) => {
          const columnJobs = jobs.filter((j) => j.status === status);
          return (
            <div
              key={status}
              className={`ck-column ck-col-${status} box p-3 ${dragOver === status ? 'ck-column-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = Number(e.dataTransfer.getData('text/plain'));
                if (id) moveJob(id, status);
              }}
            >
              <p className="ck-col-head">
                <span className="ck-col-name">{JOB_STATUS_LABELS[status]}</span>
                <span className="ck-col-count">{columnJobs.length}</span>
              </p>
              {columnJobs.map((job) => (
                <div
                  key={job.id}
                  className="card ck-card mb-3"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(job.id))}
                  onClick={() => setEditing(job)}
                >
                  <div className="card-content p-3">
                    <p className="has-text-weight-semibold">{job.title}</p>
                    <p className="is-size-7 has-text-grey">{job.company}</p>
                    {job.location && <p className="is-size-7">{job.location}</p>}
                    {job.appliedAt && status !== 'saved' && (
                      <p className="is-size-7 has-text-grey">Applied {job.appliedAt}</p>
                    )}
                  </div>
                </div>
              ))}
              {columnJobs.length === 0 && (
                <p className="is-size-7 has-text-grey has-text-centered py-4">Drop jobs here</p>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <JobModal
          job={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function JobModal({
  job,
  onClose,
  onSaved,
}: {
  job: Job | null;
  onClose(): void;
  onSaved(): void;
}) {
  const [form, setForm] = useState<NewJob>(
    job
      ? {
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
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = <K extends keyof NewJob>(key: K, value: NewJob[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.title.trim() || !form.company.trim()) return;
    setSaving(true);
    try {
      const title = form.title.trim();
      if (job) {
        await window.careerkit.updateJob(job.id, form);
        showToast(`Saved changes to ${title}`);
      } else {
        await window.careerkit.createJob(form);
        showToast(`Added ${title}`);
      }
      onSaved();
    } catch {
      showToast('Could not save that job', 'is-danger');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!job || deleting) return;
    const title = job.title;
    setDeleting(true);
    try {
      await window.careerkit.deleteJob(job.id);
      showToast(`Deleted ${title}`, 'is-danger');
      onSaved();
    } catch {
      showToast(`Could not delete ${title}`, 'is-danger');
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="modal is-active">
      <div className="modal-background" onClick={onClose} />
      <div className="modal-card ck-modal">
        <header className="modal-card-head">
          <p className="modal-card-title">{job ? 'Edit Job' : 'Add Job'}</p>
          <button className="delete" onClick={onClose} />
        </header>
        <section className="modal-card-body">
          <div className="columns">
            <div className="column">
              <div className="field">
                <label className="label">Job Title *</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                />
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label">Company *</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={(e) => set('company', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="columns">
            <div className="column">
              <div className="field">
                <label className="label">Location</label>
                <input
                  className="input"
                  list="ck-us-states"
                  placeholder="City, State"
                  value={form.location ?? ''}
                  onChange={(e) => set('location', e.target.value || null)}
                />
                <datalist id="ck-us-states">
                  {US_STATES.map((s) => (
                    <option key={s.abbr} value={`${s.name} (${s.abbr})`} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label">Posting URL</label>
                <input
                  className="input"
                  value={form.url ?? ''}
                  onChange={(e) => set('url', e.target.value || null)}
                />
              </div>
            </div>
          </div>
          <div className="columns">
            <div className="column">
              <div className="field">
                <label className="label">Status</label>
                <div className="select is-fullwidth">
                  <select
                    value={form.status}
                    onChange={(e) => set('status', e.target.value as JobStatus)}
                  >
                    {JOB_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {JOB_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label">Applied On</label>
                <input
                  type="date"
                  className="input"
                  value={form.appliedAt ?? ''}
                  onChange={(e) => set('appliedAt', e.target.value || null)}
                />
              </div>
            </div>
          </div>
          <div className="columns">
            <div className="column">
              <div className="field">
                <label className="label">Salary Min</label>
                <input
                  type="number"
                  className="input"
                  value={form.salaryMin ?? ''}
                  onChange={(e) => set('salaryMin', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label">Salary Max</label>
                <input
                  type="number"
                  className="input"
                  value={form.salaryMax ?? ''}
                  onChange={(e) => set('salaryMax', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
          </div>
          <div className="field">
            <label className="label">Notes</label>
            <textarea
              className="textarea"
              rows={4}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              placeholder="Interview notes, contacts, next steps…"
            />
          </div>
          {form.url && (
            <button
              className="button is-small is-link is-light"
              onClick={() => window.careerkit.openExternal(form.url as string)}
            >
              Open posting ↗
            </button>
          )}
        </section>
        <footer className="modal-card-foot is-justify-content-space-between">
          <div>
            <button
              type="button"
              className={`button is-primary ${saving ? 'is-loading' : ''}`}
              disabled={!form.title.trim() || !form.company.trim() || deleting}
              onClick={save}
            >
              Save
            </button>
            <button type="button" className="button ml-2" onClick={onClose} disabled={deleting}>
              Cancel
            </button>
          </div>
          {job &&
            (confirmingDelete ? (
              <div className="is-flex is-align-items-center">
                <span className="is-size-7 has-text-danger mr-3">Delete this job?</span>
                <button
                  type="button"
                  className={`button is-danger ${deleting ? 'is-loading' : ''}`}
                  onClick={remove}
                  disabled={deleting}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="button ml-2"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button is-danger is-outlined"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
            ))}
        </footer>
      </div>
    </div>,
    document.body
  );
}
