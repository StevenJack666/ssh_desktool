import { createApp } from 'vue'
import SessionWindow from './xterm/components/SessionWindow.vue'
import './style.css'

console.log('Session app starting...')

// 创建会话应用
const app = createApp(SessionWindow)

// 挂载应用
app.mount('#app')

console.log('Session app mounted')
