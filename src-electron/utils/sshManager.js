import { Client } from 'ssh2';

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
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(w => {
      try { w.webContents.send(channel, ...args); } catch {}
    });
  }
}

// 发送状态更新
function updateStatus(client, id, config, status) {
  sendIPC(client, `ssh-status:${id}`, status, config);
  sendIPC(client, 'ssh-status-global', id, status, config);
}

// ---------------------- 创建 SSH 客户端 ----------------------
export async function createSSHClient(id, config, event) {
  id = String(id);

  if (clientIsAlive(id)) return { success: true, message: '已连接' };

  const sshClient = new Client();
  clients.set(id, sshClient);
  sshClient._sender = event?.sender || null;

  return new Promise((resolve) => {
    let resolved = false; // 确保只 resolve 一次

    const finish = (success, message) => {
      if (!resolved) { resolved = true; resolve({ success, message }); }
    };

    sshClient.on('ready', () => {
      sshClient.shell((err, stream) => {
        if (err) {
          updateStatus(sshClient, id, config, 'error');
          return finish(false, err.message);
        }

        sshClient._shellStream = stream;

        // 数据输出
        stream.on('data', (data) => {
          const text = data.toString();
          sendIPC(sshClient, `ssh-output:${id}`, text);
          sendIPC(sshClient, 'ssh-output-global', id, text);
        });

        // 流关闭
        stream.on('close', () => updateStatus(sshClient, id, config, 'disconnected'));

        updateStatus(sshClient, id, config, 'connected');
        finish(true, '连接成功');
      });
    });

    sshClient.on('error', (err) => {
      updateStatus(sshClient, id, config, 'error');
      finish(false, err.message);
    });

    sshClient.on('close', () => {
      updateStatus(sshClient, id, config, 'disconnected');
      clients.delete(id);
    });

    sshClient.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
    });
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
