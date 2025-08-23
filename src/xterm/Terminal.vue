<template>
  <!-- 新增品牌行 -->
  <div class="brand-row">
    <div class="nav-brand">最好用的终端平台</div>
  </div>
  <!-- 新增顶部导航栏 -->
  <header class="top-nav">
    <div class="nav-left">
      <div class="nav-buttons">
        <button class="nav-btn" @click="loadSessions">刷新</button>
        <button class="nav-btn" @click="openCreateModal">新建会话</button>
      </div>
    </div>
    <div class="nav-right">
      <button class="nav-btn" @click="openSettings">设置</button>
    </div>
  </header>

  <div class="app-container">
    <!-- 左侧侧边栏 -->
    <aside class="sidebar">
      <ul class="server-list">
        <li 
          v-for="s in savedSessions" 
          :key="s.id"
          :class="{ active: s.id === selectedServerId }"
          @click="selectServer(s.id)"
          @contextmenu.prevent="openContextMenu($event, s)"
        >
          {{ s.host }}@{{ s.username }}:{{ s.port }}
        </li>
      </ul>

      <!-- 新建会话表单 (已移除，使用顶部“新建”模态代替) -->
    </aside>

    <!-- 右侧终端和标签页 -->
    <main class="main-area">
      <div class="session-tabs">
        <button 
          v-for="s in sessions" 
          :key="s.id" 
          @click="activeSessionId = s.id"
          :class="{ active: s.id === activeSessionId }"
        >
          {{ s.host }}@{{ s.username }}
          <span class="close-button" @click.stop="deleteSession(s.id)">×</span>
        </button>
      </div>

      <div class="terminals">
        <div
          v-for="(s, i) in sessions"
          :key="s.id"
          :ref="el => setTerminalContainer(el, i)"
          class="terminal"
          v-show="s.id === activeSessionId"
          tabindex="0"
        >
          <!-- 顶部显示已连接的 IP（只读样式） -->
          <div v-if="s.isConnected" class="terminal-header">{{ s.host }}</div>
        </div>
      </div>
    </main>

    <!-- 右键菜单 -->
    <ul 
      v-if="contextMenu.visible" 
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <li @click="connectServer(contextMenu.server)">连接</li>
      <li @click="editServer(contextMenu.server)">编辑</li>
      <li @click="deleteSavedServer(contextMenu.server.id)">删除</li>
    </ul>

    <!-- 新建服务器模态窗口 -->
    <div v-if="createModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-content">
        <h3>新建服务器</h3>
        <div class="form-row">
          <input v-model="newHost" placeholder="主机地址 *" required class="input-field" />
          <input v-model="newPort" type="number" placeholder="端口" min="1" max="65535" class="input-field" />
        </div>
        <div class="form-row">
          <input v-model="newUsername" placeholder="用户名 *" required class="input-field" />
          <select v-model="newAuthType" class="input-field">
            <option value="password">密码认证</option>
            <option value="privatekey">密钥认证</option>
          </select>
        </div>
        <div class="form-row" v-if="newAuthType === 'password'">
          <input v-model="newPassword" type="password" placeholder="密码" class="input-field" />
        </div>
        <div class="form-row" v-if="newAuthType === 'privatekey'">
          <div class="file-input-wrapper">
            <input 
              v-model="newPrivateKeyPath" 
              placeholder="私钥文件路径 *" 
              class="input-field file-path-input" 
              readonly
            />
            <button type="button" @click="selectPrivateKeyFile" class="file-select-btn">选择文件</button>
          </div>
          <!-- <input v-model="newPassphrase" type="password" placeholder="密钥密码 (可选)" class="input-field" /> -->
        </div>
        <div class="modal-actions">
          <button @click="saveModal" class="save-btn">保存</button>
          <button @click="closeCreateModal" class="cancel-btn">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { v4 as uuidv4 } from 'uuid'
import 'xterm/css/xterm.css'
// import '../css/style.css'

const sessions = ref([])
const activeSessionId = ref(null)

const newHost = ref('')
const newPort = ref(22)
const newUsername = ref('')
const newPassword = ref('')
const newAuthType = ref('password')
const newPrivateKeyPath = ref('')
const newPassphrase = ref('')
const selectedServerId = ref('')
const savedSessions = ref([])

const terminalContainers = ref([]);

// helper to map DOM nodes from v-for into terminalContainers array
function setTerminalContainer(el, idx) {
  terminalContainers.value[idx] = el
}

