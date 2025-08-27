import { ipcRenderer, contextBridge } from "electron";
const dbApi = {
  getItems: () => ipcRenderer.invoke("db-get-items"),
  addItem: (item) => ipcRenderer.invoke("db-add-item", item),
  updateItem: (id, item) => ipcRenderer.invoke("db-update-item", id, item),
  deleteItem: (id) => ipcRenderer.invoke("db-delete-item", id)
};
const sshApi = {
  // 连接到SSH服务器
  connect: (sessionId, config) => {
    return ipcRenderer.invoke("ssh-connect", sessionId, config);
  },
  // 发送命令
  send: (sessionId, data) => ipcRenderer.invoke("ssh-send", sessionId, data),
  // 断开连接
  disconnect: (sessionId) => ipcRenderer.invoke("ssh-disconnect", sessionId),
  // 检查连接状态
  ping: (sessionId) => ipcRenderer.invoke("ssh-alive", sessionId),
  // 监听SSH输出
  onOutput: (sessionId, callback) => {
    const eventName = `ssh-output:${String(sessionId)}`;
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on(eventName, wrappedCallback);
    return wrappedCallback;
  },
  offOutput: (sessionId, callback) => {
    const eventName = `ssh-output:${String(sessionId)}`;
    if (callback) {
      ipcRenderer.removeListener(eventName, callback);
    } else {
      ipcRenderer.removeAllListeners(eventName);
    }
  },
  // 监听连接状态
  onStatusChange: (sessionId, callback) => {
    const eventName = `ssh-status:${String(sessionId)}`;
    const wrappedCallback = (event, status, config) => callback({ status, config });
    ipcRenderer.on(eventName, wrappedCallback);
    return wrappedCallback;
  },
  offStatusChange: (sessionId, callback) => {
    const eventName = `ssh-status:${String(sessionId)}`;
    if (callback) {
      ipcRenderer.removeListener(eventName, callback);
    } else {
      ipcRenderer.removeAllListeners(eventName);
    }
  },
  // 错误信息
  onError: (sessionId, callback) => {
    const eventName = `ssh-error:${String(sessionId)}`;
    const wrappedCallback = (event, error) => callback(error);
    ipcRenderer.on(eventName, wrappedCallback);
    return wrappedCallback;
  },
  offError: (sessionId, callback) => {
    const eventName = `ssh-error:${String(sessionId)}`;
    if (callback) {
      ipcRenderer.removeListener(eventName, callback);
    } else {
      ipcRenderer.removeAllListeners(eventName);
    }
  },
  // 监听断开连接事件 - 使用专用的断开连接事件
  onDisconnect: (sessionId, callback) => {
    const eventName = `ssh-disconnect:${String(sessionId)}`;
    console.log(`Binding to ${eventName}`);
    const wrappedCallback = (event, data) => {
      console.log(`Received ${eventName}`);
      try {
        callback(data);
      } catch (e) {
        console.error("onDisconnect callback error", e);
      }
    };
    ipcRenderer.on(eventName, wrappedCallback);
    return wrappedCallback;
  },
  offDisconnect: (sessionId, callback) => {
    const eventName = `ssh-disconnect:${String(sessionId)}`;
    if (callback) {
      ipcRenderer.removeListener(eventName, callback);
    } else {
      ipcRenderer.removeAllListeners(eventName);
    }
  }
};
console.log("SSH API module loaded");
const dialogApi = {
  // 显示打开文件对话框
  showOpenDialog: async (options) => {
    return await ipcRenderer.invoke("dialog:showOpenDialog", options);
  },
  // 显示保存文件对话框
  showSaveDialog: async (options) => {
    return await ipcRenderer.invoke("dialog:showSaveDialog", options);
  },
  // 显示消息框
  showMessageBox: async (options) => {
    return await ipcRenderer.invoke("dialog:showMessageBox", options);
  }
};
const windowApi = {
  // 创建新的会话窗口
  createSessionWindow: (sessionData) => {
    return ipcRenderer.invoke("window-create-session", sessionData);
  },
  // 关闭会话窗口
  closeSessionWindow: (sessionId) => {
    return ipcRenderer.invoke("window-close-session", sessionId);
  },
  // 聚焦会话窗口
  focusSessionWindow: (sessionId) => {
    return ipcRenderer.invoke("window-focus-session", sessionId);
  },
  // 获取会话窗口状态
  getSessionWindowStatus: (sessionId) => {
    return ipcRenderer.invoke("window-get-session-status", sessionId);
  },
  // 监听会话窗口关闭事件
  onSessionWindowClosed: (callback) => {
    const wrappedCallback = (event, sessionId) => callback(event, sessionId);
    ipcRenderer.on("session-window-closed", wrappedCallback);
    return wrappedCallback;
  },
  // 移除会话窗口关闭事件监听器
  offSessionWindowClosed: (callback) => {
    if (callback) {
      ipcRenderer.removeListener("session-window-closed", callback);
    } else {
      ipcRenderer.removeAllListeners("session-window-closed");
    }
  },
  // 监听会话数据
  onSessionData: (callback) => {
    const wrappedCallback = (event, sessionData) => callback(event, sessionData);
    ipcRenderer.on("session-data", wrappedCallback);
    return wrappedCallback;
  },
  // 移除会话数据监听器
  offSessionData: (callback) => {
    if (callback) {
      ipcRenderer.removeListener("session-data", callback);
    } else {
      ipcRenderer.removeAllListeners("session-data");
    }
  }
};
console.log("Window API module loaded");
console.log("Preload script loading...");
console.log("dbApi:", dbApi);
console.log("sshApi:", sshApi);
console.log("dialogApi:", dialogApi);
console.log("windowApi:", windowApi);
contextBridge.exposeInMainWorld("api", {
  db: dbApi,
  ssh: sshApi,
  dialog: dialogApi,
  window: windowApi
});
console.log("Preload script loaded successfully");
