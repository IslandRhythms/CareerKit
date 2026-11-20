import { KeyboardEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_RESUME,
  RESUME_SECTION_LABELS,
  Resume,
  ResumeBullet,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  ResumeSectionKey,
} from '../../shared/types';
import { ResumeVersions } from '../components/ResumeVersions';
import { TagInput } from '../components/TagInput';

export function ResumePage() {
  const [resume, setResume] = useState<Resume>(DEFAULT_RESUME);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedJson, setSavedJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<{
    tone: 'success' | 'danger';
    lines: string[];
  } | null>(null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    window.careerkit.getResume().then((r) => {
      setResume(r);
      setSavedJson(JSON.stringify(r));
      setLoaded(true);
    });
  }, []);

  const dirty = loaded && JSON.stringify(resume) !== savedJson;

  const set = <K extends keyof Resume>(key: K, value: Resume[K]) =>
    setResume((r) => ({ ...r, [key]: value }));

  const save = async () => {
    await window.careerkit.saveResume(resume);
    setSavedJson(JSON.stringify(resume));
    setConfirmingDiscard(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  /** Throws away every unsaved edit, restoring the last saved resume. */
  const discard = () => {
    setResume(JSON.parse(savedJson));
    setImportNotice(null);
    setConfirmingDiscard(false);
  };

  const importFromFile = async () => {
    setImporting(true);
    setImportNotice(null);
    try {
      const result = await window.careerkit.importResume();
      if (!result) return; // dialog cancelled
      const { merged, added } = mergeImportedResume(resume, result.resume);
      const summary =
        added.length > 0
          ? `Imported from ${result.fileName}: ${added.join(', ')}.`
          : `Nothing new found in ${result.fileName} — everything in it is already here.`;
      setResume(merged);
      setImportNotice({
        tone: 'success',
        lines: [summary + ' Review the entries below, then Save.', ...result.warnings],
      });
      setView('edit');
    } catch (error) {
      // Electron prefixes errors thrown in the main process with the IPC channel.
      const message = (error instanceof Error ? error.message : 'Import failed.').replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        ''
      );
      setImportNotice({ tone: 'danger', lines: [message] });
    } finally {
      setImporting(false);
    }
  };

  const counts = useMemo(() => {
    const on =
      resume.experience.filter((e) => e.included).length +
      resume.education.filter((e) => e.included).length +
      resume.projects.filter((p) => p.included).length +
      resume.skills.filter((s) => s.included).length;
    const total =
      resume.experience.length + resume.education.length + resume.projects.length + resume.skills.length;
    return { on, total };
  }, [resume]);

  if (!loaded) return <progress className="progress is-primary" max={100} />;

  return (
    <div className="ck-page-narrow">
      <div className="level mb-4 ck-page-toolbar">
        <div className="level-left">
          <div>
            <h1 className="title is-3 mb-1">Master Resume</h1>
            <p className="subtitle is-6 has-text-grey mb-0">
              Store everything here, then choose what makes the cut — {counts.on} of {counts.total}{' '}
              entries selected.
            </p>
          </div>
        </div>
        <div className="level-right">
          <div className="buttons">
            <div className="buttons has-addons mb-0 mr-2">
              <button
                className={`button ${view === 'edit' ? 'is-primary is-selected' : ''}`}
                onClick={() => setView('edit')}
              >
                Edit
              </button>
              <button
                className={`button ${view === 'preview' ? 'is-primary is-selected' : ''}`}
                onClick={() => setView('preview')}
              >
                Preview
              </button>
            </div>
            {view === 'preview' && (
              <button className="button" onClick={() => window.print()}>
                Print / PDF
              </button>
            )}
            <button
              className={`button ${importing ? 'is-loading' : ''}`}
              title="Import a PDF, Word, or text resume and add its contents to the master resume"
              onClick={importFromFile}
              disabled={importing}
            >
              ⬆ Import Resume
            </button>
            <span className={dirty ? 'ck-unsaved-hint' : 'ck-saved-hint'}>
              {dirty ? '● Unsaved changes' : savedFlash ? '✓ Saved' : 'All changes saved'}
            </span>
            {dirty &&
              (confirmingDiscard ? (
                <>
                  <button className="button is-danger" onClick={discard}>
                    Discard all
                  </button>
                  <button className="button" onClick={() => setConfirmingDiscard(false)}>
                    Keep
                  </button>
                </>
              ) : (
                <button
                  className="button is-danger is-outlined"
                  title="Throw away all unsaved changes and go back to the last saved resume"
                  onClick={() => setConfirmingDiscard(true)}
                >
                  Discard
                </button>
              ))}
            <button className="button is-primary ck-save-button" onClick={save} disabled={!dirty}>
              Save
            </button>
          </div>
        </div>
      </div>

      <ResumeVersions />

      {importNotice && (
        <div className={`notification is-light is-${importNotice.tone} py-3`}>
          <button className="delete" onClick={() => setImportNotice(null)} />
          {importNotice.lines.map((line, i) => (
            <p key={i} className={i === 0 ? '' : 'is-size-7 has-text-grey mt-1'}>
              {i === 0 ? line : `⚠ ${line}`}
            </p>
          ))}
        </div>
      )}

      {view === 'preview' ? <ResumePreview resume={resume} /> : <ResumeEditor resume={resume} set={set} />}
    </div>
  );
}

