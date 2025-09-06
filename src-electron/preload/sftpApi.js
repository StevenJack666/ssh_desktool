import { ipcRenderer } from 'electron';

const sftpApi = {
  /**
   * 上传文件到远程服务器
   * @param {string} sessionId SSH会话ID
   * @param {string|null} localPath 本地文件路径，如果为null则会打开文件选择对话框
   * @param {string} remotePath 远程目标路径
   * @param {string} [tempUploadId] 临时上传ID，如果提供则在主进程中使用此ID
   * @returns {Promise<object>} 上传结果
   */
  upload: (sessionId, localPath, remotePath, tempUploadId) => {
    return ipcRenderer.invoke('sftp-upload', sessionId, localPath, remotePath, tempUploadId);
  },

  /**
   * 列出远程目录内容
   * @param {string} sessionId SSH会话ID
   * @param {string} remotePath 远程目录路径
   * @returns {Promise<object>} 目录内容列表
   */
  listDirectory: (sessionId, remotePath) => {
    return ipcRenderer.invoke('sftp-list-directory', sessionId, remotePath);
  },

  /**
   * 创建远程目录
   * @param {string} sessionId SSH会话ID
   * @param {string} remotePath 要创建的远程目录路径
   * @returns {Promise<object>} 操作结果
   */
  mkdir: (sessionId, remotePath) => {
    return ipcRenderer.invoke('sftp-mkdir', sessionId, remotePath);
  },

  /**
   * 监听文件上传进度
   * @param {string} sessionId SSH会话ID
   * @param {function} callback 进度回调函数
   * @returns {function} 取消监听的函数
   */
  onUploadProgress: (sessionId, callback) => {
    const channel = `sftp-upload-progress:${sessionId}`;
    
    // 包装回调函数，便于后续移除
    const wrappedCallback = (event, ...args) => callback(...args);
    
    ipcRenderer.on(channel, wrappedCallback);
    
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener(channel, wrappedCallback);
    };
  },
  
  /**
   * 取消文件上传
   * @param {string} sessionId SSH会话ID
   * @param {string} uploadId 上传ID
   * @returns {Promise<object>} 取消结果
   */
  cancelUpload: (sessionId, uploadId) => {
    console.log(`🟡 sftpApi.cancelUpload 被调用: sessionId=${sessionId}, uploadId=${uploadId}`);
    return ipcRenderer.invoke('sftp-cancel-upload', sessionId, uploadId)
      .then(result => {
        console.log(`🟡 ipcRenderer.invoke 结果:`, result);
        return result;
      })
      .catch(error => {
        console.error(`🟡 ipcRenderer.invoke 错误:`, error);
        throw error;
      });
  }
};

export default sftpApi;
