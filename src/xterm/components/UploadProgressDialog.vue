<template>
  <div v-if="visible" class="upload-progress-dialog-overlay" @click.self="handleOverlayClick">
    <div class="upload-progress-dialog">
      <div class="dialog-header">
        <h3>文件上传进度</h3>
        <button class="close-button" @click="handleClose" v-if="canClose">×</button>
      </div>
      
      <div class="dialog-body">
        <UploadProgress 
          :uploadData="currentUpload" 
          @close="handleClose"
          @retry="$emit('retry')"
          @cancel="handleCancel"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import UploadProgress from './UploadProgress.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  uploadData: {
    type: Object,
    default: () => ({
      fileName: '正在准备...',
      remotePath: '',
      progress: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      status: 'preparing'
    })
  }
});

const emit = defineEmits(['close', 'retry', 'cancel']);

const currentUpload = computed(() => {
  return props.uploadData || {
    fileName: '',
    remotePath: '',
    progress: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    status: 'preparing'
  };
});

const canClose = computed(() => {
  return !currentUpload.value || 
         currentUpload.value.status === 'completed' || 
         currentUpload.value.status === 'error';
});

function handleOverlayClick() {
  if (canClose.value) {
    emit('close');
  }
}

function handleClose() {
  if (canClose.value) {
    emit('close');
  }
}

function handleCancel() {
  console.log('🟠 UploadProgressDialog 的取消事件被触发');
  emit('cancel');
}
</script>

<style scoped>
.upload-progress-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.upload-progress-dialog {
  width: 450px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #444;
  background: #333;
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
  font-size: 20px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.dialog-body {
  padding: 16px;
}
</style>
