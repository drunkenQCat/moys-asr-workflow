// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupAllMocks } from '../fixtures/waveform-dom.js'
import { WaveformEditor } from '../../src/core/waveform/editor.js'

describe('WaveformEditor', () => {
  beforeEach(() => {
    setupAllMocks()
  })

  it('can be instantiated with DOM fixture', () => {
    const root = document.getElementById('waveform-pane')!
    const editor = new WaveformEditor({ root, callbacks: {} })
    expect(editor).toBeInstanceOf(WaveformEditor)
    expect(editor.workspace).not.toBeNull()
    expect(editor.pane).not.toBeNull()
    expect(editor.cues).not.toBeNull()
  })

  it('reads settings from localStorage', () => {
    localStorage.setItem('moy.asr.waveform.settings.v1', JSON.stringify({
      mode: 'basic',
      layout: 'wave-right',
    }))
    const root = document.getElementById('waveform-pane')!
    const editor = new WaveformEditor({ root })
    expect(editor.settings.mode).toBe('basic')
    expect(editor.settings.layout).toBe('wave-right')
  })

  it('applies layout to workspace', () => {
    const root = document.getElementById('waveform-pane')!
    const editor = new WaveformEditor({ root })
    editor.applyLayout()
    const workspace = document.getElementById('editor-workspace')
    expect(workspace!.style.getPropertyValue('--waveform-split')).toBeTruthy()
    expect(workspace!.classList.contains('waveform-basic')).toBe(true)
  })

  it('setPayload updates peaks', () => {
    const root = document.getElementById('waveform-pane')!
    const editor = new WaveformEditor({ root })
    const payload = {
      schema: 'moy.asr.waveform.v1',
      encoding: 'i8-minmax-base64',
      peaks_per_second: 100,
      peak_count: 2,
      duration_ms: 20,
      data: btoa(String.fromCharCode(0x81, 0x7f, 0xf6, 0x0a)),
    }
    editor.setPayload(payload)
    expect(editor.payload).not.toBeNull()
    expect(editor.peaks).not.toBeNull()
  })

  it('destroy cleans up', () => {
    const root = document.getElementById('waveform-pane')!
    const editor = new WaveformEditor({ root })
    editor.setPayload({ schema: 'moy.asr.waveform.v1', encoding: 'i8-minmax-base64', peaks_per_second: 100, peak_count: 2, duration_ms: 20, data: '' })
    editor.destroy()
    expect(editor.payload).toBeNull()
    expect(editor.peaks).toBeNull()
  })
})