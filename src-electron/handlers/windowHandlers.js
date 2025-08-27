import { ipcMain } from 'electron';
import { windowManager } from '../windowManager.js';

export function registerWindowHandlers() {
  console.log('Registering window handlers...');

  // 创建新的会话窗口
  ipcMain.handle('window-create-session', async (event, sessionData) => {
    try {
      console.log('Creating session window:', sessionData);
      const window = windowManager.createSessionWindow(sessionData);
      return { success: true, windowId: window.id };
    } catch (error) {
      console.error('Failed to create session window:', error);
      return { success: false, error: error.message };
    }
  });

  // 关闭会话窗口
  ipcMain.handle('window-close-session', async (event, sessionId) => {
    try {
      windowManager.closeSessionWindow(sessionId);
      return { success: true };
    } catch (error) {
      console.error('Failed to close session window:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取会话窗口状态
  ipcMain.handle('window-get-session-status', async (event, sessionId) => {
    try {
      const window = windowManager.getSessionWindow(sessionId);
      const isOpen = window && !window.isDestroyed();
      return { success: true, isOpen };
    } catch (error) {
      console.error('Failed to get session window status:', error);
      return { success: false, error: error.message };
    }
  });

  // 聚焦到会话窗口
  ipcMain.handle('window-focus-session', async (event, sessionId) => {
    try {
      const window = windowManager.getSessionWindow(sessionId);
      if (window && !window.isDestroyed()) {
        window.focus();
        return { success: true };
      }
      return { success: false, error: 'Window not found' };
    } catch (error) {
      console.error('Failed to focus session window:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✓ Window handlers registered');
}
