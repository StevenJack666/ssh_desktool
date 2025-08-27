
import { contextBridge, ipcRenderer } from 'electron';
import dbApi from './preload/dbApi.js';
import sshApi from './preload/sshApi.js';
import dialogApi from './preload/dialogApi.js';
import windowApi from './preload/windowApi.js';

console.log('Preload script loading...');
console.log('dbApi:', dbApi);
console.log('sshApi:', sshApi);
console.log('dialogApi:', dialogApi);
console.log('windowApi:', windowApi);

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('api', {
  db: dbApi,
  ssh: sshApi,
  dialog: dialogApi,
  window: windowApi,
});

console.log('Preload script loaded successfully');
