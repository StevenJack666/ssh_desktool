<template>
  <!-- 新增品牌行 -->
  <div class="brand-row">
    <div class="nav-brand">最好用的终端平台</div>
  </div>
  <!-- 新增顶部导航栏 - 会话切换器 -->
  <header class="top-nav">
    <div class="nav-left">
      <!-- 会话切换下拉菜单 -->
      <div class="session-switcher" @click="toggleSessionDropdown" ref="sessionSwitcher">
        <div class="current-session">
          <span class="session-title">{{ getCurrentSessionTitle() }}</span>
          <span class="session-status" :class="getCurrentSessionStatus()"></span>
          <span class="dropdown-arrow">▼</span>
        </div>
        
        <div v-if="showSessionDropdown" class="session-dropdown">
          <div class="dropdown-header">
            <span>选择会话</span>
            <button class="close-dropdown" @click.stop="showSessionDropdown = false">×</button>
          </div>
          <div class="session-list">
            <div 
              v-for="session in sessions" 
              :key="session.id"
              @click="handleSwitchSessionFromNav(session.id)"
              :class="['session-item', { 
                active: String(session.id) === activeSessionId,
                connected: session.isConnected 
              }]"
            >
              <div class="session-status-dot" :class="{ 
                connected: session.isConnected,
                connecting: session.isConnecting 
              }"></div>
              <div class="session-info">
                <span class="session-name">{{ getSessionTitle(session) }}</span>
                <span class="session-details">{{ getSessionSubtitle(session) }}</span>
              </div>
              <button 
                v-if="String(session.id) !== activeSessionId"
                @click.stop="handleCloseSession(session.id)" 
                class="session-close"
                title="关闭会话"
              >×</button>
            </div>
          </div>
          <div class="dropdown-footer">
            <button @click="handleOpenCreateModal" class="new-session-btn">+ 新建会话</button>
          </div>
        </div>
      </div>
    </div>
    <div class="nav-right">
      <div class="nav-buttons">
        <button class="nav-btn" @click="handleRefresh">刷新</button>
        <button class="nav-btn" @click="openSettings">设置</button>
      </div>
    </div>
  </header>

  <div class="app-container">
    <!-- 左侧侧边栏 -->
    <ServerSidebar
      :saved-sessions="savedSessions"
      :selected-server-id="selectedServerId"
      @select-server="handleSelectServer"
      @open-context-menu="handleOpenContextMenu"
    />

    <!-- 右侧终端和标签页 -->
    <main class="main-area">
      <TerminalTabs
        :sessions="sessions"
        :active-session-id="activeSessionId"
        @switch-session="handleSwitchSession"
        @close-session="handleCloseSession"
        @new-session="handleOpenCreateModal"
        @show-all-sessions="handleShowAllSessions"
        @show-tab-context-menu="handleShowTabContextMenu"
      />

      <div class="terminals">
        <div
          v-for="s in sessions"
          :key="s.id"
          :ref="el => setTerminalContainer(el, s.id)"
          class="terminal"
          v-show="String(s.id) === activeSessionId"
          tabindex="0"
        >
        </div>
      </div>
    </main>

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :server="contextMenu.server"
      @connect="handleConnectServer"
      @open-in-new-window="handleOpenInNewWindow"
      @edit="handleEditServer"
      @rename="handleRenameServer"
      @delete="handleDeleteServer"
    />

    <!-- 新建/编辑服务器模态窗口 -->
    <ServerModal
      :visible="showModal"
      :initial-data="modalData"
      :edit-mode="editMode"
      @close="handleCloseModal"
      @save="handleSaveServer"
    />

    <!-- 所有会话菜单 -->
        <SessionsMenu
      :visible="showSessionsMenu"
      :sessions="sessions"
      :saved-servers="savedSessions"
      :active-session-id="activeSessionId"
      @close="handleCloseSessionsMenu"
      @switch-session="handleSwitchSession"
      @close-session="handleCloseSession"
      @connectServer="handleConnectServer"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import 'xterm/css/xterm.css'
import '../styles/Terminal.css'

