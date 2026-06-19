// Drive Chrome via CDP without puppeteer — pure Node.
// Usage: node shoot.cjs <url> <out.png> [waitMs]
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

const url = process.argv[2];
const outPng = process.argv[3];
const waitMs = parseInt(process.argv[4] || '5000', 10);
const width = parseInt(process.argv[5] || '1280', 10);
const height = parseInt(process.argv[6] || '800', 10);

const chrome = '"C:/Program Files/Google/Chrome/Application/chrome.exe"';
const profileDir = path.join(require('os').tmpdir(), 'promptly-shoot-' + Date.now());

// Pick a free port
function pickPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

(async () => {
  const port = await pickPort();
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ];
  const child = spawn(chrome, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => stderr += d.toString());

  // Wait for /json/version to respond
  async function getJson(p) {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}${p}`, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.setTimeout(2000, () => req.destroy(new Error('timeout')));
    });
  }

  let info;
  for (let i = 0; i < 40; i++) {
    try { info = await getJson('/json/version'); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); }
  }
  if (!info) {
    console.error('Chrome did not start:', stderr.split('\n').slice(0, 10).join('\n'));
    child.kill();
    process.exit(1);
  }
  const wsUrl = info.webSocketDebuggerUrl;

  const WebSocket = await (async () => {
    try { return require('ws'); } catch { return null; }
  })();
  if (!WebSocket) {
    console.error('ws module missing — install with: npm install ws (or rely on puppeteer-core)');
    child.kill();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let id = 0;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  }

  // In headless mode we already have one implicit target (about:blank).
  // Attach to the browser-level session and use it for Page/Runtime.
  const sessionId = info.webSocketDebuggerUrl; // not used; use the browser session
  function sendS(method, params) {
    return new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  }
  // Get the list of targets and attach to the first page target
  const targets = await send('Target.getTargets');
  const pageTarget = targets.targetInfos.find(t => t.type === 'page');
  if (!pageTarget) {
    console.error('No page target found');
    child.kill();
    process.exit(1);
  }
  const att = await send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });
  const ssid = att.sessionId;
  function sendT(method, params) {
    return new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ sessionId: ssid, id: i, method, params }));
    });
  }

  await sendS('Page.enable');
  await sendS('Runtime.enable');
  await sendS('Network.enable');
  await sendS('Page.navigate', { url });
  // Wait for load + extra settle time
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, waitMs + 2000);
    sendS('Page.loadEventFired').then(() => { clearTimeout(timer); resolve(); }).catch(() => { clearTimeout(timer); resolve(); });
  });
  await new Promise(r => setTimeout(r, waitMs));

  // Pull some text to confirm it's not blank
  const ev = await sendS('Runtime.evaluate', {
    expression: 'document.body && document.body.innerText.slice(0, 400)',
    returnByValue: true,
  });
  console.log('PAGE_TEXT:', JSON.stringify(ev.result?.value || ''));

  const shot = await sendS('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
  console.log('SAVED:', outPng, fs.statSync(outPng).size, 'bytes');

  ws.close();
  child.kill();
  process.exit(0);
})().catch(err => {
  console.error('FAILED:', err && err.stack || err);
  process.exit(1);
});
