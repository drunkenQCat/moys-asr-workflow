<script setup lang="ts">
import { ref, watch } from 'vue'
import { useWaveformEditor } from '../composables/useWaveformEditor.js'
import { useWaveformStore } from '../stores/waveform.js'
import { useProjectStore } from '../stores/project.js'

const containerRef = ref<HTMLElement | null>(null)
const { isReady, init, setPayload, setSegments, destroy } = useWaveformEditor(containerRef)

const waveform = useWaveformStore()
const project = useProjectStore()

// 挂载后初始化
import { onMounted, onUnmounted } from 'vue'
onMounted(() => {
  init()
})
onUnmounted(() => {
  destroy()
})

// 波形数据变化 → 更新 canvas
watch(() => waveform.payload, (payload) => {
  if (payload) setPayload(payload)
}, { immediate: true })

// 字幕段变化 → 更新 canvas
watch(() => project.segments, (segments) => {
  setSegments(segments as any)
}, { deep: true, immediate: true })
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
  height: 100%;
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