/**
 * sw.js
 * 学童野球 1球速報 - オフライン対応 サービスワーカー
 * 
 * 役割:
 * - アプリ起動に必要なファイル一式を端末のローカルキャッシュへ退避
 * - 電波がない河川敷や山間部のグラウンドでも1秒で即時起動
 * - キャッシュファースト戦略（オフラインでも最新キャッシュを優先返却）
 */

const CACHE_NAME = "gakudo-score-v1";

// オフライン時に必要な全アセットリスト
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./css/base.css",
  "./css/components.css",
  "./js/app.js",
  "./js/state.js",
  "./js/components/scoreboard.js",
  "./js/components/runnerDiamond.js",
  "./js/components/zone.js",
  "./js/components/sprayModal.js",
  "./js/components/rosterView.js",
  "./js/components/scoreSheet.js",
  "./js/storage/indexedDb.js",
  "./js/storage/exporter.js",
  "https://cdn.tailwindcss.com"
];

// 1. インストール時: 必要ファイルをすべて端末に先回りキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 外部CDNも含め、取得可能なものを確実にキャッシュ
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch((err) => {
          console.warn("キャッシュスキップ (任意):", url, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// 2. アクティベーション時: 古いキャッシュを自動掃除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 通信ハンドリング（Cache First, Network Fallback）
self.addEventListener("fetch", (event) => {
  // GETリクエスト以外はService Workerをバイパス
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // キャッシュに存在する場合は即座に返却（オフラインでもゼロ秒起動）
        // バックグラウンドで更新を確認（Stale-While-Revalidate）
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {
          // オフライン時は何もしない
        });

        return cachedResponse;
      }

      // キャッシュにない場合はネットワークから取得して新規キャッシュ
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // オフラインでHTMLを要求された場合は index.html を返す
        if (event.request.headers.get("accept")?.includes("text/html")) {
          return caches.match("./index.html");
        }
      });
    })
  );
});
