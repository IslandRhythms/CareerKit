import { useEffect, useRef, useState } from 'react';
import { DEFAULT_THEME, ThemeSettings } from '../../shared/types';
import { applyTheme, THEME_PRESETS } from '../theme';

export function SettingsPage() {
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedJson, setSavedJson] = useState('');
  const savedTheme = useRef<ThemeSettings | null>(null);

  useEffect(() => {
    window.careerkit.getPreferences().then((p) => {
      setThemeState(p.theme);
      savedTheme.current = p.theme;
      setSavedJson(JSON.stringify(p.theme));
      setLoaded(true);
    });
    // Leaving the page discards any un-saved live theme preview.
    return () => {
      if (savedTheme.current) applyTheme(savedTheme.current);
    };
  }, []);

  const dirty = loaded && JSON.stringify(theme) !== savedJson;

  // Theme changes apply immediately as a live preview; Save persists them.
  const setTheme = (changes: Partial<ThemeSettings>) =>
    setThemeState((t) => {
      const next = { ...t, ...changes };
      applyTheme(next);
      return next;
    });

  const save = async () => {
    // Re-fetch so saving the theme never clobbers preferences saved elsewhere.
    const prefs = await window.careerkit.getPreferences();
    await window.careerkit.savePreferences({ ...prefs, theme });
    savedTheme.current = theme;
    setSavedJson(JSON.stringify(theme));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  if (!loaded) return <progress className="progress is-primary" max={100} />;

  return (
    <div className="ck-page-narrow">
      <div className="level mb-4 ck-page-toolbar">
        <div className="level-left">
          <div>
            <h1 className="title is-3 mb-1">Settings</h1>
            <p className="subtitle is-6 has-text-grey mb-0">
              How CareerKit looks on this machine.
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

      <div className="box">
        <h2 className="title is-5">Appearance</h2>
        <div className="field">
          <label className="label">Theme Mode</label>
          <div className="buttons has-addons">
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                className={`button ${theme.mode === mode ? 'is-primary is-selected' : ''}`}
                onClick={() => setTheme({ mode })}
              >
                {mode === 'system' ? '🖥 System' : mode === 'light' ? '☀️ Light' : '🌙 Dark'}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label">Accent Color</label>
          <div className="is-flex is-align-items-center" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.color}
                className={`ck-swatch ${theme.primary.toLowerCase() === preset.color ? 'ck-swatch-active' : ''}`}
                style={{ background: preset.color }}
                title={preset.name}
                onClick={() => setTheme({ primary: preset.color })}
              />
            ))}
            <label className="ck-swatch ck-swatch-custom" title="Custom color">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(theme.primary) ? theme.primary : '#6366f1'}
                onChange={(e) => setTheme({ primary: e.target.value })}
              />
              🎨
            </label>
          </div>
          <p className="help">
            Pick a preset or choose any custom color. Changes preview instantly — Save to keep them.
          </p>
        </div>
      </div>
    </div>
  );
}