// 导入子组件
import ServerSidebar from './components/ServerSidebar.vue'
import ServerModal from './components/ServerModal.vue'
import TerminalTabs from './components/TerminalTabs.vue'
import ContextMenu from './components/ContextMenu.vue'
import TabContextMenu from './components/TabContextMenu.vue'
import SessionsMenu from './components/SessionsMenu.vue'

// 导入 composables
import { useSSHSession } from './composables/useSSHSession.js'
import { useServerManagement } from './composables/useServerManagement.js'
import { useContextMenu } from './composables/useContextMenu.js'
import { useWindowManager } from './composables/useWindowManager.js'

// 使用 composables
const {
  sessions,
  activeSessionId,
  setTerminalContainer,
  createNewSession,
  connectSession,
  deleteSession,
  switchToSession,
  focusAndRefitActive,
  findSessionByConfig
} = useSSHSession()

const {
  savedSessions,
  selectedServerId,
  loadSessions,
  createAndSaveServer,
  updateServer,
  deleteSavedServer,
  renameServer,
  selectServer,
  getServerById
} = useServerManagement()

const {
  contextMenu,
  openContextMenu,
  closeContextMenu
} = useContextMenu()

// 窗口管理器
const {
  createSessionWindow,
  closeSessionWindow,
  getSessionWindowStatus,
  focusSessionWindow,
  hasOpenWindow,
  initializeEventListeners,
  cleanupEventListeners
} = useWindowManager()

// 模态窗口状态
const showModal = ref(false)
const modalData = ref({})
const editMode = ref(false)

// 标签页右键菜单状态
const tabContextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  session: null
})

// 会话菜单状态
const showSessionsMenu = ref(false)

// 顶部导航会话下拉菜单状态
const showSessionDropdown = ref(false)
const sessionSwitcher = ref(null)

// ---------------------- 事件处理器 ----------------------

function handleRefresh() {
  loadSessions()
}

// ---------------------- 顶部导航会话切换器 ----------------------

function toggleSessionDropdown() {
  showSessionDropdown.value = !showSessionDropdown.value
}

function handleSwitchSessionFromNav(sessionId) {
  handleSwitchSession(sessionId)
  showSessionDropdown.value = false
}

function getCurrentSessionTitle() {
  const currentSession = sessions.value.find(s => String(s.id) === activeSessionId.value)
  if (!currentSession) return '无会话'
  
  return getSessionTitle(currentSession)
}

function getCurrentSessionStatus() {
  const currentSession = sessions.value.find(s => String(s.id) === activeSessionId.value)
  if (!currentSession) return ''
  
  if (currentSession.isConnected) return 'connected'
  if (currentSession.isConnecting) return 'connecting'
  return 'disconnected'
}

function getSessionTitle(session) {
  if (session.serverData?.display_name) {
    return session.serverData.display_name
  }
  return `${session.host}@${session.username}`
}

function getSessionSubtitle(session) {
  if (session.serverData?.display_name) {
    return `${session.host}:${session.port}`
  }
  return `:${session.port}`
}

// ---------------------- 模态窗口和表单处理 ----------------------

function handleOpenCreateModal() {
  editMode.value = false
  modalData.value = {}
  showModal.value = true
}

function handleCloseModal() {
  showModal.value = false
  modalData.value = {}
  editMode.value = false
}

async function handleSaveServer(data) {
  try {
    if (editMode.value && selectedServerId.value) {
      // 编辑模式
      data.id = selectedServerId.value
      await updateServer(data)
    } else {
      // 新建模式
      await createAndSaveServer(data)
    }
  } catch (e) {
    console.error('handleSaveServer error', e)
  } finally {
    handleCloseModal()
  }
}

async function handleSelectServer(id) {
  const server = selectServer(id)
  if (!server) return

  try {
    // 左侧只切换 savedServers 的选中项，不切换终端会话
    // 调整当前活动终端的光标位置/尺寸即可
    focusAndRefitActive()
  } catch (e) {
    console.error('handleSelectServer error', e)
  }
}

function handleSwitchSession(sessionId) {
  switchToSession(sessionId)
}

function handleCloseSession(sessionId) {
  deleteSession(sessionId)
}

function handleOpenContextMenu(event, server) {
  openContextMenu(event, server)
}


