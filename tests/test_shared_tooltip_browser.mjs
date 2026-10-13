import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { compileEditorFiles } from './helpers/editor-module-loader.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MAW_TEST_PLAYWRIGHT || 'playwright');

// 共享 tooltip 与导出按钮接线：在真浏览器里验证「能力变化 → title 迁移后
// 提示保持」的行为。三源（tooltip/export-timeline/dynamic-exports）现在都是
// ESM 转换体，不能 classic script 直引；用与生产同构的装配 bundle 注入。
// 页面先预置被闭包引用的最小门面（MaweBoot/MaweProjectSave/AsrEditorUtils），
// 其余隐式门面（MaweDom/MaweFloatingPanel）由 loader 中性桩兜底。
test('export capability changes preserve stored tooltips after title migration', async () => {
  const browser = await chromium.launch({ executablePath: process.env.MAW_E2E_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    const ids = ['download-otioz', 'download-gap-removed-otioz', 'download-sticker-otioz', 'download-gap-removed-sticker-otioz', 'download-lottie', 'download-ograf'];
    await page.setContent(ids.map(id => `<button id="${id}" title="${id} help">Export</button>`).join(''));
    await page.evaluate(() => {
      window.MaweBoot = { SERVER_CONFIG: {}, maweDomContractCheck: () => [], maweDebug() {}, DATA: { segments: [], overlay_track: {}, multi_subtitle: { tracks: [] } }, PROJECT_NAME: 'test' };
      window.MaweProjectSave = { translatedEditorText: text => text };
      window.AsrEditorUtils = { defaultAssStyleLibrary: () => ({ styles: [], assProfiles: [] }) };
    });
    const code = compileEditorFiles([
      'shared/tooltip.js',
      'editor/io/editor-export-timeline.js',
      'editor/io/editor-dynamic-exports.js',
    ]);
    await page.addScriptTag({ content: code });
    await page.evaluate(() => {
      window.updateExports = () => {
        MaweExportTimeline.updateTimelineOtiozExportButtons();
        MaweExportTimeline.updateStickerExportButtons();
        MaweDynamicExports.updateLottieExportButton();
        MaweDynamicExports.updateOgrafExportButton();
      };
      updateExports();
    });
    for (const id of ids) assert.equal(await page.locator(`#${id}`).getAttribute('data-original-title'), `${id} help`);
    await page.evaluate(() => {
      MaweBoot.SERVER_CONFIG = { canOtozTimelineExport: true, otiozTimelineExportUrl: '/timeline', canOtozStickerExport: true, otiozStickerExportUrl: '/stickers', canLottieExport: true, lottieExportUrl: '/lottie', canOgrafExport: true, ografExportUrl: '/ograf' };
      updateExports();
    });
    for (const id of ids) {
      assert.equal(await page.locator(`#${id}`).getAttribute('data-title'), `${id} help`);
      assert.equal(await page.locator(`#${id}`).getAttribute('title'), null);
    }
  } finally { await browser.close(); }
});
