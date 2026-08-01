import { useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES, Preferences, RemotePreference } from '../../shared/types';
import { TagInput } from '../components/TagInput';
import { LocationPicker } from '../components/LocationPicker';

const PREF_TABS = [
  { id: 'matching', label: 'Matching' },
  { id: 'location', label: 'Location & Pay' },
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

  const save = async () => {
    // Re-fetch so saving matching/location never clobbers board settings saved elsewhere.
    const current = await window.careerkit.getPreferences();
    const next: Preferences = {
      ...current,
      titles: prefs.titles,
      skills: prefs.skills,
      avoidKeywords: prefs.avoidKeywords,
      blacklistedCompanies: prefs.blacklistedCompanies,
      remote: prefs.remote,
      locations: prefs.locations,
      minSalary: prefs.minSalary,
    };
    await window.careerkit.savePreferences(next);
    setPrefs(next);
    setSavedJson(JSON.stringify(next));
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
    </div>
  );
}
