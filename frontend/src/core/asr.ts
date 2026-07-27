// DashScope ASR API 调用 — 纯浏览器 fetch，框架无关

import { normalizeLanguage } from './language-map.js'
import { stripTrailingPunctuation } from './punctuation.js'

const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com'
const FILETRANS_MODEL = 'qwen3-asr-flash-filetrans'

export interface AsrConfig {
  apiKey: string
  language?: string
  model?: string
}

export interface AsrProgress {
  stage: 'uploading' | 'submitted' | 'processing' | 'done' | 'error'
  percent?: number
  message: string
}

export interface TranscriptionResult {
  segments: {
    start: number
    end: number
    text: string
    items: { text: string; start: number; end: number }[]
  }[]
  language: string
  durationMs: number
}

type ProgressCallback = (progress: AsrProgress) => void

/**
 * 获取 DashScope 临时 OSS 上传凭证
 */
async function getUploadPolicy(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<Record<string, string>> {
  const url = `${baseUrl}/api/v1/uploads?action=getPolicy&model=${encodeURIComponent(model)}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!resp.ok) {
    throw new Error(`获取上传凭证失败: HTTP ${resp.status} ${resp.statusText}`)
  }
  const body = await resp.json()
  if (body.code && body.code !== 200 && body.code !== '200') {
    throw new Error(`获取上传凭证失败: ${JSON.stringify(body)}`)
  }
  const data = body.data || body.output || body
  if (!data || typeof data !== 'object') {
    throw new Error(`上传凭证响应为空: ${JSON.stringify(body)}`)
  }
  return data as Record<string, string>
}

/**
 * 用 OSS Post Object 协议上传文件，返回 oss:// URL
 */
async function uploadToOss(
  policy: Record<string, string>,
  file: File,
  onProgress?: ProgressCallback,
): Promise<string> {
  const uploadHost = policy.upload_host || policy.host
  if (!uploadHost) {
    throw new Error(
      `上传凭证缺少 upload_host 字段: ${JSON.stringify(policy)}`,
    )
  }

  const uploadDir = policy.upload_dir || policy.key_prefix || policy.object_prefix
  if (!uploadDir) {
    throw new Error(
      `上传凭证缺少 upload_dir 字段: ${JSON.stringify(policy)}`,
    )
  }

  const policyStr = policy.policy
  const signature = policy.signature
  const accessKeyId = policy.oss_access_key_id || policy.access_key_id
  if (!policyStr || !signature || !accessKeyId) {
    throw new Error(
      `上传凭证缺少 policy/signature/access_key_id: ${JSON.stringify(policy)}`,
    )
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const finalKey = `${uploadDir}/${safeName}`

  // 构建 FormData
  const form = new FormData()
  form.append('key', finalKey)
  form.append('OSSAccessKeyId', accessKeyId)
  form.append('policy', policyStr)
  form.append('signature', signature)
  form.append('success_action_status', '200')
  if (policy.x_oss_object_acl) form.append('x-oss-object-acl', policy.x_oss_object_acl)
  if (policy.x_oss_forbid_overwrite) form.append('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite)
  form.append('file', file)

  onProgress?.({ stage: 'uploading', message: '上传中...' })

  // 用 XMLHttpRequest 支持上传进度
  const result = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadHost, true)

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100)
        onProgress?.({ stage: 'uploading', percent: pct, message: `上传中 ${pct}%` })
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(`oss://${finalKey}`)
      } else {
        reject(new Error(`OSS 上传失败 (HTTP ${xhr.status}): ${xhr.responseText?.slice(0, 500)}`))
      }
    }

    xhr.onerror = () => reject(new Error('OSS 上传网络错误'))
    xhr.send(form)
  })

  return result
}

/**
 * 提交异步 ASR 任务，返回 task_id
 */
async function submitFiletrans(
  baseUrl: string,
  apiKey: string,
  fileUrl: string,
  language?: string,
  enableWords = true,
  enableItn = false,
): Promise<string> {
  const params: Record<string, unknown> = {
    channel_id: [0],
    enable_words: enableWords,
    enable_itn: enableItn,
  }
  if (language) params.language = language

  const resp = await fetch(
    `${baseUrl}/api/v1/services/audio/asr/transcription`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
        'X-DashScope-OssResourceResolve': 'enable',
      },
      body: JSON.stringify({
        model: FILETRANS_MODEL,
        input: {
          file_url: fileUrl,
        },
        parameters: params,
      }),
    },
  )

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`提交转写失败 (HTTP ${resp.status}): ${text.slice(0, 500)}`)
  }

  const body = await resp.json()
  const taskId = body.output?.task_id || body.data?.task_id
  if (!taskId) {
    throw new Error(`提交转写响应缺少 task_id: ${JSON.stringify(body)}`)
  }
  return taskId
}

