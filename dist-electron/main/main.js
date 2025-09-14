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
  sshClient._sshConfig = { ...config };
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
      sshClient.shell({
        term: "xterm-256color",
        // 设置终端类型，确保支持全功能
        width: 80,
        height: 24,
        modes: {
          ICANON: false,
          // 禁用行缓冲模式，启用原始模式
          ECHO: true,
          // 启用回显
          ISIG: true
          // 启用信号处理，确保Ctrl+C等信号正常工作
        }
      }, (err, stream) => {
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
    let payload;
    if (typeof command === "string") {
      const hasControlChars = /[\x00-\x1F]/.test(command);
      if (hasControlChars) {
        payload = command;
      } else {
        payload = command.replace(/\r/g, "\n");
      }
    } else {
      payload = String(command);
    }
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
function getSSHClient(id) {
  return clients.get(String(id));
}
function registerSSHHandlers() {
  ipcMain.handle("ssh-connect", async (event, id, config) => {
    try {
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
const uploadTasks = /* @__PURE__ */ new Map();
async function uploadFile(sessionId, localPath, remotePath, progressCallback, customUploadId) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  if (!client) {
    return { success: false, message: "SSH 会话未连接" };
  }
  const uploadId = customUploadId || `${sessionId}-${Date.now()}`;
  console.log(`使用上传ID: ${uploadId}, 是否使用自定义ID: ${!!customUploadId}`);
  try {
    if (!fs.existsSync(localPath)) {
      console.error("本地文件不存在:", localPath);
      return { success: false, message: `本地文件不存在: ${localPath}` };
    }
    const localFileStats = fs.statSync(localPath);
    if (!localFileStats.isFile()) {
      console.error("本地路径不是文件:", localPath);
      return { success: false, message: `本地路径不是文件: ${localPath}` };
    }
    if (remotePath.endsWith("/")) {
      const fileName = path.basename(localPath);
      const newRemotePath = remotePath + fileName;
      remotePath = newRemotePath;
    }
    if (remotePath.endsWith("/")) {
      console.error("远程路径是目录，需要指定文件名:", remotePath);
      return {
        success: false,
        message: `无法上传到目录路径。请在路径 ${remotePath} 后添加文件名。`,
        error: {
          code: "PATH_IS_DIRECTORY",
          message: "Remote path is a directory, not a file path"
        }
      };
    }
    const finalRemotePath = remotePath;
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          console.error("创建SFTP连接失败:", err);
          return resolve({
            success: false,
            message: `创建SFTP连接失败: ${err.message}`,
            error: {
              code: err.code,
              message: err.message,
              stack: err.stack,
              type: Object.prototype.toString.call(err)
            }
          });
        }
        const remoteDir = path.dirname(finalRemotePath);
        if (progressCallback) {
          progressCallback({
            sessionId,
            fileName: path.basename(localPath),
            bytesTransferred: 0,
            totalBytes: localFileStats.size,
            percent: 0,
            status: "checking_dir"
          });
        }
        ensureRemoteDirectory(sftp, remoteDir).then(() => {
          if (progressCallback) {
            progressCallback({
              sessionId,
              fileName: path.basename(localPath),
              bytesTransferred: 0,
              totalBytes: localFileStats.size,
              percent: 0,
              status: "starting"
            });
          }
          const fileSize = localFileStats.size;
          let uploadedBytes = 0;
          try {
            const readStream = fs.createReadStream(localPath);
            const writeStream = sftp.createWriteStream(finalRemotePath);
            uploadTasks.set(uploadId, {
              sessionId,
              localPath,
              remotePath: finalRemotePath,
              readStream,
              writeStream,
              startTime: Date.now(),
              isCancelled: false
            });
            readStream.on("error", (readErr) => {
              console.error("读取本地文件错误:", readErr);
              resolve({
                success: false,
                message: `读取本地文件错误: ${readErr.message}`,
                error: {
                  code: readErr.code,
                  message: readErr.message,
                  stack: readErr.stack,
                  type: "ReadStreamError"
                }
              });
            });
            readStream.on("data", (chunk) => {
              uploadedBytes += chunk.length;
              const percent = Math.round(uploadedBytes / fileSize * 100);
              if (progressCallback) {
                progressCallback({
                  sessionId,
                  fileName: path.basename(localPath),
                  bytesTransferred: uploadedBytes,
                  totalBytes: fileSize,
                  percent,
                  status: "uploading"
                });
              }
            });
            writeStream.on("close", () => {
              console.log(`⭐ writeStream close 事件触发，uploadId: ${uploadId}`);
              const uploadTask = uploadTasks.get(uploadId);
              if (uploadTask && uploadTask.isCancelled) {
                console.log(`⭐ 检测到上传被取消: ${uploadId}`);
                uploadTasks.delete(uploadId);
                resolve({
                  success: false,
                  message: "文件上传已取消",
                  cancelled: true
                });
                return;
              }
              uploadTasks.delete(uploadId);
              resolve({
                success: true,
                message: "文件上传成功",
                uploadId,
                details: {
                  localPath,
                  remotePath: finalRemotePath,
                  fileName: path.basename(localPath),
                  fileSize
                }
              });
            });
            writeStream.on("error", (writeErr) => {
              console.error("文件上传错误:", writeErr);
              uploadTasks.delete(uploadId);
              let errorMessage = writeErr.message;
              if (writeErr.code === 4) {
                if (errorMessage.includes("Permission denied")) {
                  errorMessage = `没有权限写入文件: ${finalRemotePath}`;
                } else if (errorMessage.includes("Failure")) {
                  if (finalRemotePath.endsWith("/")) {
                    errorMessage = `无法写入文件，路径 ${finalRemotePath} 是一个目录，无法作为文件写入。请指定完整的文件路径，包含文件名。`;
                  } else {
                    const fileName = path.basename(remotePath);
                    const dirName = path.dirname(remotePath);
                    errorMessage = `无法写入文件 ${fileName}，可能的原因：1) 目标文件已存在且无法覆盖，2) 目标目录权限问题，或 3) 目标磁盘空间不足。`;
                    errorMessage += ` 请确认: a) 文件名正确，b) 目标位置有足够空间，c) SELinux/AppArmor策略没有限制写入。`;
                  }
                }
              }
              resolve({
                success: false,
                message: `文件上传错误: ${errorMessage}`,
                error: {
                  code: writeErr.code,
                  message: writeErr.message,
                  stack: writeErr.stack,
                  type: "WriteStreamError",
                  originalPath: remotePath,
                  finalPath: finalRemotePath
                }
              });
            });
            readStream.pipe(writeStream);
          } catch (streamErr) {
            console.error("创建流错误:", streamErr);
            resolve({
              success: false,
              message: `创建传输流错误: ${streamErr.message}`,
              error: {
                code: streamErr.code,
                message: streamErr.message,
                stack: streamErr.stack,
                type: "StreamCreationError"
              }
            });
          }
        }).catch((dirErr) => {
          console.error("创建远程目录失败:", dirErr);
          resolve({
            success: false,
            message: `创建远程目录失败: ${dirErr.message || dirErr}`,
            error: {
              message: dirErr.message,
              stack: dirErr.stack,
              type: "DirectoryCreationError"
            }
          });
        });
      });
    });
  } catch (error) {
    console.error("上传文件过程中发生未捕获异常:", error);
    return {
      success: false,
      message: `上传文件过程中发生未捕获异常: ${error.message}`,
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack,
        type: "UncaughtException"
      }
    };
  }
}
async function ensureRemoteDirectory(sftp, dirPath) {
  if (dirPath === "/" || dirPath === ".") {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    sftp.stat(dirPath, (err, stats) => {
      if (err) {
        if (err.code === 2) {
          const parentDir = path.dirname(dirPath);
          ensureRemoteDirectory(sftp, parentDir).then(() => {
            sftp.mkdir(dirPath, (mkdirErr) => {
              if (mkdirErr) {
                console.error(`创建目录 ${dirPath} 时出错:`, {
                  code: mkdirErr.code,
                  message: mkdirErr.message
                });
                if (mkdirErr.code === 4) {
                  sftp.stat(dirPath, (statErr, stats2) => {
                    if (statErr) {
                      console.error(`无法获取目录 ${dirPath} 状态:`, {
                        code: statErr.code,
                        message: statErr.message
                      });
                      if (mkdirErr.message.includes("Permission denied")) {
                        reject(new Error(`没有权限创建目录 ${dirPath}: 权限被拒绝`));
                      } else {
                        reject(new Error(`无法创建目录 ${dirPath}: ${mkdirErr.message}`));
                      }
                    } else if (stats2.isDirectory()) {
                      resolve();
                    } else {
                      reject(new Error(`路径 ${dirPath} 存在但不是目录`));
                    }
                  });
                } else {
                  let errorMessage = `创建目录失败 ${dirPath}: ${mkdirErr.message}`;
                  if (mkdirErr.message.includes("Permission denied")) {
                    errorMessage = `没有权限创建目录 ${dirPath}`;
                  }
                  reject(new Error(errorMessage));
                }
              } else {
                resolve();
              }
            });
          }).catch((parentErr) => {
            console.error(`确保父目录 ${parentDir} 存在时失败:`, parentErr);
            reject(parentErr);
          });
        } else {
          let errorMessage = `检查目录状态失败: ${err.message}`;
          if (err.message.includes("Permission denied")) {
            errorMessage = `没有权限访问目录 ${dirPath}`;
          }
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      } else {
        if (stats.isDirectory()) {
          sftp.open(`${dirPath}/.write_test_${Date.now()}`, "w", (openErr, handle) => {
            if (openErr) {
              if (openErr.message.includes("Permission denied")) {
                console.warn(`目录 ${dirPath} 存在，但可能没有写入权限`);
                resolve();
              } else {
                resolve();
              }
            } else {
              sftp.close(handle, () => {
                sftp.unlink(`${dirPath}/.write_test_${Date.now()}`, () => {
                  resolve();
                });
              });
            }
          });
        } else {
          console.error(`路径 ${dirPath} 存在但不是目录`);
          reject(new Error(`路径 ${dirPath} 存在但不是目录`));
        }
      }
    });
  });
}
async function listDirectory(sessionId, remotePath) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  if (!client) {
    return { success: false, message: "SSH 会话未连接" };
  }
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        console.error("创建SFTP连接失败:", err);
        return resolve({ success: false, message: `创建SFTP连接失败: ${err.message}` });
      }
      sftp.readdir(remotePath, (err2, list) => {
        if (err2) {
          console.error("读取目录失败:", err2);
          return resolve({ success: false, message: `读取目录失败: ${err2.message}` });
        }
        const files = list.map((item) => ({
          filename: item.filename,
          longname: item.longname,
          attrs: {
            size: item.attrs.size,
            mtime: item.attrs.mtime,
            isDirectory: item.attrs.isDirectory()
          }
        }));
        resolve({
          success: true,
          data: files,
          path: remotePath
        });
      });
    });
  });
}
async function createDirectory(sessionId, remotePath) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  if (!client) {
    return { success: false, message: "SSH 会话未连接" };
  }
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        console.error("创建SFTP连接失败:", err);
        return resolve({ success: false, message: `创建SFTP连接失败: ${err.message}` });
      }
      sftp.mkdir(remotePath, (err2) => {
        if (err2) {
          console.error("创建目录失败:", err2);
          return resolve({ success: false, message: `创建目录失败: ${err2.message}` });
        }
        resolve({
          success: true,
          message: "目录创建成功",
          path: remotePath
        });
      });
    });
  });
}
function dumpUploadTasks() {
  console.log("==== 当前上传任务状态 ====");
  console.log(`任务总数: ${uploadTasks.size}`);
  for (const [id, task] of uploadTasks.entries()) {
    console.log(`任务ID: ${id}`);
    console.log(`  - 会话ID: ${task.sessionId}`);
    console.log(`  - 本地路径: ${task.localPath}`);
    console.log(`  - 远程路径: ${task.remotePath}`);
    console.log(`  - 开始时间: ${new Date(task.startTime).toISOString()}`);
    console.log(`  - 已取消: ${task.isCancelled}`);
    console.log("  ---");
  }
  console.log("=======================");
}
async function getCurrentDirectory(sessionId) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  if (!client) {
    return { success: false, message: "SSH 会话未连接" };
  }
  const config = client._sshConfig || {};
  const defaultDirectory = config.username ? `/home/${config.username}/` : "/";
  return new Promise((resolve) => {
    console.log(`尝试获取会话 ${sessionId} 的当前工作目录`);
    client.exec("pwd", { pty: true }, (err, stream) => {
      if (err) {
        console.error("执行pwd命令失败:", err);
        return resolve({
          success: true,
          directory: defaultDirectory,
          message: `使用默认目录 (执行失败: ${err.message})`,
          usingDefault: true
        });
      }
      let output = "";
      let stderr = "";
      stream.on("data", (data) => {
        output += data.toString("utf8");
      });
      stream.stderr.on("data", (data) => {
        stderr += data.toString("utf8");
      });
      stream.on("close", (code) => {
        console.log(`pwd命令执行完毕，退出码: ${code}, 原始输出: "${output}", 错误: "${stderr.trim()}"`);
        let cleanOutput = output.replace(/\r?\n/g, "\n").replace(/\x1B\[\??[\d;]*[A-Za-z]/g, "").trim();
        if (cleanOutput.includes("\n")) {
          cleanOutput = cleanOutput.split("\n").filter((line) => line.trim()).shift() || "";
        }
        console.log(`清理后的目录输出: "${cleanOutput}"`);
        const directory = cleanOutput;
        if ((code !== 0 || stderr) && !directory) {
          console.error(`获取工作目录失败，错误码: ${code}, 错误信息: ${stderr}`);
          return resolve({
            success: true,
            directory: defaultDirectory,
            message: `使用默认目录 (命令失败，代码: ${code})`,
            usingDefault: true
          });
        }
        if (!directory) {
          console.warn("pwd命令没有输出，使用默认目录");
          return resolve({
            success: true,
            directory: defaultDirectory,
            message: "使用默认目录 (命令无输出)",
            usingDefault: true
          });
        }
        const formattedDir = directory.endsWith("/") ? directory : directory + "/";
        console.log(`成功获取当前工作目录: ${formattedDir}`);
        resolve({
          success: true,
          directory: formattedDir,
          message: "成功获取当前工作目录"
        });
      });
      stream.on("error", (streamErr) => {
        console.error("获取工作目录流错误:", streamErr);
        if (output && output.trim()) {
          const directory = output.trim();
          const formattedDir = directory.endsWith("/") ? directory : directory + "/";
          console.log(`尽管有错误，但已获取到目录: ${formattedDir}`);
          return resolve({
            success: true,
            directory: formattedDir,
            message: "成功获取当前工作目录 (尽管有错误)",
            hadError: true
          });
        }
        resolve({
          success: true,
          directory: defaultDirectory,
          message: `使用默认目录 (流错误: ${streamErr.message})`,
          usingDefault: true
        });
      });
    });
  });
}
async function cancelUpload(sessionId, uploadId) {
  try {
    console.log(`⭐ sftpManager.cancelUpload - 尝试取消上传: sessionId=${sessionId}, uploadId=${uploadId}`);
    dumpUploadTasks();
    const uploadTask = uploadTasks.get(uploadId);
    if (!uploadTask) {
      console.log(`⭐ 上传任务不存在或已完成: ${uploadId}`);
      return { success: false, message: "上传任务不存在或已完成" };
    }
    console.log(`⭐ 找到上传任务:`, {
      sessionId: uploadTask.sessionId,
      localPath: uploadTask.localPath,
      remotePath: uploadTask.remotePath,
      startTime: uploadTask.startTime,
      isCancelled: uploadTask.isCancelled
    });
    if (uploadTask.sessionId !== String(sessionId)) {
      console.warn(`⭐ 会话ID不匹配: 期望 ${uploadTask.sessionId}, 收到 ${sessionId}`);
      return { success: false, message: "会话ID不匹配" };
    }
    uploadTask.isCancelled = true;
    console.log(`⭐ 已将任务标记为取消`);
    if (uploadTask.readStream && typeof uploadTask.readStream.destroy === "function") {
      console.log(`⭐ 正在销毁读取流`);
      uploadTask.readStream.destroy();
    } else {
      console.log(`⭐ 读取流不存在或不可销毁`);
    }
    if (uploadTask.writeStream && typeof uploadTask.writeStream.destroy === "function") {
      console.log(`⭐ 正在销毁写入流`);
      uploadTask.writeStream.destroy();
    } else {
      console.log(`⭐ 写入流不存在或不可销毁`);
    }
    console.log(`⭐ 成功取消上传: ${uploadId}`);
    return { success: true, message: "上传已取消" };
  } catch (error) {
    console.error(`⭐ 取消上传时出错: ${uploadId}`, error);
    return {
      success: false,
      message: `取消上传时出错: ${error.message}`,
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack
      }
    };
  }
}
function registerSFTPHandlers() {
  ipcMain.handle("sftp-upload", async (event, sessionId, localPath, remotePath, tempUploadId) => {
    try {
      console.log("处理SFTP上传请求:", {
        sessionId,
        localPath,
        remotePath,
        tempUploadId
      });
      if (!localPath) {
        console.log("未提供本地文件路径，打开文件选择对话框");
        const window = BrowserWindow.fromWebContents(event.sender);
        const result2 = await dialog.showOpenDialog(window, {
          title: "选择要上传的文件",
          properties: ["openFile"]
        });
        if (result2.canceled || result2.filePaths.length === 0) {
          console.log("用户取消了文件选择");
          return { success: false, message: "没有选择文件" };
        }
        localPath = result2.filePaths[0];
        console.log("用户选择了文件:", localPath);
      }
      if (!sessionId) {
        console.error("无效的会话ID");
        return { success: false, message: "无效的会话ID" };
      }
      if (!remotePath) {
        console.error("未提供远程路径");
        return { success: false, message: "请提供远程路径" };
      }
      const progressCallback = (progress) => {
        try {
          event.sender.send(`sftp-upload-progress:${sessionId}`, progress);
        } catch (progressError) {
          console.error("发送进度更新失败:", progressError);
        }
      };
      console.log(`开始上传文件: ${localPath} → ${remotePath}${tempUploadId ? ", uploadId: " + tempUploadId : ""}`);
      const result = await uploadFile(sessionId, localPath, remotePath, progressCallback, tempUploadId);
      console.log("文件上传结果:", result);
      return result;
    } catch (error) {
      console.error("sftp-upload 处理过程中发生异常:", error);
      return {
        success: false,
        message: `文件上传异常: ${error.message}`,
        error: {
          code: error.code,
          message: error.message,
          stack: error.stack
        }
      };
    }
  });
  ipcMain.handle("sftp-list-directory", async (event, sessionId, remotePath) => {
    try {
      return await listDirectory(sessionId, remotePath);
    } catch (error) {
      console.error("sftp-list-directory error:", error);
      return { success: false, message: error.message };
    }
  });
  ipcMain.handle("sftp-mkdir", async (event, sessionId, remotePath) => {
    try {
      return await createDirectory(sessionId, remotePath);
    } catch (error) {
      console.error("sftp-mkdir error:", error);
      return { success: false, message: error.message };
    }
  });
  ipcMain.handle("sftp-cancel-upload", async (event, sessionId, uploadId) => {
    try {
      console.log(`收到取消上传请求: sessionId=${sessionId}, uploadId=${uploadId}`);
      if (!sessionId || !uploadId) {
        console.error("无效的会话ID或上传ID");
        return { success: false, message: "无效的参数" };
      }
      const result = await cancelUpload(sessionId, uploadId);
      console.log("取消上传结果:", result);
      return result;
    } catch (error) {
      console.error("sftp-cancel-upload error:", error);
      return {
        success: false,
        message: `取消上传失败: ${error.message}`,
        error: {
          code: error.code,
          message: error.message,
          stack: error.stack
        }
      };
    }
  });
  ipcMain.handle("sftp-get-current-directory", async (event, sessionId) => {
    try {
      console.log(`获取当前远程工作目录: sessionId=${sessionId}`);
      if (!sessionId) {
        console.error("无效的会话ID");
        return { success: false, message: "无效的会话ID" };
      }
      const result = await getCurrentDirectory(sessionId);
      console.log("获取当前工作目录结果:", result);
      return result;
    } catch (error) {
      console.error("sftp-get-current-directory error:", error);
      return {
        success: false,
        message: `获取当前工作目录失败: ${error.message}`,
        error: {
          code: error.code,
          message: error.message,
          stack: error.stack
        }
      };
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
    registerSFTPHandlers();
    console.log("✓ SFTP handlers registered");
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
