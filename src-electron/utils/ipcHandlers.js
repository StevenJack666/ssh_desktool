import { ipcMain } from 'electron';
import * as db from './database.js';
import * as sshManager from './sshManager.js';

function registerIPCHandlers() {
    // 数据库连接操作
    ipcMain.handle('db-get-items', () => db.getAllItems());
    ipcMain.handle('db-add-item', (e, item) => db.addItem(item));
    ipcMain.handle('db-delete-item', (e, id) => db.deleteItem(id));
    ipcMain.handle('db-update-item', (e, id, item) => db.updateItem(id, item));
    // 新增：更新条目状态（来自 preload 的 updateItemStatus）
    ipcMain.handle('db-update-item-status', (e, id, status) => db.updateItemStatus(id, status));
    // ssh连接操作
    ipcMain.handle('ssh-connect', (e, id, config) => sshManager.createSSHClient(id, config, e));
    ipcMain.handle('ssh-send', (e, id, command) => sshManager.sendCommand(id, command));
    ipcMain.handle('ssh-disconnect', (e, id) => sshManager.disconnectSSH(id));
    ipcMain.handle('ssh-alive', (e, id) => sshManager.clientIsAlive(id));
}

export { registerIPCHandlers };
