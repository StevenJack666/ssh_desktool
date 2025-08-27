import { ref } from 'vue'

export function useServerManagement() {
  const savedSessions = ref([])
  const selectedServerId = ref('')

  function safeStringify(obj) {
    try {
      return JSON.stringify(obj)
    } catch (e) {
      try {
        return String(obj)
      } catch (e2) {
        return "<unstringifiable>"
      }
    }
  }

  async function loadSessions() {
    if (!window.api?.db) return
    const items = await window.api.db.getItems()
    console.log('loadSessions result: ', safeStringify(items))
    
    // 确保每个项目都有必要的字段
    const processedItems = items.map(item => ({
      id: item.id,
      host: item.host,
      port: item.port || 22,
      username: item.username,
      password: item.password || '',
      auth_type: item.auth_type || 'password',
      private_key_path: item.private_key_path || '',
      passphrase: item.passphrase || '',
      display_name: item.display_name || null
    }))
    
    savedSessions.value = processedItems
    console.log('Processed sessions:', safeStringify(processedItems))
  }

  async function createAndSaveServer(data) {
    try {
      if (!window.api?.db) return
      const result = await window.api.db.addItem(data)
      // 更新本地 savedSessions 以刷新侧边栏
      const newItem = { 
        ...data, 
        id: result.id,
        display_name: data.display_name || null
      }
      savedSessions.value.push(newItem)
      return result
    } catch (e) {
      console.error('createAndSaveServer error', e)
    }
  }

  async function updateServer(data) {
    try {
      if (!window.api?.db) return
      
      console.log('updateServer 调用，参数:', data)
      
      if (!data.id) {
        throw new Error('data.id 不能为空')
      }
      
      // 尝试更新数据库
      if (window.api.db.updateItem) {
        await window.api.db.updateItem(data.id, data)  // 传递 id 和 item 两个参数
      } else {
        // fallback: 使用 addItem（某些DB桥接可能还没有实现 update）
        await window.api.db.addItem(data)
      }

      // 更新本地 savedSessions
      const item = { 
        id: data.id, 
        host: data.host, 
        port: data.port, 
        username: data.username, 
        password: data.password, 
        auth_type: data.auth_type,
        private_key_path: data.private_key_path,
        passphrase: data.passphrase,
        display_name: data.display_name || null
      }
      
      const idx = savedSessions.value.findIndex(s => String(s.id) === String(data.id))
      if (idx >= 0) {
        savedSessions.value.splice(idx, 1, item)
      } else {
        savedSessions.value.push(item)
      }
    } catch (e) {
      console.error('updateServer error', e)
    }
  }

  async function deleteSavedServer(id) {
    if (!window.api?.db) return
    await window.api.db.deleteItem(id)
    savedSessions.value = savedSessions.value.filter(s => s.id !== id)
    if (selectedServerId.value === id) selectedServerId.value = ''
  }

  async function renameServer(id, newDisplayName) {
    try {
      console.log('renameServer 开始执行:', { id, newDisplayName })
      
      if (!window.api?.db) {
        throw new Error('数据库API不可用')
      }
      
      if (!window.api.db.updateItemDisplayName) {
        throw new Error('updateItemDisplayName方法不存在')
      }
      
      console.log('开始调用 updateItemDisplayName...')
      
      // 更新数据库中的显示名称
      const result = await window.api.db.updateItemDisplayName(id, newDisplayName)
      console.log('updateItemDisplayName 返回结果:', result)
      
      // 更新本地 savedSessions
      const idx = savedSessions.value.findIndex(s => String(s.id) === String(id))
      if (idx >= 0) {
        savedSessions.value[idx].display_name = newDisplayName
        console.log('本地数据已更新')
      } else {
        console.warn('未找到要更新的本地数据, id:', id)
      }
      
      console.log('服务器重命名成功:', { id, newDisplayName })
    } catch (e) {
      console.error('renameServer error:', e)
      console.error('错误堆栈:', e.stack)
      throw e
    }
  }

  function selectServer(id) {
    selectedServerId.value = String(id)
    // 找到选中的服务器
    const server = savedSessions.value.find(s => String(s.id) === String(id))
    return server
  }

  function getServerById(id) {
    return savedSessions.value.find(s => String(s.id) === String(id))
  }

  return {
    savedSessions,
    selectedServerId,
    loadSessions,
    createAndSaveServer,
    updateServer,
    deleteSavedServer,
    renameServer,
    selectServer,
    getServerById
  }
}
