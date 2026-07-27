// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { transcribe } from '../../src/core/asr.js'

// fixtured API responses
const fixtures = {
  uploadPolicy: {
    data: {
      upload_host: 'https://dashscope-file-mgr.oss-cn-beijing.aliyuncs.com',
      upload_dir: 'dashscope-instant/user/20260727/uuid',
      policy: 'base64policy',
      signature: 'signature',
      oss_access_key_id: 'test-key-id',
    },
  },
  submit: {
    output: { task_id: 'task-12345' },
  },
  pollPending: {
    output: { task_status: 'PENDING' },
  },
  pollDone: {
    output: {
      task_status: 'SUCCEEDED',
      transcription_url: 'https://example.com/result.json',
    },
  },
  transcription: {
    transcripts: [
      {
        text: '你好世界今天天气真好',
        sentences: [
          {
            text: '你好世界今天天气真好',
            begin_time: 0,
            end_time: 4000,
            words: [
              { text: '你好', begin_time: 0, end_time: 1000 },
              { text: '世界', begin_time: 1000, end_time: 2000 },
              { text: '今天', begin_time: 2000, end_time: 3000, punctuation: '，' },
              { text: '天气', begin_time: 3000, end_time: 3500 },
              { text: '真好', begin_time: 3500, end_time: 4000 },
            ],
          },
        ],
      },
    ],
  },
}

describe('transcribe', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('completes full flow with mocked API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.uploadPolicy } as any)
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.submit } as any)
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.pollDone } as any)
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.transcription } as any)

    // Mock XHR for OSS upload
    const xhrMock = vi.fn()
    xhrMock.mockImplementation(() => {
      const xhr = {
        open: vi.fn(),
        send: vi.fn(function (this: any) { setTimeout(() => this.onload?.(), 0) }),
        status: 200,
        responseText: '',
        upload: { onprogress: null },
        onload: null,
        onerror: null,
      }
      return xhr
    })
    vi.stubGlobal('XMLHttpRequest', xhrMock)

    const progress: string[] = []
    const result = await transcribe(
      new File(['fake'], 'test.wav', { type: 'audio/wav' }),
      { apiKey: 'sk-test-key' },
      (p) => { progress.push(p.stage) },
    )

    expect(result.segments.length).toBe(1)
    expect(result.segments[0].text).toBe('你好世界今天天气真好')
    expect(result.language).toBe('zh')
    // Should have gone through all stages
    expect(progress).toContain('uploading')
    expect(progress).toContain('submitted')
    expect(progress).toContain('processing')
    expect(progress).toContain('done')
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('throws on missing API key', async () => {
    await expect(transcribe(
      new File(['fake'], 'test.wav'),
      { apiKey: '' },
    )).rejects.toThrow('未配置 API Key')
  })

  it('handles upload failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' } as any)

    await expect(transcribe(
      new File(['fake'], 'test.wav'),
      { apiKey: 'sk-invalid' },
    )).rejects.toThrow('获取上传凭证失败')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('handles transcription failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.uploadPolicy } as any)
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.submit } as any)
      .mockResolvedValueOnce({ ok: true, json: () => ({ output: { task_status: 'FAILED', message: '模型错误' } }) } as any)

    // Mock XHR
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => ({
      open: vi.fn(),
      send: vi.fn(function (this: any) { setTimeout(() => this.onload?.(), 0) }),
      status: 200,
      responseText: '',
      upload: { onprogress: null },
      onload: null,
      onerror: null,
    })))

    await expect(transcribe(
      new File(['fake'], 'test.wav'),
      { apiKey: 'sk-test' },
    )).rejects.toThrow('转写任务失败')
  })

  it('sends file_url (singular) in request body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.uploadPolicy } as any)
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.submit } as any)
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.pollDone } as any)
      .mockResolvedValueOnce({ ok: true, json: () => fixtures.transcription } as any)

    vi.stubGlobal('XMLHttpRequest', vi.fn(() => ({
      open: vi.fn(),
      send: vi.fn(function (this: any) { setTimeout(() => this.onload?.(), 0) }),
      status: 200,
      responseText: '',
      upload: { onprogress: null },
      onload: null,
      onerror: null,
    })))

    await transcribe(new File(['fake'], 'test.wav'), { apiKey: 'sk-test' })

    // Second fetch call is submitFiletrans — verify request body
    const submitCall = fetchSpy.mock.calls[1]
    expect(submitCall).toBeDefined()
    expect(submitCall[1]).toBeDefined()
    const requestBody = JSON.parse((submitCall[1] as any).body as string)
    expect(requestBody.input).toHaveProperty('file_url')
    expect(requestBody.input).not.toHaveProperty('file_urls')
    expect(requestBody.input.file_url).toBe('oss://dashscope-instant/user/20260727/uuid/test.wav')
  })
})