// ---------------------- 基础操作 ----------------------
// function clearForm() {
//   newHost.value = ''
//   newPort.value = 22
//   newUsername.value = ''
//   newPassword.value = ''
//   selectedServerId.value = ''
// }
function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    try {
      return String(obj);
    } catch (e2) {
      return "<unstringifiable>";
    }
  }
}

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  server: null
})


function openContextMenu(event, server) {
  // clamp coordinates to viewport so menu won't render off-screen
  const menuWidth = 140;
  const menuHeight = 120; // approximate
  const x = Math.min(event.clientX, window.innerWidth - menuWidth);
  const y = Math.min(event.clientY, window.innerHeight - menuHeight);
  console.log('openContextMenu', { x: event.clientX, y: event.clientY, clamped: { x, y }, server });
  contextMenu.value = {
    visible: true,
    x,
    y,
    server
  }
}
// 点击空白处关闭菜单
function closeContextMenu() {
  
  contextMenu.value.visible = false
}


async function loadSessions() {
  if (!window.api?.db) return
  const items = await window.api.db.getItems()
  console.log('zhangmm11: ', safeStringify(items))
  savedSessions.value = items
}

async function saveSession(session) {
  if (!window.api?.db) return
  const data = {
    id: session.id,
    host: session.host,
    port: session.port,
    username: session.username,
    password: session.password,
    auth_type: session.auth_type || 'password'
  }
  const result = await window.api.db.addItem(data)
  session.id = result.id
  // ensure savedSessions is updated so the sidebar shows the new/updated server
  const item = {
    id: session.id,
    host: session.host,
    port: session.port,
    username: session.username,
    password: session.password,
    auth_type: session.auth_type || 'password'
  }
  const existingIndex = savedSessions.value.findIndex(s => String(s.id) === String(session.id))
  if (existingIndex >= 0) {
    savedSessions.value.splice(existingIndex, 1, item)
  } else {
    savedSessions.value.push(item)
  }
  return result
}

async function createAndSaveServer(data) {
  try {
    if (!window.api?.db) return
    const result = await window.api.db.addItem(data)
    // update local savedSessions to refresh sidebar
    savedSessions.value.push({ ...data, id: result.id })
  } catch (e) {
    console.error('createAndSaveServer error', e)
  }
}

// ---------------------- 会话管理 ----------------------
function removeSessionByIdentity({ host, port, username }) {
  const idx = sessions.value.findIndex(s => s.host === host && Number(s.port) === Number(port) && s.username === username)
  if (idx >= 0) sessions.value.splice(idx, 1)
  if (!sessions.value.find(s => s.id === activeSessionId.value)) activeSessionId.value = sessions.value[0]?.id || null
}

async function deleteSession(id) {
  if (!window.api?.db) return
  await window.api.db.deleteItem(id)
  const idx = sessions.value.findIndex(s => s.id === id)
  if (idx >= 0) sessions.value.splice(idx, 1)
  activeSessionId.value = sessions.value[0]?.id || null
}

// ---------------------- 新建/连接会话 ----------------------
async function createNewSession(config, saveToDB = true) {
  // 避免重复
  const exist = sessions.value.find(s => s.host === config.host && s.port === config.port && s.username === config.username)
  if (exist) {
    console.warn('Session already exists:', safeStringify(exist))
    return exist
  }
  const id = config.id || uuidv4()
  const terminal = new Terminal({ cursorBlink: true })
  const fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)

  const session = {
    id,
    terminal,
    fitAddon,
    container: null,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    auth_type: config.auth_type || 'password',
    isConnected: false
  }

  sessions.value.push(session)
  activeSessionId.value = session.id

  if (!config.id && saveToDB) await saveSession(session)

  await nextTick()
  const idx = sessions.value.indexOf(session)
  const container = terminalContainers.value[idx]
  if (container) {
    session.container = container
    terminal.open(container)
    fitAddon.fit()
    terminal.focus()
  }
  // 不再自动连接：改为手动触发 connectSession(session)
  bindSessionIPC(session)
  return session
}

async function connectSession(session) {
  if (!window.api?.ssh) {
    session.terminal.write('\x1b[31mSSH API 不可用\x1b[0m\r\n')
    return
  }

  const result = await window.api.ssh.connect(session.id, {
    host: session.host,
    port: session.port,
    username: session.username,
    password: session.password
  })
  if (result.success) {


    console.log('zhangmm_test_connectSession', result)
    session.isConnected = true
    session.terminal.write('\x1b[33m连接成功\x1b[0m\r\n')
  } else {
    session.terminal.write(`\x1b[31m连接失败: ${result.message}\x1b[0m\r\n`)
  }
}

