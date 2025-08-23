import { BrowserWindow, ipcMain, dialog, app, session } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { Client } from "ssh2";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
function createMainWindow() {
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
    }
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
    console.log("Page finished loading");
  });
  return win;
}
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
    status TEXT DEFAULT 'disconnected'
  )
`).run();
function getAllItems() {
  return db.prepare("SELECT * FROM items").all();
}
function getItemById(host, port, username) {
  const sql = `SELECT * 
        FROM items 
        WHERE host = ? AND port = ? AND username = ?`;
  return db.prepare(sql).get(host, port, username);
}
function addItem(item) {
  if (getItemById(item.host, item.port, item.username)) {
    console.log("update_Item---zhangmm5", item);
    updateItem(item.id, item);
    return { id: item.id };
  }
  console.log("addItem---zhangmm4", item);
  const { host, port, username, password, auth_type } = item;
  const info = db.prepare(`
        INSERT INTO items (host, port, username, password, auth_type)
        VALUES (?, ?, ?, ?, ?)
    `).run(host, port || 22, username, password, auth_type || "password");
  return { id: info.lastInsertRowid, ...item };
}
function deleteItem(id) {
  const info = db.prepare("DELETE FROM items WHERE id = ?").run(id);
  return info.changes > 0;
}
function updateItem(id, item) {
  const { host, port, username, password, auth_type } = item;
  const info = db.prepare(`
        UPDATE items SET host = ?, port = ?, username = ?, password = ?, auth_type = ?
        WHERE id = ?
    `).run(host, port || 22, username, password, auth_type || "password", id);
  return info.changes > 0;
}
function updateItemStatus(id, status) {
  const info = db.prepare(`UPDATE items SET status = ? WHERE id = ?`).run(status, id);
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
    const { BrowserWindow: BrowserWindow2 } = require("electron");
    BrowserWindow2.getAllWindows().forEach((w) => {
      try {
        w.webContents.send(channel, ...args);
      } catch {
      }
    });
  }
}
function updateStatus(client, id, config, status) {
  sendIPC(client, `ssh-status:${id}`, status, config);
  sendIPC(client, "ssh-status-global", id, status, config);
}
async function createSSHClient(id, config, event) {
  id = String(id);
  if (clientIsAlive(id)) return { success: true, message: "已连接" };
  const sshClient = new Client();
  clients.set(id, sshClient);
  sshClient._sender = event?.sender || null;
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (success, message) => {
      if (!resolved) {
        resolved = true;
        resolve({ success, message });
      }
    };
    sshClient.on("ready", () => {
      sshClient.shell((err, stream) => {
        if (err) {
          updateStatus(sshClient, id, config, "error");
          return finish(false, err.message);
        }
        sshClient._shellStream = stream;
        stream.on("data", (data) => {
          const text = data.toString();
          sendIPC(sshClient, `ssh-output:${id}`, text);
          sendIPC(sshClient, "ssh-output-global", id, text);
        });
        stream.on("close", () => updateStatus(sshClient, id, config, "disconnected"));
        updateStatus(sshClient, id, config, "connected");
        finish(true, "连接成功");
      });
    });
    sshClient.on("error", (err) => {
      updateStatus(sshClient, id, config, "error");
      finish(false, err.message);
    });
    sshClient.on("close", () => {
      updateStatus(sshClient, id, config, "disconnected");
      clients.delete(id);
    });
    sshClient.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password
    });
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
function registerIPCHandlers() {
  console.log("Registering IPC handlers...");
  try {
    registerDatabaseHandlers();
    console.log("✓ Database handlers registered");
    registerSSHHandlers();
    console.log("✓ SSH handlers registered");
    registerDialogHandlers();
    console.log("✓ Dialog handlers registered");
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
  createMainWindow();
  registerIPCHandlers();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
app.on("window-all-closed", () => {
  session.defaultSession.clearCache();
  if (process.platform !== "darwin") app.quit();
});
