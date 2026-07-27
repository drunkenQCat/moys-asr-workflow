// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project.js'
import MediaPlayer from '../../src/components/MediaPlayer.vue'

// Mock HTMLMediaElement methods
let mockPaused = true
beforeEach(() => {
  mockPaused = true
  HTMLMediaElement.prototype.play = vi.fn(() => {
    mockPaused = false
    return Promise.resolve()
  })
  HTMLMediaElement.prototype.pause = vi.fn(() => {
    mockPaused = true
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    get: () => mockPaused,
    configurable: true,
  })
  HTMLMediaElement.prototype.load = vi.fn()
  // Mock URL.createObjectURL
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test') })
})

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const project = useProjectStore()
  return { project }
}

describe('MediaPlayer.vue', () => {
  it('shows placeholder when no media', () => {
    setup()
    const wrapper = mount(MediaPlayer)
    expect(wrapper.text()).toContain('暂无媒体文件')
  })

  it('renders video element for video files', () => {
    const { project } = setup()
    project.loadMedia(new File(['fake'], 'test.mp4', { type: 'video/mp4' }))
    const wrapper = mount(MediaPlayer)
    expect(wrapper.find('video').exists()).toBe(true)
    expect((wrapper.find('video').element as HTMLVideoElement).src).toBeTruthy()
  })

  it('renders audio element for audio files', () => {
    const { project } = setup()
    project.loadMedia(new File(['fake'], 'test.mp3', { type: 'audio/mp3' }))
    const wrapper = mount(MediaPlayer)
    expect(wrapper.find('audio').exists()).toBe(true)
  })

  it('toggles play/pause', async () => {
    const { project } = setup()
    project.loadMedia(new File(['fake'], 'test.mp4', { type: 'video/mp4' }))
    const wrapper = mount(MediaPlayer, { attachTo: document.body })
    // Call exposed method
    ;(wrapper.vm as any).togglePlayback()
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    ;(wrapper.vm as any).togglePlayback()
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it('sets playback rate', async () => {
    const { project } = setup()
    project.loadMedia(new File(['fake'], 'test.mp4', { type: 'video/mp4' }))
    const wrapper = mount(MediaPlayer, { attachTo: document.body })
    ;(wrapper.vm as any).setRate(2)
    const video = wrapper.find('video').element as HTMLVideoElement
    expect(video.playbackRate).toBe(2)
  })
})