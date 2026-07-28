import { useProjectStore } from '../stores/project.js'
import { useUiStore } from '../stores/ui.js'
import { serializeProject } from '../core/json-project.js'

export function useProjectFileActions() {
  const project = useProjectStore()
  const ui = useUiStore()

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

  return {
    openProject,
    saveProject,
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
