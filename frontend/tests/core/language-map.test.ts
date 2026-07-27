// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeLanguage } from '../../src/core/language-map.js'

describe('normalizeLanguage', () => {
  it('maps Chinese variants to zh', () => {
    expect(normalizeLanguage('Chinese')).toBe('zh')
    expect(normalizeLanguage('chinese')).toBe('zh')
    expect(normalizeLanguage('中文')).toBe('zh')
    expect(normalizeLanguage('普通话')).toBe('zh')
    expect(normalizeLanguage('zhongwen')).toBe('zh')
  })

  it('maps Cantonese variants to yue', () => {
    expect(normalizeLanguage('cantonese')).toBe('yue')
    expect(normalizeLanguage('粤语')).toBe('yue')
    expect(normalizeLanguage('广东话')).toBe('yue')
  })

  it('maps English, Japanese, Korean', () => {
    expect(normalizeLanguage('english')).toBe('en')
    expect(normalizeLanguage('japanese')).toBe('ja')
    expect(normalizeLanguage('日语')).toBe('ja')
    expect(normalizeLanguage('korean')).toBe('ko')
    expect(normalizeLanguage('韩语')).toBe('ko')
  })

  it('returns code as-is when already a language code', () => {
    expect(normalizeLanguage('zh')).toBe('zh')
    expect(normalizeLanguage('en')).toBe('en')
    expect(normalizeLanguage('ja')).toBe('ja')
    expect(normalizeLanguage('ko')).toBe('ko')
  })

  it('returns undefined for undefined input', () => {
    expect(normalizeLanguage(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(normalizeLanguage('')).toBeUndefined()
  })

  it('returns unknown input as-is', () => {
    expect(normalizeLanguage('vietnamese')).toBe('vietnamese')
  })
})