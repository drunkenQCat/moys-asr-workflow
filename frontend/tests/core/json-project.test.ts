// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  validateProject,
  serializeProject,
  deserializeProject,
  createEmptyProject,
  hasUnsavedChanges,
} from '../../src/core/json-project.js'

const validProject = {
  segments: [
    {
      start: 0,
      end: 2150,
      text: '大家好',
      items: [
        { text: '大', start: 0, end: 620 },
        { text: '家', start: 620, end: 1280 },
        { text: '好', start: 1280, end: 2150 },
      ],
      sticker: null,
      sticker_ref: null,
      color: null,
      color_ref: null,
    },
  ],
  media: 'D:/path/to/video.mp4',
  language: 'Chinese',
}

describe('validateProject', () => {
  it('validates a correct project', () => {
    expect(validateProject(validProject)).toBe(true)
  })

  it('rejects null', () => {
    expect(validateProject(null)).toBe(false)
  })

  it('rejects missing segments', () => {
    expect(validateProject({})).toBe(false)
  })

  it('rejects segments with invalid types', () => {
    expect(validateProject({ segments: 'not-array' })).toBe(false)
  })

  it('rejects segment with missing start', () => {
    expect(validateProject({ segments: [{ end: 1000, text: 'hello' }] })).toBe(false)
  })
})

describe('serializeProject', () => {
  it('produces valid JSON string', () => {
    const json = serializeProject(validProject)
    const parsed = JSON.parse(json)
    expect(parsed.segments[0].text).toBe('大家好')
  })
})

describe('deserializeProject', () => {
  it('deserializes valid JSON', () => {
    const json = JSON.stringify(validProject)
    const result = deserializeProject(json)
    expect(result).not.toBeNull()
    expect(result!.segments.length).toBe(1)
    expect(result!.segments[0].text).toBe('大家好')
  })

  it('returns null for invalid JSON', () => {
    expect(deserializeProject('not json')).toBeNull()
  })

  it('returns null for missing segments', () => {
    expect(deserializeProject('{}')).toBeNull()
  })
})

describe('createEmptyProject', () => {
  it('creates empty project with no segments', () => {
    const project = createEmptyProject()
    expect(project.segments).toEqual([])
  })
})

describe('hasUnsavedChanges', () => {
  it('returns false for clean project', () => {
    expect(hasUnsavedChanges(validProject)).toBe(false)
  })

  it('returns true when segments have _dirty', () => {
    const dirty = {
      segments: [
        { ...validProject.segments[0], _dirty: true },
      ],
    }
    expect(hasUnsavedChanges(dirty as any)).toBe(true)
  })
})