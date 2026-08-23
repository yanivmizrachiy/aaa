const BUILD_VERSION = String(Date.now());
const MANIFEST_URL = 'WORKBOOK_MANIFEST.json';
const workbookRoot = document.querySelector('#workbook');
const toolbar = document.querySelector('.workbook-toolbar');
const statusEl = document.querySelector('#workbook-status');
const jumpInput = document.querySelector('#page-jump');
const pageTotalLabel = document.querySelector('#page-total-label');
const progressBar = document.querySelector('#workbook-progress-bar');
const prevButton = document.querySelector('#prev-page');
const nextButton = document.querySelector('#next-page');
const printButton = document.querySelector('#print-workbook');
const workbookCss = [...document.querySelectorAll('link[rel="stylesheet"]')]
  .find((link) => new URL(link.href, document.baseURI).pathname.endsWith('/styles/pythagoras-workbook.css'));
const stylesheetPromises = new Map();

const isAppleMobile = /iPhone|iPad|iPod/u.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const lowPowerDevice = Number(navigator.deviceMemory || 8) <= 4
  || Number(navigator.hardwareConcurrency || 8) <= 4;

let totalPages = 0;
let activePage = 1;
let loadedPages = 0;
let failedPages = 0;
let refitPages = () => {};

const pageId = (local) => `workbook-page-${local}`;
const sourceFile = (pageMeta) => pageMeta.file;
const cssFile = (pageMeta) => `styles/pages/${pageMeta.file.replace(/\.html$/u, '.css')}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const versioned = (href) => {
  const url = new URL(href, document.baseURI);
  url.searchParams.set('v', BUILD_VERSION);
  return url.href;
};

async function fetchWithRetry(href, options = {}, attempts = 3) {
  const url = versioned(href);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: 'no-store', ...options });
      if (response.ok) return response;
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      const error = new Error(`${response.status} ${response.statusText}`);
      if (!retryable || attempt === attempts) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
    await delay(220 * attempt);
  }
  throw lastError || new Error(`טעינת ${href} נכשלה`);
}

function loadStylesheetOnce(href, absolute) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = absolute;
    link.dataset.workbookCss = href;
    link.addEventListener('load', () => {
      link.dataset.loaded = 'true';
      resolve(link);
    }, { once: true });
    link.addEventListener('error', () => {
      link.remove();
      reject(new Error(`טעינת CSS נכשלה: ${href}`));
    }, { once: true });
    if (workbookCss) workbookCss.before(link);
    else document.head.append(link);
  });
}

function addStylesheet(href) {
  const absolute = versioned(href);
  if (stylesheetPromises.has(absolute)) return stylesheetPromises.get(absolute);
  const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find((link) => link.href === absolute && link.dataset.loaded === 'true');
  if (existing) return Promise.resolve(existing);

  const promise = (async () => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await loadStylesheetOnce(href, absolute);
      } catch (error) {
        lastError = error;
        if (attempt < 3) await delay(180 * attempt);
      }
    }
    throw lastError;
  })();

  stylesheetPromises.set(absolute, promise);
  promise.catch(() => stylesheetPromises.delete(absolute));
  return promise;
}

function namespaceSvgIds(root, prefix) {
  const idMap = new Map();
  for (const el of root.querySelectorAll('[id]')) {
    const oldId = el.id;
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    el.id = newId;
  }
  if (!idMap.size) return;
  const urlRefAttrs = ['href', 'xlink:href', 'fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end'];
  const tokenRefAttrs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'headers'];
  const singleRefAttrs = ['for', 'form', 'list', 'aria-activedescendant', 'aria-details', 'aria-errormessage'];
  for (const el of root.querySelectorAll('*')) {
    for (const attr of urlRefAttrs) {
      if (!el.hasAttribute(attr)) continue;
      let value = el.getAttribute(attr);
      for (const [oldId, newId] of idMap) value = value.replaceAll(`#${oldId}`, `#${newId}`);
      el.setAttribute(attr, value);
    }
    for (const attr of tokenRefAttrs) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr).split(/\s+/u).map((id) => idMap.get(id) ?? id).join(' ');
      el.setAttribute(attr, value);
    }
    for (const attr of singleRefAttrs) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr);
      el.setAttribute(attr, idMap.get(value) ?? value);
    }
  }
}

