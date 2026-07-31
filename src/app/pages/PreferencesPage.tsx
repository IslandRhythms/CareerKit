import { useEffect, useState } from 'react';
import {
  DEFAULT_PREFERENCES,
  JobicyOptions,
  Preferences,
  RemotePreference,
} from '../../shared/types';
import { JOBICY_GEOS, JOBICY_INDUSTRIES } from '../../shared/jobicyOptions';
import { REMOTIVE_CATEGORIES } from '../../shared/remotiveOptions';
import { TagInput } from '../components/TagInput';
import { LocationPicker } from '../components/LocationPicker';

function DocLink({ label, url }: { label: string; url: string }) {
  return (
    <a className="tag is-link is-light" onClick={() => window.careerkit.openExternal(url)}>
      {label} API docs ↗
    </a>
  );
}

const PREF_TABS = [
  { id: 'matching', label: 'Matching' },
  { id: 'location', label: 'Location & Pay' },
  { id: 'boards', label: 'Job Boards' },
] as const;

type PrefTab = (typeof PREF_TABS)[number]['id'];

export function PreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedJson, setSavedJson] = useState('');
  const [tab, setTab] = useState<PrefTab>('matching');

  useEffect(() => {
    window.careerkit.getPreferences().then((p) => {
      setPrefs(p);
      setSavedJson(JSON.stringify(p));
      setLoaded(true);
    });
  }, []);

  const dirty = loaded && JSON.stringify(prefs) !== savedJson;

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const setJobicy = (changes: Partial<JobicyOptions>) =>
    setPrefs((p) => ({ ...p, jobicy: { ...p.jobicy, ...changes } }));

  const save = async () => {
    await window.careerkit.savePreferences(prefs);
    setSavedJson(JSON.stringify(prefs));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  if (!loaded) return <progress className="progress is-primary" max={100} />;

  return (
    <div className="ck-page-narrow">
      <div className="level mb-4 ck-page-toolbar">
        <div className="level-left">
          <div>
            <h1 className="title is-3 mb-1">Job Preferences</h1>
            <p className="subtitle is-6 has-text-grey mb-0">
              Discover uses these preferences (plus your resume skills) to score and rank job
              postings.
            </p>
          </div>
        </div>
        <div className="level-right">
          <div className="buttons">
            <span className={dirty ? 'ck-unsaved-hint' : 'ck-saved-hint'}>
              {dirty ? '● Unsaved changes' : savedFlash ? '✓ Saved' : 'All changes saved'}
            </span>
            <button className="button is-primary ck-save-button" onClick={save} disabled={!dirty}>
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="tabs ck-subtabs">
        <ul>
          {PREF_TABS.map((t) => (
            <li key={t.id} className={tab === t.id ? 'is-active' : ''}>
              <a onClick={() => setTab(t.id)}>{t.label}</a>
            </li>
          ))}
        </ul>
      </div>

      {tab === 'matching' && (
        <div className="box">
          <TagInput
            label="Desired Job Titles"
            values={prefs.titles}
            onChange={(v) => set('titles', v)}
            placeholder="e.g. Software Engineer, Frontend Developer"
          />
          <TagInput
            label="Skills"
            values={prefs.skills}
            onChange={(v) => set('skills', v)}
            placeholder="e.g. React, TypeScript, SQL"
            help="Postings that mention these rank higher. Your resume skills are also included automatically."
          />
          <TagInput
            label="Avoid Keywords"
            values={prefs.avoidKeywords}
            onChange={(v) => set('avoidKeywords', v)}
            placeholder="e.g. unpaid, clearance"
            help="Postings containing these are penalized in ranking."
          />
          <TagInput
            label="Company Blacklist"
            values={prefs.blacklistedCompanies}
            onChange={(v) => set('blacklistedCompanies', v)}
            placeholder="e.g. Acme Corp"
            help="Postings from these companies are flagged as blacklisted in Discover results."
          />
        </div>
      )}

      {tab === 'location' && (
        <div className="box">
          <div className="field">
            <label className="label">Work Style</label>
            <div className="select">
              <select
                value={prefs.remote}
                onChange={(e) => set('remote', e.target.value as RemotePreference)}
              >
                <option value="any">No preference</option>
                <option value="remote">Remote only</option>
                <option value="onsite">On-site / Hybrid</option>
              </select>
            </div>
          </div>
          <LocationPicker
            label="Preferred Locations"
            values={prefs.locations}
            onChange={(v) => set('locations', v)}
            help="Add a city, a state, or both — e.g. Austin, TX. Matching understands state names and abbreviations."
          />
          <div className="field">
            <label className="label">Minimum Salary (annual, USD)</label>
            <div className="control">
              <input
                type="number"
                className="input"
                style={{ maxWidth: '16rem' }}
                value={prefs.minSalary ?? ''}
                placeholder="e.g. 120000"
                onChange={(e) => set('minSalary', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'boards' && (
        <div className="box">
          <p className="is-size-7 has-text-grey mb-4">
            The remote-jobs aggregators Remotive and Jobicy are always searched. You can also follow
            specific companies' boards on Greenhouse and Lever.
          </p>
          <TagInput
            label="Greenhouse Boards"
            values={prefs.greenhouseBoards}
            onChange={(v) => set('greenhouseBoards', v)}
            placeholder="e.g. stripe, cloudflare"
            help="The board token from the careers URL: boards.greenhouse.io/⟨token⟩"
          />
          <TagInput
            label="Lever Companies"
            values={prefs.leverCompanies}
            onChange={(v) => set('leverCompanies', v)}
            placeholder="e.g. plaid"
            help="The company slug from the careers URL: jobs.lever.co/⟨company⟩"
          />

          <h3 className="title is-6 mt-5 mb-2">Remotive Search Options</h3>
          <div className="field">
            <label className="label">Category</label>
            <div className="select is-fullwidth">
              <select
                value={prefs.remotive.category}
                onChange={(e) => set('remotive', { category: e.target.value })}
              >
                <option value="">All categories</option>
                {REMOTIVE_CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="help">
              Remotive limits API usage, so its feed is cached for 6 hours. Category and keyword
              filtering happen locally on the cached feed.
            </p>
          </div>

          <h3 className="title is-6 mt-5 mb-2">Jobicy Search Options</h3>
          <div className="columns">
            <div className="column">
              <div className="field">
                <label className="label">Region</label>
                <div className="select is-fullwidth">
                  <select
                    value={prefs.jobicy.geo}
                    onChange={(e) => setJobicy({ geo: e.target.value })}
                  >
                    <option value="">Anywhere</option>
                    {JOBICY_GEOS.map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label">Industry</label>
                <div className="select is-fullwidth">
                  <select
                    value={prefs.jobicy.industry}
                    onChange={(e) => setJobicy({ industry: e.target.value })}
                  >
                    <option value="">All industries</option>
                    {JOBICY_INDUSTRIES.map((i) => (
                      <option key={i.slug} value={i.slug}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="column is-narrow">
              <div className="field">
                <label className="label">Max Results</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '7rem' }}
                  min={1}
                  max={100}
                  value={prefs.jobicy.count}
                  onChange={(e) => setJobicy({ count: Number(e.target.value) || 50 })}
                />
              </div>
            </div>
          </div>

          <h3 className="title is-6 mt-4 mb-2">API Documentation</h3>
          <div className="tags">
            <DocLink label="Greenhouse" url="https://developers.greenhouse.io/job-board.html" />
            <DocLink label="Lever" url="https://github.com/lever/postings-api" />
            <DocLink label="Remotive" url="https://github.com/remotive-com/remote-jobs-api" />
            <DocLink label="Jobicy" url="https://jobicy.com/jobs-rss-feed" />
          </div>
        </div>
      )}

    </div>
  );
}
