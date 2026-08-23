const PHOTO_BREAKS = [
  { after: 7,  file: 'visuals/pythagoras-photo-01.html', label: 'גשר המיתרים בירושלים — משפט פיתגורס' },
  { after: 14, file: 'visuals/pythagoras-photo-02.html', label: 'בריכת הסולטן וחומות ירושלים — משפט פיתגורס' },
  { after: 21, file: 'visuals/pythagoras-photo-03.html', label: 'אצטדיון טדי — משפט פיתגורס' },
  { after: 28, file: 'visuals/pythagoras-photo-04.html', label: 'מלחה בירושלים — משפט פיתגורס' },
  { after: 35, file: 'visuals/pythagoras-photo-05.html', label: 'התחנה המרכזית והכניסה לעיר ירושלים — משפט פיתגורס' },
  { after: 42, file: 'visuals/pythagoras-photo-01.html', label: 'גשר המיתרים בירושלים — משפט פיתגורס' },
  { after: 49, file: 'visuals/pythagoras-photo-02.html', label: 'בריכת הסולטן וחומות ירושלים — משפט פיתגורס' },
];

const root = document.querySelector('#workbook');
const printButton = document.querySelector('#print-workbook');
const statusEl = document.querySelector('#workbook-status');
const buildVersion = String(Date.now());
const photoId = (after) => `workbook-photo-after-${after}`;

function versioned(href) {
  const url = new URL(href, document.baseURI);
  url.searchParams.set('photo-v', buildVersion);
  return url.href;
}

function allPhotoPagesReady() {
  return PHOTO_BREAKS.every(({ after }) => document.getElementById(photoId(after))?.dataset.loadState === 'photo');
}

function updatePhotoStatus() {
  if (!allPhotoPagesReady() || !statusEl) return;
  if (!statusEl.textContent.includes('נכשל')) statusEl.textContent = '53 דפי תוכן + 7 דפי תמונה · חוברת מלאה';
}

async function loadPhoto(config, wrapper) {
  try {
    const response = await fetch(versioned(config.file), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const sourceMain = parsed.querySelector('main.photo-interstitial-page');
    if (!sourceMain) throw new Error('לא נמצא main.photo-interstitial-page');
    const main = document.importNode(sourceMain, true);
    main.dataset.afterContentPage = String(config.after);
    main.setAttribute('aria-label', `${config.label}; דף תמונה אחרי עמוד תוכן ${config.after}`);
    wrapper.replaceChildren(main);
    wrapper.dataset.loadState = 'photo';
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    updatePhotoStatus();
  } catch (error) {
    wrapper.dataset.loadState = 'photo-failed';
    const message = document.createElement('div');
    message.className = 'workbook-error';
    message.setAttribute('role', 'alert');
    message.textContent = `שגיאה בטעינת דף התמונה שאחרי עמוד ${config.after}.`;
    wrapper.replaceChildren(message);
    console.error(`Photo interstitial after page ${config.after} failed`, error);
  }
}

function insertPhoto(config) {
  if (!root || document.getElementById(photoId(config.after))) return false;
  const anchor = document.getElementById(`workbook-page-${config.after}`);
  if (!anchor) return false;

  const wrapper = document.createElement('section');
  wrapper.className = 'workbook-page-wrap workbook-photo-wrap';
  wrapper.id = photoId(config.after);
  wrapper.dataset.photoAfter = String(config.after);
  wrapper.dataset.loadState = 'photo-loading';
  wrapper.setAttribute('aria-label', `דף תמונה אחרי עמוד ${config.after}`);
  anchor.after(wrapper);
  void loadPhoto(config, wrapper);
  return true;
}

function syncPhotoPages() {
  for (const config of PHOTO_BREAKS) insertPhoto(config);
  if (PHOTO_BREAKS.every(({ after }) => document.getElementById(photoId(after)))) observer.disconnect();
}

const observer = new MutationObserver(syncPhotoPages);
if (root) {
  observer.observe(root, { childList: true });
  syncPhotoPages();
}

if (printButton) {
  printButton.addEventListener('click', (event) => {
    if (allPhotoPagesReady()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (statusEl) statusEl.textContent = 'ממתין לטעינת דפי התמונות לפני ההדפסה…';
  }, true);
}

window.addEventListener('load', () => {
  syncPhotoPages();
  setTimeout(updatePhotoStatus, 800);
});