// ---------------------- IPC 绑定 ----------------------
function bindSessionIPC(session) {
  const id = String(session.id)
  if (!window.api?.ssh) return

  window.api.ssh.onOutput(id, (data) => {
    console.log('onOutput', id, data);
    session.terminal.write(data)
  })
  window.api.ssh.onDisconnect(id, () => removeSessionByIdentity({ host: session.host, port: session.port, username: session.username }))
  window.api.ssh.onStatusChange(id, (status) => {
    if (['disconnected', 'closed', 'ended', 'error'].includes(status)) {
      removeSessionByIdentity({ host: session.host, port: session.port, username: session.username })
    }
  })

  session.terminal.onData((data) => window.api.ssh.send(id, data))
}

// ---------------------- watch ----------------------
watch(activeSessionId, async (id) => {
  await nextTick()
  const s = sessions.value.find(x => x.id === id)
  if (!s) return
  s.fitAddon.fit()
  s.terminal.focus()
})

// ---------------------- 生命周期 ----------------------
onMounted(() => {
  loadSessions()
  // 点击任意位置关闭右键菜单
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})

async function connectServer(server) {
  if (!server) return
  try {
    closeContextMenu()
    // 支持传入对象或 id
    const srv = server && server.id ? server : savedSessions.value.find(s => String(s.id) === String(server))
    if (!srv) return
    // 创建或获取会话（不自动连接），然后显式连接
    const session = await createNewSession({ ...srv, id: srv.id }, true)
    if (session) {
      await connectSession(session)
    }
  } catch (e) {
    console.error('connectServer error', e)
  }
}

function editServer(server) {
  if (!server) return
  // 把保存的服务器填入表单以供编辑
  newHost.value = server.host || ''
  newPort.value = server.port || 22
  newUsername.value = server.username || ''
  newPassword.value = server.password || ''
  newAuthType.value = server.auth_type || 'password'
  newPrivateKeyPath.value = server.private_key_path || ''
  newPassphrase.value = server.passphrase || ''
  selectedServerId.value = String(server.id)
  // 打开模态以便编辑
  createModal.value = true
  closeContextMenu()
}

async function deleteSavedServer(id) {

  if (!window.api?.db) return
  await window.api.db.deleteItem(id)
  savedSessions.value = savedSessions.value.filter(s => s.id !== id)
  if (selectedServerId.value === id) selectedServerId.value = ''
  contextMenu.value.visible = false
}

async function selectServer(id) {
  if (!id) return;
  // find by loose match to tolerate string/number ids
  const server = savedSessions.value.find(s => String(s.id) === String(id));
  if (!server) return;
  // populate form fields
  newHost.value = server.host || '';
  newPort.value = server.port || 22;
  newUsername.value = server.username || '';
  newPassword.value = server.password || '';
  selectedServerId.value = String(server.id);

  try {
    await createNewSession({ ...server, id: server.id }, true);
  } catch (e) {
    console.error('selectServer createNewSession error', e);
  }
}

// 新增：设置按钮处理器（可扩展为打开设置面板）
function openSettings() {
  console.log('openSettings clicked')
  // TODO: 打开设置对话框或侧边栏
}

