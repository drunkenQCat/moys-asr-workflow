<script setup lang="ts">
import { ref } from 'vue'
import { useWaveformStore } from '../stores/waveform.js'

const waveform = useWaveformStore()
const dragging = ref<'column' | 'row-top' | 'row-middle' | null>(null)
const startPos = ref(0)
const startValue = ref(0)

function beginDrag(type: 'column' | 'row-top' | 'row-middle', e: MouseEvent) {
  dragging.value = type
  startPos.value = type === 'row-top' || type === 'row-middle' ? e.clientY : e.clientX
  startValue.value = type === 'column'
    ? waveform.settings.splitPercent
    : type === 'row-top'
      ? waveform.settings.layoutRows[0]
      : waveform.settings.layoutRows[1]
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
  e.preventDefault()
}

function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  const delta = (dragging.value === 'row-top' || dragging.value === 'row-middle' ? e.clientY : e.clientX) - startPos.value
  const parent = (e.target as HTMLElement).closest('.editor-workspace') as HTMLElement
  if (!parent) return
  const size = dragging.value === 'column' ? parent.offsetWidth : parent.offsetHeight
  const pct = Math.max(10, Math.min(90, startValue.value + (delta / size) * 100))
  if (dragging.value === 'column') {
    waveform.updateSettings({ splitPercent: Math.round(pct) })
  } else if (dragging.value === 'row-top') {
    const rows = [...waveform.settings.layoutRows]
    rows[0] = Math.round(pct)
    rows[1] = Math.max(6, 100 - rows[0] - rows[2])
    waveform.updateSettings({ layoutRows: rows })
  } else if (dragging.value === 'row-middle') {
    const rows = [...waveform.settings.layoutRows]
    rows[1] = Math.round(pct)
    rows[2] = Math.max(12, 100 - rows[0] - rows[1])
    waveform.updateSettings({ layoutRows: rows })
  }
}

function endDrag() {
  dragging.value = null
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
}
</script>

<template>
  <div class="layout-resizers" v-if="waveform.settings.layout === 'free'">
    <div class="resizer-v" @mousedown="beginDrag('column', $event)"></div>
    <div class="resizer-h top" @mousedown="beginDrag('row-top', $event)"></div>
    <div class="resizer-h middle" @mousedown="beginDrag('row-middle', $event)"></div>
  </div>
</template>

<style scoped>
.resizer-v {
  position: absolute;
  top: 0; bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 100;
  background: transparent;
  transition: background 0.15s;
}
.resizer-v:hover { background: #6c63ff; }
.resizer-h {
  position: absolute;
  left: 0; right: 0;
  height: 4px;
  cursor: row-resize;
  z-index: 100;
  background: transparent;
  transition: background 0.15s;
}
.resizer-h:hover { background: #6c63ff; }
.resizer-h.top { top: 42%; }
.resizer-h.middle { top: 60%; }
</style>