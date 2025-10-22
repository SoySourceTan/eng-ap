// キャッシュのバージョンを更新して、新しいService Workerを有効にする
const CACHE_NAME = 'real-english-guide-v3'; 
const MP3_CACHE_NAME = 'real-english-guide-mp3-cache-v1';

// アプリの骨格（App Shell）となるファイル
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'data_daily_life.json',
  'data_travel.json',
  'data_welcome.json',
  'manifest.json',
  'images/icon-192x192.png',
  'images/icon-512x512.png'
];

// 1. インストール処理
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened core cache');
        // App Shellをキャッシュする
        return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })));
      })
  );
});

// 2. フェッチ処理（リクエストへの応答）
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // もしリクエストがMP3ファイルなら、専用のキャッシュ戦略を適用
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.open(MP3_CACHE_NAME).then(async (cache) => {
        // まずキャッシュにMP3があるか確認
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // あればキャッシュから返す
          return cachedResponse;
        }
        
        // なければネットワークから取得
        const networkResponse = await fetch(event.request);
        // 取得できたら、レスポンスのクローンをキャッシュに保存
        // (レスポンスは一度しか使えないためクローンが必要)
        cache.put(event.request, networkResponse.clone());
        // 取得したレスポンスをブラウザに返す
        return networkResponse;
      })
    );
  } else {
    // MP3以外（App Shellなど）のリクエストは、従来の戦略（ネットワーク優先、失敗時にキャッシュ）
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});


// 3. アクティベート処理（古いキャッシュの削除）
self.addEventListener('activate', event => {
  // 新しいService Workerが有効になったときに、古いキャッシュを削除する
  const cacheWhitelist = [CACHE_NAME, MP3_CACHE_NAME]; // 新しいキャッシュ名をホワイトリストに
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});