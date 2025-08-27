import { BrowserWindow, ipcMain, dialog, app, session } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { Client } from "ssh2";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
class WindowManager {
  constructor() {
    this.windows = /* @__PURE__ */ new Map();
    this.mainWindow = null;
  }
  createMainWindow() {
    console.log("Creating main window...");
    console.log("Current working directory:", process.cwd());
    console.log("__dirname:", __dirname$1);
    const preloadPath = process.env.NODE_ENV === "development" ? path.join(__dirname$1, "preload-dev.js") : path.join(__dirname$1, "preload.js");
    console.log("Preload path:", preloadPath);
    console.log("Preload file exists:", fs.existsSync(preloadPath));
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
        // 开发模式下禁用 web 安全
        autofill: false
      },
      title: "终端管理器"
    });
    if (process.env.VITE_DEV_SERVER_URL) {
      console.log("Loading dev server URL:", process.env.VITE_DEV_SERVER_URL);
      win.loadURL(process.env.VITE_DEV_SERVER_URL);
      win.webContents.openDevTools();
      win.webContents.session.clearCache();
    } else {
      const indexPath = path.join(__dirname$1, "../dist/index.html");
      console.log("Loading file:", indexPath);
      win.loadFile(indexPath);
      win.webContents.session.clearCache();
    }
    win.webContents.once("did-finish-load", () => {
      console.log("Main window page finished loading");
    });
    win.on("closed", () => {
      this.mainWindow = null;
    });
    this.mainWindow = win;
    return win;
  }
  createSessionWindow(sessionData) {
    console.log("Creating session window for:", sessionData);
    const preloadPath = process.env.NODE_ENV === "development" ? path.join(__dirname$1, "preload-dev.js") : path.join(__dirname$1, "preload.js");
    const sessionId = sessionData.id || `session_${Date.now()}`;
    const windowTitle = sessionData.display_name || `${sessionData.host}@${sessionData.username}:${sessionData.port}`;
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
      width: 1e3,
      height: 700,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
        autofill: false
      },
      title: `终端 - ${windowTitle}`,
      icon: process.platform === "darwin" ? path.join(__dirname$1, "../public/icon.icns") : void 0
    });
    if (process.env.VITE_DEV_SERVER_URL) {
      win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/session.html`);
      win.webContents.openDevTools();
    } else {
      const sessionPath = path.join(__dirname$1, "../dist/session.html");
      win.loadFile(sessionPath);
    }
    win.webContents.once("did-finish-load", () => {
      console.log(`Session window loaded for: ${windowTitle}`);
      win.webContents.send("session-data", sessionData);
    });
    win.on("closed", () => {
      console.log(`Session window closed: ${windowTitle}`);
      this.windows.delete(sessionId);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("session-window-closed", sessionId);
      }
    });
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
const windowManager = new WindowManager();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "../../data");
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}
const databasePath = path.join(dbPath, "database.db");
const db = new Database(databasePath);
db.prepare(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,
    auth_type TEXT DEFAULT 'password',
    status TEXT DEFAULT 'disconnected',
    private_key_path TEXT DEFAULT NULL,
    passphrase TEXT DEFAULT NULL,
    display_name TEXT DEFAULT NULL
  )
`).run();
function ensureColumnExists(columnName, columnType) {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(items)").all();
    const columnExists = tableInfo.some((col) => col.name === columnName);
    if (!columnExists) {
      db.prepare(`ALTER TABLE items ADD COLUMN ${columnName} ${columnType}`).run();
      console.log(`✓ 字段 ${columnName} 添加成功`);
    }
  } catch (error) {
    console.warn(`添加字段 ${columnName} 时发生错误:`, error.message);
  }
}
ensureColumnExists("private_key_path", "TEXT DEFAULT NULL");
ensureColumnExists("passphrase", "TEXT DEFAULT NULL");
ensureColumnExists("display_name", "TEXT DEFAULT NULL");
function getAllItems() {
  return db.prepare("SELECT * FROM items").all();
}
function getItemById(host, port, username, auth_type) {
  const sql = `SELECT * 
        FROM items 
        WHERE host = ? AND port = ? AND username = ? and auth_type = ?`;
  return db.prepare(sql).get(host, port, username, auth_type);
}
function addItem(item) {
  if (getItemById(item.host, item.port, item.username, item.auth_type)) {
    console.log("update_Item---zhangmm5", item);
    updateItem(item.id, item);
    return { id: item.id };
  }
  console.log("addItem---zhangmm4", item);
  const {
    host,
    port,
    username,
    password,
    auth_type,
    private_key_path = null,
    passphrase = null,
    display_name = null
  } = item;
  const info = db.prepare(`
        INSERT INTO items (host, port, username, password, auth_type, private_key_path, passphrase, display_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(host, port || 22, username, password, auth_type || "password", private_key_path, passphrase, display_name);
  return { id: info.lastInsertRowid, ...item };
}
function deleteItem(id) {
  const info = db.prepare("DELETE FROM items WHERE id = ?").run(id);
  return info.changes > 0;
}
function updateItem(id, item) {
  console.log("updateItem 调用参数:", { id, item });
  if (!item) {
    throw new Error("item 参数不能为空");
  }
  const {
    host,
    port,
    username,
    password,
    auth_type,
    private_key_path = null,
    passphrase = null,
    display_name = null
  } = item;
  if (!host || !username) {
    throw new Error("host 和 username 是必需字段");
  }
  const info = db.prepare(`
        UPDATE items SET host = ?, port = ?, username = ?, password = ?, auth_type = ?,
        private_key_path = ?, passphrase = ?, display_name = ?
        WHERE id = ?
    `).run(
    host,
    port || 22,
    username,
    password,
    auth_type || "password",
    private_key_path,
    passphrase,
    display_name,
    id
  );
  return info.changes > 0;
}
function updateItemStatus(id, status) {
  const info = db.prepare(`UPDATE items SET status = ? WHERE id = ?`).run(status, id);
  return info.changes > 0;
}
function updateItemDisplayName(id, displayName) {
  const info = db.prepare(`UPDATE items SET display_name = ? WHERE id = ?`).run(displayName, id);
  return info.changes > 0;
}
function registerDatabaseHandlers() {
  ipcMain.handle("db-get-items", async (event) => {
    try {
      return await getAllItems();
    } catch (error) {
      console.error("db-get-items error:", error);
      return [];
    }
  });
  ipcMain.handle("db-add-item", async (event, item) => {
    try {
      return await addItem(item);
    } catch (error) {
      console.error("db-add-item error:", error);
      throw error;
    }
  });
  ipcMain.handle("db-delete-item", async (event, id) => {
    try {
      return await deleteItem(id);
    } catch (error) {
      console.error("db-delete-item error:", error);
      throw error;
    }
  });
  ipcMain.handle("db-update-item", async (event, id, item) => {
    try {
      console.log("db-update-item 调用参数:", { id, item });
      if (!item) {
        throw new Error("item 参数不能为空");
      }
      return await updateItem(id, item);
    } catch (error) {
      console.error("db-update-item error:", error);
      throw error;
    }
  });
  ipcMain.handle("db-update-item-status", async (event, id, status) => {
    try {
      return await updateItemStatus(id, status);
    } catch (error) {
      console.error("db-update-item-status error:", error);
      throw error;
    }
  });
  ipcMain.handle("db-update-item-display-name", async (event, id, displayName) => {
    try {
      return await updateItemDisplayName(id, displayName);
    } catch (error) {
      console.error("db-update-item-display-name error:", error);
      throw error;
    }
  });
}
const clients = /* @__PURE__ */ new Map();
function clientIsAlive(id) {
  const conn = clients.get(String(id));
  if (!conn) return false;
  if (conn._shellStream && typeof conn._shellStream.writable !== "undefined") {
    return !!conn._shellStream.writable;
  }
  if (conn._sock && typeof conn._sock.writable !== "undefined") {
    return !!conn._sock.writable;
  }
  return false;
}
function sendIPC(client, channel, ...args) {
  const target = client._sender;
  if (target?.send) {
    target.send(channel, ...args);
  } else {
    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.webContents.send(channel, ...args);
      } catch {
      }
    });
  }
}
function updateStatus(client, id, config, status) {
  sendIPC(client, `ssh-status:${id}`, status, config);
}
async function createSSHClient(id, config, event) {
  id = String(id);
  console.log("createSSHClient 开始连接，配置信息:", {
    id,
    host: config.host,
    port: config.port,
    username: config.username,
    auth_type: config.auth_type,
    hasPassword: !!config.password,
    hasPrivateKeyPath: !!config.private_key_path
  });
  if (clientIsAlive(id)) return { success: true, message: "已连接" };
  const sshClient = new Client();
  clients.set(id, sshClient);
  sshClient._sender = event?.sender || null;
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (success, message) => {
      console.log("SSH连接结束:", { success, message, id });
      if (!resolved) {
        resolved = true;
        resolve({ success, message });
      }
    };
    sshClient.on("ready", () => {
      console.log("SSH客户端ready事件触发, id:", id);
      sshClient.shell((err, stream) => {
        if (err) {
          console.error("创建shell失败:", err);
          updateStatus(sshClient, id, config, "error");
          return finish(false, err.message);
        }
        console.log("Shell创建成功, id:", id);
        sshClient._shellStream = stream;
        stream.on("data", (data) => {
          const text = data.toString();
          console.log(`[SSH Output ${id}] 收到数据:`, text.substring(0, 100) + (text.length > 100 ? "..." : ""));
          sendIPC(sshClient, `ssh-output:${id}`, text);
        });
        stream.on("close", () => {
          console.log("Shell stream关闭, id:", id);
          updateStatus(sshClient, id, config, "disconnected");
          sendIPC(sshClient, `ssh-disconnect:${id}`);
        });
        stream.on("error", (err2) => {
          console.error("Shell stream错误, id:", id, err2);
          updateStatus(sshClient, id, config, "error");
        });
        updateStatus(sshClient, id, config, "connected");
        setTimeout(() => {
          console.log(`[SSH ${id}] 发送初始命令: whoami`);
          stream.write("whoami\n");
        }, 1e3);
        finish(true, "连接成功");
      });
    });
    sshClient.on("error", (err) => {
      console.error("SSH连接错误详情:", {
        message: err.message,
        code: err.code,
        level: err.level,
        description: err.description
      });
      if (err.message === "All configured authentication methods failed") {
        console.error("认证失败详细分析:", {
          config_auth_type: config.auth_type,
          has_password: !!config.password,
          has_private_key_path: !!config.private_key_path,
          private_key_path_value: config.private_key_path,
          has_passphrase: !!config.passphrase,
          connectConfig_keys: Object.keys(connectConfig),
          has_connectConfig_password: !!connectConfig.password,
          has_connectConfig_privateKey: !!connectConfig.privateKey,
          privateKey_length: connectConfig.privateKey ? connectConfig.privateKey.length : 0
        });
        if (connectConfig.privateKey) {
          const keyStart = connectConfig.privateKey.substring(0, 100);
          console.log("私钥开头内容检查:", keyStart);
          if (!keyStart.includes("BEGIN") || !keyStart.includes("PRIVATE KEY")) {
            console.error("私钥格式可能不正确，应该包含 BEGIN...PRIVATE KEY");
          }
        }
      }
      updateStatus(sshClient, id, config, "error");
      finish(false, err.message);
    });
    sshClient.on("close", () => {
      console.log("SSH连接关闭, id:", id);
      updateStatus(sshClient, id, config, "disconnected");
      clients.delete(id);
    });
    const connectConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      keepaliveInterval: 3e4,
      // 30秒心跳
      keepaliveCountMax: 3,
      // 最大重试次数
      readyTimeout: 2e4
      // 20秒连接超时
    };
    console.log("基础连接配置:", connectConfig);
    if (config.auth_type === "privatekey" && config.private_key_path != null) {
      console.log("使用私钥认证，私钥路径:", config.private_key_path);
      try {
        connectConfig.privateKey = fs.readFileSync(config.private_key_path, "utf8");
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase;
        }
      } catch (error) {
        console.error("读取私钥文件失败:", error);
        return finish(false, `读取私钥文件失败: ${error.message}`);
      }
    } else {
      console.log("使用密码认证");
      if (!config.password) {
        console.error("密码为空");
        return finish(false, "密码不能为空");
      }
      connectConfig.password = config.password;
    }
    console.log("最终连接配置 (隐藏敏感信息):", {
      host: connectConfig.host,
      port: connectConfig.port,
      username: connectConfig.username,
      hasPassword: !!connectConfig.password,
      hasPrivateKey: !!connectConfig.privateKey,
      hasPassphrase: !!connectConfig.passphrase,
      privateKeyType: connectConfig.privateKey ? connectConfig.privateKey.includes("RSA") ? "RSA" : connectConfig.privateKey.includes("ECDSA") ? "ECDSA" : connectConfig.privateKey.includes("ED25519") ? "ED25519" : "Unknown" : "None"
    });
    console.log("开始SSH连接...");
    sshClient.connect(connectConfig);
  });
}
function sendCommand(id, command) {
  id = String(id);
  const sshClient = clients.get(id);
  if (!sshClient?._shellStream) return { success: false, message: "未建立连接" };
  try {
    const payload = typeof command === "string" ? command.replace(/\r/g, "\n") : String(command);
    sshClient._shellStream.write(Buffer.from(payload, "utf8"));
    return { success: true };
  } catch (e) {
    console.error("sshManager.sendCommand failed:", e);
    return { success: false, message: e.message };
  }
}
function disconnectSSH(id) {
  id = String(id);
  const sshClient = clients.get(id);
  if (!sshClient) return { success: false, message: "没有活动的连接" };
  sshClient.end();
  clients.delete(id);
  return { success: true, message: "连接已断开" };
}
function registerSSHHandlers() {
  ipcMain.handle("ssh-connect", async (event, id, config) => {
    try {
      console.log("ssh-connect handler 接收到的参数:", {
        id,
        config: JSON.stringify(config, null, 2)
      });
      console.log("config对象的所有键:", Object.keys(config));
      return await createSSHClient(id, config, event);
    } catch (error) {
      console.error("ssh-connect error:", error);
      return { success: false, message: error.message };
    }
  });
  ipcMain.handle("ssh-send", async (event, id, command) => {
    try {
      return await sendCommand(id, command);
    } catch (error) {
      console.error("ssh-send error:", error);
      throw error;
    }
  });
  ipcMain.handle("ssh-disconnect", async (event, id) => {
    try {
      return await disconnectSSH(id);
    } catch (error) {
      console.error("ssh-disconnect error:", error);
      throw error;
    }
  });
  ipcMain.handle("ssh-alive", async (event, id) => {
    try {
      return await clientIsAlive(id);
    } catch (error) {
      console.error("ssh-alive error:", error);
      return false;
    }
  });
}
function registerDialogHandlers() {
  ipcMain.handle("dialog:showOpenDialog", async (event, options) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      return await dialog.showOpenDialog(focusedWindow, options);
    } catch (error) {
      console.error("showOpenDialog error:", error);
      return { canceled: true, filePaths: [] };
    }
  });
  ipcMain.handle("dialog:showSaveDialog", async (event, options) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      return await dialog.showSaveDialog(focusedWindow, options);
    } catch (error) {
      console.error("showSaveDialog error:", error);
      return { canceled: true, filePath: "" };
    }
  });
  ipcMain.handle("dialog:showMessageBox", async (event, options) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      return await dialog.showMessageBox(focusedWindow, options);
    } catch (error) {
      console.error("showMessageBox error:", error);
      return { response: 0, checkboxChecked: false };
    }
  });
}
function registerWindowHandlers() {
  console.log("Registering window handlers...");
  ipcMain.handle("window-create-session", async (event, sessionData) => {
    try {
      console.log("Creating session window:", sessionData);
      const window = windowManager.createSessionWindow(sessionData);
      return { success: true, windowId: window.id };
    } catch (error) {
      console.error("Failed to create session window:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("window-close-session", async (event, sessionId) => {
    try {
      windowManager.closeSessionWindow(sessionId);
      return { success: true };
    } catch (error) {
      console.error("Failed to close session window:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("window-get-session-status", async (event, sessionId) => {
    try {
      const window = windowManager.getSessionWindow(sessionId);
      const isOpen = window && !window.isDestroyed();
      return { success: true, isOpen };
    } catch (error) {
      console.error("Failed to get session window status:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("window-focus-session", async (event, sessionId) => {
    try {
      const window = windowManager.getSessionWindow(sessionId);
      if (window && !window.isDestroyed()) {
        window.focus();
        return { success: true };
      }
      return { success: false, error: "Window not found" };
    } catch (error) {
      console.error("Failed to focus session window:", error);
      return { success: false, error: error.message };
    }
  });
  console.log("✓ Window handlers registered");
}
function registerIPCHandlers() {
  console.log("Registering IPC handlers...");
  try {
    registerDatabaseHandlers();
    console.log("✓ Database handlers registered");
    registerSSHHandlers();
    console.log("✓ SSH handlers registered");
    registerDialogHandlers();
    console.log("✓ Dialog handlers registered");
    registerWindowHandlers();
    console.log("✓ Window handlers registered");
    console.log("🚀 All IPC handlers registered successfully");
  } catch (error) {
    console.error("❌ Error registering IPC handlers:", error);
    throw error;
  }
}
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
app.whenReady().then(() => {
  if (process.env.NODE_ENV === "development") {
    session.defaultSession.clearCache();
  }
  windowManager.createMainWindow();
  registerIPCHandlers();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    }
  });
});
app.on("window-all-closed", () => {
  session.defaultSession.clearCache();
  windowManager.closeAllSessionWindows();
  if (process.platform !== "darwin") app.quit();
});
