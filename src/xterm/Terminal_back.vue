<template>
  <!-- 会话输入表单 -->
  <div class="session-add">
    <select v-model="selectedServerId" @change="onServerSelect" class="input-field server-select">
      <option value="">选择已保存的服务器...</option>
      <option v-for="session in savedSessions" :key="session.id" :value="session.id">
        {{ session.host }}@{{ session.username }}:{{ session.port }}
      </option>
    </select>
    
    <div class="divider">或新建</div>

    <input v-model="newHost" placeholder="主机地址 *" required class="input-field" />
    <input v-model="newPort" type="number" placeholder="端口" min="1" max="65535" class="input-field port-input" />
    <input v-model="newUsername" placeholder="用户名 *" required class="input-field" />
    <input v-model="newPassword" type="password" placeholder="密码" class="input-field" />
    <button @click="createAndSaveSession" class="create-btn">新建会话</button>
  </div>

  

  <!-- 终端窗口 -->
  <div class="terminals">
    <div
      v-for="s in sessions"
      :key="s.id"
      ref="terminalContainers"
      class="terminal"
      v-show="s.id === activeSessionId"
      tabindex="0"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { v4 as uuidv4 } from 'uuid'
import 'xterm/css/xterm.css'

const sessions = ref([])
const activeSessionId = ref(null)

const newHost = ref('')
const newPort = ref(22)
const newUsername = ref('')
const newPassword = ref('')
const selectedServerId = ref('')
const savedSessions = ref([])

const terminalContainers = ref([])

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
async function loadSessions() {
  if (!window.api?.db) return
  const items = await window.api.db.getItems()
  console.log('zhangmm11: ', safeStringify(items))
  savedSessions.value = items
  items.forEach(item => createNewSession({ ...item, id: item.id }, false))
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
}

function onServerSelect() {
  if (!selectedServerId.value) return
  const server = savedSessions.value.find(s => s.id == selectedServerId.value)
  if (!server) return
  newHost.value = server.host
  newPort.value = server.port
  newUsername.value = server.username
  newPassword.value = server.password || ''
  createNewSession({ ...server, id: server.id })
  selectedServerId.value = ''
}

async function createAndSaveSession() {
  console.log('zhangmm_test222')
  if (!newHost.value.trim() || !newUsername.value.trim() || !newPort.value) return

  const cfg = {
    host: newHost.value.trim(),
    port: Number(newPort.value),
    username: newUsername.value.trim(),
    password: newPassword.value
  }
  try {
    await createNewSession(cfg, true)
  } catch (e) {
    console.error('createAndSaveSession error', e)
  } finally {
    // clearForm()
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
    console.warn('Session already exists:', safeStringify(config))
    return
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
  const container = terminalContainers.value[sessions.value.indexOf(session)]
  if (container) {
    terminal.open(container)
    fitAddon.fit()
    terminal.focus()
  }

  connectSession(session)
  bindSessionIPC(session)
}

async function connectSession(session) {
  if (!window.api?.ssh) {
    session.terminal.write('\x1b[31mSSH API 不可用\x1b[0m\r\n')
    return
  }
  console.log('zhangmm_tset')
  const result = await window.api.ssh.connect(session.id, {
    host: session.host,
    port: session.port,
    username: session.username,
    password: session.password
  })
  if (result.success) {
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

  window.api.ssh.onOutput(id, (data) => session.terminal.write(data))
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
onMounted(() => loadSessions())
async function deleteSavedServer(id) {
  if (!window.api?.db) return
  await window.api.db.deleteItem(id)
  savedSessions.value = savedSessions.value.filter(s => s.id !== id)
  if (selectedServerId.value === id) selectedServerId.value = ''
}
</script>

<style scoped>
.session-add { display: flex; gap: 10px; padding: 10px; background: #222; }
.input-field { padding: 8px; border-radius: 4px; border: 1px solid #555; background: #333; color: #eee; }
.input-field:focus { border-color: #4caf50; outline: none; }
.port-input { width: 100px; }
.create-btn { padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; }
.session-tabs { display: flex; gap: 5px; padding: 5px; }
.close-button { margin-left: 5px; cursor: pointer; color: #fff; }
.terminal { flex-grow: 1; background: black; height: 400px; }
.divider { text-align: center; color: #666; font-size: 14px; align-self: center; }
.divider::before { content: ''; position: absolute; top: 50%; left: -8px; right: -8px; height: 1px; background: #555; z-index: 1; }
.server-select { min-width: 200px; }
.delete-saved-btn {
  padding: 4px 8px;
  margin-left: 5px;
  background: #d9534f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
/* 新增样式 */
.saved-servers {
  margin: 10px;
  padding: 10px;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 4px;
}

</style>
