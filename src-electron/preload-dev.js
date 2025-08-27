const { contextBridge, ipcRenderer } = require('electron');


// 测试：直接在 window 上设置一个简单属性
window.testPreload = 'preload-dev.js loaded successfully';

// Database API
const dbApi = {
  getItems: () => ipcRenderer.invoke('db-get-items'),
  addItem: (item) => ipcRenderer.invoke('db-add-item', item),
  updateItem: (id, item) => ipcRenderer.invoke('db-update-item', id, item),
  deleteItem: (id) => ipcRenderer.invoke('db-delete-item', id),
  // 新增：更新条目的状态（例如标记为 'disconnected'）
  updateItemStatus: (id, status) => ipcRenderer.invoke('db-update-item-status', id, status),
  // 新增：更新条目的显示名称
  updateItemDisplayName: (id, displayName) => ipcRenderer.invoke('db-update-item-display-name', id, displayName),
};

// listener holders to allow removing specific handlers later
const _listeners = {
  output: new Map(),
  status: new Map(),
  disconnect: new Map(),
  error: new Map(),
};

const sshApi = {
  // 连接到SSH服务器
  connect: (sessionId, config) => {
    return ipcRenderer.invoke('ssh-connect', sessionId, config);
  },
  
  // 发送命令
  send: (sessionId, data) => ipcRenderer.invoke('ssh-send', sessionId, data),
  
  // 断开连接
  disconnect: (sessionId) => ipcRenderer.invoke('ssh-disconnect', sessionId),
  
  // 检查连接状态
  ping: (sessionId) => ipcRenderer.invoke('ssh-alive', sessionId),

  // 监听SSH输出
  onOutput: (sessionId, callback) => {
      const key = String(sessionId);
      const chan = `ssh-output:${key}`;
      const handler = (event, data) => {
          try {
            callback(data);
          } catch (e) {
            console.error('onOutput callback error', e);
          }
      };
      ipcRenderer.on(chan, handler);
      _listeners.output.set(key, handler);
  },
  offOutput: (sessionId) => {
      const key = String(sessionId);
      const chan = `ssh-output:${key}`;
      const handler = _listeners.output.get(key);
      if (handler) {
        ipcRenderer.removeListener(chan, handler);
        _listeners.output.delete(key);
      }
  },
  
  // 监听连接状态
  onStatusChange: (sessionId, callback) => {
      const key = String(sessionId);
      const chan = `ssh-status:${key}`;
      const handler = (event, statusOrPayload, maybeConfig) => {
          try {
            // 支持两种发送格式： (status, config) 或 ({ status, config })
            let status = statusOrPayload;
            let config = maybeConfig;
            if (statusOrPayload && typeof statusOrPayload === 'object' && ('status' in statusOrPayload)) {
              status = statusOrPayload.status;
              config = statusOrPayload.config || statusOrPayload;
            }
            callback({ status, config });
          } catch (e) {
            console.error('onStatusChange callback error', e);
          }
      };
      ipcRenderer.on(chan, handler);
      _listeners.status.set(key, handler);
   },
   offStatusChange: (sessionId) => {
       const key = String(sessionId);
       const chan = `ssh-status:${key}`;
       const handler = _listeners.status.get(key);
       if (handler) {
         ipcRenderer.removeListener(chan, handler);
         _listeners.status.delete(key);
       }
   },
   
   // 错误信息
   onError: (sessionId, callback) => {
       const key = String(sessionId);
       const chan = `ssh-error:${key}`;
       const handler = (event, error) => {
           try {
             callback(error);
           } catch (e) {
             console.error('onError callback error', e);
           }
       };
       ipcRenderer.on(chan, handler);
       _listeners.error.set(key, handler);
   },
   offError: (sessionId) => {
       const key = String(sessionId);
       const chan = `ssh-error:${key}`;
       const handler = _listeners.error.get(key);
       if (handler) {
         ipcRenderer.removeListener(chan, handler);
         _listeners.error.delete(key);
       }
   },

   // 监听断开连接事件
   onDisconnect: (sessionId, callback) => {
       const key = String(sessionId);
       const chan = `ssh-status:${key}`;
       const handler = (event, statusOrPayload, maybeConfig) => {
          try {
            let status = statusOrPayload;
            let config = maybeConfig;
            if (statusOrPayload && typeof statusOrPayload === 'object' && ('status' in statusOrPayload)) {
              status = statusOrPayload.status;
              config = statusOrPayload.config || statusOrPayload;
            }
            console.log(`preload: onDisconnect received status='${status}' for session=${sessionId}`, { config });
            if (status === 'disconnected' || status === 'closed' || status === 'ended' || status === 'error') {
                try {
                  callback({ status, config: config || null });
                } catch (e) {
                  console.error('onDisconnect callback error', e);
                }
            }
          } catch (e) {
            console.error('onDisconnect handler error', e);
          }
      };
      ipcRenderer.on(chan, handler);
      _listeners.disconnect.set(key, handler);
   },
   offDisconnect: (sessionId) => {
       const key = String(sessionId);
       const chan = `ssh-status:${key}`;
       const handler = _listeners.disconnect.get(key);
       if (handler) {
        ipcRenderer.removeListener(chan, handler);
        _listeners.disconnect.delete(key);
       }
   }
};

console.log('dbApi:', dbApi);
console.log('sshApi:', sshApi);



// Database API
const dialogApi = {
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
};

// Window API
const windowApi = {
  createSessionWindow: (sessionData) => ipcRenderer.invoke('window-create-session', sessionData),
  closeSessionWindow: (sessionId) => ipcRenderer.invoke('window-close-session', sessionId),
  getSessionWindowStatus: (sessionId) => ipcRenderer.invoke('window-get-session-status', sessionId),
  focusSessionWindow: (sessionId) => ipcRenderer.invoke('window-focus-session', sessionId),
  
  // 监听会话窗口关闭事件
  onSessionWindowClosed: (callback) => {
    const wrappedCallback = (event, sessionId) => callback(event, sessionId);
    ipcRenderer.on('session-window-closed', wrappedCallback);
    return wrappedCallback; // 返回包装的回调函数以便精确移除
  },
  
  // 移除会话窗口关闭事件监听器
  offSessionWindowClosed: (callback) => {
    if (callback) {
      ipcRenderer.removeListener('session-window-closed', callback);
    } else {
      ipcRenderer.removeAllListeners('session-window-closed');
    }
  },
  
  // 监听会话数据（用于新打开的会话窗口）
  onSessionData: (callback) => {
    const wrappedCallback = (event, sessionData) => callback(event, sessionData);
    ipcRenderer.on('session-data', wrappedCallback);
    return wrappedCallback; // 返回包装的回调函数以便精确移除
  },
  
  // 移除会话数据监听器
  offSessionData: (callback) => {
    if (callback) {
      ipcRenderer.removeListener('session-data', callback);
    } else {
      ipcRenderer.removeAllListeners('session-data');
    }
  }
};

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('api', {
  db: dbApi,
  ssh: sshApi,
  dialog: dialogApi,
  window: windowApi,
});

console.log('=== PRELOAD SCRIPT LOADED SUCCESSFULLY ===');
console.log('API exposed to window.api:', { db: !!dbApi, ssh: !!sshApi, dialog: !!dialogApi, window: !!windowApi });
