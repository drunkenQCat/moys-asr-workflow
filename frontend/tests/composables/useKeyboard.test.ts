// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project.js'
import { useSelectionStore } from '../../src/stores/selection.js'
import { useUiStore, ModalName } from '../../src/stores/ui.js'
import { useKeyboard } from '../../src/composables/useKeyboard.js'

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const project = useProjectStore()
  const selection = useSelectionStore()
  const ui = useUiStore()
  const mediaControls = { togglePlayback: vi.fn(), setRate: vi.fn() }
  project.loadProject(JSON.stringify({
    segments: [{ start: 0, end: 1000, text: '测试', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null }],
  }))
  project.performUndo = vi.fn() // mock undo
  const kb = useKeyboard(mediaControls)
  kb.init()
  return { project, selection, ui, mediaControls, kb }
}

function dispatchKey(key: string, options: Record<string, unknown> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
}

describe('useKeyboard', () => {
  it('space toggles playback', () => {
    const { mediaControls } = setup()
    dispatchKey(' ')
    expect(mediaControls.togglePlayback).toHaveBeenCalled()
  })

  it('j sets rate 0.5', () => {
    const { mediaControls } = setup()
    dispatchKey('j')
    expect(mediaControls.setRate).toHaveBeenCalledWith(0.5)
  })

  it('k sets rate 1', () => {
    const { mediaControls } = setup()
    dispatchKey('k')
    expect(mediaControls.setRate).toHaveBeenCalledWith(1)
  })

  it('l sets rate 2', () => {
    const { mediaControls } = setup()
    dispatchKey('l')
    expect(mediaControls.setRate).toHaveBeenCalledWith(2)
  })

  it('ctrl+z calls performUndo', () => {
    const { project, mediaControls } = setup()
    dispatchKey('z', { ctrlKey: true })
    expect(project.performUndo).toHaveBeenCalled()
  })

  it('does not toggle playback when editing', () => {
    const { selection, mediaControls } = setup()
    selection.startEditing(0, '测试文本')
    dispatchKey(' ')
    expect(mediaControls.togglePlayback).not.toHaveBeenCalled()
  })

  it('escape finishes editing', () => {
    const { selection, mediaControls } = setup()
    selection.startEditing(0, '测试文本')
    expect(selection.editingState).not.toBeNull()
    dispatchKey('Escape')
    expect(selection.editingState).toBeNull()
  })

  it('does not toggle playback when modal is open', () => {
    const { ui, mediaControls } = setup()
    ui.openModal(ModalName.Replace)
    dispatchKey(' ')
    expect(mediaControls.togglePlayback).not.toHaveBeenCalled()
  })

  it('escape closes modal', () => {
    const { ui, mediaControls } = setup()
    ui.openModal(ModalName.Replace)
    expect(ui.isModalOpen(ModalName.Replace)).toBe(true)
    dispatchKey('Escape')
    expect(ui.isModalOpen(ModalName.Replace)).toBe(false)
  })
})