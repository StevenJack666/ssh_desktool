import { 
    registerDatabaseHandlers,
    registerSSHHandlers,
    registerDialogHandlers
} from './index.js';
import { registerWindowHandlers } from './windowHandlers.js';

/**
 * 注册所有IPC处理器
 * 统一管理所有的主进程与渲染进程之间的通信
 */
function registerIPCHandlers() {
    console.log('Registering IPC handlers...');
    
    try {
        // 注册数据库相关处理器
        registerDatabaseHandlers();
        console.log('✓ Database handlers registered');
        
        // 注册SSH相关处理器
        registerSSHHandlers();
        console.log('✓ SSH handlers registered');
        
        // 注册对话框相关处理器
        registerDialogHandlers();
        console.log('✓ Dialog handlers registered');
        
        // 注册窗口相关处理器
        registerWindowHandlers();
        console.log('✓ Window handlers registered');
        
        console.log('🚀 All IPC handlers registered successfully');
    } catch (error) {
        console.error('❌ Error registering IPC handlers:', error);
        throw error;
    }
}

export { registerIPCHandlers };
