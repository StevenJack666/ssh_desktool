import { ipcRenderer, contextBridge as contextBridge$1 } from "electron";
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
  onOutput: (sessionId, callback) => ipcRenderer.on(
    `ssh-output:${String(sessionId)}`,
    (event, data) => callback(data)
  ),
  offOutput: (sessionId, callback) => ipcRenderer.removeAllListeners(`ssh-output:${String(sessionId)}`),
  // 监听连接状态
  onStatusChange: (sessionId, callback) => ipcRenderer.on(
    `ssh-status:${String(sessionId)}`,
    (event, status, config) => callback({ status, config })
  ),
  offStatusChange: (sessionId) => ipcRenderer.removeAllListeners(`ssh-status:${String(sessionId)}`),
  // 错误信息
  onError: (sessionId, callback) => {
    ipcRenderer.on(`ssh-error:${String(sessionId)}`, (event, error) => {
      callback(error);
    });
  },
  offError: (sessionId) => ipcRenderer.removeAllListeners(`ssh-error:${String(sessionId)}`),
  // 监听断开连接事件
  onDisconnect: (sessionId, callback) => {
    console.log(`Binding to ssh-status:${String(sessionId)}`);
    ipcRenderer.on(`ssh-status:${String(sessionId)}`, (event, status, config) => {
      console.log(`Received ssh-status:${String(sessionId)} with status: ${status}`);
      if (status === "disconnected" || status === "closed" || status === "ended" || status === "error") {
        try {
          callback({ status, config });
        } catch (e) {
          console.error("onDisconnect callback error", e);
        }
      }
    });
  },
  offDisconnect: (sessionId) => ipcRenderer.removeAllListeners(`ssh-status:${String(sessionId)}`)
};
console.log("Exposing sshApi to window.api:", sshApi);
contextBridge.exposeInMainWorld("api", {
  ssh: sshApi
});
console.log("sshApi exposed successfully");
console.log("Preload script loading...");
console.log("dbApi:", dbApi);
console.log("sshApi:", sshApi);
contextBridge$1.exposeInMainWorld("api", {
  db: dbApi,
  ssh: sshApi
});
console.log("Preload script loaded successfully");
