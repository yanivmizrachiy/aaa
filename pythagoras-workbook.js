const BUILD_VERSION = '20260824-fast-runtime-3';
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

const isAppleMobile = /iPhone|iPad|iPod/u.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const lowPowerDevice = Number(navigator.deviceMemory || 8) <= 4
  || Number(navigator.hardwareConcurrency || 8) <= 4;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const saveData = Boolean(connection?.saveData);

const stylesheetPromises = new Map();
const loadPromises = new Map();
let pageMetas = [];
let totalPages = 0;
let activePage = 1;
let loadedPages = 0;
let failedPages = 0;
let refitPages = () => {};
let mathQueue = Promise.resolve();
let navigationInstalled = false;
let lazyObserver = null;

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
      const response = await fetch(url, { cache: 'default', ...options });
      if (response.ok) return response;
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      const error = new Error(`${response.status} ${response.statusText}`);
      if (!retryable || attempt === attempts) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
    await delay(140 * attempt);
  }
  throw lastError || new Error(`טעינת ${href} נכשלה`);
}

function loadStylesheetOnce(href, absolute) {
  return new Promise((resolve, reject) => {
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find((link) => link.href === absolute);
    if (existing) {
      if (existing.sheet) return resolve(existing);
      existing.addEventListener('load', () => resolve(existing), { once: true });
      existing.addEventListener('error', () => reject(new Error(`טעינת CSS נכשלה: ${href}`)), { once: true });
      return;
    }

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
  const promise = (async () => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await loadStylesheetOnce(href, absolute);
      } catch (error) {
        lastError = error;
        if (attempt < 3) await delay(120 * attempt);
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

function updateLoadStatus() {
  if (failedPages > 0) statusEl.textContent = `${loadedPages} / ${totalPages} דפים נטענו · ${failedPages} נכשלו`;
  else if (loadedPages < totalPages) statusEl.textContent = `${loadedPages} / ${totalPages} דפים נטענו · אפשר להמשיך לגלול`;
  else statusEl.textContent = `${totalPages} דפים · חוברת מלאה`;
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
  } else {
    window.addEventListener('resize', sync, { passive: true });
  }
}

// Once MathJax's async engine is proven to stall in this environment we stop trusting it.
let mathAsyncBroken = false;

function typesetSync(wrapper) {
  const MJ = window.MathJax;
  try { MJ.typesetClear?.([wrapper]); } catch (error) { /* clearing is best-effort */ }
  MJ.typeset([wrapper]);
}

function queueTypeset(wrapper) {
  if (!wrapper || wrapper.dataset.mathState === 'ready' || wrapper.dataset.mathState === 'queued') return mathQueue;
  wrapper.dataset.mathState = 'queued';
  mathQueue = mathQueue.then(async () => {
    if (window.MathJax?.startup?.promise) await window.MathJax.startup.promise;
    const MJ = window.MathJax;
    if (!MJ) { wrapper.dataset.mathState = 'failed'; return; }
    // Async typeset first (non-blocking, chunked) — but never let it hang the booklet.
    // MathJax 4's async path can throw an internal retryAfter() to lazily load a font
    // range; when the booklet is framed through a same-origin embed proxy that load can
    // never settle, so typesetPromise stays pending forever and — because MathJax
    // serializes internally — every later page deadlocks too (raw \(…\) on the page).
    // The moment async is proven stuck we mark it broken and render synchronously, which
    // draws from the already-loaded base font and always completes. See SOURCE_OF_TRUTH §16.
    if (mathAsyncBroken || !MJ.typesetPromise) {
      if (MJ.typeset) typesetSync(wrapper);
    } else {
      let settled = false;
      MJ.typesetPromise([wrapper]).then(() => { settled = true; }, () => { settled = true; });
      await Promise.race([
        new Promise((resolve) => {
          const check = () => (settled ? resolve() : setTimeout(check, 60));
          check();
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      if (!settled && MJ.typeset) { mathAsyncBroken = true; typesetSync(wrapper); }
    }
    wrapper.dataset.mathState = 'ready';
    requestAnimationFrame(refitPages);
  }).catch((error) => {
    wrapper.dataset.mathState = 'failed';
    console.warn('MathJax page typeset failed', error);
  });
  return mathQueue;
}

async function loadSourcePage(pageMeta, wrapper) {
  const localNumber = pageMeta.workbookNumber;
  const htmlFile = sourceFile(pageMeta);
  try {
    const [, response] = await Promise.all([
      addStylesheet(cssFile(pageMeta)),
      fetchWithRetry(htmlFile),
    ]);
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const sourceMain = parsed.querySelector('main.a4-page');
    if (!sourceMain) throw new Error('לא נמצא main.a4-page');

    const main = document.importNode(sourceMain, true);
    normalizePage(main, pageMeta, totalPages);
    wrapper.replaceChildren(main);
    wrapper.dataset.loadState = 'loaded';
    wrapper.removeAttribute('aria-busy');
    loadedPages += 1;
    updateLoadStatus();
    queueTypeset(wrapper);
    requestAnimationFrame(refitPages);
    return true;
  } catch (error) {
    failedPages += 1;
    wrapper.dataset.loadState = 'failed';
    wrapper.removeAttribute('aria-busy');
    const message = document.createElement('div');
    message.className = 'workbook-error';
    message.setAttribute('role', 'alert');
    message.textContent = `שגיאה בטעינת עמוד ${localNumber}. רעננו את הדף ונסו שוב.`;
    wrapper.replaceChildren(message);
    updateLoadStatus();
    console.error(`Pythagoras workbook page ${localNumber} failed`, error);
    return false;
  }
}

function ensurePage(localNumber) {
  const local = Math.max(1, Math.min(totalPages, Number(localNumber) || 1));
  if (loadPromises.has(local)) return loadPromises.get(local);
  const pageMeta = pageMetas[local - 1];
  const wrapper = document.getElementById(pageId(local));
  if (!pageMeta || !wrapper) return Promise.resolve(false);
  if (wrapper.dataset.loadState === 'loaded') return Promise.resolve(true);

  const promise = loadSourcePage(pageMeta, wrapper);
  loadPromises.set(local, promise);
  promise.finally(() => loadPromises.delete(local));
  return promise;
}

async function runPool(numbers, concurrency = 4) {
  let next = 0;
  const list = [...new Set(numbers)].filter((n) => n >= 1 && n <= totalPages);
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (next < list.length) {
      const index = next;
      next += 1;
      await ensurePage(list[index]);
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

function warmAround(localNumber) {
  const radius = saveData ? 1 : (isAppleMobile || lowPowerDevice ? 2 : 3);
  const targets = [];
  for (let d = 0; d <= radius; d += 1) {
    targets.push(localNumber + d);
    if (d) targets.push(localNumber - d);
  }
  runPool(targets, saveData ? 1 : 2).catch(() => {});
}

function goToPage(localNumber, behavior = 'smooth') {
  if (!totalPages) return;
  const target = setActivePage(localNumber, { syncUrl: true });
  ensurePage(target).catch(() => {});
  warmAround(target);
  document.getElementById(pageId(target))?.scrollIntoView({ behavior, block: 'start' });
}

function installNavigation() {
  if (navigationInstalled) return;
  navigationInstalled = true;
  jumpInput.max = String(totalPages);
  jumpInput.disabled = false;
  setActivePage(activePage);

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

  if (typeof IntersectionObserver === 'function') {
    const activeObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const local = Number(visible.target.dataset.localPage);
      if (Number.isFinite(local) && local !== activePage) {
        setActivePage(local, { syncUrl: true });
        warmAround(local);
      }
    }, { rootMargin: '-18% 0px -55% 0px', threshold: [0.15, 0.35, 0.6] });

    lazyObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const local = Number(entry.target.dataset.localPage);
        if (Number.isFinite(local)) warmAround(local);
      }
    }, { rootMargin: '1800px 0px 1800px 0px', threshold: 0 });

    for (const wrapper of document.querySelectorAll('.workbook-page-wrap')) {
      activeObserver.observe(wrapper);
      lazyObserver.observe(wrapper);
    }
  }
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

    for (const wrapper of document.querySelectorAll('.workbook-page-wrap[data-load-state="loaded"]')) {
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

function createPageShells() {
  const fragment = document.createDocumentFragment();
  for (const pageMeta of pageMetas) {
    const localNumber = pageMeta.workbookNumber;
    const wrapper = document.createElement('section');
    wrapper.className = 'workbook-page-wrap';
    wrapper.id = pageId(localNumber);
    wrapper.dataset.localPage = String(localNumber);
    wrapper.dataset.sourcePage = String(pageMeta.sourceNumber);
    wrapper.dataset.loadState = 'pending';
    wrapper.setAttribute('aria-busy', 'true');

    const placeholder = document.createElement('div');
    placeholder.className = 'workbook-page-placeholder';
    placeholder.textContent = `עמוד ${localNumber}`;
    wrapper.append(placeholder);
    fragment.append(wrapper);
  }
  workbookRoot.append(fragment);
}

function backgroundLoad(requested) {
  const all = pageMetas.map((page) => page.workbookNumber);
  all.sort((a, b) => Math.abs(a - requested) - Math.abs(b - requested));
  const concurrency = saveData ? 1 : (isAppleMobile ? 3 : (lowPowerDevice ? 4 : 7));

  const start = () => {
    runPool(all, concurrency).then(async () => {
      await mathQueue;
      printButton.disabled = failedPages > 0 || loadedPages !== totalPages;
      updateLoadStatus();
      requestAnimationFrame(refitPages);
    }).catch((error) => {
      console.error('Background workbook load failed', error);
      printButton.disabled = true;
    });
  };

  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 700 });
  else setTimeout(start, 60);
}

async function boot() {
  const manifestResponse = await fetchWithRetry(MANIFEST_URL, { cache: 'no-store' });
  const manifest = await manifestResponse.json();
  pageMetas = validateManifest(manifest);
  totalPages = pageMetas.length;
  loadedPages = 0;
  failedPages = 0;

  const eyebrow = document.querySelector('.workbook-eyebrow');
  if (eyebrow) eyebrow.textContent = `חוברת דיגיטלית · ${totalPages} דפים`;
  pageTotalLabel.textContent = `מתוך ${totalPages}`;
  statusEl.textContent = 'מכין את העמוד הראשון…';

  const requestedRaw = Number(new URL(location.href).searchParams.get('page')) || 1;
  const requested = Math.max(1, Math.min(totalPages, Math.trunc(requestedRaw)));
  activePage = requested;

  createPageShells();
  installToolbarOffset();
  installNavigation();
  installResponsiveScaling();
  setActivePage(requested);
  warmAround(requested);

  await ensurePage(requested);
  await queueTypeset(document.getElementById(pageId(requested)));
  requestAnimationFrame(() => {
    refitPages();
    goToPage(requested, 'auto');
  });

  statusEl.textContent = `מוכן · ${loadedPages} / ${totalPages} דפים · השאר נטענים ברקע`;
  backgroundLoad(requested);
}

boot().catch((error) => {
  statusEl.textContent = 'טעינת החוברת נכשלה';
  const message = document.createElement('div');
  message.className = 'workbook-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'החוברת לא נטענה. רעננו את הדף ונסו שוב.';
  workbookRoot.prepend(message);
  console.error(error);
});
