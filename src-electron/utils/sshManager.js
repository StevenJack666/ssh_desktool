import { Client } from 'ssh2';
import fs from 'fs';
import { BrowserWindow } from 'electron';

// ---------------------- 辅助函数 ----------------------
function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch (e) { try { return String(obj); } catch (e2) { return '<unstringifiable>'; } }
}

const clients = new Map();

// 判断客户端是否存活
export function clientIsAlive(id) {
  const conn = clients.get(String(id));
  if (!conn) return false;
  // Prefer checking the allocated shell stream (most reliable indicator)
  if (conn._shellStream && typeof conn._shellStream.writable !== 'undefined') {
    return !!conn._shellStream.writable;
  }
  // Fallback to underlying socket writable flag
  if (conn._sock && typeof conn._sock.writable !== 'undefined') {
    return !!conn._sock.writable;
  }
  return false;
}

// 统一 IPC 发送
function sendIPC(client, channel, ...args) {
  const target = client._sender;
  if (target?.send) {
    target.send(channel, ...args);
  } else {
    BrowserWindow.getAllWindows().forEach(w => {
      try { w.webContents.send(channel, ...args); } catch {}
    });
  }
}

// 发送状态更新
function updateStatus(client, id, config, status) {
  sendIPC(client, `ssh-status:${id}`, status, config);
}

// ---------------------- 创建 SSH 客户端 ----------------------
export async function createSSHClient(id, config, event) {
  id = String(id);
  console.log('createSSHClient 开始连接，配置信息:', {
    id,
    host: config.host,
    port: config.port,
    username: config.username,
    auth_type: config.auth_type,
    hasPassword: !!config.password,
    hasPrivateKeyPath: !!config.private_key_path
  });

  if (clientIsAlive(id)) return { success: true, message: '已连接' };

  const sshClient = new Client();
  clients.set(id, sshClient);
  sshClient._sender = event?.sender || null;

  return new Promise((resolve) => {
    let resolved = false; // 确保只 resolve 一次

    const finish = (success, message) => {
      console.log('SSH连接结束:', { success, message, id });
      if (!resolved) { resolved = true; resolve({ success, message }); }
    };

    sshClient.on('ready', () => {
      console.log('SSH客户端ready事件触发, id:', id);
      sshClient.shell((err, stream) => {
        if (err) {
          console.error('创建shell失败:', err);
          updateStatus(sshClient, id, config, 'error');
          return finish(false, err.message);
        }

        console.log('Shell创建成功, id:', id);
        sshClient._shellStream = stream;

        // 数据输出
        stream.on('data', (data) => {
          const text = data.toString();
          console.log(`[SSH Output ${id}] 收到数据:`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
          sendIPC(sshClient, `ssh-output:${id}`, text);
        });

        // 流关闭
        stream.on('close', () => {
          console.log('Shell stream关闭, id:', id);
          updateStatus(sshClient, id, config, 'disconnected');
          sendIPC(sshClient, `ssh-disconnect:${id}`);
        });

        // 流错误
        stream.on('error', (err) => {
          console.error('Shell stream错误, id:', id, err);
          updateStatus(sshClient, id, config, 'error');
        });

        updateStatus(sshClient, id, config, 'connected');
        
        // 发送初始命令来触发输出
        setTimeout(() => {
          console.log(`[SSH ${id}] 发送初始命令: whoami`);
          stream.write('whoami\n');
        }, 1000);
        
        finish(true, '连接成功');
      });
    });

    sshClient.on('error', (err) => {
      console.error('SSH连接错误详情:', {
        message: err.message,
        code: err.code,
        level: err.level,
        description: err.description
      });
      
      // 针对认证失败的详细调试
      if (err.message === 'All configured authentication methods failed') {
        console.error('认证失败详细分析:', {
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
        
        // 检查私钥格式
        if (connectConfig.privateKey) {
          const keyStart = connectConfig.privateKey.substring(0, 100);
          console.log('私钥开头内容检查:', keyStart);
          
          // 检查私钥格式是否正确
          if (!keyStart.includes('BEGIN') || !keyStart.includes('PRIVATE KEY')) {
            console.error('私钥格式可能不正确，应该包含 BEGIN...PRIVATE KEY');
          }
        }
      }
      
      updateStatus(sshClient, id, config, 'error');
      finish(false, err.message);
    });

    sshClient.on('close', () => {
      console.log('SSH连接关闭, id:', id);
      updateStatus(sshClient, id, config, 'disconnected');
      clients.delete(id);
    });

    // 构建连接配置
    const connectConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      keepaliveInterval: 30000, // 30秒心跳
      keepaliveCountMax: 3,     // 最大重试次数
      readyTimeout: 20000,      // 20秒连接超时
    };

    console.log('基础连接配置:', connectConfig);

    // 根据认证类型添加认证参数
    if (config.auth_type === 'privatekey' && config.private_key_path != null) {
      // 私钥认证：读取私钥文件内容
      console.log('使用私钥认证，私钥路径:', config.private_key_path);
      try {
        // 读取私钥文件内容并赋值给SSH2库需要的privateKey字段
        connectConfig.privateKey = fs.readFileSync(config.private_key_path, 'utf8');
        
        // 如果有passphrase，也要添加
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase;
        }
      } catch (error) {
        console.error('读取私钥文件失败:', error);
        return finish(false, `读取私钥文件失败: ${error.message}`);
      }
    } else {
      // 密码认证
      console.log('使用密码认证');
      if (!config.password) {
        console.error('密码为空');
        return finish(false, '密码不能为空');
      }
      connectConfig.password = config.password;
    }
    
    console.log('最终连接配置 (隐藏敏感信息):', {
      host: connectConfig.host,
      port: connectConfig.port,
      username: connectConfig.username,
      hasPassword: !!connectConfig.password,
      hasPrivateKey: !!connectConfig.privateKey,
      hasPassphrase: !!connectConfig.passphrase,
      privateKeyType: connectConfig.privateKey ? 
        (connectConfig.privateKey.includes('RSA') ? 'RSA' : 
         connectConfig.privateKey.includes('ECDSA') ? 'ECDSA' :
         connectConfig.privateKey.includes('ED25519') ? 'ED25519' : 'Unknown') : 'None'
    });
    
    console.log('开始SSH连接...');
    sshClient.connect(connectConfig);
  });
}

// ---------------------- 发送命令 ----------------------
export function sendCommand(id, command) {
  id = String(id);
  const sshClient = clients.get(id);
  if (!sshClient?._shellStream) return { success: false, message: '未建立连接' };

  try {
    const payload = typeof command === 'string' ? command.replace(/\r/g, '\n') : String(command);
    sshClient._shellStream.write(Buffer.from(payload, 'utf8'));
    return { success: true };
  } catch (e) {
    console.error('sshManager.sendCommand failed:', e);
    return { success: false, message: e.message };
  }
}

// ---------------------- 断开连接 ----------------------
export function disconnectSSH(id) {
  id = String(id);
  const sshClient = clients.get(id);
  if (!sshClient) return { success: false, message: '没有活动的连接' };

  sshClient.end();
  clients.delete(id);
  return { success: true, message: '连接已断开' };
}

// ---------------------- 获取客户端实例 (可选) ----------------------
export function getSSHClient(id) {
  return clients.get(String(id));
}
