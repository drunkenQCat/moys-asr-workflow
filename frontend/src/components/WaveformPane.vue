<script setup lang="ts">
import { ref } from 'vue'
import { useWaveformEditor } from '../composables/useWaveformEditor.js'

const containerRef = ref<HTMLElement | null>(null)
const { isReady, init, destroy } = useWaveformEditor(containerRef)

// 初始化 waveform（挂载后自动）
import { onMounted, onUnmounted } from 'vue'
onMounted(() => {
  init()
})
onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div
    ref="containerRef"
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