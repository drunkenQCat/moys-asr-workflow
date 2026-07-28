<script setup lang="ts">
import { useUiStore, ModalName } from '../stores/ui.js'
import { useReplace } from '../composables/useReplace.js'

const ui = useUiStore()
const {
  findText,
  replaceText,
  caseSensitive,
  useRegex,
  preview,
  executeReplace,
} = useReplace()
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.isModalOpen(ModalName.Replace)" class="modal-overlay" @click.self="ui.closeModal(ModalName.Replace)">
      <div class="modal-content">
        <h3>查找替换</h3>
        <div class="field">
          <label>查找</label>
          <input v-model="findText" type="text" class="input" placeholder="搜索文本..." />
        </div>
        <div class="field">
          <label>替换为</label>
          <input v-model="replaceText" type="text" class="input" />
        </div>
        <div class="options">
          <label><input type="checkbox" v-model="caseSensitive" /> 区分大小写</label>
          <label><input type="checkbox" v-model="useRegex" /> 正则</label>
        </div>
        <div class="preview" v-if="preview">
          <p class="preview-info">
            {{ preview.matchCount }} 处匹配，{{ preview.lineCount }} 行修改
          </p>
          <p v-if="preview.error" class="error">{{ preview.error }}</p>
        </div>
        <div class="actions">
          <button @click="ui.closeModal(ModalName.Replace)" class="btn">取消</button>
          <button @click="executeReplace" :disabled="!preview?.matchCount" class="btn btn-primary">替换</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}
.modal-content {
  background: #2a2a3e;
  border-radius: 8px;
  padding: 24px;
  width: 420px;
  max-width: 90vw;
  color: #e0e0e0;
}
h3 { margin: 0 0 16px; }
.field { margin-bottom: 12px; }
.field label { display: block; margin-bottom: 4px; font-size: 12px; color: #888; }
.input {
  width: 100%; padding: 6px 10px;
  background: #1a1a2e; border: 1px solid #444; border-radius: 4px;
  color: #e0e0e0; font-size: 13px;
}
.options { display: flex; gap: 16px; margin-bottom: 12px; font-size: 12px; }
.options label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.preview { margin-bottom: 12px; font-size: 12px; }
.preview-info { color: #6c63ff; }
.error { color: #ff6b6b; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn {
  padding: 6px 16px; border: 1px solid #444; border-radius: 4px;
  background: transparent; color: #e0e0e0; cursor: pointer; font-size: 13px;
}
.btn-primary { background: #6c63ff; border-color: #6c63ff; }
.btn:disabled { opacity: 0.4; }
</style>
