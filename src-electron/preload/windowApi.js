import { ipcRenderer } from 'electron'

const windowApi = {
  // 创建新的会话窗口
  createSessionWindow: (sessionData) => {
    return ipcRenderer.invoke('window-create-session', sessionData)
  },

  // 关闭会话窗口
  closeSessionWindow: (sessionId) => {
    return ipcRenderer.invoke('window-close-session', sessionId)
  },

  // 聚焦会话窗口
  focusSessionWindow: (sessionId) => {
    return ipcRenderer.invoke('window-focus-session', sessionId)
  },

  // 获取会话窗口状态
  getSessionWindowStatus: (sessionId) => {
    return ipcRenderer.invoke('window-get-session-status', sessionId)
  },

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

  // 监听会话数据
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
}
export default windowApi
