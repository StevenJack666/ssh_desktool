import { ipcRenderer } from 'electron';

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
        const eventName = `ssh-output:${String(sessionId)}`;
        const wrappedCallback = (event, data) => callback(data);
        ipcRenderer.on(eventName, wrappedCallback);
        return wrappedCallback; // 返回包装的回调函数以便精确移除
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
        return wrappedCallback; // 返回包装的回调函数以便精确移除
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
        return wrappedCallback; // 返回包装的回调函数以便精确移除
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
                console.error('onDisconnect callback error', e);
            }
        };
        ipcRenderer.on(eventName, wrappedCallback);
        return wrappedCallback; // 返回包装的回调函数以便精确移除
    },
    offDisconnect: (sessionId, callback) => {
        const eventName = `ssh-disconnect:${String(sessionId)}`;
        if (callback) {
            ipcRenderer.removeListener(eventName, callback);
        } else {
            ipcRenderer.removeAllListeners(eventName);
        }
    },
};

console.log('SSH API module loaded');

export default sshApi;