function normalizePage(main, pageMeta, total) {
  const sourceNumber = pageMeta.sourceNumber ?? pageMeta.number;
  const localNumber = pageMeta.workbookNumber;
  main.classList.add('pythagoras', 'pythagoras-workbook-page');
  main.dataset.sourcePage = String(sourceNumber);
  main.dataset.workbookPage = String(localNumber);
  main.dataset.primaryTopic = pageMeta.primaryTopic || 'משפט פיתגורס';
  main.setAttribute('aria-label', `משפט פיתגורס — עמוד ${localNumber} מתוך ${total}`);
  const visibleNumber = main.querySelector('.page-number');
  if (visibleNumber) visibleNumber.textContent = String(localNumber);
  namespaceSvgIds(main, `pyt-${localNumber}`);
  return main;
}

function updateLoadStatus(total) {
  if (failedPages > 0) statusEl.textContent = `${loadedPages} / ${total} דפים נטענו · ${failedPages} נכשלו`;
  else statusEl.textContent = `${loadedPages} / ${total} דפים נטענו`;
}

function updateNavigationDisplay(page) {
  if (pageTotalLabel) pageTotalLabel.textContent = `מתוך ${totalPages || 53}`;
  if (progressBar) {
    const progress = totalPages ? Math.max(0, Math.min(100, (page / totalPages) * 100)) : 0;
    progressBar.style.width = `${progress}%`;
  }
}

function installToolbarOffset() {
  const sync = () => {
    const height = toolbar?.getBoundingClientRect().height ?? 0;
    document.documentElement.style.setProperty('--pythagoras-toolbar-offset', `${Math.ceil(height + 8)}px`);
  };
  sync();
  if (!toolbar) return;
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(sync);
    observer.observe(toolbar);
  } else window.addEventListener('resize', sync, { passive: true });
}

function unlockWorkbookActions() {
  jumpInput.disabled = false;
  printButton.disabled = failedPages > 0;
}

async function loadSourcePage(pageMeta, total, wrapper) {
  const localNumber = pageMeta.workbookNumber;
  const htmlFile = sourceFile(pageMeta);
  try {
    await addStylesheet(cssFile(pageMeta));
    const response = await fetchWithRetry(htmlFile);
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const sourceMain = parsed.querySelector('main.a4-page');
    if (!sourceMain) throw new Error('לא נמצא main.a4-page');
    const main = document.importNode(sourceMain, true);
    normalizePage(main, pageMeta, total);
    wrapper.replaceChildren(main);
    wrapper.dataset.loadState = 'loaded';
    loadedPages += 1;
    updateLoadStatus(total);
    return true;
  } catch (error) {
    failedPages += 1;
    wrapper.dataset.loadState = 'failed';
    const message = document.createElement('div');
    message.className = 'workbook-error';
    message.setAttribute('role', 'alert');
    message.textContent = `שגיאה בטעינת עמוד ${localNumber}. רעננו את הדף; המערכת כבר ניסתה לטעון אותו מחדש אוטומטית.`;
    wrapper.replaceChildren(message);
    updateLoadStatus(total);
    console.error(`Pythagoras workbook page ${localNumber} failed`, error);
    return false;
  }
}

async function runPool(tasks, concurrency = 4) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (next < tasks.length) {
      const taskIndex = next;
      next += 1;
      await tasks[taskIndex]();
    }
  });
  await Promise.all(workers);
}

function syncUrlPage(localNumber) {
  const url = new URL(location.href);
  url.searchParams.set('page', String(localNumber));
  history.replaceState(null, '', url);
}

function setActivePage(localNumber, { syncUrl = false } = {}) {
  if (!totalPages) return 1;
  const numeric = Number(localNumber);
  const integer = Number.isFinite(numeric) ? Math.trunc(numeric) : 1;
  const target = Math.max(1, Math.min(totalPages, integer || 1));
  activePage = target;
  jumpInput.value = String(target);
  prevButton.disabled = target <= 1;
  nextButton.disabled = target >= totalPages;
  updateNavigationDisplay(target);
  if (syncUrl) syncUrlPage(target);
  return target;
}

