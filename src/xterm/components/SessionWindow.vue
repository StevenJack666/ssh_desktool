<template>
  <div class="session-window">
    <!-- 会话信息栏 -->
    <div class="session-header">
      <div class="session-info">
        <span class="session-title">{{ sessionTitle }}</span>
        <span class="session-status" :class="{ connected: isConnected, connecting: isConnecting }">
          {{ statusText }}
        </span>
      </div>
      <div class="session-actions">
        <button @click="handleReconnect" :disabled="isConnecting" class="action-btn">
          {{ isConnecting ? '连接中...' : '重新连接' }}
        </button>
        <button @click="handleDisconnect" :disabled="!isConnected" class="action-btn">
          断开连接
        </button>
      </div>
    </div>

    <!-- 终端容器 -->
    <div class="terminal-container">
      <div 
        ref="terminalElement" 
        class="terminal"
        tabindex="0"
      ></div>
    </div>

    <!-- 连接状态遮罩 -->
    <div v-if="showConnectingOverlay" class="connecting-overlay">
      <div class="connecting-content">
        <div class="spinner"></div>
        <p>正在连接到 {{ sessionData.host }}...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useSSHSession } from '../composables/useSSHSession.js'

// 会话数据（从主窗口传递过来）
const sessionData = ref(null)
const terminalElement = ref(null)
const isConnected = ref(false)
const isConnecting = ref(false)

// 使用 SSH 会话管理
const {
  sessions,
  createNewSession,
  connectSession,
  deleteSession,
  setTerminalContainer
} = useSSHSession()

// 计算属性
const sessionTitle = computed(() => {
  if (!sessionData.value) return '终端会话'
  return sessionData.value.display_name || 
         `${sessionData.value.host}@${sessionData.value.username}:${sessionData.value.port}`
})

const statusText = computed(() => {
  if (isConnecting.value) return '连接中'
  if (isConnected.value) return '已连接'
  return '未连接'
})

const showConnectingOverlay = computed(() => {
  return isConnecting.value && !isConnected.value
})

// 当前会话 ID
let currentSessionId = null

// 处理重新连接
async function handleReconnect() {
  if (!sessionData.value || isConnecting.value) return
  
  try {
    isConnecting.value = true
    
    // 如果已有会话，先删除
    if (currentSessionId) {
      await deleteSession(currentSessionId)
      currentSessionId = null
      isConnected.value = false
    }
    
    // 创建新会话
    const session = await createNewSession({ ...sessionData.value }, false)
    if (session) {
      currentSessionId = session.id
      // 设置终端容器
      setTerminalContainer(terminalElement.value, session.id)
      // 连接会话
      await connectSession(session)
      isConnected.value = true
    }
  } catch (error) {
    console.error('Reconnection failed:', error)
    alert('连接失败: ' + error.message)
  } finally {
    isConnecting.value = false
  }
}

// 处理断开连接
function handleDisconnect() {
  if (currentSessionId) {
    deleteSession(currentSessionId)
    currentSessionId = null
    isConnected.value = false
  }
}

// 监听来自主进程的会话数据
let reconnectTriggered = false

function handleSessionData(event, data) {
  console.log('Received session data:', data)
  sessionData.value = data

  if (!reconnectTriggered && sessionData.value) {
    reconnectTriggered = true
    nextTick(() => handleReconnect().finally(() => {
      reconnectTriggered = false
    }))
  }
}

// 初始化
onMounted(() => {
  // 监听会话数据
  if (window.api?.window) {
    window.api.window.onSessionData(handleSessionData)
  }
  
  console.log('Session window component mounted')
})

onUnmounted(() => {
  // 清理会话
  if (currentSessionId) {
    deleteSession(currentSessionId)
  }
})
</script>

<style scoped>
.session-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
  color: #e6eef8;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  min-height: 48px;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-title {
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
}

.session-status {
  font-size: 12px;
  color: #888;
}

.session-status.connected {
  color: #4caf50;
}

.session-status.connecting {
  color: #ff9800;
}

.session-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  background: #4a5568;
  color: #e5e7eb;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.action-btn:hover:not(:disabled) {
  background: #5a6578;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.terminal-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.terminal {
  width: 100%;
  height: 100%;
  padding: 8px;
  background: #000;
  color: #fff;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
  outline: none;
}

.connecting-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.connecting-content {
  text-align: center;
  color: #fff;
}

.connecting-content p {
  margin-top: 16px;
  font-size: 14px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #333;
  border-top: 4px solid #4caf50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
