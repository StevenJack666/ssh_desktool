// preload/dbApi.js
import { ipcRenderer } from 'electron';

const dbApi = {
  getItems: () => ipcRenderer.invoke('db-get-items'),
  addItem: (item) => ipcRenderer.invoke('db-add-item', item),
  updateItem: (id, item) => ipcRenderer.invoke('db-update-item', id, item),
  deleteItem: (id) => ipcRenderer.invoke('db-delete-item', id),
};

export default dbApi;