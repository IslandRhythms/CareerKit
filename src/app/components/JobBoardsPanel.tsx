import { useEffect, useState } from 'react';
import {
  DEFAULT_PREFERENCES,
  JobicyOptions,
  Preferences,
} from '../../shared/types';
import { JOBICY_GEOS, JOBICY_INDUSTRIES } from '../../shared/jobicyOptions';
import { REMOTIVE_CATEGORIES } from '../../shared/remotiveOptions';
import { TagInput } from './TagInput';

function DocLink({ label, url }: { label: string; url: string }) {
  return (
    <a className="tag is-link is-light" onClick={() => window.careerkit.openExternal(url)}>
      {label} API docs ↗
    </a>
  );
}

type BoardPrefs = Pick<
  Preferences,
  'greenhouseBoards' | 'leverCompanies' | 'jobicy' | 'remotive'
>;

const DEFAULT_BOARD_PREFS: BoardPrefs = {
  greenhouseBoards: DEFAULT_PREFERENCES.greenhouseBoards,
  leverCompanies: DEFAULT_PREFERENCES.leverCompanies,
  jobicy: DEFAULT_PREFERENCES.jobicy,
  remotive: DEFAULT_PREFERENCES.remotive,
};

const BOARD_TABS = [
  { id: 'greenhouse', label: 'Greenhouse' },
  { id: 'lever', label: 'Lever' },
  { id: 'remotive', label: 'Remotive' },
  { id: 'jobicy', label: 'Jobicy' },
] as const;

type BoardTab = (typeof BOARD_TABS)[number]['id'];

function remotiveCategoryLabel(slug: string): string {
  if (!slug) return 'All categories';
  return REMOTIVE_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

function jobicyGeoLabel(slug: string): string {
  if (!slug) return 'Anywhere';
  return JOBICY_GEOS.find((g) => g.slug === slug)?.label ?? slug;
}

function jobicyIndustryLabel(slug: string): string {
  if (!slug) return 'All industries';
  return JOBICY_INDUSTRIES.find((i) => i.slug === slug)?.label ?? slug;
}

function boardTabHint(id: BoardTab, prefs: BoardPrefs): string {
  switch (id) {
    case 'greenhouse':
      return prefs.greenhouseBoards.length ? prefs.greenhouseBoards.join(', ') : 'None';
    case 'lever':
      return prefs.leverCompanies.length ? prefs.leverCompanies.join(', ') : 'None';
    case 'remotive':
      return remotiveCategoryLabel(prefs.remotive.category);
    case 'jobicy': {
      const parts = [
        jobicyGeoLabel(prefs.jobicy.geo),
        jobicyIndustryLabel(prefs.jobicy.industry),
        `${prefs.jobicy.count} max`,
      ];
      return parts.join(' · ');
    }
  }
}

export function JobBoardsPanel({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<BoardTab>('greenhouse');
  const [prefs, setPrefs] = useState<BoardPrefs>(DEFAULT_BOARD_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedJson, setSavedJson] = useState('');

  useEffect(() => {
    window.careerkit.getPreferences().then((p) => {
      const boards: BoardPrefs = {
        greenhouseBoards: p.greenhouseBoards,
        leverCompanies: p.leverCompanies,
        jobicy: p.jobicy,
        remotive: p.remotive,
      };
      setPrefs(boards);
      setSavedJson(JSON.stringify(boards));
      setLoaded(true);
    });
  }, []);

  const dirty = loaded && JSON.stringify(prefs) !== savedJson;

  const set = <K extends keyof BoardPrefs>(key: K, value: BoardPrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const setJobicy = (changes: Partial<JobicyOptions>) =>
    setPrefs((p) => ({ ...p, jobicy: { ...p.jobicy, ...changes } }));

  const save = async () => {
    const current = await window.careerkit.getPreferences();
    await window.careerkit.savePreferences({ ...current, ...prefs });
    setSavedJson(JSON.stringify(prefs));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    onSaved?.();
  };

  const summary = loaded
    ? BOARD_TABS.map((t) => `${t.label}: ${boardTabHint(t.id, prefs)}`).join(' · ')
    : '';

  return (
    <div className={`ck-collapse ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="ck-collapse-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="ck-collapse-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
        <span className="ck-collapse-title">Job Boards</span>
        {!open && summary && <span className="ck-collapse-summary">{summary}</span>}
        {dirty && !open && <span className="ck-unsaved-hint">● Unsaved</span>}
      </button>

      {open && (
        <div className="ck-collapse-body">
          {!loaded ? (
            <progress className="progress is-primary" max={100} />
          ) : (
            <>
              <div className="level mb-3 ck-collapse-toolbar">
                <div className="level-left">
                  <p className="is-size-7 has-text-grey mb-0">
                    Remotive and Jobicy are always searched. Add Greenhouse boards and Lever
                    companies to follow specific careers pages.
                  </p>
                </div>
                <div className="level-right">
                  <div className="buttons mb-0">
                    <span className={dirty ? 'ck-unsaved-hint' : 'ck-saved-hint'}>
                      {dirty ? '● Unsaved changes' : savedFlash ? '✓ Saved' : 'All changes saved'}
                    </span>
                    <button
                      className="button is-primary is-small ck-save-button"
                      onClick={save}
                      disabled={!dirty}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              <div className="tabs ck-subtabs ck-board-tabs mb-3">
                <ul>
                  {BOARD_TABS.map((t) => {
                    const hint = boardTabHint(t.id, prefs);
                    return (
                      <li key={t.id} className={tab === t.id ? 'is-active' : ''}>
                        <a onClick={() => setTab(t.id)}>
                          <span className="ck-board-tab-label">{t.label}</span>
                          <span className="ck-board-tab-hint" title={hint}>
                            {hint}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {tab === 'greenhouse' && (
                <div>
                  <TagInput
                    label="Greenhouse Boards"
                    values={prefs.greenhouseBoards}
                    onChange={(v) => set('greenhouseBoards', v)}
                    placeholder="e.g. stripe, cloudflare"
                    help="The board token from the careers URL: boards.greenhouse.io/⟨token⟩"
                  />
                  <DocLink
                    label="Greenhouse"
                    url="https://developers.greenhouse.io/job-board.html"
                  />
                </div>
              )}

              {tab === 'lever' && (
                <div>
                  <TagInput
                    label="Lever Companies"
                    values={prefs.leverCompanies}
                    onChange={(v) => set('leverCompanies', v)}
                    placeholder="e.g. plaid"
                    help="The company slug from the careers URL: jobs.lever.co/⟨company⟩"
                  />
                  <DocLink label="Lever" url="https://github.com/lever/postings-api" />
                </div>
              )}

              {tab === 'remotive' && (
                <div>
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
                      Remotive limits API usage, so its feed is cached for 6 hours. Category and
                      keyword filtering happen locally on the cached feed.
                    </p>
                  </div>
                  <DocLink
                    label="Remotive"
                    url="https://github.com/remotive-com/remote-jobs-api"
                  />
                </div>
              )}

              {tab === 'jobicy' && (
                <div>
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
                  <DocLink label="Jobicy" url="https://jobicy.com/jobs-rss-feed" />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
