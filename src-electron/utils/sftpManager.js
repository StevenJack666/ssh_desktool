import { getSSHClient } from './sshManager.js';
import path from 'path';
import fs from 'fs';

// 维护上传任务的映射
const uploadTasks = new Map();

/**
 * Uploads a file to the remote server using SFTP
 * @param {string} sessionId - The SSH session ID
 * @param {string} localPath - Local file path
 * @param {string} remotePath - Remote destination path
 * @param {function} progressCallback - Function to receive progress updates
 * @param {string} [customUploadId] - Optional custom upload ID
 * @returns {Promise<object>} Upload result
 */
export async function uploadFile(sessionId, localPath, remotePath, progressCallback, customUploadId) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  
  if (!client) {
    return { success: false, message: 'SSH 会话未连接' };
  }
  
  // 使用自定义上传ID或生成新ID
  const uploadId = customUploadId || `${sessionId}-${Date.now()}`;
  console.log(`使用上传ID: ${uploadId}, 是否使用自定义ID: ${!!customUploadId}`);

  try {
    // 检查本地文件是否存在
    if (!fs.existsSync(localPath)) {
      console.error('本地文件不存在:', localPath);
      return { success: false, message: `本地文件不存在: ${localPath}` };
    }

    // 获取本地文件信息
    const localFileStats = fs.statSync(localPath);
    if (!localFileStats.isFile()) {
      console.error('本地路径不是文件:', localPath);
      return { success: false, message: `本地路径不是文件: ${localPath}` };
    }
    
    // 不再警告系统目录，因为用户可能是root或有权限的用户
    // 如果路径是目录（以/结尾），自动添加本地文件名
    if (remotePath.endsWith('/')) {
      const fileName = path.basename(localPath);
      const newRemotePath = remotePath + fileName;
      remotePath = newRemotePath;
    }
    
    // 检查远程路径是否是目录而不是文件
    if (remotePath.endsWith('/')) {
      console.error('远程路径是目录，需要指定文件名:', remotePath);
      return { 
        success: false, 
        message: `无法上传到目录路径。请在路径 ${remotePath} 后添加文件名。`,
        error: {
          code: 'PATH_IS_DIRECTORY',
          message: 'Remote path is a directory, not a file path'
        }
      };
    }

    // 创建一个闭包，使用调整后的 remotePath
    const finalRemotePath = remotePath;
    
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          console.error('创建SFTP连接失败:', err);
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

        // 获取远程目录路径
        const remoteDir = path.dirname(finalRemotePath);
        
        // 向前端发送准备中状态
        if (progressCallback) {
          progressCallback({
            sessionId,
            fileName: path.basename(localPath),
            bytesTransferred: 0,
            totalBytes: localFileStats.size,
            percent: 0,
            status: 'checking_dir'
          });
        }
        
        // 确保远程目录存在
        ensureRemoteDirectory(sftp, remoteDir)
          .then(() => {
            // 向前端发送准备就绪状态
            if (progressCallback) {
              progressCallback({
                sessionId,
                fileName: path.basename(localPath),
                bytesTransferred: 0,
                totalBytes: localFileStats.size,
                percent: 0,
                status: 'starting'
              });
            }
            
            // 获取文件大小以计算上传进度
            const fileSize = localFileStats.size;
            let uploadedBytes = 0;
            
            try {
              // 创建远程文件的读取流和写入流
              const readStream = fs.createReadStream(localPath);
              const writeStream = sftp.createWriteStream(finalRemotePath);
              
              // 存储上传任务的引用
              uploadTasks.set(uploadId, {
                sessionId,
                localPath,
                remotePath: finalRemotePath,
                readStream,
                writeStream,
                startTime: Date.now(),
                isCancelled: false
              });
              
              // 监听读取流错误
              readStream.on('error', (readErr) => {
                console.error('读取本地文件错误:', readErr);
                resolve({ 
                  success: false, 
                  message: `读取本地文件错误: ${readErr.message}`,
                  error: {
                    code: readErr.code,
                    message: readErr.message,
                    stack: readErr.stack,
                    type: 'ReadStreamError'
                  }
                });
              });
              
              // 监听数据传输进度
              readStream.on('data', (chunk) => {
                uploadedBytes += chunk.length;
                const percent = Math.round((uploadedBytes / fileSize) * 100);
                
                if (progressCallback) {
                  progressCallback({
                    sessionId,
                    fileName: path.basename(localPath),
                    bytesTransferred: uploadedBytes,
                    totalBytes: fileSize,
                    percent,
                    status: 'uploading'
                  });
                }
              });

              // 监听传输完成
              writeStream.on('close', () => {
                console.log(`⭐ writeStream close 事件触发，uploadId: ${uploadId}`);
                
                // 检查是否是因为取消而关闭
                const uploadTask = uploadTasks.get(uploadId);
                
                // 先判断是否是取消的任务
                if (uploadTask && uploadTask.isCancelled) {
                  console.log(`⭐ 检测到上传被取消: ${uploadId}`);
                  // 清理上传任务
                  uploadTasks.delete(uploadId);
                  
                  resolve({
                    success: false,
                    message: '文件上传已取消',
                    cancelled: true
                  });
                  return;
                }
                
                // 不是取消的情况下，清理上传任务
                uploadTasks.delete(uploadId);
                
                resolve({ 
                  success: true, 
                  message: '文件上传成功', 
                  uploadId,
                  details: {
                    localPath,
                    remotePath: finalRemotePath,
                    fileName: path.basename(localPath),
                    fileSize
                  }
                });
              });

              // 监听传输错误
              writeStream.on('error', (writeErr) => {
                console.error('文件上传错误:', writeErr);
                
                // 清理上传任务
                uploadTasks.delete(uploadId);
                // 尝试确定错误类型
                let errorMessage = writeErr.message;
                
                if (writeErr.code === 4) {
                  if (errorMessage.includes('Permission denied')) {
                    errorMessage = `没有权限写入文件: ${finalRemotePath}`;
                  } else if (errorMessage.includes('Failure')) {
                    if (finalRemotePath.endsWith('/')) {
                      // 检测目标是否为目录路径 (这个条件不应该再触发，因为我们已经处理了目录路径)
                      errorMessage = `无法写入文件，路径 ${finalRemotePath} 是一个目录，无法作为文件写入。请指定完整的文件路径，包含文件名。`;
                    } else {
                      // 处理其他类型的写入错误
                      const fileName = path.basename(remotePath);
                      const dirName = path.dirname(remotePath);
                      
                      // 检查是否是文件已存在且无法覆盖的情况
                      errorMessage = `无法写入文件 ${fileName}，可能的原因：1) 目标文件已存在且无法覆盖，2) 目标目录权限问题，或 3) 目标磁盘空间不足。`;
                      
                      // 添加提示信息，即使是 root 用户也可能遇到这些问题
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
                    type: 'WriteStreamError',
                    originalPath: remotePath,
                    finalPath: finalRemotePath
                  }
                });
              });

              // 开始传输
              readStream.pipe(writeStream);
            } catch (streamErr) {
              console.error('创建流错误:', streamErr);
              resolve({ 
                success: false, 
                message: `创建传输流错误: ${streamErr.message}`,
                error: {
                  code: streamErr.code,
                  message: streamErr.message,
                  stack: streamErr.stack,
                  type: 'StreamCreationError'
                }
              });
            }
          })
          .catch(dirErr => {
            console.error('创建远程目录失败:', dirErr);
            resolve({ 
              success: false, 
              message: `创建远程目录失败: ${dirErr.message || dirErr}`,
              error: {
                message: dirErr.message,
                stack: dirErr.stack,
                type: 'DirectoryCreationError'
              }
            });
          });
      });
    });
  } catch (error) {
    console.error('上传文件过程中发生未捕获异常:', error);
    return { 
      success: false, 
      message: `上传文件过程中发生未捕获异常: ${error.message}`,
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack,
        type: 'UncaughtException'
      }
    };
  }
}