/**
 * Folds a parsed upload into the master resume without clobbering anything:
 * contact fields only fill blanks, list entries are appended unless an
 * equivalent entry already exists. Returns human-readable notes of what was added.
 */
function mergeImportedResume(current: Resume, imported: Resume): { merged: Resume; added: string[] } {
  const merged: Resume = { ...current };
  const added: string[] = [];
  const norm = (s: string) => s.trim().toLowerCase();
  const count = (n: number, singular: string, plural = `${singular}s`) =>
    added.push(`${n} ${n === 1 ? singular : plural}`);

  let contactFilled = 0;
  for (const key of ['fullName', 'email', 'phone', 'location', 'summary'] as const) {
    if (!current[key].trim() && imported[key].trim()) {
      merged[key] = imported[key];
      contactFilled += 1;
    }
  }
  const existingLinks = new Set(current.links.map(norm));
  const newLinks = imported.links.filter((l) => !existingLinks.has(norm(l)));
  if (newLinks.length > 0) merged.links = [...current.links, ...newLinks];
  if (contactFilled + newLinks.length > 0) count(contactFilled + newLinks.length, 'contact detail');

  const existingSkills = new Set(current.skills.map((s) => norm(s.name)));
  const newSkills = imported.skills.filter((s) => s.name.trim() && !existingSkills.has(norm(s.name)));
  if (newSkills.length > 0) {
    merged.skills = [...current.skills, ...newSkills];
    count(newSkills.length, 'skill');
  }

  const expKey = (e: { company: string; title: string }) => `${norm(e.company)}|${norm(e.title)}`;
  const existingExp = new Set(current.experience.map(expKey));
  const newExp = imported.experience.filter(
    (e) => (e.company.trim() || e.title.trim()) && !existingExp.has(expKey(e))
  );
  if (newExp.length > 0) {
    merged.experience = [...current.experience, ...newExp];
    count(newExp.length, 'experience entry', 'experience entries');
  }

  const eduKey = (e: { school: string; degree: string }) => `${norm(e.school)}|${norm(e.degree)}`;
  const existingEdu = new Set(current.education.map(eduKey));
  const newEdu = imported.education.filter((e) => !existingEdu.has(eduKey(e)));
  if (newEdu.length > 0) {
    merged.education = [...current.education, ...newEdu];
    count(newEdu.length, 'education entry', 'education entries');
  }

  const existingProjects = new Set(current.projects.map((p) => norm(p.name)));
  const newProjects = imported.projects.filter((p) => !existingProjects.has(norm(p.name)));
  if (newProjects.length > 0) {
    merged.projects = [...current.projects, ...newProjects];
    count(newProjects.length, 'project');
  }

  return { merged, added };
}

/** Swaps items at `index` and `index + delta`; returns the same array when out of range. */
function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function MoveButtons({
  index,
  count,
  onMove,
  size = 'is-small',
}: {
  index: number;
  count: number;
  onMove(delta: number): void;
  size?: string;
}) {
  return (
    <div className="ck-move-buttons">
      <button
        type="button"
        className={`button ${size} is-white`}
        title="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={`button ${size} is-white`}
        title="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
    </div>
  );
}

