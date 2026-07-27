<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useUiStore } from '../stores/ui.js'
import { serializeProject } from '../core/json-project.js'
import { segmentsToSrt, buildGapRemovedSrt } from '../core/srt.js'
import { buildFfconcat, buildGapRemovedIntervals } from '../core/editor-utils.js'

const project = useProjectStore()
const ui = useUiStore()

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
</script>

<template>
  <div class="toolbar-actions">
    <button @click="openProject" title="打开工程">📂 打开</button>
    <button @click="saveProject" :disabled="!project.segments.length" title="保存工程">💾 保存</button>
    <button @click="exportSrt" :disabled="!project.segments.length" title="导出 SRT">📄 SRT</button>
    <button @click="exportGapRemovedSrt" :disabled="!canExportGapRemoved" title="导出 去空隙 SRT">📄 去空隙</button>
    <button @click="exportFfconcat" :disabled="!canExportGapRemoved" title="导出 FFconcat">🎞️ FFconcat</button>
    <button @click="exportGapRemovedIntervals" :disabled="!canExportGapRemoved" title="导出保留区域 JSON">📋 保留区域</button>
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
</style>