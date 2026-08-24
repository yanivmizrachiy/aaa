#!/usr/bin/env node
'use strict';

const puppeteer = require('puppeteer-core');
const executablePath = process.env.CHROME_BIN;
if (!executablePath) throw new Error('CHROME_BIN is required');

const cases = [
  { name:'iPhone SE', width:320, height:568, ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' },
  { name:'iPhone 15 Pro', width:393, height:852, ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' },
  { name:'iPhone Pro Max', width:430, height:932, ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' },
  { name:'Android small', width:360, height:800, ua:'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36' },
  { name:'Android large', width:412, height:915, ua:'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36' },
  { name:'Tablet', width:768, height:1024, ua:'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/139.0 Safari/537.36' },
  { name:'Laptop', width:1366, height:768 },
  { name:'Desktop', width:1920, height:1080 },
];

(async () => {
  const browser = await puppeteer.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  try {
    for (const test of cases) {
      const page = await browser.newPage();
      await page.setViewport({ width:test.width, height:test.height, deviceScaleFactor:1 });
      if (test.ua) await page.setUserAgent(test.ua);
      await page.goto('http://127.0.0.1:8080/', { waitUntil:'domcontentloaded', timeout:60000 });
      await page.waitForSelector('.workbook-page-wrap[data-load-state="loaded"]', { timeout:30000 });
      const state = await page.evaluate(() => {
        const d = document.querySelector('#download-workbook');
        const r = d?.getBoundingClientRect();
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          download: r ? { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height } : null,
          text: d?.textContent?.replace(/\s+/g,' ').trim() || '',
          duplicateIds: duplicates,
          loaded: document.querySelectorAll('.workbook-page-wrap[data-load-state="loaded"]').length,
          pending: document.querySelectorAll('.workbook-page-wrap[data-load-state="pending"]').length,
        };
      });
      if (state.scrollWidth > state.clientWidth + 2) throw new Error(`${test.name}: horizontal overflow ${state.scrollWidth}/${state.clientWidth}`);
      if (!state.download) throw new Error(`${test.name}: Download missing`);
      if (state.download.left < -1 || state.download.right > state.clientWidth + 1) throw new Error(`${test.name}: Download clipped`);
      if (state.download.height < 55) throw new Error(`${test.name}: Download too small (${state.download.height}px)`);
      if (!state.text.includes('Download')) throw new Error(`${test.name}: Download text missing`);
      if (state.duplicateIds.length) throw new Error(`${test.name}: duplicate IDs ${state.duplicateIds.join(',')}`);

      await page.click('#next-page');
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '2', { timeout:5000 });
      await page.click('#prev-page');
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '1', { timeout:5000 });
      console.log(`✓ ${test.name} ${test.width}x${test.height} — loaded=${state.loaded}, pending=${state.pending}, no overflow`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
