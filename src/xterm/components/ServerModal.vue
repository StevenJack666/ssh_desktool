<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <h3>{{ editMode ? '编辑服务器' : '新建服务器' }}</h3>
      <div class="form-row">
        <input 
          v-model="formData.displayName" 
          placeholder="显示名称（可选）" 
          class="input-field" 
        />
      </div>
      <div class="form-row">
        <input 
          v-model="formData.host" 
          placeholder="主机地址 *" 
          required 
          class="input-field" 
        />
        <input 
          v-model="formData.port" 
          type="number" 
          placeholder="端口" 
          min="1" 
          max="65535" 
          class="input-field" 
        />
      </div>
      <div class="form-row">
        <input 
          v-model="formData.username" 
          placeholder="用户名 *" 
          required 
          class="input-field" 
        />
        <select v-model="formData.authType" class="input-field">
          <option value="password">密码认证</option>
          <option value="privatekey">密钥认证</option>
        </select>
      </div>
      <div class="form-row" v-if="formData.authType === 'password'">
        <input 
          v-model="formData.password" 
          type="password" 
          placeholder="密码" 
          class="input-field" 
        />
      </div>
      <div class="form-row" v-if="formData.authType === 'privatekey'">
        <div class="file-input-wrapper">
          <input 
            v-model="formData.privateKeyPath" 
            placeholder="私钥文件路径 *" 
            class="input-field file-path-input" 
            readonly
          />
          <button 
            type="button" 
            @click="selectPrivateKeyFile" 
            class="file-select-btn"
          >
            选择文件
          </button>
        </div>
      </div>
      <div class="form-row" v-if="formData.authType === 'privatekey'">
        <input 
          v-model="formData.passphrase" 
          type="password" 
          placeholder="密码短语（如果私钥有密码）" 
          class="input-field" 
        />
      </div>
      <div class="modal-actions">
        <button @click="handleSave" class="save-btn">保存</button>
        <button @click="$emit('close')" class="cancel-btn">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  initialData: {
    type: Object,
    default: () => ({})
  },
  editMode: Boolean
})

const emit = defineEmits(['close', 'save'])

const formData = ref({
  host: '',
  port: 22,
  username: '',
  password: '',
  authType: 'password',
  privateKeyPath: '',
  passphrase: '',
  displayName: ''
})

// 监听 initialData 变化，用于编辑模式
watch(() => props.initialData, (newData) => {
  if (newData && Object.keys(newData).length > 0) {
    formData.value = {
      host: newData.host || '',
      port: newData.port || 22,
      username: newData.username || '',
      password: newData.password || '',
      authType: newData.auth_type || 'password',
      privateKeyPath: newData.private_key_path || '',
      passphrase: newData.passphrase || '',
      displayName: newData.display_name || ''
    }
  }
}, { immediate: true, deep: true })

// 监听 visible 变化，关闭时清空表单
watch(() => props.visible, (isVisible) => {
  if (!isVisible && !props.editMode) {
    clearForm()
  }
})

function clearForm() {
  formData.value = {
    host: '',
    port: 22,
    username: '',
    password: '',
    authType: 'password',
    privateKeyPath: '',
    passphrase: '',
    displayName: ''
  }
}

async function selectPrivateKeyFile() {
  try {
    if (window.api?.dialog) {
      const result = await window.api.dialog.showOpenDialog({
        title: '选择私钥文件',
        filters: [
          { name: '所有文件', extensions: ['*'] },
          { name: 'SSH私钥文件', extensions: ['pem', 'key', 'ppk', 'openssh'] },
          { name: 'PEM文件', extensions: ['pem'] },
          { name: '密钥文件', extensions: ['key'] },
          { name: 'PuTTY私钥', extensions: ['ppk'] }
        ],
        properties: ['openFile', 'showHiddenFiles']
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        formData.value.privateKeyPath = result.filePaths[0]
      }
    } else {
      // fallback: 使用HTML5 file input API
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.pem,.key,.pub,*'
      input.style.display = 'none'
      
      input.onchange = (event) => {
        const file = event.target.files?.[0]
        if (file) {
          formData.value.privateKeyPath = file.name
          console.warn('浏览器环境下无法获取完整文件路径，仅显示文件名')
        }
      }
      
      document.body.appendChild(input)
      input.click()
      document.body.removeChild(input)
    }
  } catch (error) {
    console.error('文件选择失败:', error)
    alert('文件选择失败: ' + error.message)
  }
}

function handleSave() {
  // 表单验证
  if (!formData.value.host.trim() || !formData.value.username.trim() || !formData.value.port) {
    alert('请填写完整的主机地址、用户名和端口')
    return
  }
  
  if (formData.value.port < 1 || formData.value.port > 65535) {
    alert('端口号必须在 1-65535 之间')
    return
  }

  if (formData.value.authType === 'privatekey' && !formData.value.privateKeyPath.trim()) {
    alert('使用密钥认证时，必须提供私钥文件路径')
    return
  }

  const data = {
    host: formData.value.host.trim(),
    port: Number(formData.value.port),
    username: formData.value.username.trim(),
    password: formData.value.password,
    auth_type: formData.value.authType,
    private_key_path: formData.value.privateKeyPath.trim(),
    passphrase: formData.value.passphrase,
    display_name: formData.value.displayName.trim()
  }

  emit('save', data)
}
</script>

<style scoped>
/* 模态窗口样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000; /* 提高层级，确保在其他元素之上 */
}

.modal-content {
  background: #2d2d2d;
  padding: 30px;
  border-radius: 8px;
  width: 500px;
  max-width: 95%;
  color: #e6eef8;
}

.modal-content h3 {
  color: #ffffff;
  margin-top: 0;
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.form-row .input-field {
  flex: 1;
}

.input-field {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #333;
  color: #eee;
}

.input-field:focus {
  border-color: #4caf50;
  outline: none;
}

select.input-field {
  background: #333;
  color: #eee;
  border: 1px solid #555;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
}

select.input-field option {
  background: #333;
  color: #eee;
}

/* 文件选择器样式 */
.file-input-wrapper {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}

.file-path-input {
  flex: 1;
  background: #2a2a2a !important;
  cursor: default;
}

.file-select-btn {
  padding: 8px 12px;
  background: #4a5568;
  color: #e5e7eb;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
}

.file-select-btn:hover {
  background: #5a6578;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

.save-btn {
  padding: 8px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  padding: 8px 16px;
  background: #555;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
