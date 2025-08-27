<template>
  <aside class="sidebar">
    <ul class="server-list">
      <li 
        v-for="s in savedSessions" 
        :key="s.id"
        :class="{ active: String(s.id) === selectedServerId }"
        @click="$emit('selectServer', s.id)"
        @contextmenu.prevent="$emit('openContextMenu', $event, s)"
      >
        {{ s.display_name || `${s.host}@${s.username}:${s.port}` }}
      </li>
    </ul>
  </aside>
</template>

<script setup>
defineProps({
  savedSessions: {
    type: Array,
    default: () => []
  },
  selectedServerId: {
    type: [String, Number],
    default: ''
  }
})

defineEmits(['selectServer', 'openContextMenu'])
</script>

<style scoped>
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
</style>