// 文件选择器
async function selectPrivateKeyFile() {
  try {
    // 优先使用Electron的dialog API（如果可用）
    if (window.api?.dialog) {
      const result = await window.api.dialog.showOpenDialog({
        title: '选择私钥文件',
        filters: [
          { name: '所有文件', extensions: ['*'] },
          { name: 'SSH私钥文件', extensions: ['pem', 'key', 'ppk', 'openssh'] },
          { name: 'PEM文件', extensions: ['pem'] },
          { name: '密钥文件', extensions: ['key'] },
          { name: 'PuTTY私钥', extensions: ['ppk'] }
        ],
        properties: ['openFile', 'showHiddenFiles']
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        newPrivateKeyPath.value = result.filePaths[0]
      }
    } else {
      // fallback: 使用HTML5 file input API
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.pem,.key,.pub,*' // 常见的私钥文件扩展名
      input.style.display = 'none'
      
      input.onchange = (event) => {
        const file = event.target.files?.[0]
        if (file) {
          // 在浏览器环境中只能获取文件名，不能获取完整路径
          newPrivateKeyPath.value = file.name
          console.warn('浏览器环境下无法获取完整文件路径，仅显示文件名')
        }
      }
      
      document.body.appendChild(input)
      input.click()
      document.body.removeChild(input)
    }
  } catch (error) {
    console.error('文件选择失败:', error)
    alert('文件选择失败: ' + error.message)
  }
}

// 新建会话模态窗口状态
const createModal = ref(false)

function openCreateModal() {
  createModal.value = true
}
function closeCreateModal() {
  createModal.value = false
  // 可选：清空表单
  newHost.value = ''
  newPort.value = 22
  newUsername.value = ''
  newPassword.value = ''
  newAuthType.value = 'password'
  newPrivateKeyPath.value = ''
  newPassphrase.value = ''
  // 清除编辑状态
  selectedServerId.value = ''
}

async function saveModal() {
  try {
    // 先校验表单数据
    if (!newHost.value.trim() || !newUsername.value.trim() || !newPort.value) {
      alert('请填写完整的主机地址、用户名和端口')
      return
    }
    
    if (newPort.value < 1 || newPort.value > 65535) {
      alert('端口号必须在 1-65535 之间')
      return
    }

    // 根据认证类型进行校验
    if (newAuthType.value === 'privatekey' && !newPrivateKeyPath.value.trim()) {
      alert('使用密钥认证时，必须提供私钥文件路径')
      return
    }

    const data = {
      host: newHost.value.trim(),
      port: Number(newPort.value),
      username: newUsername.value.trim(),
      password: newPassword.value,
      auth_type: newAuthType.value,
      private_key_path: newPrivateKeyPath.value.trim(),
      passphrase: newPassphrase.value
    }

    // if selectedServerId is set, treat as edit/update
    if (selectedServerId.value) {
      data.id = selectedServerId.value
      try {
        if (window.api?.db?.addItem) {
          // fallback: try addItem (some DB bridges may not implement update yet)
          await window.api.db.addItem(data)
        }
      } catch (err) {
        console.error('saveModal db update failed', err)
      }
      // update local savedSessions
      const item = { 
        id: data.id, 
        host: data.host, 
        port: data.port, 
        username: data.username, 
        password: data.password, 
        auth_type: data.auth_type,
        private_key_path: data.private_key_path,
        passphrase: data.passphrase
      }
      const idx = savedSessions.value.findIndex(s => String(s.id) === String(data.id))
      if (idx >= 0) savedSessions.value.splice(idx, 1, item)
      else savedSessions.value.push(item)
    } else {
      await createAndSaveServer(data)
    }
  } catch (e) {
    console.error('saveModal error', e)
  } finally {
    closeCreateModal()
  }
}
</script>

<style scoped>

html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.app-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: row; /* 左右结构 */
}