function ResumeEditor({
  resume,
  set,
}: {
  resume: Resume;
  set<K extends keyof Resume>(key: K, value: Resume[K]): void;
}) {
  const order = resume.sectionOrder;
  const moveSection = (index: number, delta: number) =>
    set('sectionOrder', moveItem(order, index, delta));

  const sections: Record<ResumeSectionKey, { actions?: ReactNode; hint?: string; body: ReactNode }> = {
    summary: {
      actions: (
        <IncludeToggle included={resume.includeSummary} onChange={(v) => set('includeSummary', v)} />
      ),
      body: (
        <textarea
          className="textarea"
          rows={3}
          value={resume.summary}
          placeholder="A short professional summary…"
          onChange={(e) => set('summary', e.target.value)}
        />
      ),
    },
    skills: {
      hint: 'Click a skill to toggle whether it appears on the resume. Every skill in the bank still powers job-fit ranking.',
      body: <SkillBank resume={resume} set={set} />,
    },
    experience: {
      hint: 'Each entry has an On Resume toggle.',
      actions: (
        <AddButton
          onClick={() =>
            set('experience', [
              ...resume.experience,
              {
                id: crypto.randomUUID(),
                company: '',
                title: '',
                location: '',
                start: '',
                end: '',
                current: false,
                bullets: [],
                included: true,
              },
            ])
          }
        />
      ),
      body: (
        <>
          {resume.experience.map((exp, i) => (
            <ExperienceEditor
              key={exp.id}
              exp={exp}
              index={i}
              count={resume.experience.length}
              onMove={(delta) => set('experience', moveItem(resume.experience, i, delta))}
              onChange={(updated) =>
                set('experience', resume.experience.map((e, j) => (i === j ? updated : e)))
              }
              onRemove={() => set('experience', resume.experience.filter((_, j) => i !== j))}
            />
          ))}
          {resume.experience.length === 0 && <EmptyHint text="No experience entries yet." />}
        </>
      ),
    },
    education: {
      actions: (
        <AddButton
          onClick={() =>
            set('education', [
              ...resume.education,
              {
                id: crypto.randomUUID(),
                school: '',
                degree: '',
                field: '',
                start: '',
                end: '',
                included: true,
              },
            ])
          }
        />
      ),
      body: (
        <>
          {resume.education.map((edu, i) => (
            <EducationEditor
              key={edu.id}
              edu={edu}
              index={i}
              count={resume.education.length}
              onMove={(delta) => set('education', moveItem(resume.education, i, delta))}
              onChange={(updated) =>
                set('education', resume.education.map((e, j) => (i === j ? updated : e)))
              }
              onRemove={() => set('education', resume.education.filter((_, j) => i !== j))}
            />
          ))}
          {resume.education.length === 0 && <EmptyHint text="No education entries yet." />}
        </>
      ),
    },
    projects: {
      actions: (
        <AddButton
          onClick={() =>
            set('projects', [
              ...resume.projects,
              { id: crypto.randomUUID(), name: '', url: '', description: '', included: true },
            ])
          }
        />
      ),
      body: (
        <>
          {resume.projects.map((project, i) => (
            <ProjectEditor
              key={project.id}
              project={project}
              index={i}
              count={resume.projects.length}
              onMove={(delta) => set('projects', moveItem(resume.projects, i, delta))}
              onChange={(updated) =>
                set('projects', resume.projects.map((p, j) => (i === j ? updated : p)))
              }
              onRemove={() => set('projects', resume.projects.filter((_, j) => i !== j))}
            />
          ))}
          {resume.projects.length === 0 && <EmptyHint text="No projects yet." />}
        </>
      ),
    },
  };

  return (
    <>
      <div className="box">
        <h2 className="title is-5">Contact</h2>
        <div className="columns">
          <div className="column">
            <Field label="Full Name" value={resume.fullName} onChange={(v) => set('fullName', v)} />
          </div>
          <div className="column">
            <Field label="Email" value={resume.email} onChange={(v) => set('email', v)} />
          </div>
        </div>
        <div className="columns">
          <div className="column">
            <Field label="Phone" value={resume.phone} onChange={(v) => set('phone', v)} />
          </div>
          <div className="column">
            <Field label="Location" value={resume.location} onChange={(v) => set('location', v)} />
          </div>
        </div>
        <TagInput
          label="Links"
          values={resume.links}
          onChange={(v) => set('links', v)}
          placeholder="e.g. github.com/you, linkedin.com/in/you"
        />
      </div>

      {order.map((key, index) => {
        const section = sections[key];
        return (
          <div className="box" key={key}>
            <SectionHeader
              title={RESUME_SECTION_LABELS[key]}
              hint={section.hint}
              move={
                <MoveButtons index={index} count={order.length} onMove={(d) => moveSection(index, d)} />
              }
              actions={section.actions}
            />
            {section.body}
          </div>
        );
      })}
    </>
  );
}

