/* Service Worker for 思维导图 (index.html) — enables full offline use, both
   as a plain browser tab and (most importantly) as an iOS/desktop PWA
   added to the home screen. Everything this app needs (HTML/CSS/JS/data)
   already lives inside index.html itself plus localStorage — the only
   thing a Service Worker needs to guarantee is that the SHELL (the HTML
   file, manifest, icons) is available with zero network at all.

   Cache-name versioning: bump CACHE_NAME whenever index.html changes so
   returning users actually get the update (see the fetch handler's own
   stale-while-revalidate strategy below for how updates get picked up
   without a hard reload being required first). */
var CACHE_NAME = 'mindmap-shell-v1';
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(PRECACHE_URLS);
    }).then(function(){
      // activate this SW immediately instead of waiting for every open tab
      // of the old version to close first — a single-page app like this
      // has no multi-tab-version-skew concern worth trading for the delay.
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){
        return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* stale-while-revalidate: every request is answered from cache
   IMMEDIATELY if present (so offline/slow-network loads are instant and
   never block on a network round-trip), while a real network fetch runs
   in the background to refresh the cache for NEXT time — "离线运行" is
   satisfied by the cache-first read; staying up to date after a real
   edit to index.html is satisfied by this background refresh, without
   ever making the user wait for it. Falls back to the cached shell page
   for any same-origin navigation request that isn't itself precached
   (e.g. the bare directory URL some hosts serve differently from
   "./index.html" — same "offline first" fallback should apply there too,
   since 加图片/加节点 all happen client-side anyway with no other page to
   navigate to). */
self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method!=='GET') return;
  var url = new URL(req.url);
  if(url.origin!==self.location.origin) return; // never intercept cross-origin (e.g. a future API call) — only this app's own shell files

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.match(req).then(function(cached){
        var networkFetch = fetch(req).then(function(res){
          if(res && res.status===200) cache.put(req, res.clone());
          return res;
        }).catch(function(){
          // offline and not in cache at all — fall back to the shell page
          // itself so a stray link/navigation never dead-ends on a bare
          // browser error screen.
          return cached || cache.match('./index.html');
        });
        return cached || networkFetch;
      });
    })
  );
});
