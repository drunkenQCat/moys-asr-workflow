// 语言友好名到 DashScope language code 的映射 — 与 Python 端一致

const LANGUAGE_MAP: Record<string, string> = {
  'chinese': 'zh', 'zh': 'zh', 'zhongwen': 'zh', '中文': 'zh', '普通话': 'zh',
  'cantonese': 'yue', 'yue': 'yue', '粤语': 'yue', '广东话': 'yue',
  'english': 'en', 'en': 'en',
  'japanese': 'ja', 'ja': 'ja', '日语': 'ja',
  'korean': 'ko', 'ko': 'ko', '韩语': 'ko',
  'german': 'de', 'de': 'de',
  'french': 'fr', 'fr': 'fr',
  'russian': 'ru', 'ru': 'ru',
  'spanish': 'es', 'es': 'es',
}

/**
 * 将语言友好名映射为 DashScope API 代码。
 * 如果输入已经是代码或不在映射中，原样返回。
 */
export function normalizeLanguage(input: string | undefined): string | undefined {
  if (!input) return undefined
  const key = input.trim().toLowerCase()
  return LANGUAGE_MAP[key] || input.trim() || undefined
}