function ResumePreview({ resume }: { resume: Resume }) {
  const skills = resume.skills.filter((s) => s.included && s.name.trim());
  const experience = resume.experience.filter((e) => e.included);
  const education = resume.education.filter((e) => e.included);
  const projects = resume.projects.filter((p) => p.included);
  const contact = [resume.location, resume.email, resume.phone, ...resume.links].filter(Boolean);

  const sections: Record<ResumeSectionKey, ReactNode | null> = {
    summary:
      resume.includeSummary && resume.summary.trim() ? (
        <section key="summary">
          <h2>Summary</h2>
          <p>{resume.summary}</p>
        </section>
      ) : null,
    skills:
      skills.length > 0 ? (
        <section key="skills">
          <h2>Skills</h2>
          <p>{skills.map((s) => s.name).join('  ·  ')}</p>
        </section>
      ) : null,
    experience:
      experience.length > 0 ? (
        <section key="experience">
          <h2>Experience</h2>
          {experience.map((exp) => (
            <div key={exp.id} className="ck-rp-entry">
              <div className="ck-rp-entry-head">
                <strong>
                  {exp.title || 'Role'}
                  {exp.company ? ` — ${exp.company}` : ''}
                </strong>
                <span>
                  {[exp.location, [exp.start, exp.current ? 'Present' : exp.end].filter(Boolean).join(' – ')]
                    .filter(Boolean)
                    .join('  ·  ')}
                </span>
              </div>
              {exp.bullets.filter((b) => b.included && b.text.trim()).length > 0 && (
                <ul>
                  {exp.bullets
                    .filter((b) => b.included && b.text.trim())
                    .map((bullet) => (
                      <li key={bullet.id}>{bullet.text}</li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ) : null,
    education:
      education.length > 0 ? (
        <section key="education">
          <h2>Education</h2>
          {education.map((edu) => (
            <div key={edu.id} className="ck-rp-entry">
              <div className="ck-rp-entry-head">
                <strong>
                  {[edu.degree, edu.field].filter(Boolean).join(' in ') || 'Degree'}
                  {edu.school ? ` — ${edu.school}` : ''}
                </strong>
                <span>{[edu.start, edu.end].filter(Boolean).join(' – ')}</span>
              </div>
            </div>
          ))}
        </section>
      ) : null,
    projects:
      projects.length > 0 ? (
        <section key="projects">
          <h2>Projects</h2>
          {projects.map((project) => (
            <div key={project.id} className="ck-rp-entry">
              <div className="ck-rp-entry-head">
                <strong>{project.name || 'Project'}</strong>
                <span>{project.url}</span>
              </div>
              {project.description.trim() && <p>{project.description}</p>}
            </div>
          ))}
        </section>
      ) : null,
  };

  return (
    <div className="ck-resume-preview">
      <header className="ck-rp-header">
        <h1>{resume.fullName || 'Your Name'}</h1>
        {contact.length > 0 && <p className="ck-rp-contact">{contact.join('  ·  ')}</p>}
      </header>
      {resume.sectionOrder.map((key) => sections[key])}
      {experience.length === 0 && education.length === 0 && projects.length === 0 && skills.length === 0 && (
        <p className="has-text-grey">
          Nothing selected yet — switch to Edit and toggle entries onto the resume.
        </p>
      )}
    </div>
  );
}

function SkillBank({
  resume,
  set,
}: {
  resume: Resume;
  set<K extends keyof Resume>(key: K, value: Resume[K]): void;
}) {
  const [draft, setDraft] = useState('');

  const addSkills = () => {
    const existing = new Set(resume.skills.map((s) => s.name.toLowerCase()));
    const added = draft
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !existing.has(p.toLowerCase()))
      .map((name) => ({ id: crypto.randomUUID(), name, included: true }));
    if (added.length > 0) set('skills', [...resume.skills, ...added]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkills();
    }
  };

  return (
    <div className="field">
      <div className="control">
        <input
          className="input"
          value={draft}
          placeholder="Type a skill and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={addSkills}
        />
      </div>
      {resume.skills.length > 0 && (
        <div className="tags mt-3">
          {resume.skills.map((skill) => (
            <span
              key={skill.id}
              className={`tag ck-skill ${skill.included ? 'ck-chip' : 'ck-chip-off'}`}
              title={skill.included ? 'On resume — click to exclude' : 'Excluded — click to include'}
              onClick={() =>
                set(
                  'skills',
                  resume.skills.map((s) =>
                    s.id === skill.id ? { ...s, included: !s.included } : s
                  )
                )
              }
            >
              {skill.included ? '✓ ' : ''}
              {skill.name}
              <button
                className="delete is-small"
                onClick={(e) => {
                  e.stopPropagation();
                  set('skills', resume.skills.filter((s) => s.id !== skill.id));
                }}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IncludeToggle({
  included,
  onChange,
}: {
  included: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <button
      className={`button is-small ck-include-toggle ${included ? 'is-primary' : ''}`}
      onClick={() => onChange(!included)}
      title="Toggle whether this appears on the generated resume"
    >
      {included ? '✓ On Resume' : 'Off Resume'}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  move,
  actions,
}: {
  title: string;
  hint?: string;
  move?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="level mb-3 ck-section-header">
      <div className="level-left">
        <div className="is-flex is-align-items-center">
          {move}
          <div>
            <h2 className="title is-5 mb-0">{title}</h2>
            {hint && <p className="is-size-7 has-text-grey mb-0">{hint}</p>}
          </div>
        </div>
      </div>
      {actions && <div className="level-right">{actions}</div>}
    </div>
  );
}

function AddButton({ onClick }: { onClick(): void }) {
  return (
    <button className="button is-small is-primary is-light" onClick={onClick}>
      + Add
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="has-text-grey is-size-7">{text}</p>;
}

function ExperienceEditor({
  exp,
  onChange,
  onRemove,
  index,
  count,
  onMove,
}: {
  exp: ResumeExperience;
  onChange(e: ResumeExperience): void;
  onRemove(): void;
  index: number;
  count: number;
  onMove(delta: number): void;
}) {
  return (
    <div className={`ck-subcard p-4 mb-4 ${exp.included ? '' : 'ck-excluded'}`}>
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
        <MoveButtons index={index} count={count} onMove={onMove} />
        <IncludeToggle included={exp.included} onChange={(v) => onChange({ ...exp, included: v })} />
      </div>
      <div className="columns">
        <div className="column">
          <Field label="Company" value={exp.company} onChange={(v) => onChange({ ...exp, company: v })} />
        </div>
        <div className="column">
          <Field label="Title" value={exp.title} onChange={(v) => onChange({ ...exp, title: v })} />
        </div>
        <div className="column">
          <Field
            label="Location"
            value={exp.location}
            onChange={(v) => onChange({ ...exp, location: v })}
          />
        </div>
      </div>
      <div className="columns is-vcentered">
        <div className="column">
          <Field
            label="Start"
            value={exp.start}
            placeholder="e.g. Jun 2021"
            onChange={(v) => onChange({ ...exp, start: v })}
          />
        </div>
        <div className="column">
          <Field
            label="End"
            value={exp.current ? '' : exp.end}
            placeholder={exp.current ? 'Present' : 'e.g. Aug 2023'}
            onChange={(v) => onChange({ ...exp, end: v })}
          />
        </div>
        <div className="column is-narrow">
          <label className="checkbox mt-5">
            <input
              type="checkbox"
              checked={exp.current}
              onChange={(e) => onChange({ ...exp, current: e.target.checked })}
            />{' '}
            Current role
          </label>
        </div>
      </div>
      <BulletEditor
        bullets={exp.bullets}
        onChange={(bullets) => onChange({ ...exp, bullets })}
      />
      <button className="button is-small is-danger is-outlined" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

/**
 * Bullet bank for one experience: keep every highlight here and toggle which
 * ones appear under the entry on the generated resume.
 */
function BulletEditor({
  bullets,
  onChange,
}: {
  bullets: ResumeBullet[];
  onChange(bullets: ResumeBullet[]): void;
}) {
  const [draft, setDraft] = useState('');

  const addBullets = () => {
    const added = draft
      .split('\n')
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ id: crypto.randomUUID(), text, included: true }));
    if (added.length > 0) onChange([...bullets, ...added]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addBullets();
    }
  };

  const update = (id: string, changes: Partial<ResumeBullet>) =>
    onChange(bullets.map((b) => (b.id === id ? { ...b, ...changes } : b)));

  return (
    <div className="field">
      <label className="label">Highlights</label>
      {bullets.length > 0 && (
        <p className="is-size-7 has-text-grey mb-2">
          Toggle which bullet points appear under this entry on the resume.
        </p>
      )}
      {bullets.map((bullet) => (
        <div key={bullet.id} className={`ck-bullet-row ${bullet.included ? '' : 'ck-bullet-off'}`}>
          <button
            className={`button is-small ck-bullet-toggle ${bullet.included ? 'is-primary' : ''}`}
            title={bullet.included ? 'On resume — click to exclude' : 'Excluded — click to include'}
            onClick={() => update(bullet.id, { included: !bullet.included })}
          >
            {bullet.included ? '✓' : '•'}
          </button>
          <input
            className="input"
            value={bullet.text}
            onChange={(e) => update(bullet.id, { text: e.target.value })}
            onBlur={() => {
              if (!bullet.text.trim()) onChange(bullets.filter((b) => b.id !== bullet.id));
            }}
          />
          <button
            className="delete"
            title="Remove this bullet"
            onClick={() => onChange(bullets.filter((b) => b.id !== bullet.id))}
          />
        </div>
      ))}
      <div className="control mt-1">
        <input
          className="input"
          value={draft}
          placeholder="Add a highlight — e.g. Shipped X, improving Y by Z% — and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={addBullets}
        />
      </div>
    </div>
  );
}

function EducationEditor({
  edu,
  onChange,
  onRemove,
  index,
  count,
  onMove,
}: {
  edu: ResumeEducation;
  onChange(e: ResumeEducation): void;
  onRemove(): void;
  index: number;
  count: number;
  onMove(delta: number): void;
}) {
  return (
    <div className={`ck-subcard p-4 mb-4 ${edu.included ? '' : 'ck-excluded'}`}>
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
        <MoveButtons index={index} count={count} onMove={onMove} />
        <IncludeToggle included={edu.included} onChange={(v) => onChange({ ...edu, included: v })} />
      </div>
      <div className="columns">
        <div className="column">
          <Field label="School" value={edu.school} onChange={(v) => onChange({ ...edu, school: v })} />
        </div>
        <div className="column">
          <Field
            label="Degree"
            value={edu.degree}
            placeholder="e.g. B.S."
            onChange={(v) => onChange({ ...edu, degree: v })}
          />
        </div>
        <div className="column">
          <Field
            label="Field of Study"
            value={edu.field}
            onChange={(v) => onChange({ ...edu, field: v })}
          />
        </div>
      </div>
      <div className="columns">
        <div className="column">
          <Field
            label="Start"
            value={edu.start}
            placeholder="e.g. 2017"
            onChange={(v) => onChange({ ...edu, start: v })}
          />
        </div>
        <div className="column">
          <Field
            label="End"
            value={edu.end}
            placeholder="e.g. 2021"
            onChange={(v) => onChange({ ...edu, end: v })}
          />
        </div>
        <div className="column is-narrow is-flex is-align-items-flex-end">
          <button className="button is-small is-danger is-outlined mb-3" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectEditor({
  project,
  onChange,
  onRemove,
  index,
  count,
  onMove,
}: {
  project: ResumeProject;
  onChange(p: ResumeProject): void;
  onRemove(): void;
  index: number;
  count: number;
  onMove(delta: number): void;
}) {
  return (
    <div className={`ck-subcard p-4 mb-4 ${project.included ? '' : 'ck-excluded'}`}>
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
        <MoveButtons index={index} count={count} onMove={onMove} />
        <IncludeToggle
          included={project.included}
          onChange={(v) => onChange({ ...project, included: v })}
        />
      </div>
      <div className="columns">
        <div className="column">
          <Field
            label="Name"
            value={project.name}
            onChange={(v) => onChange({ ...project, name: v })}
          />
        </div>
        <div className="column">
          <Field label="URL" value={project.url} onChange={(v) => onChange({ ...project, url: v })} />
        </div>
      </div>
      <div className="field">
        <label className="label">Description</label>
        <textarea
          className="textarea"
          rows={2}
          value={project.description}
          onChange={(e) => onChange({ ...project, description: e.target.value })}
        />
      </div>
      <button className="button is-small is-danger is-outlined" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
