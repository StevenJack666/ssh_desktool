import { ref, computed } from 'vue';

export function useSFTP() {
  // 上传状态
  const uploads = ref(new Map());
  
  // 是否有上传进行中
  const hasActiveUploads = computed(() => {
    for (const upload of uploads.value.values()) {
      if (upload.status === 'uploading') {
        return true;
      }
    }
    return false;
  });
  
  /**
   * 上传文件
   * @param {string} sessionId SSH会话ID
   * @param {string|null} localPath 本地文件路径，null表示打开文件选择对话框
   * @param {string} remotePath 远程目标路径
   * @param {string} [tempUploadId] 临时上传ID（可选），如果提供则使用此ID而不是生成新ID
   * @returns {Promise<object>} 上传结果
   */
  async function uploadFile(sessionId, localPath, remotePath, tempUploadId) {
    if (!window.api?.sftp) {
      throw new Error('SFTP API 不可用');
    }
    
    // 确保 sessionId 为字符串
    sessionId = String(sessionId);
    
    // 创建上传对象，如果提供了临时ID则使用它
    const uploadId = tempUploadId || `${sessionId}-${Date.now()}`;
    console.log('🔶 创建上传任务，ID:', uploadId, '临时ID:', tempUploadId);
    
    const upload = {
      id: uploadId,
      sessionId,
      localPath,
      remotePath,
      fileName: localPath ? localPath.split('/').pop() : '正在选择文件...',
      startTime: Date.now(),
      progress: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      status: 'preparing', // preparing, checking_dir, starting, uploading, completed, error
      error: null
    };
    
    // 添加到上传列表
    uploads.value.set(uploadId, upload);
    
    // 存储进度回调的取消函数
    let unsubscribe = null;
    
    try {
      // 注册进度回调
      unsubscribe = window.api.sftp.onUploadProgress(sessionId, (progress) => {
        const currentUpload = uploads.value.get(uploadId);
        if (currentUpload) {
          uploads.value.set(uploadId, {
            ...currentUpload,
            // 使用进度回调中的状态，如果没有则默认为'uploading'
            status: progress.status || 'uploading',
            fileName: progress.fileName || currentUpload.fileName,
            bytesTransferred: progress.bytesTransferred,
            totalBytes: progress.totalBytes,
            progress: progress.percent
          });
        }
      });
      
      // 更新状态为上传中
      upload.status = 'uploading';
      uploads.value.set(uploadId, upload);
      
      // 开始上传，传递上传ID以便在主进程中使用相同的ID
      const result = await window.api.sftp.upload(sessionId, localPath, remotePath, uploadId);
      
      // 清理进度监听
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      
      // 更新上传状态
      if (result.success) {
        uploads.value.set(uploadId, {
          ...uploads.value.get(uploadId),
          status: 'completed',
          progress: 100,
          bytesTransferred: uploads.value.get(uploadId).totalBytes || 1, // 防止没有收到进度更新
          endTime: Date.now()
        });
      } else {
        // 上传失败，记录错误状态
        uploads.value.set(uploadId, {
          ...uploads.value.get(uploadId),
          status: 'error',
          error: result.message || '上传失败',
          errorDetails: result.error || null,
          endTime: Date.now()
        });
      }
      
      return { ...result, uploadId };
    } catch (error) {
      console.error(`[SFTP] 上传过程发生异常 - ID: ${uploadId}`, error);
      
      // 清理进度监听
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (cleanupError) {
          console.error('[SFTP] 清理进度回调时出错', cleanupError);
        }
      }
      
      // 记录详细的错误信息
      const errorDetails = {
        message: error.message || '未知错误',
        code: error.code,
        stack: error.stack,
        type: Object.prototype.toString.call(error)
      };
      
      // 更新上传状态为错误
      uploads.value.set(uploadId, {
        ...uploads.value.get(uploadId),
        status: 'error',
        error: error.message || '上传失败',
        errorDetails,
        endTime: Date.now()
      });
      
      // 包装错误并抛出
      const enhancedError = new Error(error.message || '文件上传失败');
      enhancedError.originalError = error;
      enhancedError.uploadId = uploadId;
      enhancedError.details = errorDetails;
      
      throw enhancedError;
    }
  }
  
  /**
   * 获取指定上传的状态
   * @param {string} uploadId 上传ID
   * @returns {object|null} 上传状态对象
   */
  function getUploadStatus(uploadId) {
    return uploads.value.get(uploadId) || null;
  }
  
  /**
   * 获取指定会话的所有上传
   * @param {string} sessionId SSH会话ID
   * @returns {Array<object>} 该会话的上传列表
   */
  function getSessionUploads(sessionId) {
    sessionId = String(sessionId);
    const sessionUploads = [];
    
    for (const upload of uploads.value.values()) {
      if (upload.sessionId === sessionId) {
        sessionUploads.push(upload);
      }
    }
    
    return sessionUploads;
  }
  
  /**
   * 清理已完成或出错的上传记录
   * @param {string} sessionId 可选，如果提供则只清理指定会话的上传
   */
  function clearFinishedUploads(sessionId = null) {
    for (const [id, upload] of uploads.value.entries()) {
      if ((sessionId === null || upload.sessionId === String(sessionId)) && 
          (upload.status === 'completed' || upload.status === 'error')) {
        uploads.value.delete(id);
      }
    }
  }
  
  /**
   * 列出远程目录
   * @param {string} sessionId SSH会话ID
   * @param {string} remotePath 远程目录路径
   * @returns {Promise<object>} 目录内容
   */
  async function listDirectory(sessionId, remotePath) {
    if (!window.api?.sftp) {
      throw new Error('SFTP API 不可用');
    }
    
    return await window.api.sftp.listDirectory(sessionId, remotePath);
  }
  
  /**
   * 创建远程目录
   * @param {string} sessionId SSH会话ID
   * @param {string} remotePath 要创建的远程目录路径
   * @returns {Promise<object>} 操作结果
   */
  async function createDirectory(sessionId, remotePath) {
    if (!window.api?.sftp) {
      throw new Error('SFTP API 不可用');
    }
    
    return await window.api.sftp.mkdir(sessionId, remotePath);
  }
  
  /**
   * 取消文件上传
   * @param {string} uploadId 上传ID
   * @returns {Promise<boolean>} 是否成功取消
   */
  async function cancelUpload(uploadId) {
    console.log(`🔄 useSFTP.cancelUpload 被调用，uploadId: ${uploadId}`);
    
    const upload = uploads.value.get(uploadId);
    if (!upload) {
      console.warn(`[SFTP] 无法取消上传 - ID不存在: ${uploadId}`);
      return false;
    }
    
    console.log(`🔄 找到上传任务:`, upload);
    
    // 检查上传状态是否可以取消 - 任何状态都可以尝试取消
    // 即使在 completed 或 error 状态下，我们也尝试取消，因为主进程可能仍有任务
    console.log(`🔄 上传状态: ${upload.status}，将尝试取消`);
    
    try {
      if (window.api?.sftp?.cancelUpload) {
        console.log(`🔄 调用 window.api.sftp.cancelUpload，sessionId: ${upload.sessionId}, uploadId: ${uploadId}`);
        // 调用主进程取消上传
        const result = await window.api.sftp.cancelUpload(upload.sessionId, uploadId);
        console.log(`🔄 取消上传结果:`, result);
        
        // 更新上传状态
        uploads.value.set(uploadId, {
          ...upload,
          status: 'cancelled',
          endTime: Date.now()
        });
        
        console.log(`🔄 更新上传状态为 cancelled`);
        return result.success || false;
      } else {
        console.error('[SFTP] 取消上传功能不可用 - API不存在');
        return false;
      }
    } catch (error) {
      console.error('[SFTP] 取消上传时出错', error);
      
      // 标记为出错状态
      uploads.value.set(uploadId, {
        ...upload,
        status: 'error',
        error: '取消上传时出错: ' + (error.message || '未知错误'),
        endTime: Date.now()
      });
      
      return false;
    }
  }
  
  return {
    uploads,
    hasActiveUploads,
    uploadFile,
    getUploadStatus,
    getSessionUploads,
    clearFinishedUploads,
    listDirectory,
    createDirectory,
    cancelUpload
  };
}
