import { ref } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useUiStore } from '../stores/ui.js'
import { useWaveformStore } from '../stores/waveform.js'
import { transcribe } from '../core/asr.js'
import { loadAsrConfig } from '../core/asr-config.js'
import { extractWaveform } from '../core/waveform-extract.js'

export function useTranscribeAction() {
  const project = useProjectStore()
  const ui = useUiStore()
  const waveform = useWaveformStore()

  const transcribing = ref(false)
  const transcribeProgress = ref('')

  async function startTranscribe(onNeedConfig: () => void) {
    const config = loadAsrConfig()
    if (!config.apiKey) {
      onNeedConfig()
      return
    }

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

  return {
    transcribing,
    transcribeProgress,
    startTranscribe,
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