function goToPage(localNumber, behavior = 'smooth') {
  if (!totalPages) return;
  const target = setActivePage(localNumber, { syncUrl: true });
  document.getElementById(pageId(target))?.scrollIntoView({ behavior, block: 'start' });
}

function installNavigation() {
  jumpInput.max = String(totalPages);
  setActivePage(1);
  prevButton.addEventListener('click', () => goToPage(activePage - 1));
  nextButton.addEventListener('click', () => goToPage(activePage + 1));
  jumpInput.addEventListener('change', () => goToPage(jumpInput.value));
  jumpInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      jumpInput.blur();
      goToPage(jumpInput.value);
    }
  });
  printButton.addEventListener('click', () => window.print());
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const local = Number(visible.target.dataset.localPage);
    if (Number.isFinite(local) && local !== activePage) setActivePage(local, { syncUrl: true });
  }, { threshold: [0.25, 0.5, 0.75] });
  for (const wrapper of document.querySelectorAll('.workbook-page-wrap')) observer.observe(wrapper);
}

function installResponsiveScaling() {
  let frame = 0;
  const canZoom = !isAppleMobile && typeof CSS !== 'undefined' && CSS.supports?.('zoom', '0.5');

  const layoutViewportWidth = () => Math.max(
    1,
    Math.floor(document.documentElement.clientWidth || window.innerWidth || 1),
  );

  const resetPage = (wrapper, page) => {
    wrapper.style.width = '';
    wrapper.style.maxWidth = '';
    wrapper.style.height = '';
    wrapper.style.marginInline = '';
    wrapper.style.overflow = '';
    page.style.zoom = '';
    page.style.position = '';
    page.style.left = '';
    page.style.right = '';
    page.style.top = '';
    page.style.marginLeft = '';
    page.style.transform = '';
    page.style.removeProperty('transform-origin');
  };

  const fitPages = () => {
    frame = 0;
    const viewWidth = layoutViewportWidth();
    const mobile = viewWidth <= 720;
    document.body.classList.toggle('mobile-print-preview', mobile);
    document.body.classList.remove('mobile-reader');

    for (const wrapper of document.querySelectorAll('.workbook-page-wrap')) {
      const page = wrapper.querySelector('.a4-page');
      if (!page) continue;
      resetPage(wrapper, page);

      const parentWidth = Math.max(1, wrapper.parentElement?.getBoundingClientRect().width || viewWidth);
      const available = Math.max(1, Math.min(parentWidth - 12, viewWidth - 12));
      const canonicalWidth = page.offsetWidth;
      const canonicalHeight = page.offsetHeight;
      if (!canonicalWidth || !canonicalHeight) continue;

      const scale = Math.min(1, available / canonicalWidth);
      const scaledWidth = Math.floor(canonicalWidth * scale * 1000) / 1000;
      const scaledHeight = Math.floor(canonicalHeight * scale * 1000) / 1000;

      wrapper.style.width = `${scaledWidth}px`;
      wrapper.style.maxWidth = 'calc(100vw - 12px)';
      wrapper.style.marginInline = 'auto';
      wrapper.style.overflow = 'visible';

      page.style.marginLeft = '0';
      page.style.left = '0';
      page.style.right = 'auto';
      page.style.top = '0';

      if (scale >= 0.999) {
        wrapper.style.height = 'auto';
        page.style.position = 'relative';
        continue;
      }

      if (canZoom) {
        wrapper.style.height = 'auto';
        page.style.position = 'relative';
        page.style.transform = 'none';
        page.style.setProperty('transform-origin', 'top left', 'important');
        page.style.zoom = String(scale);
      } else {
        wrapper.style.height = `${scaledHeight}px`;
        page.style.position = 'absolute';
        page.style.zoom = '';
        page.style.setProperty('transform-origin', 'top left', 'important');
        page.style.transform = `scale(${scale})`;
      }
    }
  };

  const scheduleFit = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fitPages);
  };

  const resetForPrint = () => {
    document.body.classList.remove('mobile-print-preview', 'mobile-reader');
    for (const wrapper of document.querySelectorAll('.workbook-page-wrap')) {
      const page = wrapper.querySelector('.a4-page');
      if (page) resetPage(wrapper, page);
    }
  };

  window.addEventListener('resize', scheduleFit, { passive: true });
  window.addEventListener('orientationchange', scheduleFit, { passive: true });
  window.addEventListener('beforeprint', resetForPrint);
  window.addEventListener('afterprint', scheduleFit);
  refitPages = scheduleFit;
  fitPages();
}

