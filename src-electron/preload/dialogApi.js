import { ipcRenderer } from 'electron';

const dialogApi = {
  // 显示打开文件对话框
  showOpenDialog: async (options) => {
    return await ipcRenderer.invoke('dialog:showOpenDialog', options);
  },
  
  // 显示保存文件对话框
  showSaveDialog: async (options) => {
    return await ipcRenderer.invoke('dialog:showSaveDialog', options);
  },
  
  // 显示消息框
  showMessageBox: async (options) => {
    return await ipcRenderer.invoke('dialog:showMessageBox', options);
  }
};

export default dialogApi;