async function handleConnectServer(server) {
  console.log('📞 handleConnectServer called with:', server)

  const serverId = String(server.id)
  if (!server) return
  try {
    closeContextMenu()
    
    // 使用更精确的会话查找逻辑，避免重复创建
    let session = findSessionByConfig(server)
    console.log('findSessionByConfig result:', session)
    
    if (!session) {
      console.log('Creating new session for server:', server)
      session = await createNewSession({ ...server, id: server.id }, false)
      console.log('Created session:', session)
    } else {
      console.log('Found existing session, will reuse:', session.id)
    }
    
    if (session) {
      console.log('🔌 Attempting to connect session:', session.id)
      await connectSession(session)
    }
  } catch (e) {
    console.error('handleConnectServer error', e)
  }
}

async function handleOpenInNewWindow(server) {
  console.log('handleOpenInNewWindow called with:', server)
  if (!server) return
  
  try {
    closeContextMenu()
    
    // 创建新窗口
    const result = await createSessionWindow(server)
    if (result.success) {
      console.log('New window created successfully:', result)
    } else {
      console.error('Failed to create new window:', result.error)
      alert('创建新窗口失败: ' + (result.error || '未知错误'))
    }
  } catch (e) {
    console.error('handleOpenInNewWindow error', e)
    alert('创建新窗口失败: ' + e.message)
  }
}

function handleEditServer(server) {
  if (!server) return
  
  editMode.value = true
  selectedServerId.value = String(server.id)
  modalData.value = { ...server }
  showModal.value = true
  closeContextMenu()
}

async function handleRenameServer(server) {
  if (!server) {
    console.error('handleRenameServer: server参数为空')
    return
  }
  
  console.log('handleRenameServer 开始, server:', server)
  
  try {
    const currentName = server.display_name || `${server.host}@${server.username}:${server.port}`
    const newName = prompt('请输入新的服务器名称:', currentName)
    
    if (newName && newName.trim() && newName.trim() !== currentName) {
      console.log('准备重命名:', { id: server.id, oldName: currentName, newName: newName.trim() })
      
      await renameServer(server.id, newName.trim())
      console.log('服务器重命名成功')
    } else {
      console.log('用户取消重命名或名称未改变')
    }
  } catch (e) {
    console.error('handleRenameServer error:', e)
    console.error('错误详情:', {
      message: e.message,
      stack: e.stack,
      server: server
    })
    alert('重命名失败: ' + e.message)
  } finally {
    closeContextMenu()
  }
}

async function handleDeleteServer(id) {
  if (!id) return
  
  try {
    await deleteSavedServer(id)
    closeContextMenu()
  } catch (e) {
    console.error('handleDeleteServer error', e)
  }
}

function openSettings() {
  console.log('openSettings clicked - test')
  // TODO: 打开设置对话框或侧边栏
}

// ---------------------- 标签页右键菜单处理器 ----------------------

function handleShowTabContextMenu(event, session) {
  tabContextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    session: session
  }
}

function closeTabContextMenu() {
  tabContextMenu.value.visible = false
}

// ---------------------- 会话菜单处理器 ----------------------

function handleShowAllSessions() {
  showSessionsMenu.value = true
}

function handleCloseSessionsMenu() {
  showSessionsMenu.value = false
}

// ---------------------- 监听器 ----------------------

watch(activeSessionId, async (id) => {
  switchToSession(id)
})

// ---------------------- 生命周期 ----------------------

// 全局点击处理器
function handleGlobalClick(event) {
  // 检查点击是否在会话切换器内部
  if (sessionSwitcher.value && sessionSwitcher.value.contains(event.target)) {
    return // 如果在内部则不关闭
  }
  
  // 关闭各种菜单和下拉框
  closeContextMenu()
  closeTabContextMenu()
  showSessionDropdown.value = false
}

onMounted(() => {
  loadSessions()
  // 点击任意位置关闭右键菜单
  document.addEventListener('click', handleGlobalClick)
  // 初始化窗口事件监听器
  initializeEventListeners()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClick)
  // 清理窗口事件监听器
  cleanupEventListeners()
})
</script>
