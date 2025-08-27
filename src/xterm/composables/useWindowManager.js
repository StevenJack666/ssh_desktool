import { ref, reactive } from 'vue'

export function useWindowManager() {
  // 跟踪已打开的会话窗口
  const sessionWindows = reactive(new Map())

  // 创建新的会话窗口
  async function createSessionWindow(sessionData) {
    try {
      console.log('Creating session window for:', sessionData)
      
      if (!window.api?.window) {
        throw new Error('Window API not available')
      }

      // 清理数据，只保留可序列化的属性
      const cleanSessionData = {
        id: sessionData.id,
        host: sessionData.host,
        port: sessionData.port,
        username: sessionData.username,
        password: sessionData.password,
        auth_type: sessionData.auth_type,
        private_key_path: sessionData.private_key_path,
        passphrase: sessionData.passphrase,
        display_name: sessionData.display_name,
        status: sessionData.status
      }

      console.log('Cleaned session data:', cleanSessionData)

      // 检查是否已经有该会话的窗口
      const sessionId = cleanSessionData.id
      if (sessionWindows.has(sessionId)) {
        // 如果窗口已存在，尝试聚焦
        const result = await window.api.window.focusSessionWindow(sessionId)
        if (result.success) {
          console.log('Focused existing session window:', sessionId)
          return { success: true, isNew: false }
        } else {
          // 窗口可能已关闭，从映射中删除
          sessionWindows.delete(sessionId)
        }
      }

      // 创建新窗口
      const result = await window.api.window.createSessionWindow(cleanSessionData)
      
      if (result.success) {
        // 记录窗口状态
        sessionWindows.set(sessionId, {
          windowId: result.windowId,
          sessionData: { ...cleanSessionData }, // 使用清理后的数据
          isOpen: true,
          createdAt: new Date()
        })
        
        console.log('Session window created successfully:', sessionId)
        return { success: true, isNew: true, windowId: result.windowId }
      } else {
        throw new Error(result.error || 'Failed to create session window')
      }
      
    } catch (error) {
      console.error('Failed to create session window:', error)
      throw error
    }
  }

  // 关闭会话窗口
  async function closeSessionWindow(sessionId) {
    try {
      if (!window.api?.window) {
        throw new Error('Window API not available')
      }

      const result = await window.api.window.closeSessionWindow(sessionId)
      
      if (result.success) {
        sessionWindows.delete(sessionId)
        console.log('Session window closed:', sessionId)
        return { success: true }
      } else {
        throw new Error(result.error || 'Failed to close session window')
      }
      
    } catch (error) {
      console.error('Failed to close session window:', error)
      throw error
    }
  }

  // 检查会话窗口状态
  async function getSessionWindowStatus(sessionId) {
    try {
      if (!window.api?.window) {
        return { success: false, isOpen: false }
      }

      const result = await window.api.window.getSessionWindowStatus(sessionId)
      
      if (result.success) {
        // 更新本地状态
        if (sessionWindows.has(sessionId)) {
          sessionWindows.get(sessionId).isOpen = result.isOpen
        }
        
        // 如果窗口已关闭，从映射中删除
        if (!result.isOpen) {
          sessionWindows.delete(sessionId)
        }
        
        return { success: true, isOpen: result.isOpen }
      } else {
        return { success: false, error: result.error }
      }
      
    } catch (error) {
      console.error('Failed to get session window status:', error)
      return { success: false, error: error.message }
    }
  }

  // 聚焦到会话窗口
  async function focusSessionWindow(sessionId) {
    try {
      if (!window.api?.window) {
        throw new Error('Window API not available')
      }

      const result = await window.api.window.focusSessionWindow(sessionId)
      
      if (result.success) {
        console.log('Session window focused:', sessionId)
        return { success: true }
      } else {
        // 窗口可能已关闭
        sessionWindows.delete(sessionId)
        throw new Error(result.error || 'Failed to focus session window')
      }
      
    } catch (error) {
      console.error('Failed to focus session window:', error)
      throw error
    }
  }

  // 获取所有已打开的会话窗口
  function getOpenSessionWindows() {
    return Array.from(sessionWindows.entries()).map(([sessionId, windowInfo]) => ({
      sessionId,
      ...windowInfo
    }))
  }

  // 检查指定会话是否有打开的窗口
  function hasOpenWindow(sessionId) {
    return sessionWindows.has(sessionId)
  }

  // 初始化事件监听
  let isListenersInitialized = false
  let sessionWindowClosedListener = null
  
  function initializeEventListeners() {
    // 防止重复绑定
    if (isListenersInitialized) {
      console.log('Window event listeners already initialized, skipping')
      return
    }
    
    if (window.api?.window) {
      // 创建监听器函数并保存包装后的引用
      sessionWindowClosedListener = window.api.window.onSessionWindowClosed((event, sessionId) => {
        console.log('Session window closed event received:', sessionId)
        sessionWindows.delete(sessionId)
      })
      
      isListenersInitialized = true
      console.log('Window event listeners initialized')
    }
  }
  
  // 清理事件监听器
  function cleanupEventListeners() {
    if (isListenersInitialized && window.api?.window) {
      try {
        // 使用精确的监听器移除
        if (sessionWindowClosedListener) {
          window.api.window.offSessionWindowClosed(sessionWindowClosedListener)
        }
        
        isListenersInitialized = false
        sessionWindowClosedListener = null
        console.log('Window event listeners cleaned up')
      } catch (error) {
        console.warn('Failed to cleanup window event listeners:', error)
      }
    }
  }

  return {
    sessionWindows,
    createSessionWindow,
    closeSessionWindow,
    getSessionWindowStatus,
    focusSessionWindow,
    getOpenSessionWindows,
    hasOpenWindow,
    initializeEventListeners,
    cleanupEventListeners
  }
}
