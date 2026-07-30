import { contextBridge, ipcRenderer } from 'electron';
import { CareerKitApi, DiscoveredJob, NewJob, Preferences, Resume } from './shared/types';

const api: CareerKitApi = {
  listJobs: () => ipcRenderer.invoke('jobs:list'),
  createJob: (job: NewJob) => ipcRenderer.invoke('jobs:create', job),
  updateJob: (id: number, changes: Partial<NewJob>) => ipcRenderer.invoke('jobs:update', id, changes),
  deleteJob: (id: number) => ipcRenderer.invoke('jobs:delete', id),
  getPreferences: () => ipcRenderer.invoke('prefs:get'),
  savePreferences: (prefs: Preferences) => ipcRenderer.invoke('prefs:save', prefs),
  getResume: () => ipcRenderer.invoke('resume:get'),
  saveResume: (resume: Resume) => ipcRenderer.invoke('resume:save', resume),
  discoverJobs: (query: string) => ipcRenderer.invoke('discover:search', query),
  importDiscoveredJob: (job: DiscoveredJob) => ipcRenderer.invoke('discover:import', job),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
};

contextBridge.exposeInMainWorld('careerkit', api);
