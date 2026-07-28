import { ref, watch } from 'vue'

export interface UseMediaPlayerOptions {
  onTimeUpdate?: (timeMs: number) => void
  onCurrentTimeChange?: (timeMs: number) => void
}

export function useMediaPlayer(options: UseMediaPlayerOptions = {}) {
  const videoRef = ref<HTMLVideoElement | HTMLAudioElement | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const playbackRate = ref(1)

  watch(currentTime, (ms) => {
    options.onCurrentTimeChange?.(ms)
  })

  function onTimeUpdate(e: Event) {
    const target = e.target as HTMLVideoElement | HTMLAudioElement
    const ms = Math.round(target.currentTime * 1000)
    currentTime.value = ms
    options.onTimeUpdate?.(ms)
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

  return {
    videoRef,
    isPlaying,
    currentTime,
    playbackRate,
    onTimeUpdate,
    togglePlayback,
    seekTo,
    setRate,
  }
}
