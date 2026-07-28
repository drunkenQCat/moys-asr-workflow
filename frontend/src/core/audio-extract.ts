// 音频提取 — 用 ffmpeg.wasm 从视频文件提取 WAV 音频
// 与 Python generate_subtitle_qwen_api.py 的 extract_audio 一致：
//   -vn -acodec pcm_s16le -ar 16000 -ac 1

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m4v']

export function isVideoFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return VIDEO_EXTS.includes(ext)
}

/**
 * 用 ffmpeg.wasm 从视频文件提取 WAV 音频。
 * 如果传入的已经是音频文件，直接返回原 File。
 */
export async function ensureAudioFile(
  file: File,
  onProgress?: (message: string) => void,
): Promise<File> {
  if (!isVideoFile(file.name)) return file

  onProgress?.('提取音频中...')

  const ffmpeg = new FFmpeg()
  const coreVersion = '0.12.10'
  const baseCDN = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseCDN}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseCDN}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  const inputName = `input_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const inputData = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile(inputName, inputData)

  const outputName = 'audio.wav'
  await ffmpeg.exec([
    '-i', inputName,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    outputName,
  ])

  const wavData = await ffmpeg.readFile(outputName) as Uint8Array
  ffmpeg.terminate()

  const wavFile = new File([wavData], 'audio.wav', { type: 'audio/wav' })
  onProgress?.(`音频提取完成 (${(wavData.length / 1024 / 1024).toFixed(1)} MB)`)
  return wavFile
}