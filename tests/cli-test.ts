// CLI 集成测试：从视频文件到 JSON 的完整流程
// 用法: npx tsx tests/cli-test.ts
//
// 验证前端 TS 代码的逻辑是否通：
// 1. ffmpeg 提取音频（模拟 Python 的 extract_audio）
// 2. DashScope 上传 + 提交 + 轮询（用 fetch 替代 XMLHttpRequest）
// 3. parseTranscriptionResult（直接 import asr.ts）
// 4. splitWordsToSegments（直接 import segment-split.ts）
// 5. stripTrailingPunctuation（直接 import punctuation.ts）
// 6. 输出 JSON

import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// 前端 TS 模块（直接 import 测试逻辑是否通）
import { splitWordsToSegments } from '../frontend/src/core/segment-split.ts'
import { stripTrailingPunctuation } from '../frontend/src/core/punctuation.ts'
import { normalizeLanguage } from '../frontend/src/core/language-map.ts'
import { segmentsToSrt } from '../frontend/src/core/srt.ts'

const API_KEY = process.env.DASHSCOPE_API_KEY!
const TEST_MKV = join(import.meta.dirname, 'test.mkv')
const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m4v']

function extractAudio(videoPath: string, outputPath: string): void {
  const cmd = [
    'ffmpeg', '-i', videoPath,
    '-vn', '-acodec', 'pcm_s16le',
    '-ar', '16000', '-ac', '1',
    '-y', outputPath,
  ]
  console.log(`[ffmpeg] 提取音频: ${videoPath}`)
  const result = spawnSync('ffmpeg', cmd.slice(1), { stdio: 'pipe' })
  if (result.status !== 0) {
    throw new Error(`ffmpeg 失败: ${result.stderr?.toString().slice(0, 500)}`)
  }
}

