import { useCallback, useEffect, useState } from 'react';
import { TrackerPage } from './pages/TrackerPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { PreferencesPage } from './pages/PreferencesPage';
import { ResumePage } from './pages/ResumePage';
import { SettingsPage } from './pages/SettingsPage';
import { applyTheme } from './theme';

type Page = 'tracker' | 'discover' | 'resume' | 'preferences' | 'settings';

const NAV_ITEMS: Array<{ id: Page; label: string }> = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'discover', label: 'Discover' },
  { id: 'resume', label: 'Resume' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'settings', label: 'Settings' },
];

interface PipelineStats {
  tracked: number;
  active: number;
  interviews: number;
  offers: number;
}

export function App() {
  const [page, setPage] = useState<Page>('tracker');
  const [stats, setStats] = useState<PipelineStats>({
    tracked: 0,
    active: 0,
    interviews: 0,
    offers: 0,
  });

  const refreshStats = useCallback(() => {
    window.careerkit.listJobs().then((jobs) =>
      setStats({
        tracked: jobs.length,
        active: jobs.filter((j) => j.status === 'applied' || j.status === 'interview').length,
        interviews: jobs.filter((j) => j.status === 'interview').length,
        offers: jobs.filter((j) => j.status === 'offer').length,
      })
    );
  }, []);

  useEffect(() => {
    window.careerkit.getPreferences().then((prefs) => applyTheme(prefs.theme));
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats, page]);

  return (
    <div className="ck-shell">
      <nav className="ck-navbar" role="navigation" aria-label="main navigation">
        <span className="ck-brand">
          CAREER<span className="ck-brand-accent">KIT</span>
        </span>
        <div className="ck-nav-tabs">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              className={`ck-nav-tab ${page === item.id ? 'ck-nav-tab-active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </a>
          ))}
        </div>
        <div className="ck-stats">
          <Stat value={stats.tracked} label="tracked" />
          <Stat value={stats.active} label="active" tone="active" />
          <Stat value={stats.interviews} label="interviews" tone="interviews" />
          <Stat value={stats.offers} label="offers" tone="offers" />
        </div>
      </nav>
      <main className="ck-content p-4">
        {page === 'tracker' && <TrackerPage onJobsChanged={refreshStats} />}
        {page === 'discover' && <DiscoverPage onJobsChanged={refreshStats} />}
        {page === 'resume' && <ResumePage />}
        {page === 'preferences' && <PreferencesPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className={`ck-stat ${tone ? `ck-stat-${tone}` : ''}`} title={label}>
      <span className="ck-stat-num">{value}</span>
      <span className="ck-stat-label">{label}</span>
    </div>
  );
}