/**
 * 轮询任务状态，返回 transcription_url
 */
async function pollTask(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  interval = 5000,
  timeout = 1800000,
  onProgress?: ProgressCallback,
): Promise<{ transcriptionUrl: string; usage: Record<string, unknown> }> {
  const url = `${baseUrl}/api/v1/tasks/${taskId}`
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!resp.ok) {
      throw new Error(`轮询任务失败 (HTTP ${resp.status})`)
    }

    const body = await resp.json()
    const output = body.output || {}

    if (output.task_status === 'SUCCEEDED') {
      onProgress?.({ stage: 'done', message: '转写完成' })
      return {
        transcriptionUrl: output.transcription_url || output.result,
        usage: output.task_metrics || {},
      }
    }

    if (output.task_status === 'FAILED') {
      throw new Error(`转写任务失败: ${output.message || JSON.stringify(output)}`)
    }

    onProgress?.({ stage: 'processing', message: output.task_status || '处理中...' })
    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error(`转写任务超时 (${timeout / 1000}s)`)
}

/**
 * 下载识别结果
 */
async function downloadTranscription(transcriptionUrl: string): Promise<Record<string, unknown>> {
  const resp = await fetch(transcriptionUrl)
  if (!resp.ok) {
    throw new Error(`下载识别结果失败 (HTTP ${resp.status})`)
  }
  return resp.json()
}

/**
 * 解析 filetrans JSON 转为一个统一格式
 */
function parseTranscriptionResult(result: Record<string, unknown>): {
  text: string
  language: string
  items: { text: string; start: number; end: number }[]
} {
  const transcripts = (result.transcripts as any[]) || []
  if (!transcripts.length) {
    return { text: '', language: '', items: [] }
  }

  const t = transcripts[0]
  const allItems: { text: string; start: number; end: number }[] = []
  let detectedLanguage = ''

  for (const sent of (t.sentences || []) as any[]) {
    if (!detectedLanguage && sent.language) {
      detectedLanguage = sent.language
    }

    const words = sent.words || []
    if (!words.length) {
      allItems.push({
        text: sent.text || '',
        start: sent.begin_time || 0,
        end: sent.end_time || 0,
      })
      continue
    }

    for (const w of words) {
      const text = w.text || ''
      const punct = w.punctuation || ''
      allItems.push({
        text: text + punct,
        start: w.begin_time || 0,
        end: w.end_time || 0,
      })
    }
  }

  return {
    text: t.text || '',
    language: detectedLanguage,
    items: allItems,
  }
}

/**
 * 完整转写流程：上传 → 提交 → 轮询 → 解析
 */
export async function transcribe(
  file: File,
  config: AsrConfig,
  onProgress?: ProgressCallback,
): Promise<TranscriptionResult> {
  const { apiKey, model = FILETRANS_MODEL } = config
  const language = normalizeLanguage(config.language)
  if (!apiKey) {
    throw new Error('未配置 API Key')
  }

  const baseUrl = DASHSCOPE_BASE_URL

  // Step 1: 获取上传凭证
  onProgress?.({ stage: 'uploading', message: '获取上传凭证...' })
  const policy = await getUploadPolicy(baseUrl, apiKey, model)

  // Step 2: 上传到 OSS
  const fileUrl = await uploadToOss(policy, file, onProgress)

  // Step 3: 提交转写任务
  onProgress?.({ stage: 'submitted', message: '提交转写任务...' })
  const taskId = await submitFiletrans(baseUrl, apiKey, fileUrl, language)

  // Step 4: 轮询结果
  onProgress?.({ stage: 'processing', message: '等待转写结果...' })
  const { transcriptionUrl } = await pollTask(baseUrl, apiKey, taskId, 5000, 1800000, onProgress)

  // Step 5: 下载并解析
  onProgress?.({ stage: 'done', message: '下载结果...' })
  const raw = await downloadTranscription(transcriptionUrl)
  const parsed = parseTranscriptionResult(raw)

  // 组装 segments 并剥离句末标点
  const segments = parsed.items.length > 0
    ? stripTrailingPunctuation([{
        start: parsed.items[0].start,
        end: parsed.items[parsed.items.length - 1].end,
        text: parsed.text,
        items: parsed.items,
        sticker: null,
        sticker_ref: null,
        color: null,
        color_ref: null,
      }])
    : []

  return {
    segments,
    language: parsed.language || language || 'zh',
    durationMs: segments.length > 0 ? segments[0].end - segments[0].start : 0,
  }
}