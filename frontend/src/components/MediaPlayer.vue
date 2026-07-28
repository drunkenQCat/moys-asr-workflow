<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../stores/project.js'
import OverlayPreview from './OverlayPreview.vue'

const emit = defineEmits<{
  timeupdate: [timeMs: number]
}>()

const project = useProjectStore()
const videoRef = ref<HTMLVideoElement | HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const playbackRate = ref(1)

function onTimeUpdate(e: Event) {
  const target = e.target as HTMLVideoElement | HTMLAudioElement
  const ms = Math.round(target.currentTime * 1000)
  currentTime.value = ms
  emit('timeupdate', ms)
}

function togglePlayback() {
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play()
    isPlaying.value = true
  } else {
    videoRef.value.pause()
    isPlaying.value = false
  }
}

function seekTo(timeMs: number) {
  if (!videoRef.value) return
  videoRef.value.currentTime = timeMs / 1000
}

function setRate(rate: number) {
  if (!videoRef.value) return
  videoRef.value.playbackRate = rate
  playbackRate.value = rate
}

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