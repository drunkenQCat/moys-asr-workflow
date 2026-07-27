// 标点处理 — 与 Python 端一致

import type { Segment } from '../types/project.js'

/** 句末需剥离的标点集（与 Python 端一致） */
const TRAILING_PUNCT = new Set(['，', '。'])

/**
 * 剥离 segments 末尾的标点符号。
 * 与 Python `generate_subtitle_qwen_api.py` main() 中 `keep_punct` 逻辑一致：
 *   1. seg.text 末尾 rstrip("，。")
 *   2. 反向遍历 items，逐条 rstrip("，。")
 *   3. 如果 item 被 rstrip 为空，跳过该 item
 */
export function stripTrailingPunctuation(segments: Segment[]): Segment[] {
  return segments.map(seg => {
    let text = seg.text
    // 1. 剥离 text 末尾标点
    while (text.length > 0 && TRAILING_PUNCT.has(text[text.length - 1])) {
      text = text.slice(0, -1)
    }

    const items = [...(seg.items || [])]
    // 2. 反向遍历 items，剥离末尾标点
    let k = items.length - 1
    while (k >= 0) {
      let itemText = items[k].text
      while (itemText.length > 0 && TRAILING_PUNCT.has(itemText[itemText.length - 1])) {
        itemText = itemText.slice(0, -1)
      }
      items[k] = { ...items[k], text: itemText }
      if (itemText.length > 0) break
      k -= 1
    }

    return { ...seg, text, items }
  })
}