// 带变量文案的逐条翻译：先查词典，再按顺序匹配正则模板；以及词典覆盖自检。
// 自 web/editor/i18n/i18n.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweI18n；
// 兼容出口 window.MAWE_I18N 仍由 editor/i18n/compat-surface.js 统一组装。
(function initMaweI18nTextPatterns(global) {
  'use strict';

  const U = global.MaweI18n;

  function translateText(value, lang = U.language) {
    const text = String(value ?? '');
    if (lang !== U.EN) return text;
    if (U.EN_TEXT[text]) return U.EN_TEXT[text];
    if (U.EN_ATTR[text]) return U.EN_ATTR[text];
    let match = /^(主字幕|副字幕)\s+(\d+)$/.exec(text);
    if (match) return `${translateText(match[1], U.EN)} ${match[2]}`;
    match = /^(主字幕|副字幕)(?:（(.+)）)?\s*·\s*(\d+)\s*条$/.exec(text);
    if (match) {
      const label = translateText(match[1], U.EN);
      return `${label}${match[2] ? ` (${match[2]})` : ''} · ${match[3]}`;
    }
    match = /^(\d+)\s*条（未修改\s*(\d+)\s*条）$/.exec(text);
    if (match) return `${match[1]} changed (${match[2]} unchanged)`;
    match = /^第\s*(\d+)\s*条\s*字幕文本$/.exec(text);
    if (match) return `Subtitle ${match[1]} text`;
    match = /^第\s*(\d+)\s*条\s*·\s*(.+)$/.exec(text);
    if (match) return `Subtitle ${match[1]} · ${translateText(match[2], U.EN)}`;
    match = /^有效字词时间码覆盖率：\s*(\d+)%$/.exec(text);
    if (match) return `Word-timing coverage: ${match[1]}%`;
    match = /^原始时间码复用率：\s*(\d+)%$/.exec(text);
    if (match) return `Original timing reuse: ${match[1]}%`;
    match = /^有效字词时间码：\s*(\d+)\/(\d+)$/.exec(text);
    if (match) return `Valid word timings: ${match[1]}/${match[2]}`;
    match = /^有效字词时间码覆盖率：\s*(\d+)\/(\d+)$/.exec(text);
    if (match) return `Word-timing coverage: ${match[1]}/${match[2]}`;
    match = /^原始时间码复用率：\s*(\d+)\/(\d+)$/.exec(text);
    if (match) return `Original timing reuse: ${match[1]}/${match[2]}`;
    if (text === '时间范围为自动估算（按原字幕范围/文字长度分配）') {
      return 'Time range estimated from the original cue range and text length';
    }
    match = /^时间范围：(.+?)\s*[–-]\s*(.+?)\s*→\s*(.+?)\s*[–-]\s*(.+)$/.exec(text);
    if (match) return `Time range: ${match[1]} - ${match[2]} -> ${match[3]} - ${match[4]}`;
    match = /^版本号\s+(.+)$/.exec(text);
    if (match) return `Version ${match[1]}`;
    // 动态 title / 徽标：带变量的属性文案
    match = /^颜色：(.+)$/.exec(text);
    if (match) {
      const name = translateText(match[1], U.EN);
      return `Color: ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    }
    match = /^↑\s*属于第\s*(\d+)\s*条的颜色（(.+)）$/.exec(text);
    if (match) return `↑ Inherits the color of subtitle ${match[1]} (${translateText(match[2], U.EN)})`;
    match = /^属于上方第\s*(\d+)\s*条的表情包$/.exec(text);
    if (match) return `Inherits the sticker of subtitle ${match[1]}`;
    match = /^工程路径失效：(.+)$/.exec(text);
    if (match) return `Project path is no longer valid: ${match[1]}`;
    match = /^点击复制工程文件名：(.+)$/.exec(text);
    if (match) return `Click to copy the project file name: ${match[1]}`;
    match = /^点击复制媒体名：(.+)$/.exec(text);
    if (match) return `Click to copy the media name: ${match[1]}`;
    match = /^工程关联媒体：(.+)$/.exec(text);
    if (match) return `Media linked to this project: ${match[1]}`;
    match = /^(.+)（按\s*(\d+)）$/.exec(text);
    if (match) return `${translateText(match[1], U.EN)} (press ${match[2]})`;
    // 时长片段（供下面各摘要规则递归调用，必须排在它们之前，且只匹配纯时长，
    //  不能吞掉前缀文字，否则会抢先匹配整句）：6秒 / 6秒（占比 2.1%） / 1分 6秒
    match = /^(\d+(?:\.\d+)?)\s*秒（占比\s+(.+?)）$/.exec(text);
    if (match) return `${match[1]}s (${match[2]} of media)`;
    match = /^(\d+)\s*分\s*(\d+(?:\.\d+)?)\s*秒（占比\s+(.+?)）$/.exec(text);
    if (match) return `${match[1]}m ${match[2]}s (${match[3]} of media)`;
    match = /^(\d+(?:\.\d+)?)\s*秒$/.exec(text);
    if (match) return `${match[1]}s`;
    match = /^(\d+)\s*分\s*(\d+(?:\.\d+)?)\s*秒$/.exec(text);
    if (match) return `${match[1]}m ${match[2]}s`;
    // 空隙摘要（工具栏紧凑版）：已移除 4/4 段 · 6秒（占比 2.1%）[ · 人工修正]
    // 先剥离可选的「· 人工修正」尾巴，再整体翻译中间的时长片段。
    {
      const manual = / ·\s*人工修正$/.test(text);
      const body = manual ? text.replace(/ ·\s*人工修正$/, '') : text;
      const m = /^已移除\s+(\d+)\/(\d+)\s+段\s+·\s+(.+)$/.exec(body);
      if (m) {
        return `${m[1]}/${m[2]} gaps removed · ${translateText(m[3], U.EN)}`
          + (manual ? ' · manually adjusted' : '');
      }
    }
    match = /^禁用位于空隙范围内的字幕（当前有\s*(\d+)\s*条未禁用）$/.exec(text);
    if (match) return `Disable subtitles within gap ranges (${match[1]} not disabled)`;
    // 空隙摘要（工具窗完整版）
    match = /^已移除\s+(\d+)\/(\d+)\s+段，共\s+(.+)；左键空隙跳转播放头，Alt\+左键切换移除。$/.exec(text);
    if (match) {
      return `${match[1]}/${match[2]} gaps removed, ${translateText(match[3], U.EN)} total. `
        + 'Left-click a gap to move the playhead; Alt+left-click toggles removal.';
    }
    // flashHint：已移除 N 段音量空隙，共 6秒（占比 2.1%）
    match = /^已移除\s+(\d+)\s+段音量空隙，共\s+(.+)$/.exec(text);
    if (match) return `Removed ${match[1]} loudness gaps, ${translateText(match[2], U.EN)} total`;
    // 波形状态：12:34.567 · 缓存波形（未加载媒体）
    match = /^(.+?)\s+·\s+缓存波形（未加载媒体）$/.exec(text);
    if (match) return `${match[1]} · cached waveform (no media loaded)`;
    match = /^未扫描空隙(?:\s+·\s+人工修正)?$/.exec(text);
    if (match) return text.includes('人工修正') ? 'No gap scan yet · manually adjusted' : 'No gap scan yet';
    if (text === ' · 人工修正') return ' · manually adjusted';
    match = /^(.+?)\s+·\s+人工修正$/.exec(text);
    if (match) return `${translateText(match[1])} · manually adjusted`;
    match = /^上次打开：(.+)$/.exec(text);
    if (match) return `Last opened: ${match[1]}`;
    match = /^第\s*(\d+)\s*条字幕(?:\s*·\s*item\s*(\d+))?$/.exec(text);
    if (match) return match[2] ? `Subtitle ${match[1]} · item ${match[2]}` : `Subtitle ${match[1]}`;
    match = /^定位到第\s*(\d+)\s*条字幕$/.exec(text);
    if (match) return `Go to subtitle ${match[1]}`;
    match = /^保存失败：(.+)$/.exec(text);
    if (match) return `Save failed: ${match[1]}`;
    match = /^打开工程失败：(.+)$/.exec(text);
    if (match) return `Could not open project: ${match[1]}`;
    match = /^服务器返回\s+(.+)$/.exec(text);
    if (match) return `Server returned ${match[1]}`;
    match = /^已自动加载媒体：(.+)$/.exec(text);
    if (match) return `Media loaded automatically: ${match[1]}`;
    match = /^已加载媒体：(.+)$/.exec(text);
    if (match) return `Media loaded: ${match[1]}`;
    match = /^已复制：(.+)$/.exec(text);
    if (match) return `Copied: ${match[1]}`;
    match = /^已复制媒体名：(.+)$/.exec(text);
    if (match) return `Media name copied: ${match[1]}`;
    match = /^已应用纯文本编辑：(\d+) 条字幕(?:，移除 (\d+) 条空字幕行)?(?:，(\d+) 条字词时间码已清除)?$/.exec(text);
    if (match) {
      return `Plain text edit applied: ${match[1]} subtitle${match[1] === '1' ? '' : 's'}`
        + (match[2] ? `; removed ${match[2]} empty subtitle row${match[2] === '1' ? '' : 's'}` : '')
        + (match[3] ? `; word timings cleared for ${match[3]}` : '');
    }
    match = /^总长度\s+(.+)$/.exec(text);
    if (match) return `Total length ${match[1]}`;
    match = /^字\/秒\s+(.+)$/.exec(text);
    if (match) return `chars/s ${match[1]}`;
    match = /^已处理\s*(\d+)\s*个(选中字幕|字幕)：完整延长\s*(\d+)\s*条，部分延长\s*(\d+)\s*条，未延长\s*(\d+)\s*条$/.exec(text);
    if (match) {
      const target = match[2] === '选中字幕' ? 'selected subtitles' : 'subtitles';
      return `Processed ${match[1]} ${target}: ${match[3]} fully extended, ${match[4]} partially extended, ${match[5]} unchanged`;
    }
    match = /^合并\s+(\d+)\s+条字幕$/.exec(text);
    if (match) return `Merge ${match[1]} subtitles`;
    match = /^已合并\s+(\d+)\s+条副字幕(，原绑定已解除)?$/.exec(text);
    if (match) return `Merged ${match[1]} secondary subtitle${match[1] === '1' ? '' : 's'}${match[2] ? '; previous bindings were removed' : ''}`;
    match = /^已绑定主字幕\s+(\d+)\s+与副字幕\s+(\d+)$/.exec(text);
    if (match) return `Bound main subtitle ${match[1]} to secondary subtitle ${match[2]}`;
    match = /^已替换主字幕\s+(\d+)\s+的绑定，改为副字幕\s+(\d+)$/.exec(text);
    if (match) return `Replaced the binding for main subtitle ${match[1]} with secondary subtitle ${match[2]}`;
    match = /^有多条主字幕与当前副字幕重叠，已自动绑定时间最早的未绑定主字幕（第\s*(\d+)\s*条）$/.exec(text);
    if (match) return `Multiple main subtitles overlap this secondary subtitle; automatically bound the earliest unbound main subtitle (subtitle ${match[1]})`;
    match = /^已批量对齐\s*(\d+)\s*条副字幕(?:，跳过\s*(\d+)\s*条未绑定副字幕)?$/.exec(text);
    if (match) return `Batch-aligned ${match[1]} secondary subtitle${match[1] === '1' ? '' : 's'}${match[2] ? `; skipped ${match[2]} unbound` : ''}`;
    match = /^(已对齐到主字幕范围|副字幕发生冲突，已)(?:，)?(?:挤压\s*(\d+)\s*条副字幕)?(?:，删除\s*(\d+)\s*条副字幕)?(并解除绑定)?$/.exec(text);
    if (match && (match[2] || match[3])) {
      const parts = [];
      if (match[2]) parts.push(`squeezed ${match[2]} secondary subtitle${match[2] === '1' ? '' : 's'}`);
      if (match[3]) parts.push(`deleted ${match[3]} secondary subtitle${match[3] === '1' ? '' : 's'}`);
      if (match[4]) parts.push('and removed their bindings');
      return `${match[1] === '已对齐到主字幕范围' ? 'Aligned to the main subtitle range' : 'Secondary subtitle conflict resolved'}: ${parts.join(', ')}`;
    }
    if (text === '副字幕已随主字幕联动调整') return 'Secondary subtitle followed the main subtitle';
    match = /^已交换主副字幕：主轨\s+(\d+)\s+条，副轨\s+(\d+)\s+条$/.exec(text);
    if (match) return `Swapped main and secondary subtitles: ${match[1]} main, ${match[2]} secondary`;
    // 合并连接设置旁的主字幕类型提示与切换按钮 title（目标类型语言说明）
    match = /^当前为「(.+)」(?:（(.+)）)?$/.exec(text);
    if (match) {
      const mode = translateText(match[1], U.EN);
      const example = match[2] ? translateText(match[2], U.EN) : '';
      return `Current: ${mode}${example ? ` (${example})` : ''}`;
    }
    match = /^切换为(单词型|字符型)$/.exec(text);
    if (match) return `Switch to ${translateText(match[1], U.EN)}`;
    // 颜色过滤行 title：该颜色的字幕共 N 条；点击条目只显示此颜色，勾选可多选
    match = /^该颜色的字幕共\s*(\d+)\s*条；点击条目只显示此颜色，勾选可多选$/.exec(text);
    if (match) {
      return `This color has ${match[1]} subtitles; click a row to show only that color, check boxes to select multiple`;
    }
    // flashHint：已拼接/合并字幕：吸附 2 处间隔，吸收 1 条短字幕
    match = /^(已拼接\/合并字幕|已拼合字幕)：(.+)$/.exec(text);
    if (match) {
      const parts = match[2].split('，').map((part) => {
        let inner = /^(吸附|拼合|拼接)\s*(\d+)\s*处间隔$/.exec(part);
        if (inner) return `snapped ${inner[2]} intervals`;
        inner = /^吸收\s*(\d+)\s*条短字幕$/.exec(part);
        if (inner) return `absorbed ${inner[1]} short subtitles`;
        return translateText(part, U.EN);
      });
      return `${match[1] === '已拼接/合并字幕' ? 'Join / merge subtitles' : 'Snap subtitles'}: ${parts.join(', ')}`;
    }
    // flashHint：已自动修复 2 处 0 长时间码（保底 100ms）
    match = /^已自动修复\s*(\d+)\s*处\s*0\s*长时间码（保底\s*100ms）$/.exec(text);
    if (match) return `Auto-repaired ${match[1]} zero-length timings (100 ms minimum)`;
    match = /^已新增第\s*(\d+)\s*条字幕$/.exec(text);
    if (match) return `Created subtitle ${match[1]}`;
    match = /^删除\s+(\d+)\s+条字幕$/.exec(text);
    if (match) return `Delete ${match[1]} subtitles`;
    match = /^已将关联字幕统一设为「(.+)」$/.exec(text);
    if (match) return `All linked subtitles set to ${translateText(match[1])}`;
    match = /^已将字幕设为「(.+)」$/.exec(text);
    if (match) return `Subtitle set to ${translateText(match[1])}`;
    if (text === '无法连接本地编辑器服务器。是否改为导出工程文件，以免丢失改动？') {
      return 'The local editor server is unavailable. Export the project file instead so your changes are not lost?';
    }
    if (text === '服务器未连接；工程已另存为工程文件，请重新启动本地编辑器后继续') {
      return 'The server is disconnected. The project was saved as a project file; restart the local editor to continue.';
    }
    if (text === '另存为到当前工程目录（仅文件名）：') {
      return 'Save as in the current project folder (filename only):';
    }
    if (text === '当前有未保存的改动，是否确定打开最近工程？将丢失未保存内容。') {
      return 'This project has unsaved changes. Open the recent project and discard them?';
    }
    // 表情包导出灰显拦截 flashHint：当前模式不可用：<原因>
    match = /^当前模式不可用：(.+)$/.exec(text);
    if (match) return `Unavailable in the current mode: ${translateText(match[1], U.EN)}`;
    return text;
  }

  function validateTranslationKeys(keys) {
    const values = Array.from(keys, (key) => String(key));
    return {
      zh: values.filter((key) => !(key in U.EN_TEXT) && !(key in U.EN_ATTR)),
      en: values.filter((key) => translateText(key, U.EN) === key),
    };
  }

  Object.assign(U, {
    translateText,
    validateTranslationKeys,
  });
})(typeof window !== 'undefined' ? window : globalThis);
