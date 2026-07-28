<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useWaveformRenderer } from '../composables/useWaveformRenderer.js'
import { useWaveformStore } from '../stores/waveform.js'
import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'

const containerRef = ref<HTMLElement | null>(null)
const waveform = useWaveformStore()
const project = useProjectStore()
const selection = useSelectionStore()

const currentTimeMs = ref(0)

const activeIndex = computed(() => selection.lastActive)

function onSeek(timeMs: number) {
  waveform.setEditorInstance?.({ currentTime: timeMs })
}

function onSegmentChange(index: number, start: number, end: number) {
  project.updateSegment(index, { start, end })
}

function onSettingsChange(patch: Partial<typeof waveform.settings>) {
  waveform.updateSettings(patch)
}

const { isReady } = useWaveformRenderer({
  containerRef,
  settings: () => waveform.settings,
  payload: () => waveform.payload,
  segments: () => project.segments,
  currentTimeMs: () => currentTimeMs.value,
  activeIndex: () => activeIndex.value,
  callbacks: {
    onSeek,
    onSegmentChange,
    onSettingsChange,
  },
})

watch(() => waveform.editorInstance, (inst) => {
  if (inst?.currentTime !== undefined) {
    currentTimeMs.value = inst.currentTime
  }
}, { deep: true })
</script>

<template>
  <div
    ref="containerRef"
    id="waveform-pane"
    class="waveform-pane"
    :class="{ ready: isReady }"
  >
    <div v-if="!isReady" class="waveform-placeholder">
      波形加载中...
    </div>
  </div>
</template>

<style scoped>
.waveform-pane {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 100px;
  background: #1a1a2e;
  overflow: hidden;
}
.waveform-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 14px;
}
</style>
