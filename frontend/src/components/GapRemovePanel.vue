<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useWaveformStore } from '../stores/waveform.js'
import { detectAudioGapRemoveGaps, applyGapRemoveRange, getRemovedGapRanges, formatGapRemoveDuration, buildGapRemovedIntervals } from '../core/editor-utils.js'
import type { GapRemoveGap, GapRemoveData } from '../types/project.js'

const project = useProjectStore()
const waveform = useWaveformStore()

const show = defineModel<boolean>('show', { default: false })

const minimumMs = ref(200)
const thresholdDb = ref(-24)
const hysteresisDb = ref(6)
const leadInMs = ref(50)
const leadOutMs = ref(50)
const advancedOpen = ref(false)
const scanning = ref(false)

const removedGaps = computed(() => getRemovedGapRanges(project.gapRemove?.gaps || []))
const removedDuration = computed(() => removedGaps.value.reduce((sum, g) => sum + (g.end - g.start), 0))

async function scan() {
  scanning.value = true
  try {
    // 从波形 payload 获取检测数据（如果有）
    const payload = waveform.payload
    if (payload) {
      const gaps = detectAudioGapRemoveGaps(payload as any, {
        minimumMs: minimumMs.value,
        thresholdDb: thresholdDb.value,
        hysteresisDb: hysteresisDb.value,
        leadInMs: leadInMs.value,
        leadOutMs: leadOutMs.value,
      })
      project.setGapRemove({
        schema: 'moy.asr.gap_remove.v1',
        detector: 'audio_gate',
        minimum_ms: minimumMs.value,
        threshold_db: thresholdDb.value,
        hysteresis_db: hysteresisDb.value,
        lead_in_ms: leadInMs.value,
        lead_out_ms: leadOutMs.value,
        skip_playback: false,
        manual_corrections: false,
        operation_mode: 'none',
        gaps,
      })
    } else {
      // 无波形数据时创建占位
      project.setGapRemove({
        schema: 'moy.asr.gap_remove.v1',
        detector: 'audio_gate',
        minimum_ms: minimumMs.value,
        threshold_db: thresholdDb.value,
        hysteresis_db: hysteresisDb.value,
        lead_in_ms: leadInMs.value,
        lead_out_ms: leadOutMs.value,
        skip_playback: false,
        manual_corrections: false,
        operation_mode: 'none',
        gaps: [],
      })
    }
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
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="gap-overlay" @click.self="show = false">
      <div class="gap-panel" @click.stop>
        <div class="panel-header">
          <h3>空隙移除</h3>
          <button @click="show = false" class="close-btn">✕</button>
        </div>

        <div class="params">
          <div class="param-row">
            <label>最小空隙 (ms)</label>
            <input type="number" v-model="minimumMs" class="input" min="0" step="10" />
          </div>
          <div class="param-row">
            <label>音量阈值 (dB)</label>
            <input type="number" v-model="thresholdDb" class="input" min="-96" max="0" step="3" />
          </div>
          <button @click="advancedOpen = !advancedOpen" class="btn-link">
            {{ advancedOpen ? '收起' : '高级' }}
          </button>

          <template v-if="advancedOpen">
            <div class="param-row">
              <label>滞回 (dB)</label>
              <input type="number" v-model="hysteresisDb" class="input" min="0" max="30" step="1" />
            </div>
            <div class="param-row">
              <label>前端预留 (ms)</label>
              <input type="number" v-model="leadInMs" class="input" min="0" step="10" />
            </div>
            <div class="param-row">
              <label>后端预留 (ms)</label>
              <input type="number" v-model="leadOutMs" class="input" min="0" step="10" />
            </div>
          </template>

          <button @click="scan" :disabled="scanning" class="btn-scan">
            {{ scanning ? '扫描中...' : '扫描空隙' }}
          </button>
        </div>

        <div class="gaps-list" v-if="removedGaps.length">
          <div class="gaps-header">
            <span>{{ removedGaps.length }} 处空隙</span>
            <span>{{ formatGapRemoveDuration(removedDuration, project.mediaDurationMs) }}</span>
            <button @click="restoreAll" class="btn-link">全部恢复</button>
          </div>
          <div class="gap-item" v-for="(gap, i) in removedGaps" :key="i">
            <span class="gap-time">{{ (gap.start / 1000).toFixed(1) }}s - {{ (gap.end / 1000).toFixed(1) }}s</span>
            <span class="gap-duration">{{ ((gap.end - gap.start) / 1000).toFixed(1) }}s</span>
            <button @click="restoreGap(i)" class="btn-link">恢复</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gap-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}
.gap-panel {
  background: #2a2a3e;
  border-radius: 10px;
  padding: 20px;
  width: 380px;
  max-width: 90vw;
  max-height: 70vh;
  overflow-y: auto;
  color: #e0e0e0;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.panel-header h3 { margin: 0; font-size: 16px; }
.close-btn {
  background: none; border: none; color: #888; cursor: pointer; font-size: 18px;
}
.params { margin-bottom: 16px; }
.param-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.param-row label {
  font-size: 12px;
  color: #888;
  min-width: 100px;
}
.input {
  flex: 1;
  padding: 4px 8px;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
}
.btn-scan {
  width: 100%;
  padding: 8px;
  background: #6c63ff;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  margin-top: 8px;
}
.btn-scan:disabled { opacity: 0.5; }
.btn-link {
  background: none;
  border: none;
  color: #6c63ff;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.gaps-list { margin-top: 12px; }
.gaps-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}
.gap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  border-bottom: 1px solid #333;
}
.gap-time { flex: 1; font-family: monospace; }
.gap-duration { color: #888; font-size: 11px; }
</style>