import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_RESUME,
  Resume,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
} from '../../shared/types';
import { TagInput } from '../components/TagInput';

export function ResumePage() {
  const [resume, setResume] = useState<Resume>(DEFAULT_RESUME);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    window.careerkit.getResume().then((r) => {
      setResume(r);
      setLoaded(true);
    });
  }, []);

  const set = <K extends keyof Resume>(key: K, value: Resume[K]) =>
    setResume((r) => ({ ...r, [key]: value }));

  const save = async () => {
    await window.careerkit.saveResume(resume);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
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
      <div className="level mb-4 ck-resume-toolbar">
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
            <button className="button is-primary" onClick={save}>
              Save
            </button>
            {savedFlash && <span className="ml-2 has-text-success">✓ Saved</span>}
          </div>
        </div>
      </div>

      {view === 'preview' ? <ResumePreview resume={resume} /> : <ResumeEditor resume={resume} set={set} />}
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

      <div className="box">
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
          <h2 className="title is-5 mb-0">Summary</h2>
          <IncludeToggle
            included={resume.includeSummary}
            onChange={(v) => set('includeSummary', v)}
          />
        </div>
        <textarea
          className="textarea"
          rows={3}
          value={resume.summary}
          placeholder="A short professional summary…"
          onChange={(e) => set('summary', e.target.value)}
        />
      </div>

      <div className="box">
        <h2 className="title is-5 mb-1">Skills</h2>
        <p className="is-size-7 has-text-grey mb-3">
          Click a skill to toggle whether it appears on the resume. Every skill in the bank still
          powers job-fit ranking.
        </p>
        <SkillBank resume={resume} set={set} />
      </div>

      <div className="box">
        <SectionHeader
          title="Experience"
          hint="Each entry has an On Resume toggle."
          onAdd={() =>
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
        {resume.experience.map((exp, i) => (
          <ExperienceEditor
            key={exp.id}
            exp={exp}
            onChange={(updated) =>
              set('experience', resume.experience.map((e, j) => (i === j ? updated : e)))
            }
            onRemove={() => set('experience', resume.experience.filter((_, j) => i !== j))}
          />
        ))}
        {resume.experience.length === 0 && <EmptyHint text="No experience entries yet." />}
      </div>

      <div className="box">
        <SectionHeader
          title="Education"
          onAdd={() =>
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
        {resume.education.map((edu, i) => (
          <EducationEditor
            key={edu.id}
            edu={edu}
            onChange={(updated) =>
              set('education', resume.education.map((e, j) => (i === j ? updated : e)))
            }
            onRemove={() => set('education', resume.education.filter((_, j) => i !== j))}
          />
        ))}
        {resume.education.length === 0 && <EmptyHint text="No education entries yet." />}
      </div>

      <div className="box">
        <SectionHeader
          title="Projects"
          onAdd={() =>
            set('projects', [
              ...resume.projects,
              { id: crypto.randomUUID(), name: '', url: '', description: '', included: true },
            ])
          }
        />
        {resume.projects.map((project, i) => (
          <ProjectEditor
            key={project.id}
            project={project}
            onChange={(updated) =>
              set('projects', resume.projects.map((p, j) => (i === j ? updated : p)))
            }
            onRemove={() => set('projects', resume.projects.filter((_, j) => i !== j))}
          />
        ))}
        {resume.projects.length === 0 && <EmptyHint text="No projects yet." />}
      </div>
    </>
  );
}

function ResumePreview({ resume }: { resume: Resume }) {
  const skills = resume.skills.filter((s) => s.included && s.name.trim());
  const experience = resume.experience.filter((e) => e.included);
  const education = resume.education.filter((e) => e.included);
  const projects = resume.projects.filter((p) => p.included);
  const contact = [resume.location, resume.email, resume.phone, ...resume.links].filter(Boolean);

  return (
    <div className="ck-resume-preview">
      <header className="ck-rp-header">
        <h1>{resume.fullName || 'Your Name'}</h1>
        {contact.length > 0 && <p className="ck-rp-contact">{contact.join('  ·  ')}</p>}
      </header>
      {resume.includeSummary && resume.summary.trim() && (
        <section>
          <h2>Summary</h2>
          <p>{resume.summary}</p>
        </section>
      )}
      {skills.length > 0 && (
        <section>
          <h2>Skills</h2>
          <p>{skills.map((s) => s.name).join('  ·  ')}</p>
        </section>
      )}
      {experience.length > 0 && (
        <section>
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
              {exp.bullets.filter((b) => b.trim()).length > 0 && (
                <ul>
                  {exp.bullets
                    .filter((b) => b.trim())
                    .map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
      {education.length > 0 && (
        <section>
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
      )}
      {projects.length > 0 && (
        <section>
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
      )}
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

function SectionHeader({ title, hint, onAdd }: { title: string; hint?: string; onAdd(): void }) {
  return (
    <div className="level mb-3">
      <div className="level-left">
        <div>
          <h2 className="title is-5 mb-0">{title}</h2>
          {hint && <p className="is-size-7 has-text-grey mb-0">{hint}</p>}
        </div>
      </div>
      <div className="level-right">
        <button className="button is-small is-primary is-light" onClick={onAdd}>
          + Add
        </button>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="has-text-grey is-size-7">{text}</p>;
}

function ExperienceEditor({
  exp,
  onChange,
  onRemove,
}: {
  exp: ResumeExperience;
  onChange(e: ResumeExperience): void;
  onRemove(): void;
}) {
  return (
    <div className={`ck-subcard p-4 mb-4 ${exp.included ? '' : 'ck-excluded'}`}>
      <div className="is-flex is-justify-content-flex-end mb-2">
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
      <div className="field">
        <label className="label">Highlights (one per line)</label>
        <textarea
          className="textarea"
          rows={4}
          value={exp.bullets.join('\n')}
          placeholder={'Shipped X, improving Y by Z%\nLed a team of…'}
          onChange={(e) => onChange({ ...exp, bullets: e.target.value.split('\n') })}
          onBlur={(e) =>
            onChange({ ...exp, bullets: e.target.value.split('\n').filter((b) => b.trim()) })
          }
        />
      </div>
      <button className="button is-small is-danger is-outlined" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

function EducationEditor({
  edu,
  onChange,
  onRemove,
}: {
  edu: ResumeEducation;
  onChange(e: ResumeEducation): void;
  onRemove(): void;
}) {
  return (
    <div className={`ck-subcard p-4 mb-4 ${edu.included ? '' : 'ck-excluded'}`}>
      <div className="is-flex is-justify-content-flex-end mb-2">
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
}: {
  project: ResumeProject;
  onChange(p: ResumeProject): void;
  onRemove(): void;
}) {
  return (
    <div className={`ck-subcard p-4 mb-4 ${project.included ? '' : 'ck-excluded'}`}>
      <div className="is-flex is-justify-content-flex-end mb-2">
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
