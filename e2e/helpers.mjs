import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function getBrowserPath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const platform = os.platform();
  if (platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null
    ].filter(Boolean);
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  throw new Error('Chrome/Chromium executable not found. Please set CHROME_PATH environment variable in .env.test or system environment.');
}

export function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function connectCdp(wsUrl, onConsoleError, onHttpError, onRuntimeException) {
  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    } else if (msg.method) {
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = msg.params.args.map(a => a.value ?? JSON.stringify(a)).join(' ');
        onConsoleError?.(text);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        onRuntimeException?.(msg.params.exceptionDetails);
      } else if (msg.method === 'Network.responseReceived') {
        const res = msg.params.response;
        if (res.status >= 400 && !res.url.includes('favicon')) {
          onHttpError?.({ url: res.url, status: res.status });
        }
      }
    }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  await new Promise(r => ws.onopen = r);
  return { ws, send };
}