<script setup lang="ts">
import { useCurrentCue } from '../composables/useCurrentCue.js'

const {
  currentCue,
  metrics,
  goPrev,
  goNext,
  updateStart,
  updateDuration,
  updateText,
} = useCurrentCue()
</script>

<template>
  <div class="current-cue-panel" v-if="currentCue">
    <div class="panel-header">
      <span class="panel-title">字幕 #{{ currentCue.index + 1 }}</span>
      <div class="panel-nav">
        <button @click="goPrev" :disabled="currentCue.index <= 0">◀</button>
        <button @click="goNext" :disabled="currentCue.index >= currentCue.total - 1">▶</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="field-row">
        <label>开始</label>
        <input
          type="text"
          :value="(currentCue.start / 1000).toFixed(3)"
          @change="(e) => updateStart(Number((e.target as HTMLInputElement).value))"
          class="field-input"
        />
      </div>
      <div class="field-row">
        <label>时长</label>
        <input
          type="text"
          :value="((currentCue.end - currentCue.start) / 1000).toFixed(2)"
          @change="(e) => updateDuration(Number((e.target as HTMLInputElement).value))"
          class="field-input"
        />
      </div>
      <div class="field-area">
        <label>文本</label>
        <textarea
          :value="currentCue.text"
          @input="(e) => updateText((e.target as HTMLTextAreaElement).value)"
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