/* 新增顶部导航样式 */
.top-nav {
  position: fixed;
  top: 28px;
  left: 0;
  right: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: linear-gradient(90deg, #1f2937, #111827);
  color: #e5e7eb;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  z-index: 10001;
}

.nav-left {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.brand-row {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: linear-gradient(90deg, #1f2937, #111827);
  color: #cbd5e1;
  border-bottom: 1px solid rgba(255,255,255,0.02);
  z-index: 10002;
}

.nav-brand {
  font-size: 12px;
  color: #cbd5e1;
  font-weight: 500;
  margin-left: 4px;
}

.nav-buttons { display: flex; gap: 8px; align-items: center; }

.nav-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  color: #e5e7eb;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.nav-btn:hover {
  background: rgba(255,255,255,0.02);
}

.session-add { display: flex; gap: 10px; padding: 10px; background: #222; }
.input-field { padding: 8px; border-radius: 4px; border: 1px solid #555; background: #333; color: #eee; }
.input-field:focus { border-color: #4caf50; outline: none; }
select.input-field { 
  background: #333; 
  color: #eee; 
  border: 1px solid #555; 
  padding: 8px; 
  border-radius: 4px; 
  cursor: pointer;
}
select.input-field option {
  background: #333;
  color: #eee;
}
.port-input { width: 100px; }
.create-btn { padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; }

.session-tabs {
  display: flex;
  gap: 5px;
  padding: 5px;
  z-index: 1;
}

.close-button {
  margin-left: 5px;
  cursor: pointer;
  color: #fff;
}

.terminals {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;      /* 撑满宽度 */
  margin: 0;        /* 去掉外边距 */
  padding: 0;       /* 去掉内边距 */
  overflow: hidden;
}

.terminal {
  width: 100%;
  height: 100%;

  text-align: left !important;
  justify-content: flex-start !important;
  align-items: flex-start !important;

  position: relative; /* 允许 header 绝对定位 */
  flex: 1 1 auto;
  /* width: 100%; */
  background: black;
  min-height: 0; /* allow flex children to shrink properly */
  cursor: default; /* don't show text I-beam cursor to avoid 'input' feeling */
  padding-top: 30px; /* 给顶部 header 留出空间 */
  overflow: hidden;
  margin: 0;        /* 避免左右留白 */
}

/* 顶部只读样式，看起来像输入框但不可编辑，只显示 IP */
.terminal-header {
  position: absolute;
  top: 4px;
  left: 8px;
  right: 8px;
  height: 24px;
  line-height: 24px;
  padding: 0 10px;
  background: rgba(0,0,0,0.75);
  color: #00ff88;   /* 绿色高亮，显眼 */
  font-size: 12px;  /* 加大字号 */
  font-weight: bold;
  border-radius: 4px;
  z-index: 9999;    /* 保证在最上层 */
  pointer-events: none; /* 不影响输入 */
}

/* Hide xterm helper textarea caret and any stray caret rendered at top of the page */
.terminal .xterm-helper-textarea {
  opacity: 0 !important;
  caret-color: transparent !important;
  color: transparent !important;
  background: transparent !important;
  outline: none !important;
  border: none !important;
  position: absolute !important;
  left: 0;
  top: 0;
}
/* Prevent helper elements from showing or capturing events */
/* .terminal .xterm-helpers {
  pointer-events: none;
} */

/* 侧边栏：固定在左侧 */
.sidebar {
  box-sizing: border-box;
  position: fixed;
  padding: 10px;
  top: 76px; /* brand-row (28) + top-nav (48) */
  left: 0;
  bottom: 0;
  width: 280px;
  background: #252526;
  padding: 10px;
  border-right: 1px solid #444;
  overflow-y: auto;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  color: #e6eef8;
}
.sidebar h3 {
  color: #cfd8e3;
  font-size: 14px;
  margin: 4px 0; /* 减少上下边距 */
}

/* 主内容区域让出侧边栏空间，并垂直布局 */
.main-area {
  margin-left: 280px;
  padding: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.brand-row { z-index: 10002; }
.top-nav { 
  z-index: 10001; 
  height: 50px;
  background: #34495e;
  color: white;
  display: flex;
  align-items: center;
  padding-left: 10px;
  box-sizing: border-box;
}

.server-list {
  background: transparent;
  padding: 6px;
  border-radius: 6px;
}

.server-list li {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #33363a; /* lighter than before */
  color: #e6eef8;      /* high-contrast text */
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  border: 1px solid rgba(255,255,255,0.04);
}
.server-list li:hover {
  background: #3b82f6; /* blue hover */
  color: white;
}

.server-list li.active {
  background: #0b74da; /* active blue */
  color: white;
  box-shadow: 0 1px 0 rgba(0,0,0,0.25) inset;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: #34383b; /* slightly lighter for contrast */
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  list-style: none;
  padding: 6px 0;
  margin: 0;
  z-index: 10003;
  width: 160px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.5);
}
.context-menu li {
  padding: 8px 14px;
  cursor: pointer;
  color: #e6eef8; /* visible by default */
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.context-menu li:hover {
  background: #2563eb; /* brighter blue */
  color: white;
  border-radius: 4px;
}

.context-menu li:active {
  background: #1e40af;
}

/* 模态窗口样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.modal-content {
  background: #2d2d2d;
  padding: 30px; /* 从20px增加到30px */
  border-radius: 8px;
  width: 500px; /* 从400px增加到500px */
  max-width: 95%; /* 从90%增加到95% */
  color: #e6eef8; /* 添加亮色文字 */
}
.modal-content h3 {
  color: #ffffff; /* 标题使用白色 */
  margin-top: 0;
  margin-bottom: 20px;
}
.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}
.form-row .input-field {
  flex: 1;
}

/* 文件选择器样式 */
.file-input-wrapper {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}
.file-path-input {
  flex: 1;
  background: #2a2a2a !important;
  cursor: default;
}
.file-select-btn {
  padding: 8px 12px;
  background: #4a5568;
  color: #e5e7eb;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
}
.file-select-btn:hover {
  background: #5a6578;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
.save-btn {
  padding: 8px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.cancel-btn {
  padding: 8px 16px;
  background: #555;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
