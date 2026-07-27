// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CueItem from '../../src/components/CueItem.vue'
import type { Segment } from '../../src/types/project.js'

const baseSegment: Segment = {
  start: 1000,
  end: 5000,
  text: '你好世界',
  items: [{ text: '你好', start: 1000, end: 2500 }, { text: '世界', start: 2500, end: 5000 }],
  sticker: null,
  sticker_ref: null,
  color: null,
  color_ref: null,
}

function createWrapper(overrides: Record<string, unknown> = {}) {
  return mount(CueItem, {
    props: {
      segment: baseSegment,
      index: 0,
      isActive: false,
      isSelected: false,
      isEditing: false,
      showIndex: true,
      showTime: true,
      showSticker: false,
      showCharcount: true,
      charcountThreshold: 15,
      searchQuery: '',
      ...overrides,
    },
    attachTo: document.body,
  })
}

describe('CueItem.vue', () => {
  it('renders index and text', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('你好世界')
  })

  it('renders timecode', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('00:00:01.000')
    expect(wrapper.text()).toContain('00:00:05.000')
  })

  it('shows charcount without over class when within threshold', () => {
    const wrapper = createWrapper()
    const charcount = wrapper.find('.cue-charcount')
    expect(charcount.exists()).toBe(true)
    expect(charcount.text()).toBe('4')
    expect(charcount.classes()).not.toContain('over')
  })

  it('applies disabled class', () => {
    const wrapper = createWrapper({ segment: { ...baseSegment, disabled: true } })
    expect(wrapper.classes()).toContain('disabled')
  })

  it('applies active class', () => {
    const wrapper = createWrapper({ isActive: true })
    expect(wrapper.classes()).toContain('active')
  })

  it('applies selected class', () => {
    const wrapper = createWrapper({ isSelected: true })
    expect(wrapper.classes()).toContain('selected')
  })

  it('emits click on click', async () => {
    const wrapper = createWrapper()
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')![0]).toEqual([0, expect.any(MouseEvent)])
  })

  it('emits contextmenu on right click', async () => {
    const wrapper = createWrapper()
    await wrapper.trigger('contextmenu')
    expect(wrapper.emitted('contextmenu')).toBeTruthy()
  })

  it('shows textarea when editing', () => {
    const wrapper = createWrapper({ isEditing: true })
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('emits edit-cancel on Escape', async () => {
    const wrapper = createWrapper({ isEditing: true })
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('edit-cancel')).toBeTruthy()
  })

  it('hides index when showIndex is false', () => {
    const wrapper = createWrapper({ showIndex: false })
    expect(wrapper.find('.cue-index').exists()).toBe(false)
  })

  it('hides time when showTime is false', () => {
    const wrapper = createWrapper({ showTime: false })
    expect(wrapper.find('.cue-time').exists()).toBe(false)
  })

  it('highlights search matches', () => {
    const wrapper = createWrapper({ searchQuery: '世界' })
    expect(wrapper.html()).toContain('<mark>')
  })

  it('escapes HTML in search match', () => {
    const wrapper = createWrapper({ segment: { ...baseSegment, text: '<script>alert("xss")</script>' }, searchQuery: 'script' })
    expect(wrapper.html()).not.toContain('<script>')
    expect(wrapper.html()).toContain('&lt;')
  })
})