async function main() {
  if (!existsSync(TEST_MKV)) {
    console.error(`测试文件不存在: ${TEST_MKV}`)
    process.exit(1)
  }

  // Step 1: 检查文件类型，提取音频
  const ext = TEST_MKV.slice(TEST_MKV.lastIndexOf('.')).toLowerCase()
  const isVideo = VIDEO_EXTS.includes(ext)
  console.log(`[info] 文件: ${TEST_MKV}`)
  console.log(`[info] 类型: ${isVideo ? '视频' : '音频'} (${ext})`)

  const audioPath = join(import.meta.dirname, 'test-audio.wav')
  if (isVideo) {
    console.log('[info] 提取音频中...')
    extractAudio(TEST_MKV, audioPath)
    console.log(`[info] 音频提取完成: ${audioPath}`)
  }

  // Step 2: 读取音频文件
  const audioBuffer = readFileSync(audioPath)
  const audioFile = new File([audioBuffer], 'test.wav', { type: 'audio/wav' })
  console.log(`[info] 音频大小: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  // Step 3: 获取上传凭证
  const model = 'qwen3-asr-flash-filetrans'
  const uploadBaseUrl = 'https://dashscope.aliyuncs.com'
  console.log('[upload] 获取上传凭证...')
  const policyResp = await fetch(
    `${uploadBaseUrl}/api/v1/uploads?action=getPolicy&model=${encodeURIComponent(model)}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } },
  )
  if (!policyResp.ok) {
    const text = await policyResp.text()
    console.error(`[upload] 获取凭证失败: HTTP ${policyResp.status}`)
    console.error(text.slice(0, 500))
    process.exit(1)
  }
  const policyBody = await policyResp.json()
  const policy = policyBody.data || policyBody.output || policyBody
  console.log('[upload] 凭证获取成功')
  console.log('[upload] policy 字段:', Object.keys(policy))
  console.log('[upload] upload_host:', policy.upload_host)
  console.log('[upload] upload_dir:', policy.upload_dir)
  if (policy.x_oss_object_acl) console.log('[upload] x_oss_object_acl:', policy.x_oss_object_acl)

  // Step 4: 上传到 OSS
  const safeName = 'test.wav'
  const finalKey = `${policy.upload_dir}/${safeName}`
  const formData = new FormData()
  formData.append('key', finalKey)
  formData.append('OSSAccessKeyId', policy.oss_access_key_id)
  formData.append('policy', policy.policy)
  formData.append('signature', policy.signature)
  formData.append('success_action_status', '200')
  // policy 条件要求这些字段
  if (policy.x_oss_object_acl) formData.append('x-oss-object-acl', policy.x_oss_object_acl)
  if (policy.x_oss_forbid_overwrite) formData.append('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite)
  formData.append('file', audioFile)

  console.log('[upload] 上传到 OSS...')
  const ossResp = await fetch(policy.upload_host, {
    method: 'POST',
    body: formData,
  })
  if (!ossResp.ok) {
    const text = await ossResp.text()
    console.error(`[upload] OSS 上传失败: HTTP ${ossResp.status}`)
    console.error(text.slice(0, 500))
    process.exit(1)
  }
  const fileUrl = `oss://${finalKey}`
  console.log(`[upload] 上传完成: ${fileUrl}`)

  // Step 5: 提交转写任务
  // 百炼 workspace ID 从环境变量获取（如果有）
  const workspaceId = process.env.DASHSCOPE_WORKSPACE_ID || ''
  const apiBaseUrl = workspaceId
    ? `https://${workspaceId}.cn-beijing.maas.aliyuncs.com`
    : 'https://dashscope.aliyuncs.com'
  const language = normalizeLanguage('zh')

  console.log(`[filetrans] 提交任务 (baseUrl=${apiBaseUrl}, language=${language})...`)
  const submitResp = await fetch(
    `${apiBaseUrl}/api/v1/services/audio/asr/transcription`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
        'X-DashScope-OssResourceResolve': 'enable',
      },
      body: JSON.stringify({
        model,
        input: { file_url: fileUrl },
        parameters: {
          channel_id: [0],
          enable_words: true,
          enable_itn: false,
          ...(language ? { language } : {}),
        },
      }),
    },
  )
  if (!submitResp.ok) {
    const text = await submitResp.text()
    console.error(`[filetrans] 提交失败: HTTP ${submitResp.status}`)
    console.error(text.slice(0, 500))
    process.exit(1)
  }
  const submitBody = await submitResp.json()
  const taskId = submitBody.output?.task_id
  if (!taskId) {
    console.error('[filetrans] 响应缺少 task_id')
    console.error(JSON.stringify(submitBody, null, 2))
    process.exit(1)
  }
  console.log(`[filetrans] 任务已提交: task_id=${taskId}`)

  // Step 6: 轮询
  console.log('[filetrans] 轮询中...')
  let transcriptionUrl: string | null = null
  const deadline = Date.now() + 1800000 // 30 min
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000))
    const pollResp = await fetch(
      `${apiBaseUrl}/api/v1/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    )
    if (!pollResp.ok) {
      console.error(`[filetrans] 轮询失败: HTTP ${pollResp.status}`)
      continue
    }
    const pollBody = await pollResp.json()
    const status = pollBody.output?.task_status
    console.log(`[filetrans] 状态: ${status}`)

    if (status === 'SUCCEEDED') {
      const output = pollBody.output
      transcriptionUrl = output?.transcription_url || output?.result?.transcription_url || output?.result
      if (typeof transcriptionUrl === 'string') {
        console.log(`[filetrans] 结果 URL: ${transcriptionUrl.slice(0, 80)}...`)
      } else {
        console.log('[filetrans] 响应:', JSON.stringify(output, null, 2).slice(0, 500))
      }
      break
    }
    if (status === 'FAILED') {
      console.error(`[filetrans] 任务失败: ${pollBody.output.message}`)
      process.exit(1)
    }
  }

  if (!transcriptionUrl) {
    console.error('[filetrans] 超时')
    process.exit(1)
  }

  // Step 7: 下载结果
  console.log('[filetrans] 下载结果...')
  const resultResp = await fetch(transcriptionUrl)
  const raw = await resultResp.json()

  // Step 8: 解析（与 asr.ts 的 parseTranscriptionResult 一致）
  const transcripts = raw.transcripts || []
  if (!transcripts.length) {
    console.error('[parse] 无转写结果')
    process.exit(1)
  }
  const t = transcripts[0]
  const items: { text: string; start: number; end: number }[] = []
  let detectedLanguage = ''
  for (const sent of (t.sentences || [])) {
    if (!detectedLanguage && sent.language) detectedLanguage = sent.language
    const words = sent.words || []
    if (!words.length) {
      items.push({ text: sent.text || '', start: sent.begin_time || 0, end: sent.end_time || 0 })
      continue
    }
    for (const w of words) {
      items.push({ text: (w.text || '') + (w.punctuation || ''), start: w.begin_time || 0, end: w.end_time || 0 })
    }
  }
  console.log(`[parse] 检测语言: ${detectedLanguage}`)
  console.log(`[parse] items 数量: ${items.length}`)
  console.log(`[parse] 原始文本: ${t.text?.slice(0, 100)}...`)

  // Step 9: 断句（与 Python split_words_to_segments 一致）
  console.log('[split] 断句中...')
  const segments = splitWordsToSegments(items, 15, 5, 0)
  console.log(`[split] 断句完成: ${segments.length} 条`)

  // Step 10: 剥离标点
  const stripped = stripTrailingPunctuation(segments)
  console.log(`[punct] 标点剥离完成`)

  // Step 11: 输出 JSON + SRT
  const json = JSON.stringify({
    segments: stripped,
    language: detectedLanguage || language || 'zh',
    media: 'test.mkv',
    model,
  }, null, 2)
  writeFileSync(join(import.meta.dirname, 'test-output.json'), json, 'utf-8')
  console.log(`[output] JSON 已保存: tests/test-output.json`)

  const srt = segmentsToSrt(stripped, { offsetToZero: true })
  writeFileSync(join(import.meta.dirname, 'test-output.srt'), srt, 'utf-8')
  console.log(`[output] SRT 已保存: tests/test-output.srt`)

  // 打印前 3 条
  console.log('\n--- 前 3 条字幕 ---')
  stripped.slice(0, 3).forEach((seg, i) => {
    console.log(`${i + 1}. [${seg.start}-${seg.end}] ${seg.text}`)
  })
  console.log('--- 完成 ---')
}

main().catch(err => {
  console.error('错误:', err)
  process.exit(1)
})