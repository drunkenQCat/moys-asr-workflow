<script setup lang="ts">
import { useUiStore, ModalName } from '../stores/ui.js'
import { useProjectStore } from '../stores/project.js'
import { useProjectFileActions } from '../composables/useProjectFileActions.js'
import { useExportActions } from '../composables/useExportActions.js'
import { useTranscribeAction } from '../composables/useTranscribeAction.js'

const emit = defineEmits<{
  'open-settings': []
  'open-editor-settings': []
  'open-gap-remove': []
}>()

const project = useProjectStore()
const ui = useUiStore()
const { openProject, saveProject } = useProjectFileActions()
const {
  canExportGapRemoved,
  exportSrt,
  exportGapRemovedSrt,
  exportOtio,
  exportGapRemovedOtio,
  exportResolveJson,
  exportFfconcat,
  exportGapRemovedIntervals,
} = useExportActions()
const { transcribing, transcribeProgress, startTranscribe } = useTranscribeAction()

function openReplace() {
  ui.openModal(ModalName.Replace)
}
</script>

<template>
  <div class="toolbar-actions">
    <button @click="openProject" title="打开工程">📂 打开</button>
    <button @click="saveProject" :disabled="!project.segments.length" title="保存工程">💾 保存</button>
    <button @click="exportSrt" :disabled="!project.segments.length" title="导出 SRT">📄 SRT</button>
    <button @click="exportGapRemovedSrt" :disabled="!canExportGapRemoved" title="去空隙 SRT">📄 去空隙</button>
    <button @click="exportOtio" :disabled="!project.segments.length" title="导出 OTIO">🎬 OTIO</button>
    <button @click="exportGapRemovedOtio" :disabled="!canExportGapRemoved" title="去空隙 OTIO">🎬 去空隙</button>
    <button @click="exportResolveJson" :disabled="!project.segments.length" title="导出 Resolve JSON">🎞️ Resolve</button>
    <button @click="exportFfconcat" :disabled="!canExportGapRemoved" title="FFconcat">🎞️ FFconcat</button>
    <button @click="exportGapRemovedIntervals" :disabled="!canExportGapRemoved" title="保留区域 JSON">📋 保留区域</button>
    <span class="spacer"></span>
    <button @click="emit('open-gap-remove')" title="空隙移除">✂️</button>
    <button @click="emit('open-editor-settings')" title="编辑器设置">⚙️</button>
    <button @click="openReplace" :disabled="!project.segments.length" title="查找替换">🔍</button>
    <button @click="startTranscribe(() => emit('open-settings'))" :disabled="transcribing" :title="transcribing ? transcribeProgress : 'ASR 转写'">
      {{ transcribing ? '⏳' : '🎙️' }}
    </button>
    <button @click="emit('open-settings')" title="ASR 设置">🔑</button>
  </div>
</template>

<style scoped>
.toolbar-actions {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  background: #1e1e32;
  border-bottom: 1px solid #333;
}
button {
  padding: 4px 10px;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
}
button:hover { background: #3a3a5e; }
button:disabled { opacity: 0.4; cursor: default; }
.spacer { flex: 1; }
.btn-settings { font-size: 14px; padding: 4px 8px; }
</style>
