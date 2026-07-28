<script setup lang="ts">
import { useWaveformStore } from '../stores/waveform.js'
import { useLayoutResizers } from '../composables/useLayoutResizers.js'

const waveform = useWaveformStore()
const { beginDrag } = useLayoutResizers()
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
