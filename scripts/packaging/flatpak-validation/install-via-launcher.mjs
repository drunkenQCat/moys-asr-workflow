import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const feature = process.argv[2];
assert(['ocr', 'local'].includes(feature));
const readyEvent = `${feature}RuntimeReady`;
const errorCode = `${feature}_runtime_install_failed`;

let target;
for (let attempt = 0; attempt < 120; attempt += 1) {
  try {
    const response = await fetch('http://127.0.0.1:9222/json/list', { signal: AbortSignal.timeout(1000) });
    target = (await response.json()).find((page) => page.type === 'page' && page.url.includes('launcher'));
    if (target) break;
  } catch {
    // The Launcher may still be starting.
  }
  await delay(500);
}
assert(target, 'Launcher did not expose a page on the loopback test endpoint');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
function evaluate(expression) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener('message', onMessage);
      const failure = message.error ?? message.result.exceptionDetails;
      if (failure) reject(new Error(JSON.stringify(failure)));
      else resolve(message.result.result.value);
    }
    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
}

try {
  let real = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    real = await evaluate('window.MAWLauncher?.backend === "real"');
    if (real) break;
    await delay(500);
  }
  assert(real, 'Launcher did not connect to its real backend');

  const result = await evaluate(`new Promise(async (resolve) => {
    const launcher = window.MAWLauncher;
    const method = ${JSON.stringify(`get_${feature}_runtime`)};
    const before = await launcher.callBackend(method);
    if (!before.ok || before.status !== 'missing') return resolve({ before });
    const original = launcher.onBackendEvents;
    launcher.onBackendEvents = function (events) {
      for (const event of events) {
        if (event.type === ${JSON.stringify(readyEvent)} || event.code === ${JSON.stringify(errorCode)}) resolve(event);
      }
      original.call(this, events);
    };
    const started = await launcher.callBackend(${JSON.stringify(`install_${feature}_runtime`)});
    if (!started.ok || !started.installing) resolve({ started });
  })`);
  console.log(JSON.stringify(result));
  assert.equal(result.type, readyEvent);
  assert.equal(result.runtime.ready, true);
} finally {
  socket.close();
}
