import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { v4 as uuidv4 } from 'uuid'

export function useSSHSession() {
  const sessions = ref([])
  const activeSessionId = ref(null)
  const terminalContainers = ref(new Map()) // 改为Map，使用会话ID作为key
  const pendingSessionKeys = new Set()
  const pendingSessionPromises = new Map() // key -> Promise<session>

  function normalizeHost(host) { return String(host || '').trim().toLowerCase() }
  function normalizeUser(user) { return String(user || '').trim() }
  function normalizePort(port) { const n = Number(port); return Number.isFinite(n) && n > 0 ? n : 22 }
  function normalizeAuthType(type) { return String(type || 'password').trim().toLowerCase() }
  function makeKey(obj) { return `${normalizeHost(obj.host)}:${normalizePort(obj.port)}:${normalizeUser(obj.username)}:${normalizeAuthType(obj.auth_type)}` }

  function findSessionByConfig(cfg) {
    const key = makeKey(cfg)
    return sessions.value.find(s => makeKey(s) === key) || null
  }

  function setTerminalContainer(el, sessionId) {
    if (el && sessionId) {
      console.log(`[Container] Setting container for session ${sessionId}`)
      // Ensure the container fills available space and is visible before open/fit
      el.style.display = 'flex'
      el.style.flex = '1 1 auto'
      el.style.minHeight = '0'

      terminalContainers.value.set(String(sessionId), el)
      
      // 如果会话已经存在且还没有容器，立即绑定
      const session = sessions.value.find(s => String(s.id) === String(sessionId))
      if (session && !session.container) {
        console.log(`[Container] Immediately binding terminal for session ${sessionId}`)
        session.container = el
        session.terminal.open(el)
        
        // 等待布局稳定后再 fit + focus
        fitFocusRefresh(session)
      }
    }
  }
  
  function safeStringify(obj) {
    try { return JSON.stringify(obj) } catch (e) {
      try { return String(obj) } catch { return '<unstringifiable>' }
    }
  }

  async function createNewSession(config, saveToDB = true) {
    const key = makeKey(config)

    // 已存在直接返回
    const existing = findSessionByConfig(config)
    if (existing) {
      console.warn('Session already exists:', safeStringify({ id: existing.id, key }))
      return existing
    }

    // 正在创建，复用同一个 Promise
    if (pendingSessionPromises.has(key)) {
      console.warn('Reuse pending creation promise for:', key)
      return pendingSessionPromises.get(key)
    }

    // 建立创建 Promise 并缓存
    const creationPromise = (async () => {
      pendingSessionKeys.add(key)
      try {
        const id = config.id || uuidv4()
        console.log(`[Session ${id}] Creating new session for ${config.username}@${config.host}:${config.port}`)
        const terminal = new Terminal({
          cursorBlink: true,
          cursorStyle: 'block',
          cursorWidth: 1,
          scrollback: 1000,
          allowTransparency: true,
          theme: { background: '#000000', foreground: '#ffffff', cursor: '#ffffff', cursorAccent: '#000000' }
        })
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        // 移除创建时的提示信息，避免与连接信息重复

        const session = {
          id,
          terminal,
          fitAddon,
          container: null,
          host: config.host,
          port: normalizePort(config.port),
          username: config.username,
          password: config.password,
          auth_type: config.auth_type || 'password',
          private_key_path: config.private_key_path,
          passphrase: config.passphrase,
          isConnected: false,
          isConnecting: false,
          serverData: { ...config }
        }

        sessions.value.push(session)
        activeSessionId.value = String(session.id)
        console.log(`[Session ${id}] Added to sessions list. Total sessions: ${sessions.value.length}`)

        if (!config.id && saveToDB) {
          await saveSession(session)
        }

        await nextTick()
        const container = terminalContainers.value.get(String(session.id))
        if (container) {
          console.log(`[Session ${id}] Found container, attaching terminal`)
          session.container = container
          session.terminal.open(container)
          fitFocusRefresh(session)
        } else {
          console.warn(`[Session ${id}] Container not found yet`)
          setTimeout(() => {
            const delayed = terminalContainers.value.get(String(session.id))
            if (delayed && !session.container) {
              console.log(`[Session ${id}] 延迟绑定容器成功`)
              session.container = delayed
              session.terminal.open(delayed)
              fitFocusRefresh(session)
            }
          }, 1000)
        }

        bindSessionIPC(session)
        return session
      } finally {
        pendingSessionKeys.delete(key)
      }
    })()

    pendingSessionPromises.set(key, creationPromise)
    try {
      return await creationPromise
    } finally {
      pendingSessionPromises.delete(key)
    }
  }

  // 防止重复连接的时间窗口映射
  const connectionCooldowns = new Map()
  const CONNECT_COOLDOWN_MS = 1000 // 1秒内不允许重复连接同一会话

  async function connectSession(session) {
    const sessionId = String(session.id)
    console.log(`[connectSession] Called for session ${sessionId}, isConnecting: ${session.isConnecting}, isConnected: ${session.isConnected}`)
    
    // 检查冷却时间
    const now = Date.now()
    const lastConnectTime = connectionCooldowns.get(sessionId)
    if (lastConnectTime && (now - lastConnectTime) < CONNECT_COOLDOWN_MS) {
      console.warn(`[connectSession] Session ${sessionId} is in cooldown period, skipping duplicate call`)
      return
    }
    
    if (!window.api?.ssh) {
      console.error('SSH API not available')
      session.terminal.write('\x1b[31mSSH API 不可用\x1b[0m\r\n')
      return
    }

    // 避免重复连接
    if (session.isConnecting) {
      console.warn('Session is already connecting, skipping duplicate connection attempt')
      return
    }

    if (session.isConnected) {
      console.warn('Session is already connected, skipping connection attempt')
      return
    }

    // 设置冷却时间
    connectionCooldowns.set(sessionId, now)

    // 设置连接状态
    session.isConnecting = true
    session.isConnected = false
    session.terminal.write('\x1b[33m正在连接...\x1b[0m\r\n')

    // 构建连接参数
    const connectionParams = {
      host: session.host,
      port: session.port,
      username: session.username,
      auth_type: session.auth_type || 'password'  // 添加认证类型
    }
    
    // 根据认证类型添加不同的参数
    if (session.auth_type === 'privatekey') {
      if (session.private_key_path) {
        connectionParams.private_key_path = session.private_key_path
        if (session.passphrase) {
          connectionParams.passphrase = session.passphrase
        }
        console.log('私钥认证参数已添加')
      } else {
        console.error('私钥认证类型但缺少私钥路径')
        session.terminal.write('\x1b[31m私钥路径未设置\x1b[0m\r\n')
        session.isConnecting = false
        return
      }
    } else {
      console.log('使用密码认证, auth_type值为:', session.auth_type)
      connectionParams.password = session.password
    }

    console.log('最终连接参数 (隐藏敏感信息):', { 
      ...connectionParams, 
      password: connectionParams.password ? '[HIDDEN]' : undefined,
      passphrase: connectionParams.passphrase ? '[HIDDEN]' : undefined
    })

    console.log('session 私钥相关字段详细检查:', {
     connectionParams 
    })

    try {
      const result = await window.api.ssh.connect(session.id, connectionParams)
      console.log('SSH connect result:', result)
      
      if (result.success) {
        console.log('connectSession success', result)
        session.isConnected = true
        session.isConnecting = false
        session.terminal.write('\x1b[32m连接成功\x1b[0m\r\n')
      } else {
        console.error('connectSession failed:', result.message)
        session.isConnected = false
        session.isConnecting = false
        session.terminal.write(`\x1b[31m连接失败: ${result.message}\x1b[0m\r\n`)
      }
    } catch (error) {
      console.error('connectSession error:', error)
      session.isConnected = false
      session.isConnecting = false
      session.terminal.write(`\x1b[31m连接错误: ${error.message}\x1b[0m\r\n`)
    }
  }

  function bindSessionIPC(session) {
    const id = String(session.id)
    if (!window.api?.ssh) return

    // 确保清理旧的监听器
    if (session._ipcCleanup) {
      session._ipcCleanup()
    }

    // 创建专用的事件监听器
    const outputHandler = (data) => {
      console.log(`[Session ${id}] onOutput:`, data.substring(0, 50) + '...')
      session.terminal.write(data)
    }

    const disconnectHandler = (data) => {
      console.log(`[Session ${id}] onDisconnect`)
      session.isConnected = false
      session.isConnecting = false
      removeSessionByIdentity({ 
        host: session.host, 
        port: session.port, 
        username: session.username 
      })
    }

    const statusHandler = (statusData) => {
      const status = statusData?.status || statusData
      console.log(`[Session ${id}] onStatusChange:`, status)
      session.isConnecting = status === 'connecting'
      session.isConnected = status === 'connected'
      
      if (['disconnected', 'closed', 'ended', 'error'].includes(status)) {
        session.isConnected = false
        session.isConnecting = false
        removeSessionByIdentity({ 
          host: session.host, 
          port: session.port, 
          username: session.username 
        })
      }
    }

    const dataHandler = (data) => {
      console.log(`[Session ${id}] sending data to SSH:`, data.substring(0, 20) + '...')
      window.api.ssh.send(id, data)
    }

    // 绑定事件监听器并保存返回的包装函数
    const wrappedOutputHandler = window.api.ssh.onOutput(id, outputHandler)
    const wrappedDisconnectHandler = window.api.ssh.onDisconnect(id, disconnectHandler)
    const wrappedStatusHandler = window.api.ssh.onStatusChange(id, statusHandler)

    // 确保不重复绑定终端数据事件，先释放旧的再绑定新的
    if (session._terminalDataDisposable) {
      try { session._terminalDataDisposable.dispose() } catch {}
      session._terminalDataDisposable = null
    }
    session._terminalDataDisposable = session.terminal.onData(dataHandler)

    // 保存清理函数
    session._ipcCleanup = () => {
      console.log(`[Session ${id}] Cleaning up IPC listeners`)
      
      // 使用 SSH API 提供的清理方法，传入精确的包装函数
      try {
        if (window.api?.ssh) {
          window.api.ssh.offOutput(id, wrappedOutputHandler)
          window.api.ssh.offDisconnect(id, wrappedDisconnectHandler)
          window.api.ssh.offStatusChange(id, wrappedStatusHandler)
          window.api.ssh.offError(id) // 移除所有错误监听器
        }
      } catch (error) {
        console.warn(`[Session ${id}] Error cleaning up SSH listeners:`, error)
      }
      
      // 释放xterm数据监听器
      if (session._terminalDataDisposable) {
        try { session._terminalDataDisposable.dispose() } catch {}
        session._terminalDataDisposable = null
      }
    }
  }

  function removeSessionByIdentity({ host, port, username }) {
    const session = sessions.value.find(s => 
      s.host === host && 
      Number(s.port) === Number(port) && 
      s.username === username
    )
    
    if (session) {
      console.log(`[Session ${session.id}] Removing session by identity`)
      
      // 清理IPC监听器
      if (session._ipcCleanup) {
        session._ipcCleanup()
      }
      
      // 清理终端容器引用
      terminalContainers.value.delete(String(session.id))
      
      // 从会话列表中移除
      const idx = sessions.value.indexOf(session)
      if (idx >= 0) {
        sessions.value.splice(idx, 1)
      }
      
      // 更新活动会话
      if (String(activeSessionId.value) === String(session.id)) {
        activeSessionId.value = sessions.value[0]?.id ? String(sessions.value[0].id) : null
      }
    }
  }

  async function deleteSession(id) {
    console.log(`[Session ${id}] Deleting session`)
    const session = sessions.value.find(s => String(s.id) === String(id))
    
    // 清理IPC监听器
    if (session?._ipcCleanup) {
      session._ipcCleanup()
    }
    
    // 断开SSH连接
    if (session?.isConnected && window.api?.ssh) {
      try {
        await window.api.ssh.disconnect(id)
      } catch (error) {
        console.warn(`[Session ${id}] Error disconnecting SSH:`, error)
      }
    }
    
    // 清理终端容器引用
    terminalContainers.value.delete(String(id))
    
    // 从数据库删除（如果适用）
    if (window.api?.db) {
      try {
        await window.api.db.deleteItem(id)
      } catch (e) {
        console.warn('Failed to delete from database:', e)
      }
    }
    
    // 从会话列表中移除
    const idx = sessions.value.findIndex(s => String(s.id) === String(id))
    if (idx >= 0) {
      sessions.value.splice(idx, 1)
    }
    
    // 更新活动会话
    if (String(activeSessionId.value) === String(id)) {
      activeSessionId.value = sessions.value[0]?.id ? String(sessions.value[0].id) : null
    }
  }

  async function saveSession(session) {
    if (!window.api?.db) return
    const data = {
      id: session.id,
      host: session.host,
      port: session.port,
      username: session.username,
      password: session.password,
      auth_type: session.auth_type || 'password',
      private_key_path: session.private_key_path,
      passphrase: session.passphrase
    }
    const result = await window.api.db.addItem(data)
    session.id = result.id
    return result
  }

  async function switchToSession(sessionId) {
    console.log(`[Switch] Switching to session ${sessionId}`)
    activeSessionId.value = String(sessionId)
    await nextTick()
    const s = sessions.value.find(x => String(x.id) === String(sessionId))
    if (s) {
      console.log(`[Switch] Found session ${sessionId}, connecting: ${s.isConnecting}, connected: ${s.isConnected}`)
      const container = terminalContainers.value.get(String(sessionId))
      if (container && !s.container) {
        console.log(`[Switch] Binding container for session ${sessionId}`)
        s.container = container
        s.terminal.open(container)
      }
      fitFocusRefresh(s)
    } else {
      console.warn(`[Switch] Session ${sessionId} not found`)
    }
  }

  function focusAndRefitActive() {
    const id = String(activeSessionId.value || '')
    const s = sessions.value.find(x => String(x.id) === id)
    if (s && s.container) {
      try {
        s.fitAddon.fit()
        s.terminal.focus()
        s.terminal.refresh(0, s.terminal.rows - 1)
      } catch (e) {
        console.warn('focusAndRefitActive failed', e)
      }
    }
  }

  async function fitFocusRefresh(session) {
    // Wait for DOM paint and fonts to be ready (important for correct char metrics)
    try { await nextTick() } catch {}
    try { if (document.fonts && document.fonts.ready) { await document.fonts.ready } } catch {}
    await new Promise(r => requestAnimationFrame(r))
    try {
      session.fitAddon.fit()
      session.terminal.focus()
      session.terminal.refresh(0, session.terminal.rows - 1)
    } catch {}
    // Second pass after one more frame to stabilize
    await new Promise(r => requestAnimationFrame(r))
    try {
      session.fitAddon.fit()
      session.terminal.refresh(0, session.terminal.rows - 1)
    } catch {}
  }

  let resizeTimer = null
  function refitActiveTerminal() {
    const id = String(activeSessionId.value || '')
    const s = sessions.value.find(x => String(x.id) === id)
    if (s && s.container) {
      try {
        s.fitAddon.fit()
        s.terminal.refresh(0, s.terminal.rows - 1)
      } catch (e) {
        console.warn('refitActiveTerminal failed', e)
      }
    }
  }

  function scheduleRefit() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(refitActiveTerminal, 120)
  }

  onMounted(() => {
    window.addEventListener('resize', scheduleRefit)
  })
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', scheduleRefit)
    clearTimeout(resizeTimer)
    
    // 清理所有会话的监听器
    console.log('Cleaning up all session listeners on unmount')
    sessions.value.forEach(session => {
      if (session._ipcCleanup) {
        session._ipcCleanup()
      }
    })
  })

  return {
    sessions,
    activeSessionId,
    terminalContainers,
    setTerminalContainer,
    findSessionByConfig,
    createNewSession,
    connectSession,
    deleteSession,
    switchToSession,
    removeSessionByIdentity,
    focusAndRefitActive
  }
}
