import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WindowManager {
  constructor() {
    this.windows = new Map(); // 存储所有窗口，key是sessionId，value是窗口对象
    this.mainWindow = null;
  }

  createMainWindow() {
    console.log('Creating main window...');
    console.log('Current working directory:', process.cwd());
    console.log('__dirname:', __dirname);
    
    // 在开发模式下使用 CommonJS 格式的 preload 脚本
    const preloadPath = process.env.NODE_ENV === 'development' 
      ? path.join(__dirname, 'preload-dev.js')  // 使用专门的开发版preload
      : path.join(__dirname, 'preload.js');
      
    console.log('Preload path:', preloadPath);
    console.log('Preload file exists:', fs.existsSync(preloadPath));
    
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,  // 开发模式下禁用 web 安全
        autofill: false,
      },
      title: '终端管理器'
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      console.log('Loading dev server URL:', process.env.VITE_DEV_SERVER_URL);
      win.loadURL(process.env.VITE_DEV_SERVER_URL);
      win.webContents.openDevTools();
      win.webContents.session.clearCache();
    } else {
      const indexPath = path.join(__dirname, '../dist/index.html');
      console.log('Loading file:', indexPath);
      win.loadFile(indexPath);
      win.webContents.session.clearCache();
    }

    // 监听页面加载完成
    win.webContents.once('did-finish-load', () => {
      console.log('Main window page finished loading');
    });

    // 监听窗口关闭
    win.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow = win;
    return win;
  }

  createSessionWindow(sessionData) {
    console.log('Creating session window for:', sessionData);
    
    const preloadPath = process.env.NODE_ENV === 'development' 
      ? path.join(__dirname, 'preload-dev.js')
      : path.join(__dirname, 'preload.js');
    
    const sessionId = sessionData.id || `session_${Date.now()}`;
    const windowTitle = sessionData.display_name || `${sessionData.host}@${sessionData.username}:${sessionData.port}`;
    
    // 检查是否已经有该会话的窗口
    if (this.windows.has(sessionId)) {
      const existingWindow = this.windows.get(sessionId);
      if (!existingWindow.isDestroyed()) {
        existingWindow.focus();
        return existingWindow;
      } else {
        this.windows.delete(sessionId);
      }
    }

    const win = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
        autofill: false
      },
      title: `终端 - ${windowTitle}`,
      icon: process.platform === 'darwin' ? path.join(__dirname, '../public/icon.icns') : undefined
    });

    // 加载会话专用页面
    if (process.env.VITE_DEV_SERVER_URL) {
      // 开发模式：加载开发服务器URL，但传递会话参数
      win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/session.html`);
      win.webContents.openDevTools();
    } else {
      // 生产模式：加载会话页面
      const sessionPath = path.join(__dirname, '../dist/session.html');
      win.loadFile(sessionPath);
    }

    // 窗口创建后发送会话数据
    win.webContents.once('did-finish-load', () => {
      console.log(`Session window loaded for: ${windowTitle}`);
      // 发送会话数据到渲染进程
      win.webContents.send('session-data', sessionData);
    });

    // 监听窗口关闭
    win.on('closed', () => {
      console.log(`Session window closed: ${windowTitle}`);
      this.windows.delete(sessionId);
      
      // 通知主窗口该会话已关闭
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('session-window-closed', sessionId);
      }
    });

    // 存储窗口引用
    this.windows.set(sessionId, win);
    
    return win;
  }

  getSessionWindow(sessionId) {
    return this.windows.get(sessionId);
  }

  getAllSessionWindows() {
    return Array.from(this.windows.values());
  }

  closeSessionWindow(sessionId) {
    const window = this.windows.get(sessionId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  closeAllSessionWindows() {
    for (const [sessionId, window] of this.windows) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.windows.clear();
  }

  getMainWindow() {
    return this.mainWindow;
  }
}

// 导出单例
export const windowManager = new WindowManager();
export { WindowManager };
