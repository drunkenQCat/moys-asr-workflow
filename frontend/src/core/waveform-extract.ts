// 波形峰值提取 — 浏览器原生解码优先，ffmpeg.wasm 降级

import type { WaveformPayload } from '../types/project.js'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const PEAKS_PER_SECOND = 100

/**
 * 从 PCM 数据计算 min/max 峰值，编码为 i8-minmax-base64
 */
function computePeaks(
  pcmData: Int16Array,
  samplesPerPeak: number,
  peakCount: number,
): string {
  const peaks: number[] = []
  for (let i = 0; i < peakCount; i++) {
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, pcmData.length)
    let min = 0
    let max = 0
    for (let j = start; j < end; j++) {
      const sample = pcmData[j]
      if (sample < min) min = sample
      if (sample > max) max = sample
    }
    // Normalize to i8 [-127, 127]
    peaks.push(Math.round(Math.max(-127, Math.min(127, min / 256))))
    peaks.push(Math.round(Math.max(-127, Math.min(127, max / 256))))
  }

  // base64 encode
  const bytes = new Int8Array(peaks)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] + 128) // offset to 0-255 for btoa
  }
  return btoa(binary)
}

/**
 * 用 Browser AudioContext 解码音频并提取波形峰值
 */
async function extractWithAudioContext(
  file: File,
  peaksPerSecond: number,
): Promise<WaveformPayload | null> {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new AudioContext()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } catch {
    audioCtx.close()
    return null
  }
  audioCtx.close()

  const channelData = audioBuffer.getChannelData(0) // mono
  const sampleRate = audioBuffer.sampleRate
  const durationMs = Math.round((channelData.length / sampleRate) * 1000)
  const peakCount = Math.ceil(durationMs / 1000 * peaksPerSecond)
  const samplesPerPeak = Math.max(1, Math.floor(channelData.length / peakCount))

  // Convert Float32 [-1, 1] to Int16
  const pcm16 = new Int16Array(channelData.length)
  for (let i = 0; i < channelData.length; i++) {
    pcm16[i] = Math.round(channelData[i] * 32767)
  }

  const data = computePeaks(pcm16, samplesPerPeak, peakCount)

  return {
    schema: 'moy.asr.waveform.v1',
    encoding: 'i8-minmax-base64',
    peaks_per_second: peaksPerSecond,
    peak_count: peakCount,
    duration_ms: durationMs,
    data,
    source: {
      name: file.name,
      size: file.size,
      modified_ms: file.lastModified,
    },
  }
}

/**
 * 用 ffmpeg.wasm 解码音频并提取波形峰值
 */
async function extractWithFfmpeg(
  file: File,
  peaksPerSecond: number,
): Promise<WaveformPayload> {
  const ffmpeg = new FFmpeg()
  const coreVersion = '0.12.10'
  const baseCDN = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseCDN}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseCDN}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  // 写入输入文件
  const inputName = `input_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const inputData = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile(inputName, inputData)

  // 提取 PCM
  const outputName = 'output.pcm'
  await ffmpeg.exec([
    '-i', inputName,
    '-ac', '1',
    '-ar', '8000',        // 8kHz 足够计算波形
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    outputName,
  ])

  const pcmData = await ffmpeg.readFile(outputName) as Uint8Array
  const pcm16 = new Int16Array(pcmData.buffer)
  const durationMs = Math.round((pcm16.length / 8000) * 1000)
  const peakCount = Math.ceil(durationMs / 1000 * peaksPerSecond)
  const samplesPerPeak = Math.max(1, Math.floor(pcm16.length / peakCount))
  const data = computePeaks(pcm16, samplesPerPeak, peakCount)

  ffmpeg.terminate()

  return {
    schema: 'moy.asr.waveform.v1',
    encoding: 'i8-minmax-base64',
    peaks_per_second: peaksPerSecond,
    peak_count: peakCount,
    duration_ms: durationMs,
    data,
    source: {
      name: file.name,
      size: file.size,
      modified_ms: file.lastModified,
    },
  }
}

/**
 * 从媒体文件提取波形数据
 *
 * 1. 优先用 AudioContext.decodeAudioData()（浏览器原生）
 * 2. 失败时降级到 ffmpeg.wasm（CDN 懒加载）
 */
export async function extractWaveform(
  file: File,
  peaksPerSecond = PEAKS_PER_SECOND,
): Promise<WaveformPayload> {
  // 尝试浏览器原生解码
  const nativeResult = await extractWithAudioContext(file, peaksPerSecond)
  if (nativeResult) return nativeResult

  // 降级到 ffmpeg.wasm
  return extractWithFfmpeg(file, peaksPerSecond)
}