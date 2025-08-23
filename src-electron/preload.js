
import { contextBridge, ipcRenderer } from 'electron';
import dbApi from './preload/dbApi.js';
import sshApi from './preload/sshApi.js';
import dialogApi from './preload/dialogApi.js';

console.log('Preload script loading...');
console.log('dbApi:', dbApi);
console.log('sshApi:', sshApi);
console.log('dialogApi:', dialogApi);

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('api', {
  db: dbApi,
  ssh: sshApi,
  dialog: dialogApi,
});

console.log('Preload script loaded successfully');
