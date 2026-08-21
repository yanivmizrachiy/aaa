import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const SOURCE = 'https://pythagoras-runtime-cache.vercel.app';
const EXPECTED_SHA = '5c41e13b7d93fb63c138efa1b3508e5b6c2a5dbd2d122d2882a2aef7e1c38c2e';
const repoRoot = process.cwd();

function run(cmd, args, cwd = process.cwd()) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  if (result.status !== 0) throw new Error(`${cmd} failed with exit code ${result.status}`);
}
async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.text();
}
function findPackageRoot(root) {
  const direct = path.join(root, 'package.json');
  if (fs.existsSync(direct)) return root;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  throw new Error('package.json not found in extracted Pythagoras source');
}
function walkHtml(root, current = root, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walkHtml(root, full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(path.relative(root, full).replaceAll(path.sep, '/'));
  }
  return out;
}
function ensureRootIndex(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return;
  const html = walkHtml(distDir).filter((p) => p !== 'index.html');
  if (!html.length) throw new Error('Build produced no HTML files');
  const score = (p) => {
    const lower = p.toLowerCase();
    if (lower.endsWith('/workbook.html') || lower === 'workbook.html') return 0;
    if (/((^|\/)(page[-_ ]?0*1|0*1)(\/|$))/.test(lower)) return 1;
    if (lower.endsWith('/main.html') || lower === 'main.html') return 2;
    return 3;
  };
  html.sort((a, b) => score(a) - score(b) || a.localeCompare(b, 'en'));
  const target = html[0];
  const escaped = target.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  fs.writeFileSync(indexPath, `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${escaped}"><title>משפט פיתגורס</title></head><body><p><a href="${escaped}">פתיחת דפי משפט פיתגורס</a></p></body></html>`, 'utf8');
}
function enhanceHtml(distDir) {
  const css = `<style id="aaa-workbook-ui">:root{color-scheme:light;--aaa-ink:#12263f;--aaa-accent:#1f5f8b;--aaa-line:#d9e5ee;--aaa-paper:#fff}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}button,a,[role="button"],input,select,textarea{touch-action:manipulation}button,[role="button"],input[type="button"],input[type="submit"]{min-height:42px;border-radius:10px}input,select,textarea{max-width:100%;font:inherit}input:focus,select:focus,textarea:focus,button:focus-visible,a:focus-visible{outline:3px solid rgba(31,95,139,.28);outline-offset:2px}img,svg,canvas{max-width:100%;height:auto}.page,.worksheet,.sheet,[class*="page"],[class*="worksheet"]{box-sizing:border-box}@media(max-width:720px){body{overflow-x:hidden}.page,.worksheet,.sheet,[class*="page"],[class*="worksheet"]{max-width:100%!important;margin-inline:auto!important}button,[role="button"],input[type="button"],input[type="submit"]{min-height:46px}}@media print{html,body{background:#fff!important}button,[role="button"],nav,.toolbar,.controls,[class*="nav"],[class*="toolbar"]{box-shadow:none!important}*{animation:none!important;transition:none!important}}</style>`;
  let count = 0;
  for (const rel of walkHtml(distDir)) {
    const file = path.join(distDir, rel);
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes('id="aaa-workbook-ui"')) continue;
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${css}</head>`);
    else html = `${css}${html}`;
    fs.writeFileSync(file, html, 'utf8');
    count++;
  }
  console.log(`Enhanced ${count} HTML files for readability, mobile and print`);
}

const manifest = JSON.parse(await fetchText(`${SOURCE}/`));
if (manifest.archiveSha256 !== EXPECTED_SHA) throw new Error(`Runtime source changed unexpectedly: ${manifest.archiveSha256}`);
if (!Array.isArray(manifest.parts) || manifest.parts.length !== 51) throw new Error(`Expected 51 runtime source parts, got ${manifest.parts?.length ?? 'none'}`);
let base64 = '';
for (const part of manifest.parts) {
  const text = (await fetchText(`${SOURCE}/${encodeURIComponent(part.name)}`)).trim();
  if (text.length !== part.length) throw new Error(`${part.name}: expected ${part.length} chars, got ${text.length}`);
  base64 += text;
}
if (base64.length !== manifest.base64Length) throw new Error(`Base64 length mismatch: ${base64.length} != ${manifest.base64Length}`);
const archive = Buffer.from(base64, 'base64');
if (archive.length !== manifest.archiveBytes) throw new Error(`Archive size mismatch: ${archive.length} != ${manifest.archiveBytes}`);
const sha = crypto.createHash('sha256').update(archive).digest('hex');
if (sha !== EXPECTED_SHA) throw new Error(`Archive SHA mismatch: ${sha}`);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pythagoras-src-'));
const archivePath = path.join(tempRoot, 'source.tar.xz');
const sourceDir = path.join(tempRoot, 'source');
fs.mkdirSync(sourceDir);
fs.writeFileSync(archivePath, archive);
run('tar', ['-xJf', archivePath, '-C', sourceDir]);
const projectRoot = findPackageRoot(sourceDir);
if (!fs.existsSync(path.join(projectRoot, 'SOURCE_OF_TRUTH.md'))) throw new Error('SOURCE_OF_TRUTH.md missing from verified source');
run('npm', ['install', '--no-audit', '--no-fund'], projectRoot);
run('npm', ['run', 'build'], projectRoot);
const builtDist = path.join(projectRoot, 'dist');
if (!fs.existsSync(builtDist)) throw new Error('dist directory missing after build');
const targetDist = path.join(repoRoot, 'dist');
fs.rmSync(targetDist, { recursive: true, force: true });
fs.cpSync(builtDist, targetDist, { recursive: true });
ensureRootIndex(targetDist);
enhanceHtml(targetDist);
console.log(`Pythagoras production build ready from ${EXPECTED_SHA}`);
