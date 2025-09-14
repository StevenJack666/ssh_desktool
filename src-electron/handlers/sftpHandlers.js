import { ipcMain, dialog } from 'electron';
import * as sftpManager from '../utils/sftpManager.js';
import { BrowserWindow } from 'electron';

export function registerSFTPHandlers() {
    // 上传文件
    ipcMain.handle('sftp-upload', async (event, sessionId, localPath, remotePath, tempUploadId) => {
        try {
            console.log('处理SFTP上传请求:', {
                sessionId,
                localPath,
                remotePath,
                tempUploadId
            });
            
            // 如果没有提供本地文件路径，打开文件选择对话框
            if (!localPath) {
                console.log('未提供本地文件路径，打开文件选择对话框');
                const window = BrowserWindow.fromWebContents(event.sender);
                const result = await dialog.showOpenDialog(window, {
                    title: '选择要上传的文件',
                    properties: ['openFile']
                });
                
                if (result.canceled || result.filePaths.length === 0) {
                    console.log('用户取消了文件选择');
                    return { success: false, message: '没有选择文件' };
                }
                
                localPath = result.filePaths[0];
                console.log('用户选择了文件:', localPath);
            }
            
            // 校验参数
            if (!sessionId) {
                console.error('无效的会话ID');
                return { success: false, message: '无效的会话ID' };
            }
            
            if (!remotePath) {
                console.error('未提供远程路径');
                return { success: false, message: '请提供远程路径' };
            }
            
            // 设置进度回调函数
            const progressCallback = (progress) => {
                try {
                    event.sender.send(`sftp-upload-progress:${sessionId}`, progress);
                } catch (progressError) {
                    console.error('发送进度更新失败:', progressError);
                }
            };
            
            console.log(`开始上传文件: ${localPath} → ${remotePath}${tempUploadId ? ', uploadId: ' + tempUploadId : ''}`);
            
            // 执行文件上传，传递可选的上传ID
            const result = await sftpManager.uploadFile(sessionId, localPath, remotePath, progressCallback, tempUploadId);
            console.log('文件上传结果:', result);
            return result;
        } catch (error) {
            console.error('sftp-upload 处理过程中发生异常:', error);
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
    
    // 列出远程目录
    ipcMain.handle('sftp-list-directory', async (event, sessionId, remotePath) => {
        try {
            return await sftpManager.listDirectory(sessionId, remotePath);
        } catch (error) {
            console.error('sftp-list-directory error:', error);
            return { success: false, message: error.message };
        }
    });
    
    // 创建远程目录
    ipcMain.handle('sftp-mkdir', async (event, sessionId, remotePath) => {
        try {
            return await sftpManager.createDirectory(sessionId, remotePath);
        } catch (error) {
            console.error('sftp-mkdir error:', error);
            return { success: false, message: error.message };
        }
    });
    
    // 取消上传
    ipcMain.handle('sftp-cancel-upload', async (event, sessionId, uploadId) => {
        try {
            console.log(`收到取消上传请求: sessionId=${sessionId}, uploadId=${uploadId}`);
            
            if (!sessionId || !uploadId) {
                console.error('无效的会话ID或上传ID');
                return { success: false, message: '无效的参数' };
            }
            
            const result = await sftpManager.cancelUpload(sessionId, uploadId);
            console.log('取消上传结果:', result);
            return result;
        } catch (error) {
            console.error('sftp-cancel-upload error:', error);
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
    
    // 获取当前远程工作目录
    ipcMain.handle('sftp-get-current-directory', async (event, sessionId) => {
        try {
            console.log(`获取当前远程工作目录: sessionId=${sessionId}`);
            
            if (!sessionId) {
                console.error('无效的会话ID');
                return { success: false, message: '无效的会话ID' };
            }
            
            // 调用SSH执行pwd命令获取当前工作目录
            const result = await sftpManager.getCurrentDirectory(sessionId);
            console.log('获取当前工作目录结果:', result);
            return result;
        } catch (error) {
            console.error('sftp-get-current-directory error:', error);
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
