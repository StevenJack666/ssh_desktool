<template>
  <div class="modal-backdrop" v-if="visible" @click="handleBackdropClick">
    <div class="modal-dialog" @click.stop>
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="handleCancel">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label v-if="label">{{ label }}</label>
          <input 
            ref="inputRef"
            type="text" 
            v-model="inputValue" 
            :placeholder="placeholder" 
            @keyup.enter="handleConfirm"
            class="form-input"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-cancel" @click="handleCancel">取消</button>
        <button class="btn btn-confirm" @click="handleConfirm">确认</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  visible: Boolean,
  title: {
    type: String,
    default: '请输入'
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  defaultValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['confirm', 'cancel', 'update:visible']);

const inputValue = ref('');
const inputRef = ref(null);

// 当对话框显示时，聚焦到输入框
watch(() => props.visible, async (visible) => {
  if (visible) {
    inputValue.value = props.defaultValue;
    await nextTick();
    inputRef.value?.focus();
  }
});

function handleConfirm() {
  emit('confirm', inputValue.value);
  emit('update:visible', false);
}

function handleCancel() {
  emit('cancel');
  emit('update:visible', false);
}

function handleBackdropClick(event) {
  // 点击背景关闭对话框
  if (event.target.classList.contains('modal-backdrop')) {
    handleCancel();
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-dialog {
  width: 400px;
  background-color: #2d2d2d;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #333;
  border-bottom: 1px solid #444;
}

.modal-header h3 {
  margin: 0;
  color: #eee;
  font-size: 16px;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.modal-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #eee;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #555;
  background-color: #333;
  color: #fff;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid #444;
}

.btn {
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 8px;
  border: none;
}

.btn-cancel {
  background-color: #555;
  color: #fff;
}

.btn-cancel:hover {
  background-color: #666;
}

.btn-confirm {
  background-color: #2196f3;
  color: #fff;
}

.btn-confirm:hover {
  background-color: #1e88e5;
}
</style>
