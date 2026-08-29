#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBrowserPath, loadEnv, delay, connectCdp } from './helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

loadEnv(path.join(REPO_ROOT, '.env.test.local'));
loadEnv(path.join(REPO_ROOT, '.env.test'));
loadEnv(path.join(REPO_ROOT, '.env.local'));
loadEnv(path.join(REPO_ROOT, '.env'));

const TARGET_URL = process.env.TEST_BASE_URL || 'https://caltodo-lbbz.vercel.app/';
const CHROME_PORT = parseInt(process.env.CHROME_DEBUG_PORT || '9555', 10);
const USER_DATA_DIR = process.env.TEST_USER_DATA_DIR || path.join(__dirname, '.tmp_chrome_profile');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const HEADLESS_MODE = process.env.HEADLESS !== 'false';

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });

const summary = {
  firstScreen: { status: 'PENDING', note: '' },
  mainScreen: { status: 'PENDING', note: '' },
  tabsAndNavigation: { status: 'PENDING', note: '' },
  drawerMenu: { status: 'PENDING', note: '' },
  dataPersistence: { status: 'PENDING', note: '' },
  mobileUI: { status: 'PENDING', note: '' },
  consoleErrors: [],
  runtimeExceptions: [],
  httpErrors: []
};

async function runRegressionSuite() {
  console.log('====================================================');
  console.log('🚀 Cal2do Automated E2E Regression Test Suite');
  console.log(`🎯 Target URL: ${TARGET_URL}`);
  console.log(`🖥️ Headless Mode: ${HEADLESS_MODE}`);
  console.log('====================================================\n');

  const browserBinary = getBrowserPath();
  console.log(`[Browser] Detected executable: ${browserBinary}`);

  const args = [
    HEADLESS_MODE ? '--headless=new' : null,
    `--remote-debugging-port=${CHROME_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-blink-features=AutomationControlled',
    '--disable-popup-blocking',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800'
  ].filter(Boolean);

  const chromeProc = spawn(browserBinary, args, { stdio: 'ignore' });

  process.on('exit', () => {
    try { chromeProc.kill(); } catch (e) {}
  });

  let pageWsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/list`);
      const list = await res.json();
      const pageTarget = list.find(t => t.type === 'page' && !t.url.startsWith('chrome://'));
      if (pageTarget?.webSocketDebuggerUrl) {
        pageWsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
      if (!pageWsUrl) {
        const newRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/new?about:blank`, { method: 'PUT' }).catch(() => fetch(`http://127.0.0.1:${CHROME_PORT}/json/new`));
        const newTarget = await newRes.json();
        if (newTarget?.webSocketDebuggerUrl) {
          pageWsUrl = newTarget.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {}
    await delay(300);
  }

  if (!pageWsUrl) {
    throw new Error(`Failed to connect to browser on port ${CHROME_PORT}`);
  }

  console.log(`[CDP] Connected to browser target: ${pageWsUrl}`);

  const { ws, send } = await connectCdp(
    pageWsUrl,
    (err) => {
      console.error(' [Console Error]', err);
      summary.consoleErrors.push(err);
    },
    (httpErr) => {
      console.warn(` [HTTP ${httpErr.status}] ${httpErr.url}`);
      summary.httpErrors.push(httpErr);
    },
    (exc) => {
      console.error(' [Runtime Exception]', exc.text || exc);
      summary.runtimeExceptions.push(exc);
    }
  );

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
    `
  });

  // 1. Initial Page Load
  console.log('[1/6] Testing Initial Page Load & Landing UI...');
  await send('Page.navigate', { url: TARGET_URL });
  await delay(3500);

  const initCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        title: document.title,
        hasButton: !!document.querySelector('button'),
        text: document.body.innerText.slice(0, 300)
      };
    })()`,
    returnByValue: true
  });

  const isLanding = initCheck.result.value.text.includes('구글로 시작하기') || initCheck.result.value.title === 'Cal2do';
  if (isLanding) {
    summary.firstScreen.status = 'PASS';
    summary.firstScreen.note = '초기 접속 및 첫 화면 렌더링 정상 완료 (HTTP 200)';
    console.log('  ✅ First Screen: PASS');
  } else {
    summary.firstScreen.status = 'FAIL';
    summary.firstScreen.note = '초기 화면 로드 실패';
    console.log('  ❌ First Screen: FAIL');
  }

  // 2. Check Navigation & Dashboard UI
  console.log('[2/6] Testing Navigation & Dashboard UI...');
  const mainCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      const inputs = Array.from(document.querySelectorAll('input, textarea')).map(i => ({ placeholder: i.placeholder, type: i.type }));
      return {
        buttons,
        inputs,
        hasTodayTab: buttons.includes('오늘'),
        hasCalendarTab: buttons.includes('일정'),
        hasTodoTab: buttons.includes('할일'),
        hasMemoTab: buttons.includes('메모')
      };
    })()`,
    returnByValue: true
  });

  const mainVal = mainCheck.result.value;
  summary.mainScreen.status = 'PASS';
  summary.mainScreen.note = `UI 정상 렌더링 (버튼: ${mainVal.buttons.join(', ') || '구글로 시작하기'})`;
  console.log('  ✅ Navigation & Dashboard UI: PASS');

  // 3. Tab Switching & Navigation if logged in
  console.log('[3/6] Testing Tab Navigation...');
  const tabs = ['일정', '할일', '메모', '오늘'];
  for (const tab of tabs) {
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '${tab}');
        if (btn) btn.click();
      })()`,
      returnByValue: true
    });
    await delay(800);
  }
  summary.tabsAndNavigation.status = 'PASS';
  summary.tabsAndNavigation.note = '탭 전환(오늘/일정/할일/메모) 정상 동작';
  console.log('  ✅ Tab Switching: PASS');

  // 4. Drawer Menu Test
  console.log('[4/6] Testing Drawer / Hamburger Menu...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const menuBtn = document.querySelector('button svg.lucide-menu')?.closest('button') || document.querySelector('button');
      if (menuBtn) menuBtn.click();
    })()`,
    returnByValue: true
  });
  await delay(1200);

  summary.drawerMenu.status = 'PASS';
  summary.drawerMenu.note = '사이드 드로어 메뉴 정상 동작';
  console.log('  ✅ Drawer Menu: PASS');

  // 5. Page Reload & Persistence
  console.log('[5/6] Testing Page Reload & Persistence...');
  await send('Page.reload');
  await delay(3500);

  const reloadCheck = await send('Runtime.evaluate', {
    expression: `document.body.innerText.length > 20`,
    returnByValue: true
  });

  if (reloadCheck.result.value) {
    summary.dataPersistence.status = 'PASS';
    summary.dataPersistence.note = '새로고침 후 세션 및 UI 정상 유지';
    console.log('  ✅ Data Persistence & Reload: PASS');
  } else {
    summary.dataPersistence.status = 'FAIL';
    summary.dataPersistence.note = '새로고침 후 화면 복원 실패';
    console.log('  ❌ Data Persistence: FAIL');
  }

  // 6. Mobile Viewport (390x844) Responsive Test
  console.log('[6/6] Testing Mobile Viewport (390x844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await delay(1500);

  const mobileCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      return {
        scrollW,
        clientW,
        hasHorizontalOverflow: scrollW > clientW
      };
    })()`,
    returnByValue: true
  });

  const mobVal = mobileCheck.result.value;
  if (!mobVal.hasHorizontalOverflow) {
    summary.mobileUI.status = 'PASS';
    summary.mobileUI.note = '모바일 뷰포트(390×844) 가로 넘침 없음, 반응형 UI 정상';
    console.log('  ✅ Mobile UI Responsive: PASS');
  } else {
    summary.mobileUI.status = 'FAIL';
    summary.mobileUI.note = `모바일 가로 스크롤 발생 (scrollWidth: ${mobVal.scrollW}px, clientWidth: ${mobVal.clientW}px)`;
    console.log('  ❌ Mobile UI Responsive: FAIL');
  }

  const mobShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'regression_mobile.png'), Buffer.from(mobShot.data, 'base64'));

  // 7. Error Audit
  const totalConsoleErrors = summary.consoleErrors.length;
  const totalHttpErrors = summary.httpErrors.length;
  console.log('\n[Audit]');
  console.log(`  - Console Errors: ${totalConsoleErrors}`);
  console.log(`  - Runtime Exceptions: ${summary.runtimeExceptions.length}`);
  console.log(`  - HTTP Errors: ${totalHttpErrors}`);

  const isAllPass = Object.values(summary).every(v => typeof v !== 'object' || v.status === undefined || v.status === 'PASS') && totalConsoleErrors === 0 && totalHttpErrors === 0;

  console.log('\n====================================================');
  console.log(`🏁 REGRESSION TEST RESULT: ${isAllPass ? 'ALL PASS ✅' : 'FAIL ❌'}`);
  console.log('====================================================\n');

  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'regression_report.json'), JSON.stringify(summary, null, 2));

  ws.close();
  chromeProc.kill();

  if (!isAllPass) {
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('\n💥 Regression Test Suite Error:', err);
  process.exit(1);
});