async function typesetMathInBatches() {
  if (window.MathJax?.startup?.promise) await window.MathJax.startup.promise;
  if (!window.MathJax?.typesetPromise) return;
  const wrappers = [...document.querySelectorAll('.workbook-page-wrap[data-load-state="loaded"]')];
  const batchSize = isAppleMobile || lowPowerDevice ? 3 : 6;
  for (let index = 0; index < wrappers.length; index += batchSize) {
    const batch = wrappers.slice(index, index + batchSize);
    await window.MathJax.typesetPromise(batch);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function validateManifest(manifest) {
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : [];
  if (!pages.length) throw new Error('WORKBOOK_MANIFEST.json אינו מכיל דפים.');
  const declared = Number(manifest?.totalPages);
  if (declared && declared !== pages.length) {
    throw new Error(`WORKBOOK_MANIFEST.json: totalPages (${declared}) אינו תואם למספר הדפים בפועל (${pages.length}).`);
  }
  const files = new Set();
  return pages.map((page, index) => {
    if (!page?.file || typeof page.file !== 'string') throw new Error(`חסר file לעמוד ${index + 1} במניפסט`);
    if (files.has(page.file)) throw new Error(`קובץ כפול במניפסט: ${page.file}`);
    files.add(page.file);
    return {
      ...page,
      workbookNumber: index + 1,
      sourceNumber: page.sourceNumber ?? page.number,
      primaryTopic: page.primaryTopic || 'משפט פיתגורס',
    };
  });
}

async function boot() {
  const manifestResponse = await fetchWithRetry(MANIFEST_URL, { cache: 'no-store' });
  const manifest = await manifestResponse.json();
  const pages = validateManifest(manifest);
  totalPages = pages.length;
  loadedPages = 0;
  failedPages = 0;
  const eyebrow = document.querySelector('.workbook-eyebrow');
  if (eyebrow) eyebrow.textContent = `חוברת דיגיטלית · ${totalPages} דפים`;
  updateNavigationDisplay(1);
  statusEl.textContent = `0 / ${totalPages} דפים נטענו`;

  const requestedRaw = Number(new URL(location.href).searchParams.get('page')) || 1;
  const requested = Math.max(1, Math.min(totalPages, Math.trunc(requestedRaw)));
  const jobs = [];

  for (const pageMeta of pages) {
    const localNumber = pageMeta.workbookNumber;
    const wrapper = document.createElement('section');
    wrapper.className = 'workbook-page-wrap';
    wrapper.id = pageId(localNumber);
    wrapper.dataset.localPage = String(localNumber);
    wrapper.dataset.sourcePage = String(pageMeta.sourceNumber);
    workbookRoot.append(wrapper);
    jobs.push({
      priority: Math.abs(localNumber - requested),
      task: () => loadSourcePage(pageMeta, totalPages, wrapper),
    });
  }

  jobs.sort((a, b) => a.priority - b.priority);
  const concurrency = isAppleMobile ? 2 : (lowPowerDevice ? 3 : 5);
  await runPool(jobs.map((job) => job.task), concurrency);
  await typesetMathInBatches();
  unlockWorkbookActions();
  installToolbarOffset();
  installNavigation();
  installResponsiveScaling();
  refitPages();

  statusEl.textContent = failedPages > 0
    ? `${loadedPages} / ${totalPages} דפים נטענו · ${failedPages} נכשלו`
    : `${totalPages} דפים · חוברת מלאה`;
  requestAnimationFrame(() => goToPage(requested, 'auto'));
}

boot().catch((error) => {
  statusEl.textContent = 'טעינת החוברת נכשלה';
  const message = document.createElement('div');
  message.className = 'workbook-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'החוברת לא נטענה במלואה. רעננו את הדף ונסו שוב.';
  workbookRoot.prepend(message);
  console.error(error);
});
