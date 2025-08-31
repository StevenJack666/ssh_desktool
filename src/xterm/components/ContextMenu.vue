<template>
  <ul 
    v-if="visible" 
    class="context-menu"
    :style="{ top: y + 'px', left: x + 'px' }"
  >
    <li @click="handleConnect">连接</li>
    <!-- <li @click="handleOpenInNewWindow">在新窗口中打开</li> -->
    <li class="separator"></li>
    <li @click="handleEdit">编辑</li>
    <li @click="handleRename">重命名</li>
    <li @click="handleDelete">删除</li>
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
  server: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['connect', 'open-in-new-window', 'edit', 'rename', 'delete'])

function handleConnect() {
  console.log('ContextMenu handleConnect clicked for server:', props.server)
  emit('connect', props.server)
}

function handleOpenInNewWindow() {
  console.log('ContextMenu handleOpenInNewWindow clicked for server:', props.server)
  emit('open-in-new-window', props.server)
}

function handleEdit() {
  console.log('ContextMenu handleEdit clicked for server:', props.server)
  emit('edit', props.server)
}

function handleRename() {
  console.log('ContextMenu handleRename clicked for server:', props.server)
  emit('rename', props.server)
}

function handleDelete() {
  console.log('ContextMenu handleDelete clicked for server:', props.server)
  emit('delete', props.server.id)
}
</script>

<style scoped>
/* 右键菜单 */
.context-menu {
  position: fixed;
  background: #34383b;
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
  color: #e6eef8;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.context-menu li:hover {
  background: #2563eb;
  color: white;
  border-radius: 4px;
}

.context-menu li:active {
  background: #1e40af;
}

/* 分隔线 */
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
