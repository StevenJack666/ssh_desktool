
import { contextBridge, ipcRenderer } from 'electron';
import dbApi from './preload/dbApi.js';
import sshApi from './preload/sshApi.js';

console.log('Preload script loading...');
console.log('dbApi:', dbApi);
console.log('sshApi:', sshApi);

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('api', {
  db: dbApi,
  ssh: sshApi,
});

console.log('Preload script loaded successfully');
