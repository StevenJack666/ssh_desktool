<template>
  <div v-if="visible" class="sessions-menu-overlay" @click="$emit('close')">
    <div class="sessions-menu" @click.stop>
      <div class="menu-header">
        <h3>所有会话</h3>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
      
      <div class="menu-content">
        <div class="sessions-section">
          <h4>活动会话 ({{ sessions.length }})</h4>
          <div class="session-list">
            <div 
              v-for="session in sessions" 
              :key="session.id"
              :class="['session-item', { 
                active: String(session.id) === activeSessionId,
                connected: session.isConnected 
              }]"
              @click="$emit('switchSession', session.id)"
            >
              <div class="session-status">
                <div class="status-indicator" :class="{
                  connected: session.isConnected,
                  connecting: session.isConnecting
                }"></div>
              </div>
              
              <div class="session-info">
                <div class="session-title">{{ getSessionTitle(session) }}</div>
                <div class="session-details">{{ getSessionDetails(session) }}</div>
              </div>
              
              <div class="session-actions">
                <button 
                  @click.stop="$emit('closeSession', session.id)"
                  class="action-btn close"
                  title="关闭会话"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="sessions-section">
          <h4>保存的服务器</h4>
          <div class="server-list">
            <div 
              v-for="server in savedServers" 
              :key="server.id"
              class="server-item"
              @click="$emit('connectServer', server)"
            >
              <div class="server-info">
                <div class="server-title">{{ getServerTitle(server) }}</div>
                <div class="server-details">{{ getServerDetails(server) }}</div>
              </div>
              
              <div class="server-actions">
                <button 
                  @click.stop="$emit('connectServer', server)"
                  class="action-btn"
                  title="连接服务器"
                >
                  ➕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="menu-footer">
        <button @click="$emit('newSession')" class="primary-btn">
          + 新建会话
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: Boolean,
  sessions: {
    type: Array,
    default: () => []
  },
  savedServers: {
    type: Array,
    default: () => []
  },
  activeSessionId: {
    type: [String, Number],
    default: null
  }
})

defineEmits([
  'close',
  'switchSession', 
  'closeSession',
  'connectServer',
  'newSession'
])

function getSessionTitle(session) {
  if (session.serverData?.display_name) {
    return session.serverData.display_name
  }
  return `${session.host}@${session.username}`
}

function getSessionDetails(session) {
  if (session.serverData?.display_name) {
    return `${session.host}:${session.port}`
  }
  return `:${session.port}`
}

function getServerTitle(server) {
  return server.display_name || `${server.host}@${server.username}`
}

function getServerDetails(server) {
  if (server.display_name) {
    return `${server.host}:${server.port}`
  }
  return `:${server.port}`
}
</script>

<style scoped>
.sessions-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 10005;
  padding-top: 60px;
}

.sessions-menu {
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 8px;
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  box-shadow: 0 12px 32px rgba(0,0,0,0.7);
  display: flex;
  flex-direction: column;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #444;
}

.menu-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #444;
  color: #fff;
}

.menu-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.sessions-section {
  margin-bottom: 24px;
}

.sessions-section:last-child {
  margin-bottom: 0;
}

.sessions-section h4 {
  margin: 0 0 12px 0;
  color: #e6eef8;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}

.session-list,
.server-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item,
.server-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 12px;
}

.session-item:hover,
.server-item:hover {
  background: #333;
  border-color: #444;
}

.session-item.active {
  background: #0b74da;
  border-color: #0b74da;
  color: white;
}

.session-status {
  flex-shrink: 0;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #666;
  transition: background-color 0.2s ease;
}

.status-indicator.connected {
  background: #4caf50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.5);
}

.status-indicator.connecting {
  background: #ff9800;
  animation: pulse 1.5s infinite;
}

.session-info,
.server-info {
  flex: 1;
  min-width: 0;
}

.session-title,
.server-title {
  font-size: 14px;
  font-weight: 500;
  color: #e6eef8;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item.active .session-title {
  color: white;
}

.session-details,
.server-details {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item.active .session-details {
  color: rgba(255, 255, 255, 0.8);
}

.session-actions,
.server-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.session-item:hover .session-actions,
.server-item:hover .server-actions {
  opacity: 1;
}

.action-btn {
  background: #444;
  border: 1px solid #555;
  color: #e5e7eb;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  transition: all 0.2s ease;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #555;
  border-color: #666;
}

.action-btn.close:hover {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
}

.menu-footer {
  padding: 16px 20px;
  border-top: 1px solid #444;
}

.primary-btn {
  background: #0b74da;
  border: 1px solid #0b74da;
  color: white;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  width: 100%;
}

.primary-btn:hover {
  background: #0a66c2;
  border-color: #0a66c2;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
