// 临时调试用例：拖入工程+媒体的完整链路追踪，跑完即删。
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanupTempDir, findFreePort, generateBlankEditor, generateProjectJson,
  generateWav, makeTempDir, startStaticServer,
} from './helpers.mjs';

let tempDir, server, projectPath, mediaPath;

test.beforeAll(async () => {
  tempDir = makeTempDir('probe');
  mediaPath = join(tempDir, 'synthetic.wav');
  projectPath = join(tempDir, 'project.json');
  generateWav(mediaPath, 5);
  generateProjectJson(projectPath);
  server = await startStaticServer(generateBlankEditor(join(tempDir, 'blank.html')), await findFreePort());
});
test.afterAll(async () => { await server?.stop(); cleanupTempDir(tempDir); });

test('probe: drop project+media chain', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  const consoleErrs = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 120)); });
  await page.goto(server.url);
  await page.waitForTimeout(800);

  const files = page.evaluateHandle((specs) => {
    const dt = new DataTransfer();
    for (const spec of specs) {
      const bytes = Uint8Array.from(atob(spec.base64), (ch) => ch.charCodeAt(0));
      dt.items.add(new File([bytes], spec.name, { type: spec.type }));
    }
    return dt;
  }, [
    { name: 'project.json', type: 'application/json', base64: readFileSync(projectPath).toString('base64') },
    { name: 'synthetic.wav', type: 'audio/wav', base64: readFileSync(mediaPath).toString('base64') },
  ]);
  await page.dispatchEvent('body', 'drop', { dataTransfer: await files });
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => ({
    mediaName: document.getElementById('media-name')?.textContent,
    modalClass: document.getElementById('project-media-modal')?.className,
    wrapClass: document.getElementById('player-wrap')?.className,
    currentSrc: (document.getElementById('player')?.currentSrc || '').slice(0, 40),
    hasBridge: typeof window.MAWE_EDITOR_BRIDGE,
  }));
  console.log('STATE:', JSON.stringify(state));
  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('CONSOLE_ERRS:', JSON.stringify(consoleErrs.slice(0, 5)));
});
