import { ipcMain } from 'electron';
import * as sshManager from '../utils/sshManager.js';

export function registerSSHHandlers() {
    // SSH连接
    ipcMain.handle('ssh-connect', async (event, id, config) => {
        try {
            console.log('ssh-connect handler 接收到的参数:', {
                id,
                config: JSON.stringify(config, null, 2)
            });
            console.log('config对象的所有键:', Object.keys(config));
            return await sshManager.createSSHClient(id, config, event);
        } catch (error) {
            console.error('ssh-connect error:', error);
            return { success: false, message: error.message };
        }
    });
    
    // 发送SSH命令
    ipcMain.handle('ssh-send', async (event, id, command) => {
        try {
            return await sshManager.sendCommand(id, command);
        } catch (error) {
            console.error('ssh-send error:', error);
            throw error;
        }
    });
    
    // 断开SSH连接
    ipcMain.handle('ssh-disconnect', async (event, id) => {
        try {
            return await sshManager.disconnectSSH(id);
        } catch (error) {
            console.error('ssh-disconnect error:', error);
            throw error;
        }
    });
    
    // 检查SSH连接状态
    ipcMain.handle('ssh-alive', async (event, id) => {
        try {
            return await sshManager.clientIsAlive(id);
        } catch (error) {
            console.error('ssh-alive error:', error);
            return false;
        }
    });
}
