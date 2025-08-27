import { app, session, BrowserWindow } from 'electron';
import { windowManager } from './windowManager.js';
import { registerIPCHandlers } from './handlers/ipcHandlers.js';

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

app.whenReady().then(() => {
  if (process.env.NODE_ENV === 'development') {
    // 清缓存
    session.defaultSession.clearCache();
  }

  const mainWindow = windowManager.createMainWindow();
  registerIPCHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  session.defaultSession.clearCache();
  windowManager.closeAllSessionWindows();

  if (process.platform !== 'darwin') app.quit();
});
