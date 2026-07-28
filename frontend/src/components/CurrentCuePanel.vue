<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { cueMetrics } from '../core/editor-utils.js'

const project = useProjectStore()
const selection = useSelectionStore()

const currentCue = computed(() => {
  const idx = selection.lastActive
  return idx >= 0 && idx < project.segments.length ? project.segments[idx] : null
})

const metrics = computed(() => {
  if (!currentCue.value) return null
  return cueMetrics(currentCue.value.text, currentCue.value.start, currentCue.value.end)
})

function goPrev() {
  if (selection.lastActive > 0) selection.setActive(selection.lastActive - 1)
}

function goNext() {
  if (selection.lastActive < project.segments.length - 1) selection.setActive(selection.lastActive + 1)
}
</script>

<template>
  <div class="current-cue-panel" v-if="currentCue">
    <div class="panel-header">
      <span class="panel-title">字幕 #{{ selection.lastActive + 1 }}</span>
      <div class="panel-nav">
        <button @click="goPrev" :disabled="selection.lastActive <= 0">◀</button>
        <button @click="goNext" :disabled="selection.lastActive >= project.segments.length - 1">▶</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="field-row">
        <label>开始</label>
        <input
          type="text"
          :value="(currentCue.start / 1000).toFixed(3)"
          @change="(e) => currentCue && project.updateSegment(selection.lastActive, { start: Math.round(Number((e.target as HTMLInputElement).value) * 1000) })"
          class="field-input"
        />
      </div>
      <div class="field-row">
        <label>时长</label>
        <input
          type="text"
          :value="((currentCue.end - currentCue.start) / 1000).toFixed(2)"
          @change="(e) => currentCue && project.updateSegment(selection.lastActive, { end: currentCue.start + Number((e.target as HTMLInputElement).value) * 1000 })"
          class="field-input"
        />
      </div>
      <div class="field-area">
        <label>文本</label>
        <textarea
          :value="currentCue.text"
          @input="(e) => { const text = (e.target as HTMLTextAreaElement).value; project.updateSegment(selection.lastActive, { text }); }"
          class="field-textarea"
          rows="3"
        />
      </div>
      <div class="metrics" v-if="metrics">
        <span>字数: {{ metrics.totalLength }}</span>
        <span>字/秒: {{ metrics.charsPerSecond }}</span>
      </div>
    </div>
  </div>
  <div class="current-cue-panel empty" v-else>
    <p class="empty-hint">选择一条字幕查看详情</p>
  </div>
</template>

<style scoped>
.current-cue-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.current-cue-panel.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-hint { color: #666; font-size: 13px; }
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: #222;
  border-bottom: 1px solid #333;
}
.panel-title { font-size: 12px; color: #888; }
.panel-nav button {
  background: none;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
}
.panel-nav button:disabled { opacity: 0.4; }
.panel-body {
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.field-row label { font-size: 12px; color: #888; min-width: 40px; }
.field-input {
  flex: 1;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  padding: 4px 8px;
  font-size: 12px;
  font-family: monospace;
}
.field-area label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}
.field-textarea {
  width: 100%;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  padding: 4px 8px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}
.metrics {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 11px;
  color: #888;
}
</style>