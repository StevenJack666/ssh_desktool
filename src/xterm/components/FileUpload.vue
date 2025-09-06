<template>
  <div class="file-upload">
    <!-- 上传按钮 -->
    <div class="upload-button-container" @click="openFileUpload">
      <button class="upload-button" :disabled="isDisabled || uploading">
        <svg class="upload-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>上传文件</span>
      </button>
    </div>
    
    <!-- 上传进度对话框 -->
    <div v-if="showProgressDialog" class="upload-progress-dialog">
      <div class="dialog-header">
        <h3>文件上传</h3>
        <button class="close-button" @click="closeProgressDialog" v-if="!uploading">×</button>
      </div>
      
      <div class="dialog-body">
        <UploadProgress 
          :uploadData="uploadStatus" 
          @close="closeProgressDialog"
          @retry="retryUpload"
        />
      </div>
    </div>
    
    <!-- 目标路径输入对话框 -->
    <div v-if="showPathDialog" class="path-input-dialog">
      <div class="dialog-header">
        <h3>设置上传路径</h3>
        <button class="close-button" @click="closepathDialog">×</button>
      </div>
      
      <div class="dialog-body">
        <div class="form-group">
          <label for="remote-path">远程路径:</label>
          <input 
            id="remote-path" 
            v-model="remotePath" 
            type="text" 
            placeholder="例如: /home/username/files/"
            @keyup.enter="startUpload"
          />
        </div>
      </div>
      
      <div class="dialog-footer">
        <button @click="closepathDialog" class="action-button cancel">取消</button>
        <button @click="startUpload" class="action-button confirm">上传</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useSFTP } from '../composables/useSFTP.js';
import UploadProgress from './UploadProgress.vue';

// 属性
const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

// SFTP hook
const { uploadFile, getUploadStatus } = useSFTP();

// 本地状态
const isDisabled = computed(() => props.disabled);
const uploading = ref(false);
const showProgressDialog = ref(false);
const showPathDialog = ref(false);
const remotePath = ref('/home/');
const selectedFile = ref(null);
const currentUploadId = ref(null);

// 上传状态
const uploadStatus = computed(() => {
  if (!currentUploadId.value) return {};
  return getUploadStatus(currentUploadId.value) || {};
});

// 打开文件选择对话框
function openFileUpload() {
  if (isDisabled.value || uploading.value) return;
  
  // 使用SFTP API上传文件，传null表示打开文件选择对话框
  selectedFile.value = null;
  showPathDialog.value = true;
}

// 关闭路径对话框
function closepathDialog() {
  showPathDialog.value = false;
  selectedFile.value = null;
}

// 关闭进度对话框
function closeProgressDialog() {
  if (uploading.value) return;
  showProgressDialog.value = false;
  currentUploadId.value = null;
}

// 重试上传
async function retryUpload() {
  if (!props.sessionId || !remotePath.value) {
    alert('无法重试上传，会话或路径无效');
    return;
  }
  
  try {
    uploading.value = true;
    
    const result = await uploadFile(
      props.sessionId,
      null, // 重新打开文件选择对话框
      remotePath.value
    );
    
    if (result.success) {
      currentUploadId.value = result.uploadId;
    }
  } catch (error) {
    console.error('重试上传错误:', error);
    alert(`重试上传失败: ${error.message}`);
  } finally {
    uploading.value = false;
  }
}

// 开始上传
async function startUpload() {
  if (!props.sessionId || !remotePath.value) {
    alert('请设置有效的远程路径');
    return;
  }
  
  try {
    uploading.value = true;
    showPathDialog.value = false;
    showProgressDialog.value = true;
    
    const result = await uploadFile(
      props.sessionId,
      selectedFile.value, // null 将打开文件选择对话框
      remotePath.value
    );
    
    if (result.success) {
      currentUploadId.value = result.uploadId;
    } else {
      alert(`上传失败: ${result.message}`);
      showProgressDialog.value = false;
    }
  } catch (error) {
    console.error('文件上传错误:', error);
    alert(`上传错误: ${error.message}`);
    showProgressDialog.value = false;
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.file-upload {
  position: relative;
}

.upload-button-container {
  display: inline-block;
}

.upload-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: #4a5568;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.upload-button:hover:not(:disabled) {
  background-color: #5a6578;
}

.upload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-icon {
  width: 16px;
  height: 16px;
}

/* 对话框样式 */
.upload-progress-dialog,
.path-input-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #444;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  color: #e6eef8;
}

.close-button {
  background: none;
  border: none;
  color: #aaa;
  font-size: 18px;
  cursor: pointer;
}

.close-button:hover {
  color: #fff;
}

.dialog-body {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid #444;
  gap: 8px;
}

.action-button {
  padding: 6px 12px;
  background: #4a5568;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.action-button:hover {
  background: #5a6578;
}

.action-button.cancel {
  background: #555;
}

.action-button.confirm {
  background: #4caf50;
}

.action-button.uploading {
  cursor: not-allowed;
  opacity: 0.7;
}

/* 上传进度条样式 */
.upload-item {
  margin-bottom: 12px;
}

.upload-info {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
}

.filename {
  font-weight: 600;
  margin-bottom: 2px;
  color: #e6eef8;
}

.upload-path {
  font-size: 12px;
  color: #aaa;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: #444;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-bar {
  height: 100%;
  background: #4caf50;
  transition: width 0.3s ease;
}

.upload-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #aaa;
}

.upload-error {
  color: #f44336;
  margin-top: 8px;
  padding: 8px;
  background: rgba(244, 67, 54, 0.1);
  border-left: 3px solid #f44336;
}

/* 表单样式 */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #e6eef8;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  background: #333;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
}

.form-group input:focus {
  outline: none;
  border-color: #4caf50;
}
</style>
