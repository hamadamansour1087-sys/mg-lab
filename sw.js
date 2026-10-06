/* ============================================================
   MG Dental Lab — Service Worker (PWA offline)
   - صفحة البرنامج: network-first (تحديثات فورية عند وجود نت) مع رجوع للكاش أوفلاين
   - سكربتات CDN والخطوط: cache-first (روابط مثبتة الإصدارات)
   - Firestore/Firebase APIs: لا يلمسها السوا — الـ SDK فيه أوفلاين داخلي (IndexedDB)
   - لو غيّرت إصدارات CDN مستقبلًا: زوّد رقم VERSION هنا
   ============================================================ */
var VERSION = 'mg-lab-v1';
var CORE = [
  './manifest.json',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];
var CDN = [
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap'
];

self.addEventListener('install', function(e){
  e.waitUntil((async function(){
    var cache = await caches.open(VERSION);
    for (var i = 0; i < CORE.length; i++){ try { await cache.add(CORE[i]); } catch (err) {} }
    for (var j = 0; j < CDN.length; j++){ try { await cache.add(CDN[j]); } catch (err) {} }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    var keys = await caches.keys();
    await Promise.all(keys.filter(function(k){ return k !== VERSION; }).map(function(k){ return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* Firestore وأي APIs تبع قاعدة البيانات — السوا ما يلمسهاش */
  if (/(firestore|firebaseio|firebaselogging|google-analytics)/.test(url.hostname)) return;

  /* تصفح الصفحة نفسها: نت الأول، ولو مقطوع يرجع للكاش */
  if (req.mode === 'navigate'){
    e.respondWith((async function(){
      try {
        var fresh = await fetch(req);
        try {
          var c1 = await caches.open(VERSION);
          c1.put(req, fresh.clone());
        } catch (err) {}
        return fresh;
      } catch (err) {
        var cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        var home = await caches.match('./', { ignoreSearch: true });
        return home || Response.error();
      }
    })());
    return;
  }

  /* CDN + الخطوط + ملفات البرنامج المحلية: الكاش الأول */
  var isCDN = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|gstatic\.com|googleapis\.com/.test(url.hostname);
  if (isCDN || url.origin === location.origin){
    e.respondWith((async function(){
      var cached = await caches.match(req, { ignoreSearch: /googleapis\.com/.test(url.hostname) });
      if (cached) return cached;
      try {
        var fresh = await fetch(req);
        if (fresh && (fresh.ok || fresh.type === 'opaque')){
          try {
            var c2 = await caches.open(VERSION);
            c2.put(req, fresh.clone());
          } catch (err) {}
        }
        return fresh;
      } catch (err) { return Response.error(); }
    })());
  }
});
