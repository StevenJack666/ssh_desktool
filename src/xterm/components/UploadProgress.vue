<template>
  <div class="upload-progress-component">
    <div class="upload-item">
      <div class="upload-info">
        <div class="file-info">
          <span class="filename">{{ uploadData.fileName || '未知文件' }}</span>
          <span class="file-size">{{ formatFileSize(uploadData.totalBytes) }}</span>
        </div>
        <span class="upload-path">上传到: {{ uploadData.remotePath || '/' }}</span>
      </div>
      
      <div class="progress-bar-container">
        <div class="progress-bar" :style="{ width: `${uploadData.progress || 0}%` }"></div>
      </div>
      
      <div class="upload-stats">
        <span>{{ formatFileSize(uploadData.bytesTransferred) }} / {{ formatFileSize(uploadData.totalBytes) }}</span>
        <span>{{ uploadData.progress || 0 }}%</span>
      </div>
      
      <!-- 状态指示器 -->
      <div v-if="uploadData.status === 'preparing'" class="upload-status preparing">
        <span class="status-icon">⏳</span>
        <span class="status-text">准备中...</span>
      </div>
      
      <div v-if="uploadData.status === 'checking_dir'" class="upload-status preparing">
        <span class="status-icon">📁</span>
        <span class="status-text">检查目录结构...</span>
      </div>
      
      <div v-if="uploadData.status === 'starting'" class="upload-status preparing">
        <span class="status-icon">🚀</span>
        <span class="status-text">准备开始传输...</span>
      </div>
      
      <div v-if="uploadData.status === 'error'" class="upload-error">
        <div class="error-icon">⚠️</div>
        <div class="error-message">{{ uploadData.error }}</div>
      </div>
      
      <div v-if="uploadData.status === 'completed'" class="upload-success">
        <div class="success-icon">✓</div>
        <div class="success-message">上传成功!</div>
      </div>
    </div>
    
    <!-- 按钮区域 -->
    <div class="progress-actions" v-if="showActions">
      <button 
        v-if="uploadData.status === 'error'" 
        @click="$emit('retry')" 
        class="action-button retry">
        重试
      </button>
      
      <button 
        v-if="uploadData.status === 'completed' || uploadData.status === 'error'" 
        @click="$emit('close')" 
        class="action-button close">
        关闭
      </button>
      
      <button 
        v-else-if="['preparing', 'checking_dir', 'starting', 'uploading'].includes(uploadData.status)" 
        @click="handleCancel"
        class="action-button cancel">
        取消上传
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  uploadData: {
    type: Object,
    // 注意：Vue 不允许同时设置 required: true 和 default
    // 如果设置了默认值，则不能设为必填
    default: () => ({
      fileName: '未知文件',
      remotePath: '',
      progress: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      status: 'preparing', // preparing, checking_dir, starting, uploading, completed, error
      error: null
    })
  },
  showActions: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close', 'retry', 'cancel']);

function handleCancel() {
  console.log('🔴 UploadProgress 组件的取消按钮被点击，当前上传状态:', props.uploadData.status);
  emit('cancel');
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
</script>

<style scoped>
.upload-progress-component {
  padding: 12px;
  border-radius: 6px;
  background: #2d2d2d;
  border: 1px solid #444;
}

.upload-item {
  margin-bottom: 10px;
}

.upload-info {
  margin-bottom: 10px;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.filename {
  font-weight: 600;
  color: #e6eef8;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
}

.file-size {
  color: #888;
  font-size: 12px;
  white-space: nowrap;
  margin-left: 8px;
}

.upload-path {
  font-size: 12px;
  color: #aaa;
  display: block;
  margin-bottom: 8px;
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
  background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
}

.upload-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 10px;
}

.upload-status {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
}

.upload-status.preparing {
  background: rgba(33, 150, 243, 0.1);
  color: #2196f3;
}

.status-icon {
  margin-right: 6px;
}

.upload-error {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(244, 67, 54, 0.1);
  border-left: 3px solid #f44336;
  color: #f44336;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.error-icon {
  font-size: 16px;
}

.upload-success {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(76, 175, 80, 0.1);
  border-left: 3px solid #4caf50;
  color: #4caf50;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-icon {
  font-size: 16px;
}

.progress-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.action-button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.action-button.retry {
  background: #ff9800;
  color: #fff;
}

.action-button.retry:hover {
  background: #f57c00;
}

.action-button.close {
  background: #2196f3;
  color: #fff;
}

.action-button.close:hover {
  background: #1976d2;
}

.action-button.cancel {
  background: #f44336;
  color: #fff;
}

.action-button.cancel:hover {
  background: #e53935;
}
</style>
