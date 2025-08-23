/**
 * IPC处理器索引文件
 * 统一导出所有处理器注册函数
 */

export { registerDatabaseHandlers } from './databaseHandlers.js';
export { registerSSHHandlers } from './sshHandlers.js';
export { registerDialogHandlers } from './dialogHandlers.js';

// 未来可以在这里添加更多处理器
// export { registerFileHandlers } from './fileHandlers.js';
// export { registerSystemHandlers } from './systemHandlers.js';
// export { registerNotificationHandlers } from './notificationHandlers.js';
