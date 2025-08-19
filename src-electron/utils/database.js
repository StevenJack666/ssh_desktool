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

// 初始化表
db.prepare(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,
    auth_type TEXT DEFAULT 'password',
    status TEXT DEFAULT 'disconnected'
  )
`).run();

export function getAllItems() {
    return db.prepare('SELECT * FROM items').all();
}

export function getItemById(host, port , username) {
    const sql = `SELECT * 
        FROM items 
        WHERE host = ? AND port = ? AND username = ?`;
    return db.prepare(sql).get(host, port, username);
}

export function addItem(item) {
    if (getItemById(item.host, item.port, item.username)) {
        // 如果已存在则更新
        console.log('update_Item---zhangmm5', item);
        updateItem(item.id, item);
        return { id: item.id };
    }
    console.log('addItem---zhangmm4', item);        
    const { host, port, username, password, auth_type } = item;
    const info = db.prepare(`
        INSERT INTO items (host, port, username, password, auth_type)
        VALUES (?, ?, ?, ?, ?)
    `).run(host, port || 22, username, password, auth_type || 'password');
    return { id: info.lastInsertRowid, ...item };
}

export function deleteItem(id) {
    const info = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return info.changes > 0;
}

export function updateItem(id, item) {
    const { host, port, username, password, auth_type } = item;
    const info = db.prepare(`
        UPDATE items SET host = ?, port = ?, username = ?, password = ?, auth_type = ?
        WHERE id = ?
    `).run(host, port || 22, username, password, auth_type || 'password', id);
    return info.changes > 0;
}

export function updateItemStatus(id, status) {
    const info = db.prepare(`UPDATE items SET status = ? WHERE id = ?`).run(status, id);
    return info.changes > 0;
}