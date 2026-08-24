#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const count = (text, re) => (text.match(re) || []).length;

for (const file of ['index.html','pythagoras-workbook.js','styles/workbook-download.css','styles/workbook-performance.css','SOURCE_OF_TRUTH.md']) {
  check(exists(file), `חסר קובץ UI/ביצועים: ${file}`);
}

if (exists('index.html')) {
  const html = read('index.html');
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gu)].map((m) => m[1]);
  const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  check(duplicateIds.length === 0, `index.html מכיל IDs כפולים: ${duplicateIds.join(', ')}`);
  check(count(html, /id=["']download-workbook["']/gu) === 1, 'חייב להיות בדיוק Download אחד בממשק.');
  check(count(html, /styles\/workbook-download\.css/gu) === 1, 'קובץ עיצוב Download חייב להיטען פעם אחת בלבד.');
  check(count(html, /styles\/workbook-performance\.css/gu) === 1, 'קובץ performance חייב להיטען פעם אחת בלבד.');
  check(/name=["']viewport["'][^>]*width=device-width/iu.test(html), 'viewport חייב להשתמש ב-width=device-width.');
  check(/href=["']pythagoras-workbook\.pdf["']/u.test(html), 'Download אינו מפנה ל-PDF המוכן.');
}

if (exists('pythagoras-workbook.js')) {
  const js = read('pythagoras-workbook.js');
  check(count(js, /\basync function boot\s*\(/gu) === 1, 'חייב להיות bootstrap אחד בלבד.');
  check(count(js, /\bfunction installNavigation\s*\(/gu) === 1, 'חייב להיות מנגנון ניווט אחד בלבד.');
  check(count(js, /\bfunction installResponsiveScaling\s*\(/gu) === 1, 'חייב להיות מנגנון responsive scaling אחד בלבד.');
  check(!js.includes('String(Date.now())'), 'אסור cache-buster חדש בכל טעינה; הוא מבטל reuse וגורם לבקשות מיותרות.');
  check(js.includes('backgroundLoad(requested)'), 'חסר מנגנון טעינת שאר הדפים ברקע.');
  check(js.includes('await ensurePage(requested)'), 'העמוד המבוקש חייב להיטען לפני הרקע.');
  check(js.includes('requestIdleCallback'), 'טעינת הרקע צריכה להידחות לזמן idle כאשר נתמך.');
  check(js.includes('saveData'), 'חסר התאמת עומס למצב חיסכון נתונים.');
}

if (exists('styles/workbook-performance.css')) {
  const css = read('styles/workbook-performance.css');
  check(css.includes('content-visibility:auto'), 'חסר content-visibility לגלילה מהירה.');
  check(css.includes('contain-intrinsic-size'), 'חסר intrinsic size ליציבות גלילה.');
  check(css.includes('data-load-state="pending"'), 'חסר placeholder לדפים שטרם נטענו.');
}

if (exists('styles/workbook-download.css')) {
  const css = read('styles/workbook-download.css');
  const h = Number(css.match(/\.download-action\{[\s\S]*?min-height:(\d+)px/u)?.[1] || 0);
  const w = Number(css.match(/\.download-action\{[\s\S]*?min-width:(\d+)px/u)?.[1] || 0);
  check(h >= 58, `Download קטן מדי בגובה: ${h}px.`);
  check(w >= 150, `Download קטן מדי ברוחב: ${w}px.`);
}

if (errors.length) {
  errors.forEach((e) => console.error(`✗ ${e}`));
  console.error(`\nUI/performance validation failed: ${errors.length} errors`);
  process.exit(1);
}
console.log('✓ UI/performance validation passed — no duplicate controls, fast-loading contract present.');
