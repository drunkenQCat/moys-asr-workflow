import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useWaveformStore } from '../stores/waveform.js'
import {
  detectAudioGapRemoveGaps,
  applyGapRemoveRange,
  getRemovedGapRanges,
  buildGapRemovedIntervals,
} from '../core/editor-utils.js'
import type { GapRemoveGap } from '../types/project.js'

export interface GapRemoveScanParams {
  minimumMs: number
  thresholdDb: number
  hysteresisDb: number
  leadInMs: number
  leadOutMs: number
}

export function useGapRemove() {
  const project = useProjectStore()
  const waveform = useWaveformStore()

  const scanning = ref(false)

  const removedGaps = computed<GapRemoveGap[]>(() =>
    getRemovedGapRanges(project.gapRemove?.gaps || []),
  )

  const removedDuration = computed(() =>
    removedGaps.value.reduce((sum, g) => sum + (g.end - g.start), 0),
  )

  async function scan(params: GapRemoveScanParams) {
    scanning.value = true
    try {
      const payload = waveform.payload
      const gaps = payload
        ? detectAudioGapRemoveGaps(payload as any, {
            minimumMs: params.minimumMs,
            thresholdDb: params.thresholdDb,
            hysteresisDb: params.hysteresisDb,
            leadInMs: params.leadInMs,
            leadOutMs: params.leadOutMs,
          })
        : []
      project.setGapRemove({
        schema: 'moy.asr.gap_remove.v1',
        detector: 'audio_gate',
        minimum_ms: params.minimumMs,
        threshold_db: params.thresholdDb,
        hysteresis_db: params.hysteresisDb,
        lead_in_ms: params.leadInMs,
        lead_out_ms: params.leadOutMs,
        skip_playback: false,
        manual_corrections: false,
        operation_mode: 'none',
        gaps,
      })
    } finally {
      scanning.value = false
    }
  }

  function restoreGap(index: number) {
    if (!project.gapRemove) return
    const gap = project.gapRemove.gaps[index]
    if (!gap) return
    const next = applyGapRemoveRange(project.gapRemove.gaps, gap.start, gap.end, false)
    project.setGapRemove({ ...project.gapRemove, gaps: next })
  }

  function restoreAll() {
    if (!project.gapRemove) return
    project.setGapRemove({ ...project.gapRemove, gaps: [] })
  }

  return {
    scanning,
    removedGaps,
    removedDuration,
    scan,
    restoreGap,
    restoreAll,
  }
}
