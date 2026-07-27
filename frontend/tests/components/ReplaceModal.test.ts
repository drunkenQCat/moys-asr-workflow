// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project.js'
import { useUiStore, ModalName } from '../../src/stores/ui.js'
import ReplaceModal from '../../src/components/ReplaceModal.vue'

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

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const project = useProjectStore()
  const ui = useUiStore()
  project.loadProject(JSON.stringify({
    segments: [
      { start: 0, end: 1000, text: '猫喜欢鱼', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
      { start: 1500, end: 3000, text: '狗喜欢骨头', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
    ],
  }))
  return { project, ui }
}

describe('ReplaceModal.vue', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders when modal is open', () => {
    const { ui } = setup()
    ui.openModal(ModalName.Replace)
    mount(ReplaceModal, { attachTo: document.body })
    const modal = document.querySelector('.modal-content')
    expect(modal).not.toBeNull()
    expect(modal!.textContent).toContain('查找替换')
  })

  it('is hidden when modal is closed', () => {
    setup()
    mount(ReplaceModal, { attachTo: document.body })
    expect(document.querySelector('.modal-overlay')).toBeNull()
  })

  it('generates preview on input', async () => {
    const { ui } = setup()
    ui.openModal(ModalName.Replace)
    mount(ReplaceModal, { attachTo: document.body })
    const inputs = document.querySelectorAll<HTMLInputElement>('.modal-content input.input')
    expect(inputs.length).toBe(2)
    const findInput = inputs[0]
    const replaceInput = inputs[1]
    findInput.value = '喜欢'
    findInput.dispatchEvent(new Event('input'))
    replaceInput.value = '不讨厌'
    replaceInput.dispatchEvent(new Event('input'))
    await new Promise(r => setTimeout(r, 50))
    expect(document.querySelector('.preview-info')?.textContent).toContain('2')
  })

  it('replaces text on execute', async () => {
    const { ui, project } = setup()
    ui.openModal(ModalName.Replace)
    mount(ReplaceModal, { attachTo: document.body })
    const inputs = document.querySelectorAll<HTMLInputElement>('.modal-content input.input')
    const findInput = inputs[0]
    const replaceInput = inputs[1]
    findInput.value = '喜欢'
    findInput.dispatchEvent(new Event('input'))
    replaceInput.value = '不讨厌'
    replaceInput.dispatchEvent(new Event('input'))
    await new Promise(r => setTimeout(r, 50))
    const replaceBtn = document.querySelector('.btn-primary') as HTMLButtonElement
    replaceBtn?.click()
    await new Promise(r => setTimeout(r, 0))
    expect(project.segments[0].text).toBe('猫不讨厌鱼')
    expect(project.segments[1].text).toBe('狗不讨厌骨头')
  })

  it('closes on cancel', async () => {
    const { ui } = setup()
    ui.openModal(ModalName.Replace)
    mount(ReplaceModal, { attachTo: document.body })
    const buttons = document.querySelectorAll('.modal-content button')
    let cancelBtn: HTMLButtonElement | null = null
    buttons.forEach((b) => { if (b.textContent === '取消') cancelBtn = b as HTMLButtonElement })
    expect(cancelBtn).not.toBeNull()
    cancelBtn!.click()
    await new Promise(r => setTimeout(r, 0))
    expect(ui.isModalOpen(ModalName.Replace)).toBe(false)
  })
})