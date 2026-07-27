<script setup lang="ts">
import { useUiStore } from '../stores/ui.js'
import { useProjectStore } from '../stores/project.js'

const ui = useUiStore()
const project = useProjectStore()

function onDragOver(e: DragEvent) {
  e.preventDefault()
  ui.incrementDrag()
}

function onDragLeave() {
  ui.decrementDrag()
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  ui.decrementDrag()

  const files = Array.from(e.dataTransfer?.files || [])
  if (!files.length) return

  const jsonFile = files.find((f) => f.name.endsWith('.json'))
  const mediaFile = files.find((f) => !f.name.endsWith('.json'))

  if (jsonFile) {
    const text = await readFileAsText(jsonFile)
    if (project.loadProject(text)) {
      project.projectName = jsonFile.name.replace(/\.json$/i, '')
    }
  }

  if (mediaFile) {
    project.loadMedia(mediaFile)
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
</script>

<template>
  <div
    v-if="ui.dragOverlayVisible"
    class="drag-overlay"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
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