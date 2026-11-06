/* 유니 타임즈 서비스 워커 — 앱처럼 빠르게 열리고, 인터넷이 끊겨도 마지막으로 본 신문을 보여 준다.
   · 버전이 붙은 화면 파일(/app.js?v=…, app.css?v=…)과 글꼴은 한 번 받으면 저장본을 바로 쓴다 (파일이 바뀌면 주소가 바뀜)
   · 첫 화면(index)과 글 자료(API)는 늘 서버에서 먼저 받아 최신을 쓰고, 받을 수 없을 때만 저장본을 쓴다 */
const VERSION = 'yt-v21';
const SHELL = `${VERSION}-shell`, API = `${VERSION}-api`, PHOTO = `${VERSION}-photo`, ASSET = `${VERSION}-asset`;
const SHELL_FILES = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png'];
// 오프라인에서도 보여 줄 읽기 전용 자료
const API_CACHE = /^\/api\/(me|settings|articles|articles\/[^/]+|articles\/[^/]+\/comments|events|people|polls|notes|cards)(\?|$)/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data === 'logout') e.waitUntil(caches.delete(API)); // 로그아웃하면 저장해 둔 글 자료를 지운다
});

const networkFirst = async (req, cacheName, fallbackUrl) => {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(fallbackUrl || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackUrl || req, { ignoreSearch: false });
    if (hit) return hit;
    throw err;
  }
};
const cacheFirst = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req); if (hit) return hit;
  const res = await fetch(req); if (res.ok) cache.put(req, res.clone());
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (p === '/api/calendar.ics' || p.startsWith('/a/') || p.startsWith('/i/') || p.startsWith('/api/audio/')) return;
  // 사진: 한 번 받은 사진은 저장본으로 바로 (사진 주소는 바뀌지 않음)
  if (p.startsWith('/api/photo/')) { e.respondWith(cacheFirst(req, PHOTO)); return; }
  if (p.startsWith('/api/')) { if (API_CACHE.test(p + url.search)) e.respondWith(networkFirst(req, API)); return; }
  // 버전 붙은 화면 파일·글꼴·지도 파일: 저장본 먼저
  if (url.searchParams.has('v') || p.startsWith('/fonts/') || p.startsWith('/vendor/')) { e.respondWith(cacheFirst(req, ASSET)); return; }
  // 화면: 페이지 이동은 언제나 index.html
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, SHELL, '/')); return; }
  e.respondWith(networkFirst(req, SHELL));
});