/**
 * 确保远程目录存在，如果不存在则递归创建
 * @param {object} sftp - SFTP连接实例 
 * @param {string} dirPath - 要确保存在的目录路径
 * @returns {Promise<void>}
 */
async function ensureRemoteDirectory(sftp, dirPath) {
  if (dirPath === '/' || dirPath === '.') {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    // 先检查目录是否存在
    sftp.stat(dirPath, (err, stats) => {
      if (err) {
        if (err.code === 2) { // 目录不存在 (code 2 = ENOENT)
          // 递归确保父目录存在
          const parentDir = path.dirname(dirPath);
          
          ensureRemoteDirectory(sftp, parentDir)
            .then(() => {
              // 创建当前目录
              sftp.mkdir(dirPath, mkdirErr => {
                if (mkdirErr) {
                  console.error(`创建目录 ${dirPath} 时出错:`, {
                    code: mkdirErr.code,
                    message: mkdirErr.message
                  });
                  
                  // 忽略目录已存在的错误 (可能是并发创建导致的)
                  if (mkdirErr.code === 4) {
                    // 错误代码4可能是多种错误，包括权限错误和目录已存在
                    // 再次检查目录是否已经存在
                    sftp.stat(dirPath, (statErr, stats) => {
                      if (statErr) {
                        console.error(`无法获取目录 ${dirPath} 状态:`, {
                          code: statErr.code,
                          message: statErr.message
                        });
                        
                        // 如果是权限错误，给出更明确的信息
                        if (mkdirErr.message.includes('Permission denied')) {
                          reject(new Error(`没有权限创建目录 ${dirPath}: 权限被拒绝`));
                        } else {
                          reject(new Error(`无法创建目录 ${dirPath}: ${mkdirErr.message}`));
                        }
                      } else if (stats.isDirectory()) {
                        resolve();
                      } else {
                        reject(new Error(`路径 ${dirPath} 存在但不是目录`));
                      }
                    });
                  } else {
                    let errorMessage = `创建目录失败 ${dirPath}: ${mkdirErr.message}`;
                    if (mkdirErr.message.includes('Permission denied')) {
                      errorMessage = `没有权限创建目录 ${dirPath}`;
                    }
                    reject(new Error(errorMessage));
                  }
                } else {
                  resolve();
                }
              });
            })
            .catch(parentErr => {
              console.error(`确保父目录 ${parentDir} 存在时失败:`, parentErr);
              reject(parentErr);
            });
        } else {
          // 其他错误
          let errorMessage = `检查目录状态失败: ${err.message}`;
          if (err.message.includes('Permission denied')) {
            errorMessage = `没有权限访问目录 ${dirPath}`;
          }
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      } else {
        if (stats.isDirectory()) {
          // 检查是否有写入权限
          sftp.open(`${dirPath}/.write_test_${Date.now()}`, 'w', (openErr, handle) => {
            if (openErr) {
              if (openErr.message.includes('Permission denied')) {
                console.warn(`目录 ${dirPath} 存在，但可能没有写入权限`);
                // 尽管没有写入权限，但目录确实存在，所以我们仍然继续
                resolve();
              } else {
                resolve(); // 继续，因为目录确实存在
              }
            } else {
              // 关闭并删除测试文件
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

/**
 * Lists files and directories in a remote directory
 * @param {string} sessionId - The SSH session ID
 * @param {string} remotePath - Remote directory path
 * @returns {Promise<object>} Directory listing result
 */
export async function listDirectory(sessionId, remotePath) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  
  if (!client) {
    return { success: false, message: 'SSH 会话未连接' };
  }

  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        console.error('创建SFTP连接失败:', err);
        return resolve({ success: false, message: `创建SFTP连接失败: ${err.message}` });
      }

      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          console.error('读取目录失败:', err);
          return resolve({ success: false, message: `读取目录失败: ${err.message}` });
        }

        // 处理文件列表
        const files = list.map(item => ({
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

/**
 * Creates a directory on the remote server
 * @param {string} sessionId - The SSH session ID
 * @param {string} remotePath - Remote directory path to create
 * @returns {Promise<object>} Result of the operation
 */
export async function createDirectory(sessionId, remotePath) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  
  if (!client) {
    return { success: false, message: 'SSH 会话未连接' };
  }

  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        console.error('创建SFTP连接失败:', err);
        return resolve({ success: false, message: `创建SFTP连接失败: ${err.message}` });
      }

      // 创建远程目录
      sftp.mkdir(remotePath, (err) => {
        if (err) {
          console.error('创建目录失败:', err);
          return resolve({ success: false, message: `创建目录失败: ${err.message}` });
        }

        resolve({ 
          success: true, 
          message: '目录创建成功',
          path: remotePath 
        });
      });
    });
  });
}

/**
 * 取消进行中的文件上传
 * @param {string} sessionId - SSH会话ID
 * @param {string} uploadId - 上传ID
 * @returns {Promise<object>} 取消结果
 */
// 调试用：获取当前的上传任务状态
function dumpUploadTasks() {
  console.log('==== 当前上传任务状态 ====');
  console.log(`任务总数: ${uploadTasks.size}`);
  
  for (const [id, task] of uploadTasks.entries()) {
    console.log(`任务ID: ${id}`);
    console.log(`  - 会话ID: ${task.sessionId}`);
    console.log(`  - 本地路径: ${task.localPath}`);
    console.log(`  - 远程路径: ${task.remotePath}`);
    console.log(`  - 开始时间: ${new Date(task.startTime).toISOString()}`);
    console.log(`  - 已取消: ${task.isCancelled}`);
    console.log('  ---');
  }
  console.log('=======================');
}

/**
 * 获取当前远程工作目录
 * @param {string} sessionId - SSH会话ID
 * @returns {Promise<object>} 包含当前工作目录的结果对象
 */
export async function getCurrentDirectory(sessionId) {
  sessionId = String(sessionId);
  const client = getSSHClient(sessionId);
  
  if (!client) {
    return { success: false, message: 'SSH 会话未连接' };
  }
  
  // 获取连接配置信息
  const config = client._sshConfig || {};
  // 基于用户名创建默认目录
  const defaultDirectory = config.username ? `/home/${config.username}/` : '/';

  // 创建一个不会显示在用户终端的新命令通道
  return new Promise((resolve) => {
    console.log(`尝试获取会话 ${sessionId} 的当前工作目录`);
    
    // 创建一个独立的exec连接，但使用PTY模式
    // 启用PTY模式可以确保命令在与用户相同的环境中执行
    client.exec('pwd', { pty: true }, (err, stream) => {
      if (err) {
        console.error('执行pwd命令失败:', err);
        return resolve({ 
          success: true, 
          directory: defaultDirectory,
          message: `使用默认目录 (执行失败: ${err.message})`,
          usingDefault: true
        });
      }
      
      let output = '';
      let stderr = '';
      
      stream.on('data', (data) => {
        output += data.toString('utf8');
      });
      
      stream.stderr.on('data', (data) => {
        stderr += data.toString('utf8');
      });
      
      stream.on('close', (code) => {
        console.log(`pwd命令执行完毕，退出码: ${code}, 原始输出: "${output}", 错误: "${stderr.trim()}"`);
        
        // 清理输出中的特殊字符和终端控制序列
        let cleanOutput = output
          .replace(/\r?\n/g, '\n') // 规范化换行符
          .replace(/\x1B\[\??[\d;]*[A-Za-z]/g, '') // 移除ANSI转义序列
          .trim();
        
        // 如果有多行，取第一行非空行
        if (cleanOutput.includes('\n')) {
          cleanOutput = cleanOutput.split('\n').filter(line => line.trim()).shift() || '';
        }
        
        console.log(`清理后的目录输出: "${cleanOutput}"`);
        
        // 尝试从输出中获取目录，即使有错误也先尝试获取
        const directory = cleanOutput;
        
        // 如果命令执行失败且没有输出，才使用默认目录
        if ((code !== 0 || stderr) && !directory) {
          console.error(`获取工作目录失败，错误码: ${code}, 错误信息: ${stderr}`);
          return resolve({
            success: true,
            directory: defaultDirectory,
            message: `使用默认目录 (命令失败，代码: ${code})`,
            usingDefault: true
          });
        }
        
        // 没有得到任何目录信息时使用默认目录
        if (!directory) {
          console.warn('pwd命令没有输出，使用默认目录');
          return resolve({
            success: true,
            directory: defaultDirectory,
            message: '使用默认目录 (命令无输出)',
            usingDefault: true
          });
        }
        
        // 确保目录以斜杠结尾
        const formattedDir = directory.endsWith('/') ? directory : directory + '/';
        
        console.log(`成功获取当前工作目录: ${formattedDir}`);
        resolve({
          success: true,
          directory: formattedDir,
          message: '成功获取当前工作目录'
        });
      });
      
      // 添加错误处理 - 流错误时尝试使用已收集的输出，如果有的话
      stream.on('error', (streamErr) => {
        console.error('获取工作目录流错误:', streamErr);
        
        // 如果已经收集了一些输出，尝试使用它
        if (output && output.trim()) {
          const directory = output.trim();
          const formattedDir = directory.endsWith('/') ? directory : directory + '/';
          
          console.log(`尽管有错误，但已获取到目录: ${formattedDir}`);
          return resolve({
            success: true,
            directory: formattedDir,
            message: '成功获取当前工作目录 (尽管有错误)',
            hadError: true
          });
        }
        
        // 否则使用默认目录
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

export async function cancelUpload(sessionId, uploadId) {
  try {
    console.log(`⭐ sftpManager.cancelUpload - 尝试取消上传: sessionId=${sessionId}, uploadId=${uploadId}`);
    dumpUploadTasks();
    
    const uploadTask = uploadTasks.get(uploadId);
    if (!uploadTask) {
      console.log(`⭐ 上传任务不存在或已完成: ${uploadId}`);
      return { success: false, message: '上传任务不存在或已完成' };
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
      return { success: false, message: '会话ID不匹配' };
    }
    
    // 标记为已取消
    uploadTask.isCancelled = true;
    console.log(`⭐ 已将任务标记为取消`);
    
    // 销毁流，触发关闭事件
    if (uploadTask.readStream && typeof uploadTask.readStream.destroy === 'function') {
      console.log(`⭐ 正在销毁读取流`);
      uploadTask.readStream.destroy();
    } else {
      console.log(`⭐ 读取流不存在或不可销毁`);
    }
    
    if (uploadTask.writeStream && typeof uploadTask.writeStream.destroy === 'function') {
      console.log(`⭐ 正在销毁写入流`);
      uploadTask.writeStream.destroy();
    } else {
      console.log(`⭐ 写入流不存在或不可销毁`);
    }
    
    console.log(`⭐ 成功取消上传: ${uploadId}`);
    return { success: true, message: '上传已取消' };
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
