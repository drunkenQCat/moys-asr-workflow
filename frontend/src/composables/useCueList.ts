import { computed } from 'vue'
import type { Segment } from '../types/project.js'

export interface CueListItem {
  segment: Segment
  index: number
}

export interface UseCueListOptions {
  segments: () => Segment[]
  searchQuery: () => string
}

export function useCueList(options: UseCueListOptions) {
  const filteredSegments = computed<CueListItem[]>(() => {
    const query = options.searchQuery().trim().toLowerCase()
    const mapped = options.segments().map((seg, i) => ({ segment: seg, index: i }))
    if (!query) return mapped
    return mapped.filter(({ segment }) =>
      segment.text.toLowerCase().includes(query)
      || String(segment.start).includes(query)
      || String(segment.end).includes(query),
    )
  })

  return {
    filteredSegments,
  }
}
