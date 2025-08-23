import { ipcMain, dialog, BrowserWindow } from 'electron';

export function registerDialogHandlers() {
    // 打开文件对话框
    ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
        try {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            return await dialog.showOpenDialog(focusedWindow, options);
        } catch (error) {
            console.error('showOpenDialog error:', error);
            return { canceled: true, filePaths: [] };
        }
    });
    
    // 保存文件对话框
    ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
        try {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            return await dialog.showSaveDialog(focusedWindow, options);
        } catch (error) {
            console.error('showSaveDialog error:', error);
            return { canceled: true, filePath: '' };
        }
    });
    
    // 消息框对话框
    ipcMain.handle('dialog:showMessageBox', async (event, options) => {
        try {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            return await dialog.showMessageBox(focusedWindow, options);
        } catch (error) {
            console.error('showMessageBox error:', error);
            return { response: 0, checkboxChecked: false };
        }
    });
}
