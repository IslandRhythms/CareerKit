import { ipcMain, shell } from 'electron';
import { DiscoveredJob, NewJob, Preferences, Resume } from '../shared/types';
import * as db from './db';
import { discoverJobs } from './discover';
import { importResumeFromFile } from './resumeImport';

export function registerIpcHandlers(): void {
  ipcMain.handle('jobs:list', () => db.listJobs());
  ipcMain.handle('jobs:create', (_event, job: NewJob) => db.createJob(job));
  ipcMain.handle('jobs:update', (_event, id: number, changes: Partial<NewJob>) =>
    db.updateJob(id, changes)
  );
  ipcMain.handle('jobs:delete', (_event, id: number) => db.deleteJob(id));

  ipcMain.handle('prefs:get', () => db.getPreferences());
  ipcMain.handle('prefs:save', (_event, prefs: Preferences) => db.savePreferences(prefs));

  ipcMain.handle('resume:get', () => db.getResume());
  ipcMain.handle('resume:save', (_event, resume: Resume) => db.saveResume(resume));
  ipcMain.handle('resume:import', () => importResumeFromFile());

  ipcMain.handle('discover:search', (_event, query: string) => discoverJobs(query));
  ipcMain.handle('discover:import', (_event, job: DiscoveredJob) =>
    db.createJob({
      title: job.title,
      company: job.company,
      url: job.url,
      location: job.location,
      salaryMin: null,
      salaryMax: null,
      status: 'saved',
      source: job.source,
      externalId: job.externalId,
      description: job.description,
      notes: null,
      appliedAt: null,
    })
  );

  ipcMain.handle('app:openExternal', (_event, url: string) => {
    if (/^https?:\/\//i.test(url)) {
      return shell.openExternal(url);
    }
  });
}
