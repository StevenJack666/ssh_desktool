// database.js
import path from 'path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}
const databasePath = path.join(dbPath, 'database.db');
const db = new Database(databasePath);

// 初始化表结构
db.prepare(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,
    auth_type TEXT DEFAULT 'password',
    status TEXT DEFAULT 'disconnected',
    private_key_path TEXT DEFAULT NULL,
    passphrase TEXT DEFAULT NULL,
    display_name TEXT DEFAULT NULL
  )
`).run();

// 检查表结构并添加缺失的字段
function ensureColumnExists(columnName, columnType) {
  try {
    // 检查列是否存在
    const tableInfo = db.prepare("PRAGMA table_info(items)").all();
    const columnExists = tableInfo.some(col => col.name === columnName);
    
    if (!columnExists) {
      db.prepare(`ALTER TABLE items ADD COLUMN ${columnName} ${columnType}`).run();
      console.log(`✓ 字段 ${columnName} 添加成功`);
    }
  } catch (error) {
    console.warn(`添加字段 ${columnName} 时发生错误:`, error.message);
  }
}

// 确保所有必要的字段都存在
ensureColumnExists('private_key_path', 'TEXT DEFAULT NULL');
ensureColumnExists('passphrase', 'TEXT DEFAULT NULL');
ensureColumnExists('display_name', 'TEXT DEFAULT NULL');

export function getAllItems() {
    return db.prepare('SELECT * FROM items').all();
}

export function getItemById(host, port , username, auth_type) {
    const sql = `SELECT * 
        FROM items 
        WHERE host = ? AND port = ? AND username = ? and auth_type = ?`;
    return db.prepare(sql).get(host, port, username, auth_type);
}

export function addItem(item) {
    if (getItemById(item.host, item.port, item.username, item.auth_type)) {
        // 如果已存在则更新
        console.log('update_Item---zhangmm5', item);
        updateItem(item.id, item);
        return { id: item.id };
    }
    console.log('addItem---zhangmm4', item);        
    const { 
        host, 
        port, 
        username, 
        password, 
        auth_type, 
        private_key_path = null, 
        passphrase = null,
        display_name = null 
    } = item;
    const info = db.prepare(`
        INSERT INTO items (host, port, username, password, auth_type, private_key_path, passphrase, display_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(host, port || 22, username, password, auth_type || 'password', private_key_path, passphrase, display_name);
    return { id: info.lastInsertRowid, ...item };
}

export function deleteItem(id) {
    const info = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return info.changes > 0;
}

export function updateItem(id, item) {
    console.log('updateItem 调用参数:', { id, item });
    
    if (!item) {
        throw new Error('item 参数不能为空');
    }
    
    const { 
        host, 
        port, 
        username, 
        password, 
        auth_type, 
        private_key_path = null, 
        passphrase = null,
        display_name = null 
    } = item;
    
    // 验证必需的字段
    if (!host || !username) {
        throw new Error('host 和 username 是必需字段');
    }
    
    const info = db.prepare(`
        UPDATE items SET host = ?, port = ?, username = ?, password = ?, auth_type = ?,
        private_key_path = ?, passphrase = ?, display_name = ?
        WHERE id = ?
    `).run(host, port || 22, username, password, 
        auth_type || 'password', private_key_path, passphrase, display_name, id);
    return info.changes > 0;
}

export function updateItemStatus(id, status) {
    const info = db.prepare(`UPDATE items SET status = ? WHERE id = ?`).run(status, id);
    return info.changes > 0;
}

export function updateItemDisplayName(id, displayName) {
    const info = db.prepare(`UPDATE items SET display_name = ? WHERE id = ?`).run(displayName, id);
    return info.changes > 0;
}