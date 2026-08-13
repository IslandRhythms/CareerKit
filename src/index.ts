import path from 'node:path';

import { app, BrowserWindow, nativeImage } from 'electron';
import { initDb } from './main/db';
import { registerIpcHandlers } from './main/ipc';
import bundledIcon from '../icon.png';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.careerkit.app');
}

const resolveWindowIcon = () => {
  const bundledIconPath = path.isAbsolute(bundledIcon)
    ? bundledIcon
    : path.join(__dirname, bundledIcon);

  const candidates = [
    path.join(app.getAppPath(), 'icon.ico'),
    path.join(app.getAppPath(), 'icon.png'),
    bundledIconPath,
  ];

  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      return image;
    }
  }

  return undefined;
};

const createWindow = (): void => {
  const icon = resolveWindowIcon();
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.on('ready', () => {
  initDb();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
