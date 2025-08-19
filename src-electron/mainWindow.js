import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMainWindow() {
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
    }
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
    console.log('Page finished loading');
  });

  return win;
}

export { createMainWindow };
