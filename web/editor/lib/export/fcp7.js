// FCP7 XML 序列化：字幕轨道、字体映射与图形/类型文本编码。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibExportFcp7(global) {
  'use strict';

  const U = global.MaweLib;

  function fcpRate(profile) {
    return `<rate><timebase>${profile.numerator}/${profile.denominator}</timebase><ntsc>${profile.denominator === 1001 ? 'TRUE' : 'FALSE'}</ntsc></rate>`;
  }

  function fcpTimeRange(startMs, endMs, plan) {
    const start = U.exportPlanFrame(plan, startMs, 'floor');
    const end = Math.max(start + 1, U.exportPlanFrame(plan, endMs, 'ceil'));
    return { start, end, duration: end - start };
  }

  function encodeGraphicAndTypeText(text, fontFamily = 'FangSong') {
    const payload = {
      mTextParam: {
        mAlignment: 0,
        mBackFillColor: 0,
        mBackFillOpacity: 100,
        mBackFillSize: 0,
        mBackFillVisible: false,
        mDefaultRun: [],
        mHeight: 0,
        mHindiDigits: false,
        mIndic: false,
        mIsMask: false,
        mIsMaskInverted: false,
        mIsVerticalText: false,
        mLeading: 0,
        mLigatures: false,
        mLineCapType: 0,
        mLineJoinType: 0,
        mMiterLimit: 2.5,
        mNumStrokes: 1,
        mRTL: false,
        mShadowAngle: 0,
        mShadowBlur: 0,
        mShadowColor: 0,
        mShadowOffset: 0,
        mShadowOpacity: 0,
        mShadowSize: 0,
        mShadowVisible: false,
        mStyleSheet: {
          mAdditionalStrokeColor: [],
          mAdditionalStrokeVisible: [],
          mAdditionalStrokeWidth: [],
          mBaselineOption: { mParamValues: [[0, 0]] },
          mBaselineShift: { mParamValues: [[0, 0]] },
          mCapsOption: { mParamValues: [[0, 0]] },
          mFauxBold: { mParamValues: [[0, false]] },
          mFauxItalic: { mParamValues: [[0, false]] },
          mFillColor: { mParamValues: [[0, 16777215]] },
          mFillOverStroke: { mParamValues: [[0, true]] },
          mFillVisible: { mParamValues: [[0, true]] },
          mFontName: { mParamValues: [[0, fontFamily]] },
          mFontSize: { mParamValues: [[0, 120]] },
          mKerning: { mParamValues: [[0, 0]] },
          mStrokeColor: { mParamValues: [[0, 16777215]] },
          mStrokeVisible: { mParamValues: [[0, false]] },
          mStrokeWidth: { mParamValues: [[0, 1]] },
          mText: String(text ?? ''),
          mTracking: { mParamValues: [[0, 0]] },
          mTsumi: { mParamValues: [[0, 0]] },
          mUnderline: { mParamValues: [[0, false]] },
        },
        mTabWidth: 400,
        mWidth: 0,
      },
      mVersion: 1,
    };
    const json = JSON.stringify(payload);
    const bytes = new Uint8Array(8 + json.length * 2);
    bytes[0] = 0xf6;
    bytes[1] = 0x0a;
    for (let index = 0; index < json.length; index += 1) {
      const code = json.charCodeAt(index);
      bytes[8 + index * 2] = code & 0xff;
      bytes[9 + index * 2] = code >>> 8;
    }
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let encoded = '';
    for (let index = 0; index < bytes.length; index += 3) {
      const first = bytes[index];
      const second = bytes[index + 1];
      const third = bytes[index + 2];
      encoded += alphabet[first >> 2];
      encoded += alphabet[((first & 3) << 4) | (second === undefined ? 0 : second >> 4)];
      encoded += second === undefined ? '=' : alphabet[((second & 15) << 2) | (third === undefined ? 0 : third >> 6)];
      encoded += third === undefined ? '=' : alphabet[third & 63];
    }
    return encoded;
  }

  function premiereFontFamily(value) {
    const key = String(value ?? '').trim();
    return ({
      default: 'Arial',
      yahei: 'Microsoft YaHei',
      hei: 'SimHei',
      song: 'FangSong',
      sans: 'Arial',
    })[key] || key || 'Arial';
  }

  function fcpClipItem({ id, fileId, name, path, width, height, sourceStartMs, sourceEndMs, startMs, endMs, startFrame, endFrame, plan, mediaKind, track, link, defineFile = true, encodeDriveColon = false }) {
    const source = fcpTimeRange(sourceStartMs, sourceEndMs, plan);
    const timeline = fcpTimeRange(startMs, endMs, plan);
    const url = U.escapeExportXml(U.exportPathToFileUrl(path, { encodeDriveColon }));
    const isSticker = mediaKind === 'sticker';
    const media = mediaKind === 'audio' ? '<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex><channel>1</channel><channelcount>2</channelcount></sourcetrack>'
      : '<sourcetrack><mediatype>video</mediatype><trackindex>1</trackindex></sourcetrack>';
    const sourceDuration = U.exportPlanFrame(plan, plan.sourceDurationMs, 'ceil');
    const fileMedia = mediaKind === 'audio'
      ? `<media><audio><duration>${sourceDuration}</duration><channelcount>2</channelcount></audio></media>`
      : isSticker
        ? `<media><video><samplecharacteristics><rate><timebase>${plan.frameProfile.numerator}/${plan.frameProfile.denominator}</timebase><ntsc>${plan.frameProfile.denominator === 1001 ? 'TRUE' : 'FALSE'}</ntsc></rate><width>${Number.isInteger(width) && width > 0 ? width : 720}</width><height>${Number.isInteger(height) && height > 0 ? height : 480}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></video></media>`
        : `<media><video><duration>${sourceDuration}</duration></video><audio><duration>${sourceDuration}</duration><channelcount>2</channelcount></audio></media>`;
    const file = defineFile
      ? `<file id="${U.escapeExportXml(fileId)}"><name>${U.escapeExportXml(U.fileBasename(path))}</name><pathurl>${url}</pathurl><duration>${sourceDuration}</duration>${fcpRate(plan.frameProfile)}${isSticker ? `<timecode><rate>${fcpRate(plan.frameProfile).replace('<rate>', '').replace('</rate>', '')}</rate><string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>` : ''}${fileMedia}</file>`
      : `<file id="${U.escapeExportXml(fileId)}"/>`;
    const frameStart = startFrame ?? timeline.start;
    const frameEnd = Math.max(frameStart + 1, endFrame ?? frameStart + source.duration);
    const stickerClipMetadata = isSticker
      ? `<enabled>TRUE</enabled><alphatype>${/\.(?:gif|png|webp)$/iu.test(path) ? 'straight' : 'none'}</alphatype><pixelaspectratio>square</pixelaspectratio><anamorphic>FALSE</anamorphic>`
      : '';
    const masterClipMetadata = isSticker ? `<masterclipid>${U.escapeExportXml(fileId.replace(/^file-/, 'master-'))}</masterclipid>` : '';
    return `<clipitem id="${U.escapeExportXml(id)}">${masterClipMetadata}<name>${U.escapeExportXml(name)}</name>${stickerClipMetadata}<duration>${frameEnd - frameStart}</duration>${fcpRate(plan.frameProfile)}<start>${frameStart}</start><end>${frameEnd}</end><in>${source.start}</in><out>${source.end}</out>${file}${media}${link ? `<link><linkclipref>${U.escapeExportXml(link)}</linkclipref><mediatype>audio</mediatype><trackindex>1</trackindex><clipindex>1</clipindex></link>` : ''}<label>${U.escapeExportXml(track)}</label></clipitem>`;
  }

  function serializeFcp7Xml(plan, options = {}) {
    const exportPlan = U.assertExportPlan(plan);
    if (options.nativeTextObjects !== undefined && typeof options.nativeTextObjects !== 'boolean') {
      throw new Error('native text option must be boolean');
    }
    const nativeTextObjects = options.nativeTextObjects === true;
    const subtitleTracks = options.subtitleTracks || 'main';
    if (!U.EXPORT_SUBTITLE_TRACKS.includes(subtitleTracks)) {
      throw new Error(`unsupported subtitle tracks: ${subtitleTracks}`);
    }
    const mediaType = String(exportPlan.media.type || 'video').toLowerCase();
    const hasVideo = mediaType !== 'audio';
    let cursor = 0;
    const sourceTracks = [];
    const intervals = Array.isArray(exportPlan.keptIntervals) ? exportPlan.keptIntervals : [];
    const boundaries = [0];
    intervals.forEach((interval) => boundaries.push(boundaries[boundaries.length - 1]
      + fcpTimeRange(interval.start, interval.end, exportPlan).duration));
    const duration = boundaries[boundaries.length - 1];
    intervals.forEach((interval, index) => {
      const range = fcpTimeRange(interval.start, interval.end, exportPlan);
      const startMs = cursor * 1000 * exportPlan.frameProfile.denominator / exportPlan.frameProfile.numerator;
      const endMs = (cursor + range.duration) * 1000 * exportPlan.frameProfile.denominator / exportPlan.frameProfile.numerator;
      sourceTracks.push(fcpClipItem({
        id: `video-clip-${index + 1}`, fileId: 'file-source-video-1', name: `${U.fileBasename(exportPlan.media.path)} [${index + 1}]`,
        path: exportPlan.media.path, sourceStartMs: interval.start, sourceEndMs: interval.end,
        startMs, endMs, startFrame: boundaries[index], endFrame: boundaries[index + 1], plan: exportPlan, mediaKind: mediaType, track: 'source', defineFile: index === 0,
      }));
      cursor += range.duration;
    });
    const audioTracks = hasVideo ? intervals.map((interval, index) => {
      const range = fcpTimeRange(interval.start, interval.end, exportPlan);
      const startMs = (intervals.slice(0, index).reduce((sum, prior) => sum + fcpTimeRange(prior.start, prior.end, exportPlan).duration, 0)) * 1000 * exportPlan.frameProfile.denominator / exportPlan.frameProfile.numerator;
      const endMs = startMs + range.duration * 1000 * exportPlan.frameProfile.denominator / exportPlan.frameProfile.numerator;
      return fcpClipItem({ id: `audio-clip-${index + 1}`, fileId: 'file-source-audio', name: `${U.fileBasename(exportPlan.media.path)} audio [${index + 1}]`, path: exportPlan.media.path, sourceStartMs: interval.start, sourceEndMs: interval.end, startMs, endMs, startFrame: boundaries[index], endFrame: boundaries[index + 1], plan: exportPlan, mediaKind: 'audio', track: 'source-audio', link: `video-clip-${index + 1}`, defineFile: index === 0 });
    }) : [];
    const videoTracks = hasVideo ? [`<track>${sourceTracks.join('')}</track>`] : [];
    const stickerFileIds = new Map();
    const stickerTracks = hasVideo ? (Array.isArray(exportPlan.stickers) ? exportPlan.stickers : []).map((sticker, index) => {
      if (!String(sticker.path || '').trim()) return '';
      const stickerKey = String(sticker.path);
      const fileId = stickerFileIds.get(stickerKey) || `file-sticker-${stickerFileIds.size + 1}`;
      const defineFile = !stickerFileIds.has(stickerKey);
      stickerFileIds.set(stickerKey, fileId);
      const clip = fcpClipItem({
        id: `sticker-clip-${index + 1}`, fileId, name: `MAW sticker - ${sticker.name || index + 1}`,
        path: sticker.path, width: sticker.width, height: sticker.height, sourceStartMs: 0,
        sourceEndMs: Math.max(1, sticker.endMs - sticker.startMs),
        startMs: sticker.startMs, endMs: sticker.endMs, plan: exportPlan, mediaKind: 'sticker', track: `sticker-${index + 1}`,
        defineFile, encodeDriveColon: true,
      });
      return `<track>${clip}</track>`;
    }).filter(Boolean) : [];
    const textTracks = nativeTextObjects && hasVideo ? (subtitleTracks === 'main_and_extension' || subtitleTracks === 'both'
      ? ['main', 'extension'] : subtitleTracks === 'extension' ? ['extension'] : ['main']).map((track) => {
      const cues = U.selectedSubtitleTracks(exportPlan, track);
      const generators = cues.map((cue, index) => {
        const range = fcpTimeRange(cue.startMs, cue.endMs, exportPlan);
        const text = encodeGraphicAndTypeText(cue.text, exportPlan.subtitleFontFamily);
        const clipId = `text-${track}-${index + 1}`;
        return `<clipitem id="${clipId}"><name>MAW native text - ${U.escapeExportXml(track)}</name><enabled>TRUE</enabled><duration>${range.duration}</duration>${fcpRate(exportPlan.frameProfile)}<start>${range.start}</start><end>${range.end}</end><in>0</in><out>${range.duration}</out><file id="file-${clipId}"><name>MAW GraphicAndType</name><mediaSource>GraphicAndType</mediaSource><duration>${range.duration}</duration>${fcpRate(exportPlan.frameProfile)}<media><video><duration>${range.duration}</duration></video></media></file><filter><effect><name>GraphicAndType</name><effectid>GraphicAndType</effectid><effectcategory>graphic</effectcategory><effecttype>filter</effecttype><mediatype>video</mediatype><parameter authoringApp="MAW"><parameterid>1</parameterid><name>Source Text</name><value>${text}</value></parameter></effect></filter></clipitem>`;
      }).join('');
      return generators ? `<track>${generators}</track>` : '';
    }).filter(Boolean) : [];
    const video = hasVideo ? `<video>${videoTracks.concat(stickerTracks, textTracks).join('')}</video>` : '';
    const audio = mediaType === 'audio' ? `<audio><track>${sourceTracks.join('')}</track></audio>` : `<audio><track>${audioTracks.join('')}</track></audio>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5"><sequence id="MAW-sequence"><name>MAW FCP 7 Premiere handoff</name><duration>${duration}</duration>${fcpRate(exportPlan.frameProfile)}<media>${video}${audio}</media></sequence></xmeml>`;
    return xml;
  }

  function buildFcp7ExportArtifacts(plan, options = {}) {
    const exportPlan = U.assertExportPlan(plan);
    const normalized = U.normalizeExportOptions({
      timelineMode: exportPlan.mode,
      fps: exportPlan.frameProfile.name,
      ...options,
    });
    if (normalized.timelineMode !== exportPlan.mode
      || normalized.fps !== exportPlan.frameProfile.name) {
      throw new Error('export artifact options do not match the shared plan');
    }
    const names = U.buildExportNames(normalized.baseName);
    const serializerOptions = {
      nativeTextObjects: normalized.nativeTextObjects,
      subtitleTracks: normalized.subtitleTracks,
    };
    return U.freezeExportValue([
      {
        kind: 'xml', filename: names.files.project, mime: 'application/xml',
        content: serializeFcp7Xml(exportPlan, serializerOptions), plan: exportPlan,
      },
      {
        kind: 'srt', filename: names.files.subtitles, mime: 'text/plain',
        content: U.serializeMappedSrt(exportPlan, serializerOptions), plan: exportPlan,
      },
    ]);
  }

  Object.assign(U, {
    fcpRate,
    fcpTimeRange,
    encodeGraphicAndTypeText,
    premiereFontFamily,
    fcpClipItem,
    serializeFcp7Xml,
    buildFcp7ExportArtifacts,
  });
})(typeof window !== 'undefined' ? window : globalThis);
