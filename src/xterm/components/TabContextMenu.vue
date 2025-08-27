<template>
  <ul 
    v-if="visible" 
    class="tab-context-menu"
    :style="{ top: y + 'px', left: x + 'px' }"
  >
    <li @click="handleDuplicate">
      <span class="menu-icon">📋</span>
      复制标签页
    </li>
    <li class="separator"></li>
    <li @click="handleCloseOthers">
      <span class="menu-icon">✕</span>
      关闭其他标签页
    </li>
    <li @click="handleCloseToRight">
      <span class="menu-icon">➡</span>
      关闭右侧标签页
    </li>
    <li @click="handleCloseAll">
      <span class="menu-icon">🗑</span>
      关闭所有标签页
    </li>
    <li class="separator"></li>
    <li @click="handleReconnect" :class="{ disabled: !session?.isConnected }">
      <span class="menu-icon">🔄</span>
      重新连接
    </li>
    <li @click="handleEditConnection">
      <span class="menu-icon">⚙️</span>
      编辑连接
    </li>
  </ul>
</template>

<script setup>
const props = defineProps({
  visible: Boolean,
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  session: {
    type: Object,
    default: null
  },
  allSessions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'duplicate', 
  'closeOthers', 
  'closeToRight', 
  'closeAll',
  'reconnect',
  'editConnection'
])

function handleDuplicate() {
  emit('duplicate', props.session)
}

function handleCloseOthers() {
  emit('closeOthers', props.session.id)
}

function handleCloseToRight() {
  emit('closeToRight', props.session.id)
}

function handleCloseAll() {
  emit('closeAll')
}

function handleReconnect() {
  if (props.session) {
    emit('reconnect', props.session)
  }
}

function handleEditConnection() {
  emit('editConnection', props.session)
}
</script>

<style scoped>
.tab-context-menu {
  position: fixed;
  background: #34383b;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  list-style: none;
  padding: 6px 0;
  margin: 0;
  z-index: 10004;
  width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  backdrop-filter: blur(10px);
}

.tab-context-menu li {
  padding: 8px 14px;
  cursor: pointer;
  color: #e6eef8;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  transition: all 0.15s ease;
}

.tab-context-menu li:hover:not(.separator):not(.disabled) {
  background: #2563eb;
  color: white;
}

.tab-context-menu li.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tab-context-menu li.disabled:hover {
  background: transparent;
  color: #e6eef8;
}

.menu-icon {
  font-size: 12px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 8px;
  padding: 0 !important;
  cursor: default !important;
}

.separator:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}
</style>
