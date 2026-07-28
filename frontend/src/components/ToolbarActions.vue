<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useUiStore, ModalName } from '../stores/ui.js'
import { serializeProject } from '../core/json-project.js'
import { segmentsToSrt, buildGapRemovedSrt } from '../core/srt.js'
import { buildFfconcat, buildGapRemovedIntervals } from '../core/editor-utils.js'
import { transcribe } from '../core/asr.js'
import { loadAsrConfig } from '../core/asr-config.js'
import { extractWaveform } from '../core/waveform-extract.js'
import { useWaveformStore } from '../stores/waveform.js'
import { buildStickerOtio, buildGapRemovedOtio, buildGapRemovedStickerOtio } from '../core/otio.js'
import { buildResolveJson } from '../core/resolve-json.js'

const emit = defineEmits<{
  'open-settings': []
  'open-editor-settings': []
  'open-gap-remove': []
}>()

const project = useProjectStore()
const ui = useUiStore()
const waveform = useWaveformStore()

const transcribing = ref(false)
const transcribeProgress = ref('')

const canExportGapRemoved = computed(() =>
  project.gapRemove && project.gapRemove.gaps.some(g => g.removed)
)

function openProject() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    if (project.loadProject(text)) {
      project.projectName = file.name.replace(/\.json$/i, '')
      ui.addRecentProject(project.projectName, text)
      ui.flash('工程已加载')
    } else {
      ui.flash('无效的工程文件', 5000)
    }
  }
  input.click()
}

function saveProject() {
  const json = serializeProject(project.getExportData())
  downloadBlob(json, `${project.projectName || 'project'}.json`, 'application/json')
  ui.flash('工程已保存')
}

function exportSrt() {
  const srt = segmentsToSrt(project.segments, { offsetToZero: true })
  downloadBlob(srt, `${project.projectName || 'subtitles'}.srt`, 'text/plain')
  ui.flash('SRT 已导出')
}

function exportGapRemovedSrt() {
  if (!project.gapRemove) return
  const srt = buildGapRemovedSrt(project.segments, project.gapRemove.gaps, { offsetToZero: true })
  downloadBlob(srt, `${project.projectName || 'subtitles'}.gap-removed.srt`, 'text/plain')
  ui.flash('去空隙 SRT 已导出')
}

function exportFfconcat() {
  if (!project.gapRemove) return
  const intervals = buildGapRemovedIntervals(project.mediaDurationMs, project.gapRemove.gaps)
  const fc = buildFfconcat(project.mediaName, intervals)
  downloadBlob(fc, `${project.projectName || 'subtitles'}.ffconcat`, 'text/plain')
  ui.flash('FFconcat 已导出')
}

