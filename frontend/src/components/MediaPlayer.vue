<script setup lang="ts">
import { useProjectStore } from '../stores/project.js'
import { useWaveformStore } from '../stores/waveform.js'
import { useMediaPlayer } from '../composables/useMediaPlayer.js'
import OverlayPreview from './OverlayPreview.vue'

const emit = defineEmits<{
  timeupdate: [timeMs: number]
}>()

const project = useProjectStore()
const waveform = useWaveformStore()

const {
  videoRef,
  isPlaying,
  onTimeUpdate,
  togglePlayback,
  seekTo,
  setRate,
} = useMediaPlayer({
  onTimeUpdate: (ms) => emit('timeupdate', ms),
  onCurrentTimeChange: (ms) => waveform.setEditorInstance({ currentTime: ms }),
})

defineExpose({ togglePlayback, seekTo, setRate })
</script>

<template>
  <div class="media-player">
    <video
      v-if="project.mediaName?.match(/\.(mp4|mkv|webm|mov|avi)$/i)"
      ref="videoRef"
      :src="project.mediaUrl"
      class="player-element"
      @timeupdate="onTimeUpdate"
      @ended="isPlaying = false"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      controls
    />
    <audio
      v-else-if="project.mediaName"
      ref="videoRef"
      :src="project.mediaUrl"
      class="player-element"
      @timeupdate="onTimeUpdate"
      @ended="isPlaying = false"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      controls
    />
    <div v-else class="player-placeholder">
      <p>暂无媒体文件</p>
      <p class="hint">打开工程或拖拽媒体文件到此处</p>
    </div>
    <OverlayPreview />
  </div>
</template>

<style scoped>
.media-player {
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}
.player-element {
  width: 100%;
  max-height: 100%;
  display: block;
}
.player-placeholder {
  color: #666;
  text-align: center;
  padding: 20px;
}
.player-placeholder .hint {
  font-size: 12px;
  margin-top: 4px;
}
</style>
