import { computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useUiStore } from '../stores/ui.js'
import { serializeProject } from '../core/json-project.js'
import { segmentsToSrt, buildGapRemovedSrt } from '../core/srt.js'
import { buildFfconcat, buildGapRemovedIntervals } from '../core/editor-utils.js'
import { buildStickerOtio, buildGapRemovedOtio, buildGapRemovedStickerOtio } from '../core/otio.js'
import { buildResolveJson } from '../core/resolve-json.js'

export function useExportActions() {
  const project = useProjectStore()
  const ui = useUiStore()

  const canExportGapRemoved = computed(() =>
    project.gapRemove && project.gapRemove.gaps.some(g => g.removed),
  )

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

  return {
    canExportGapRemoved,
    saveProject,
    exportSrt,
    exportGapRemovedSrt,
    exportFfconcat,
    exportGapRemovedIntervals,
    exportOtio,
    exportGapRemovedOtio,
    exportResolveJson,
  }
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
