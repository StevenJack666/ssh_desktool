import { app, session, BrowserWindow } from 'electron';
import { createMainWindow } from './mainWindow.js';
import { registerIPCHandlers } from './handlers/ipcHandlers.js';

let mainWindow = null;

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

app.whenReady().then(() => {
  if (process.env.NODE_ENV === 'development') {
    // 清缓存
    session.defaultSession.clearCache();
  }

  mainWindow = createMainWindow();
  registerIPCHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  session.defaultSession.clearCache();

  if (process.platform !== 'darwin') app.quit();
});
