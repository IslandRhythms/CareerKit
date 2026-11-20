import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  INTERVIEW_STAGE_STATUSES,
  INTERVIEW_STAGE_STATUS_LABELS,
  INTERVIEW_STAGE_TYPES,
  INTERVIEW_STAGE_TYPE_LABELS,
  InterviewStage,
  InterviewStageStatus,
  InterviewStageType,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  Job,
  JobStatus,
  NewJob,
  ResumeVersion,
  WORK_ARRANGEMENT_LABELS,
  WORK_ARRANGEMENTS,
  WorkArrangement,
  isWorkArrangement,
  stageDisplayName,
  summarizeStages,
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
  interviewStages: [],
  resumeId: null,
  workArrangement: null,
};

function workArrangementFromSelect(value: string): WorkArrangement | null {
  return isWorkArrangement(value) ? value : null;
}

function formatStageDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hasTime = value.includes('T');
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(hasTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

/** Compact "Stage 2 of 4 · Technical" progress strip shown on cards with stages. */
function StageProgress({ stages }: { stages: InterviewStage[] }) {
  if (stages.length === 0) return null;
  const { total, finished, current, nextScheduled, failed } = summarizeStages(stages);
  const done = finished === total;
  const plural = total === 1 ? '' : 's';
  const headline = current
    ? `Stage ${finished + 1} of ${total} · ${stageDisplayName(current)}`
    : failed
      ? `${total} stage${plural} · did not advance`
      : `All ${total} stage${plural} complete`;
  const when = nextScheduled ? formatStageDate(nextScheduled.scheduledAt) : null;
  return (
    <div className={`ck-stages ${failed ? 'ck-stages-failed' : done ? 'ck-stages-done' : ''}`}>
      <div className="ck-stage-dots" aria-hidden="true">
        {stages.map((stage) => (
          <span key={stage.id} className={`ck-stage-dot ck-stage-dot-${stage.status}`} />
        ))}
      </div>
      <p className="is-size-7 ck-stage-headline">{headline}</p>
      {when && <p className="is-size-7 has-text-grey">Next: {when}</p>}
    </div>
  );
}

export function TrackerPage({ onJobsChanged }: { onJobsChanged(): void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  const [dragOver, setDragOver] = useState<JobStatus | null>(null);

  const reload = () =>
    Promise.all([window.careerkit.listJobs(), window.careerkit.listResumeVersions()]).then(
      ([nextJobs, nextVersions]) => {
        setJobs(nextJobs);
        setVersions(nextVersions);
        onJobsChanged();
      }
    );
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

  const versionNames = new Map(versions.map((version) => [version.id, version.name]));

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
              {columnJobs.map((job) => {
                const resumeName = job.resumeId ? versionNames.get(job.resumeId) : undefined;
                return (
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
                      {resumeName && <p className="is-size-7">{resumeName}</p>}
                      {job.workArrangement && (
                        <div className="mt-1">
                          <span className="tag is-small is-light">
                            {WORK_ARRANGEMENT_LABELS[job.workArrangement]}
                          </span>
                        </div>
                      )}
                      {job.appliedAt && status !== 'saved' && (
                        <p className="is-size-7 has-text-grey">Applied {job.appliedAt}</p>
                      )}
                      <StageProgress stages={job.interviewStages} />
                    </div>
                  </div>
                );
              })}
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
          interviewStages: job.interviewStages,
          resumeId: job.resumeId,
          workArrangement: job.workArrangement,
        }
      : EMPTY_FORM
  );
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    window.careerkit.listResumeVersions().then(setVersions).catch(() => setVersions([]));
  }, []);

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
                <label className="label">Resume used</label>
                <div className="select is-fullwidth">
                  <select
                    value={form.resumeId ?? ''}
                    onChange={(e) => set('resumeId', e.target.value || null)}
                  >
                    <option value="">Not linked</option>
                    {versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="help">
                  {versions.length === 0
                    ? 'Upload a resume on the Resume page, then link it here.'
                    : 'Counts toward that resume once the job leaves Saved.'}
                </p>
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label">Work arrangement</label>
                <div className="select is-fullwidth">
                  <select
                    value={form.workArrangement ?? ''}
                    onChange={(e) => set('workArrangement', workArrangementFromSelect(e.target.value))}
                  >
                    <option value="">Not set</option>
                    {WORK_ARRANGEMENTS.map((arrangement) => (
                      <option key={arrangement} value={arrangement}>
                        {WORK_ARRANGEMENT_LABELS[arrangement]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="help">Splits the ratio between remote and hybrid / onsite.</p>
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
          <InterviewStagesEditor
            stages={form.interviewStages}
            onChange={(stages) => set('interviewStages', stages)}
          />
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

function InterviewStagesEditor({
  stages,
  onChange,
}: {
  stages: InterviewStage[];
  onChange(stages: InterviewStage[]): void;
}) {
  const update = (id: string, changes: Partial<InterviewStage>) =>
    onChange(stages.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  const remove = (id: string) => onChange(stages.filter((s) => s.id !== id));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = () =>
    onChange([
      ...stages,
      {
        id: crypto.randomUUID(),
        type: 'other',
        label: '',
        scheduledAt: null,
        status: 'pending',
        notes: '',
      },
    ]);

  const summary = summarizeStages(stages);

  return (
    <div className="field">
      <div className="is-flex is-align-items-center is-justify-content-space-between mb-2">
        <label className="label mb-0">
          Interview Stages
          {stages.length > 0 && (
            <span className="has-text-weight-normal has-text-grey is-size-7 ml-2">
              {summary.finished} of {summary.total} finished
            </span>
          )}
        </label>
        <button type="button" className="button is-small" onClick={add}>
          + Add stage
        </button>
      </div>
      {stages.length === 0 && (
        <p className="is-size-7 has-text-grey">
          Track each round separately: recruiter screen, technical, onsite, and so on.
        </p>
      )}
      {stages.map((stage, index) => (
        <div key={stage.id} className={`ck-subcard ck-stage-row ck-stage-row-${stage.status}`}>
          <div className="ck-stage-row-head">
            <span className="ck-stage-index">{index + 1}</span>
            <div className="select is-small">
              <select
                value={stage.type}
                onChange={(e) => update(stage.id, { type: e.target.value as InterviewStageType })}
              >
                {INTERVIEW_STAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {INTERVIEW_STAGE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="input is-small ck-stage-label"
              placeholder="Custom name (optional)"
              value={stage.label}
              onChange={(e) => update(stage.id, { label: e.target.value })}
            />
            <div className="ck-stage-row-actions">
              <button
                type="button"
                className="button is-small is-white"
                title="Move up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="button is-small is-white"
                title="Move down"
                disabled={index === stages.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="delete is-small"
                title="Remove stage"
                onClick={() => remove(stage.id)}
              />
            </div>
          </div>
          <div className="ck-stage-row-body">
            <input
              type="datetime-local"
              className="input is-small"
              value={stage.scheduledAt ?? ''}
              onChange={(e) => {
                const scheduledAt = e.target.value || null;
                const changes: Partial<InterviewStage> = { scheduledAt };
                if (scheduledAt && stage.status === 'pending') changes.status = 'scheduled';
                if (!scheduledAt && stage.status === 'scheduled') changes.status = 'pending';
                update(stage.id, changes);
              }}
            />
            <div className="select is-small">
              <select
                value={stage.status}
                onChange={(e) =>
                  update(stage.id, { status: e.target.value as InterviewStageStatus })
                }
              >
                {INTERVIEW_STAGE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {INTERVIEW_STAGE_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <input
            className="input is-small"
            placeholder="Notes: interviewer, format, prep, how it went…"
            value={stage.notes}
            onChange={(e) => update(stage.id, { notes: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
