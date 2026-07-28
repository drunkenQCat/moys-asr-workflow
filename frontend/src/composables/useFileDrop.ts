import { useUiStore } from '../stores/ui.js'
import { useProjectStore } from '../stores/project.js'
import { useWaveformStore } from '../stores/waveform.js'
import { extractWaveform } from '../core/waveform-extract.js'

export function useFileDrop() {
  const ui = useUiStore()
  const project = useProjectStore()
  const waveform = useWaveformStore()

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    ui.incrementDrag()
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    ui.decrementDrag()
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    ui.resetDrag()

    const files = Array.from(e.dataTransfer?.files || [])
    if (!files.length) return

    const jsonFile = files.find((f) => f.name.endsWith('.json'))
    const mediaFile = files.find((f) => !f.name.endsWith('.json'))

    if (jsonFile) {
      const text = await readFileAsText(jsonFile)
      if (project.loadProject(text)) {
        project.projectName = jsonFile.name.replace(/\.json$/i, '')
        ui.addRecentProject(project.projectName, text)
      }
    }

    if (mediaFile) {
      project.loadMedia(mediaFile)
      try {
        const wfPayload = await extractWaveform(mediaFile)
        waveform.setPayload(wfPayload)
      } catch {
        // 波形提取失败不阻塞流程
      }
    }
  }

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }

  function init() {
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
  }

  function destroy() {
    window.removeEventListener('dragenter', onDragEnter)
    window.removeEventListener('dragover', onDragOver)
    window.removeEventListener('dragleave', onDragLeave)
    window.removeEventListener('drop', onDrop)
  }

  return { init, destroy }
}
