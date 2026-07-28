<script setup lang="ts">
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
</script>

<template>
  <div v-if="ui.dragOverlayVisible" class="drag-overlay">
    <div class="drag-hint">
      <span class="icon">📁</span>
      <span>拖放工程 JSON 或媒体文件到此</span>
    </div>
  </div>
</template>

<style scoped>
.drag-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(108, 99, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
  pointer-events: none;
}
.drag-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  border: 2px dashed #6c63ff;
  border-radius: 16px;
  background: rgba(26, 26, 46, 0.9);
  color: #e0e0e0;
  font-size: 16px;
}
.icon { font-size: 48px; }
</style>
