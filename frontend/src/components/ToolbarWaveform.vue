<script setup lang="ts">
import { useWaveformStore } from '../stores/waveform.js'

const waveform = useWaveformStore()
const s = waveform.settings

function setMode(mode: 'hidden' | 'basic' | 'multi') {
  waveform.updateSettings({ mode })
}

function setLayout(layout: 'classic' | 'wave-right' | 'wave-bottom' | 'free') {
  waveform.updateSettings({ layout })
}

function setSide(side: 'left' | 'right') {
  waveform.updateSettings({ side })
}

function setDisabledDisplay(display: 'dim' | 'hidden') {
  waveform.updateSettings({ disabledDisplay: display })
}

function zoomIn() {
  const v = Math.max(1, (s.visibleSeconds || 10) - 5)
  waveform.updateSettings({ visibleSeconds: v })
}

function zoomOut() {
  const v = Math.min(120, (s.visibleSeconds || 10) + 5)
  waveform.updateSettings({ visibleSeconds: v })
}

function scaleUp() {
  waveform.updateSettings({ waveformScale: Math.min(6, (s.waveformScale || 1) + 0.25) })
}

function scaleDown() {
  waveform.updateSettings({ waveformScale: Math.max(0.25, (s.waveformScale || 1) - 0.25) })
}
</script>

<template>
  <div class="toolbar-waveform">
    <select :value="s.mode" @change="setMode(($event.target as HTMLSelectElement).value as any)" class="select" title="波形模式">
      <option value="hidden">隐藏</option>
      <option value="basic">基础</option>
      <option value="multi">多行</option>
    </select>
    <select :value="s.layout" @change="setLayout(($event.target as HTMLSelectElement).value as any)" class="select" title="布局">
      <option value="classic">经典</option>
      <option value="wave-right">波形在右</option>
      <option value="wave-bottom">波形在下</option>
      <option value="free">自由</option>
    </select>
    <select :value="s.side" @change="setSide(($event.target as HTMLSelectElement).value as any)" class="select" title="波形侧边">
      <option value="left">左侧</option>
      <option value="right">右侧</option>
    </select>
    <select :value="s.disabledDisplay" @change="setDisabledDisplay(($event.target as HTMLSelectElement).value as any)" class="select" title="禁用显示">
      <option value="dim">变暗</option>
      <option value="hidden">隐藏</option>
    </select>
    <button @click="zoomIn" title="放大" :disabled="(s.visibleSeconds || 10) <= 1">🔍+</button>
    <button @click="zoomOut" title="缩小" :disabled="(s.visibleSeconds || 10) >= 120">🔍-</button>
    <span class="label">{{ s.visibleSeconds }}s</span>
    <button @click="scaleUp" title="波形放大">📈</button>
    <button @click="scaleDown" title="波形缩小">📉</button>
    <span class="label">{{ s.waveformScale?.toFixed(2) }}</span>
  </div>
</template>

<style scoped>
.toolbar-waveform {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #1e1e32;
  border-bottom: 1px solid #333;
  font-size: 11px;
}
.select {
  padding: 2px 4px;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 3px;
  color: #e0e0e0;
  font-size: 11px;
}
button {
  padding: 2px 6px;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 3px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 11px;
}
button:hover { background: #3a3a5e; }
button:disabled { opacity: 0.4; }
.label {
  color: #888;
  font-size: 11px;
  font-family: monospace;
  min-width: 30px;
}
</style>