function exportGapRemovedIntervals() {
  if (!project.gapRemove) return
  const intervals = buildGapRemovedIntervals(project.mediaDurationMs, project.gapRemove.gaps)
  const json = JSON.stringify(intervals, null, 2)
  downloadBlob(json, `${project.projectName || 'subtitles'}.intervals.json`, 'application/json')
  ui.flash('保留区域 JSON 已导出')
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportOtio() {
  const name = project.projectName || 'project'
  const dur = project.mediaDurationMs || 60000
  const mediaUrl = project.mediaName || ''
  const otio = buildStickerOtio(project.segments, mediaUrl, dur, '')
  downloadBlob(otio, `${name}.otio`, 'application/json')
  ui.flash('OTIO 已导出')
}

function exportGapRemovedOtio() {
  if (!project.gapRemove) return
  const name = project.projectName || 'project'
  const dur = project.mediaDurationMs || 60000
  const mediaUrl = project.mediaName || ''
  const otio = buildGapRemovedOtio(project.segments, project.gapRemove.gaps, mediaUrl, dur)
  downloadBlob(otio, `${name}.gap-removed.otio`, 'application/json')
  ui.flash('去空隙 OTIO 已导出')
}

function exportResolveJson() {
  const name = project.projectName || 'project'
  const json = buildResolveJson(project.segments, project.mediaName || '')
  downloadBlob(json, `${name}.resolve.json`, 'application/json')
  ui.flash('Resolve JSON 已导出')
}

async function startTranscribe() {
  const config = loadAsrConfig()
  if (!config.apiKey) {
    emit('open-settings')
    return
  }

  // 优先使用已加载的媒体文件，避免重复弹文件选择框
  let file = project.mediaFile
  if (!file) {
    const picked = await pickFile('.mp3,.wav,.mp4,.mkv,.avi,.mov,.flac,.ogg,.m4a,.webm')
    if (!picked) return
    file = picked
  }

  transcribing.value = true
  transcribeProgress.value = '准备中...'
  try {
    const result = await transcribe(file, config, (p) => {
      transcribeProgress.value = p.message
    })
    project.projectName = file.name.replace(/\.[^.]+$/, '')
    project.loadProject(JSON.stringify({
      segments: result.segments,
      language: result.language,
      media: file.name,
    }))
    if (!project.mediaFile) {
      project.loadMedia(file)
    }
    if (!waveform.payload) {
      try {
        const wfPayload = await extractWaveform(file)
        waveform.setPayload(wfPayload)
      } catch {
        // 波形提取失败不阻塞流程
      }
    }
    ui.flash(`转写完成: ${result.segments.length} 条字幕`)
    project.saveToStorage()
  } catch (err: unknown) {
    ui.flash(`转写失败: ${err instanceof Error ? err.message : String(err)}`, 5000)
  } finally {
    transcribing.value = false
    transcribeProgress.value = ''
  }
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] || null)
    input.click()
  })
}

function openReplace() {
  ui.openModal(ModalName.Replace)
}
</script>

<template>
  <div class="toolbar-actions">
    <button @click="openProject" title="打开工程">📂 打开</button>
    <button @click="saveProject" :disabled="!project.segments.length" title="保存工程">💾 保存</button>
    <button @click="exportSrt" :disabled="!project.segments.length" title="导出 SRT">📄 SRT</button>
    <button @click="exportGapRemovedSrt" :disabled="!canExportGapRemoved" title="去空隙 SRT">📄 去空隙</button>
    <button @click="exportOtio" :disabled="!project.segments.length" title="导出 OTIO">🎬 OTIO</button>
    <button @click="exportGapRemovedOtio" :disabled="!canExportGapRemoved" title="去空隙 OTIO">🎬 去空隙</button>
    <button @click="exportResolveJson" :disabled="!project.segments.length" title="导出 Resolve JSON">🎞️ Resolve</button>
    <button @click="exportFfconcat" :disabled="!canExportGapRemoved" title="FFconcat">🎞️ FFconcat</button>
    <button @click="exportGapRemovedIntervals" :disabled="!canExportGapRemoved" title="保留区域 JSON">📋 保留区域</button>
    <span class="spacer"></span>
    <button @click="emit('open-gap-remove')" title="空隙移除">✂️</button>
    <button @click="emit('open-editor-settings')" title="编辑器设置">⚙️</button>
    <button @click="openReplace" :disabled="!project.segments.length" title="查找替换">🔍</button>
    <button @click="startTranscribe" :disabled="transcribing" :title="transcribing ? transcribeProgress : 'ASR 转写'">
      {{ transcribing ? '⏳' : '🎙️' }}
    </button>
    <button @click="emit('open-settings')" title="ASR 设置">🔑</button>
  </div>
</template>

<style scoped>
.toolbar-actions {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  background: #1e1e32;
  border-bottom: 1px solid #333;
}
button {
  padding: 4px 10px;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
}
button:hover { background: #3a3a5e; }
button:disabled { opacity: 0.4; cursor: default; }
.spacer { flex: 1; }
.btn-settings { font-size: 14px; padding: 4px 8px; }
</style>