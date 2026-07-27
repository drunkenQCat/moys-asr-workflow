// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SetupWizard from '../../src/components/SetupWizard.vue'

beforeEach(() => {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k in store) delete store[k] },
    get length() { return Object.keys(store).length },
    key: () => null,
  }
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SetupWizard.vue', () => {
  it('shows when no API key configured', async () => {
    setActivePinia(createPinia())
    mount(SetupWizard, { attachTo: document.body })
    await new Promise(r => setTimeout(r, 10))
    const overlay = document.querySelector('.setup-overlay')
    expect(overlay).not.toBeNull()
  })

  it('hides when API key is already configured', () => {
    localStorage.setItem('moy.asr.config', JSON.stringify({ apiKey: 'sk-test' }))
    setActivePinia(createPinia())
    mount(SetupWizard, { attachTo: document.body })
    expect(document.querySelector('.setup-overlay')).toBeNull()
  })

  it('saves config on save', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(SetupWizard, { attachTo: document.body })
    await new Promise(r => setTimeout(r, 10))
    // Set the apiKey ref directly via component vm
    ;(wrapper.vm as any).apiKey = 'sk-my-key'
    await wrapper.vm.$nextTick()
    const saveBtn = document.querySelector('.btn-primary') as HTMLButtonElement
    expect(saveBtn).not.toBeNull()
    expect(saveBtn.disabled).toBe(false)
    saveBtn.click()
    await new Promise(r => setTimeout(r, 0))
    const saved = JSON.parse(localStorage.getItem('moy.asr.config') || '{}')
    expect(saved.apiKey).toBe('sk-my-key')
  })

  it('skips without saving', async () => {
    setActivePinia(createPinia())
    mount(SetupWizard, { attachTo: document.body })
    await new Promise(r => setTimeout(r, 10))
    const skipBtn = document.querySelector('.btn-skip') as HTMLButtonElement
    expect(skipBtn).not.toBeNull()
    skipBtn.click()
    await new Promise(r => setTimeout(r, 0))
    expect(document.querySelector('.setup-overlay')).toBeNull()
  })
})