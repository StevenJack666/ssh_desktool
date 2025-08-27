import { ipcMain } from 'electron';
import * as db from '../utils/database.js';

export function registerDatabaseHandlers() {
    // 获取所有项目
    ipcMain.handle('db-get-items', async (event) => {
        try {
            return await db.getAllItems();
        } catch (error) {
            console.error('db-get-items error:', error);
            return [];
        }
    });
    
    // 添加项目
    ipcMain.handle('db-add-item', async (event, item) => {
        try {
            return await db.addItem(item);
        } catch (error) {
            console.error('db-add-item error:', error);
            throw error;
        }
    });
    
    // 删除项目
    ipcMain.handle('db-delete-item', async (event, id) => {
        try {
            return await db.deleteItem(id);
        } catch (error) {
            console.error('db-delete-item error:', error);
            throw error;
        }
    });
    
    // 更新项目
    ipcMain.handle('db-update-item', async (event, id, item) => {
        try {
            console.log('db-update-item 调用参数:', { id, item });
            if (!item) {
                throw new Error('item 参数不能为空');
            }
            return await db.updateItem(id, item);
        } catch (error) {
            console.error('db-update-item error:', error);
            throw error;
        }
    });
    
    // 更新项目状态
    ipcMain.handle('db-update-item-status', async (event, id, status) => {
        try {
            return await db.updateItemStatus(id, status);
        } catch (error) {
            console.error('db-update-item-status error:', error);
            throw error;
        }
    });

    // 重命名项目显示名称
    ipcMain.handle('db-update-item-display-name', async (event, id, displayName) => {
        try {
            return await db.updateItemDisplayName(id, displayName);
        } catch (error) {
            console.error('db-update-item-display-name error:', error);
            throw error;
        }
    });
}
