import { useProjectStore } from '../stores/project.js'
import { useUiStore } from '../stores/ui.js'

export function useSubtitleToolbar() {
  const project = useProjectStore()
  const ui = useUiStore()

  return {
    searchQuery: ui.searchQuery,
    filterOverOnly: ui.filterOverOnly,
    count: project.segments.length,
  }
}
