<template>
  <div class="terminal-tabs-container">
    <div class="tabs-wrapper">
      <div class="session-tabs" ref="tabsContainer">
        <div 
          v-for="s in sessions" 
          :key="s.id" 
          @click="$emit('switchSession', s.id)"
          :class="['tab-item', { 
            active: String(s.id) === activeSessionId,
            connected: s.isConnected,
            connecting: s.isConnecting 
          }]"
          @contextmenu.prevent="$emit('showTabContextMenu', $event, s)"
        >
          <div class="tab-status-indicator"></div>
          <div class="tab-content">
            <span class="tab-title">{{ getTabTitle(s) }}</span>
            <span class="tab-subtitle">{{ getTabSubtitle(s) }}</span>
          </div>
          <button 
            class="close-button" 
            @click.stop="$emit('closeSession', s.id)"
            :title="`关闭 ${getTabTitle(s)}`"
          >
            ×
          </button>
        </div>
      </div>
      
      <!-- 滚动控制按钮 -->
      <div class="scroll-controls" v-if="showScrollControls">
        <button @click="scrollTabs('left')" class="scroll-btn">‹</button>
        <button @click="scrollTabs('right')" class="scroll-btn">›</button>
      </div>
    </div>
    
    <!-- 新建标签页按钮 -->
    <div class="tab-actions">
      <button @click="$emit('newSession')" class="new-tab-btn" title="新建会话">+</button>
      <button @click="$emit('showAllSessions')" class="sessions-menu-btn" title="所有会话">☰</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  sessions: {
    type: Array,
    default: () => []
  },
  activeSessionId: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['switchSession', 'closeSession', 'newSession', 'showAllSessions', 'showTabContextMenu'])

const tabsContainer = ref(null)
const showScrollControls = ref(false)

// 计算标签标题
function getTabTitle(session) {
  if (session.serverData?.display_name) {
    return session.serverData.display_name
  }
  return `${session.host}@${session.username}`
}

// 计算标签副标题
function getTabSubtitle(session) {
  if (session.serverData?.display_name) {
    return `${session.host}:${session.port}`
  }
  return `:${session.port}`
}

// 滚动标签页
function scrollTabs(direction) {
  const container = tabsContainer.value
  if (!container) return
  
  const scrollAmount = 200
  const currentScroll = container.scrollLeft
  
  if (direction === 'left') {
    container.scrollTo({
      left: Math.max(0, currentScroll - scrollAmount),
      behavior: 'smooth'
    })
  } else {
    container.scrollTo({
      left: currentScroll + scrollAmount,
      behavior: 'smooth'
    })
  }
}

// 检查是否需要显示滚动控制
function checkScrollControls() {
  const container = tabsContainer.value
  if (!container) return
  
  showScrollControls.value = container.scrollWidth > container.clientWidth
}

// 键盘快捷键支持
function handleKeyDown(event) {
  // Ctrl/Cmd + T = 新建标签
  if ((event.ctrlKey || event.metaKey) && event.key === 't') {
    event.preventDefault()
    emit('newSession')
  }
  
  // Ctrl/Cmd + W = 关闭当前标签
  if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
    event.preventDefault()
    if (props.activeSessionId) {
      emit('closeSession', props.activeSessionId)
    }
  }
  
  // Ctrl/Cmd + Tab = 切换标签
  if ((event.ctrlKey || event.metaKey) && event.key === 'Tab') {
    event.preventDefault()
    const currentIndex = props.sessions.findIndex(s => String(s.id) === props.activeSessionId)
    if (currentIndex >= 0) {
      const nextIndex = event.shiftKey 
        ? (currentIndex - 1 + props.sessions.length) % props.sessions.length
        : (currentIndex + 1) % props.sessions.length
      emit('switchSession', props.sessions[nextIndex].id)
    }
  }
}

onMounted(() => {
  // 监听窗口大小变化
  window.addEventListener('resize', checkScrollControls)
  // 监听键盘事件
  document.addEventListener('keydown', handleKeyDown)
  
  // 初始检查
  setTimeout(checkScrollControls, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScrollControls)
  document.removeEventListener('keydown', handleKeyDown)
})

// 监听 sessions 变化，重新检查滚动
computed(() => {
  setTimeout(checkScrollControls, 50)
  return props.sessions.length
})
</script>

<style scoped>
.terminal-tabs-container {
  display: flex;
  align-items: center;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  padding: 4px 8px;
  min-height: 44px;
  gap: 8px;
}

.tabs-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  position: relative;
  min-width: 0;
}

.session-tabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-behavior: smooth;
  flex: 1;
  min-width: 0;
}

.session-tabs::-webkit-scrollbar {
  display: none;
}

.tab-item {
  display: flex;
  align-items: center;
  background: #1e1e1e;
  border: 1px solid rgba(255,255,255,0.06);
  color: #e5e7eb;
  padding: 8px 12px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  min-width: 120px;
  max-width: 200px;
  flex-shrink: 0;
  transition: all 0.2s ease;
  position: relative;
  gap: 8px;
}

.tab-item:hover {
  background: #333;
  border-color: rgba(255,255,255,0.1);
}

.tab-item.active {
  background: #0b74da;
  border-color: #0b74da;
  color: white;
}

.tab-status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

.tab-item.connected .tab-status-indicator {
  background: #4caf50;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
}

.tab-item.connecting .tab-status-indicator {
  background: #ff9800;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tab-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.tab-subtitle {
  font-size: 11px;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
}

.tab-item.active .tab-subtitle {
  opacity: 0.9;
}

.close-button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  opacity: 0.6;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  opacity: 1;
}

.tab-item.active .close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.scroll-controls {
  display: flex;
  gap: 2px;
  margin-left: 4px;
}

.scroll-btn {
  background: #333;
  border: 1px solid #555;
  color: #e5e7eb;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  transition: all 0.2s ease;
}

.scroll-btn:hover {
  background: #444;
  border-color: #666;
}

.tab-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.new-tab-btn,
.sessions-menu-btn {
  background: #333;
  border: 1px solid #555;
  color: #e5e7eb;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1;
  transition: all 0.2s ease;
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.new-tab-btn:hover,
.sessions-menu-btn:hover {
  background: #444;
  border-color: #666;
}

.new-tab-btn {
  font-weight: bold;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tab-item {
    min-width: 100px;
    max-width: 150px;
  }
  
  .tab-subtitle {
    display: none;
  }
  
  .tab-content {
    justify-content: center;
  }
}
</style>
