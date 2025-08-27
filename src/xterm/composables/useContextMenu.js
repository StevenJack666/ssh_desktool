import { ref } from 'vue'

export function useContextMenu() {
  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    server: null
  })

  function openContextMenu(event, server) {
    // 限制坐标以防止菜单渲染到屏幕外
    const menuWidth = 140
    const menuHeight = 120 // 大概值
    const x = Math.min(event.clientX, window.innerWidth - menuWidth)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight)
    
    console.log('openContextMenu', { 
      x: event.clientX, 
      y: event.clientY, 
      clamped: { x, y }, 
      server 
    })
    
    contextMenu.value = {
      visible: true,
      x,
      y,
      server
    }
  }

  function closeContextMenu() {
    contextMenu.value.visible = false
  }

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu
  }
}
