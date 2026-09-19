/**
 * js/storage/indexedDb.js
 * ブラウザ内 IndexedDB 完全オフライン自動保存 ＆ 復元モジュール
 * 
 * 担当役割:
 * - 1球ごとの自動オートセーブ（不意のリロード・電源断からの100%復元）
 * - 進行中試合（active_game）の状態保存とロード
 * - 試合アーカイブ（games）の保存・一覧取得・詳細読込
 * - 団員名簿マスタ（roster）の永続化
 * - トランザクション処理のPromiseラップによる安全な非同期操作
 */

const DB_NAME = "GakudoBaseballDB";
const DB_VERSION = 1;

// オブジェクトストア名の定義
export const STORES = {
  ACTIVE_GAME: "active_game",
  GAMES: "games",
  ROSTER: "roster"
};

export class IndexedDBStorage {
  constructor() {
    this.db = null;
    this.dbReadyPromise = this.init();
  }

  /**
   * IndexedDBの初期化とストア作成・バージョンアップグレード
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. 進行中試合ストア（キー: "current" 固定）
        if (!db.objectStoreNames.contains(STORES.ACTIVE_GAME)) {
          db.createObjectStore(STORES.ACTIVE_GAME, { keyPath: "id" });
        }

        // 2. 保存済み試合アーカイブストア（キー: gameId）
        if (!db.objectStoreNames.contains(STORES.GAMES)) {
          const gameStore = db.createObjectStore(STORES.GAMES, { keyPath: "gameId" });
          gameStore.createIndex("date", "date", { unique: false });
          gameStore.createIndex("opponent", "opponent", { unique: false });
        }

        // 3. 団員名簿マスタストア（キー: playerId）
        if (!db.objectStoreNames.contains(STORES.ROSTER)) {
          const rosterStore = db.createObjectStore(STORES.ROSTER, { keyPath: "id" });
          rosterStore.createIndex("number", "number", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("IndexedDB Open Error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * トランザクションの取得ヘルパー
   */
  async getStore(storeName, mode = "readonly") {
    await this.dbReadyPromise;
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  /**
   * 1球記録ごとのアクティブゲーム即時自動保存
   * @param {Object} gameStateData GameState.getState() のスナップショット
   */
  async saveActiveGame(gameStateData) {
    try {
      const store = await this.getStore(STORES.ACTIVE_GAME, "readwrite");
      const record = {
        id: "current",
        updatedAt: new Date().toISOString(),
        state: gameStateData
      };

      return new Promise((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("アクティブゲーム自動保存失敗 (IndexedDB):", err);
      // 万が一のフォールバック (LocalStorage)
      try {
        localStorage.setItem("gakudo_active_game_fallback", JSON.stringify(gameStateData));
      } catch (_) {}
      return false;
    }
  }

  /**
   * 進行中の試合データを復元ロード
   * @returns {Promise<Object|null>} 復元データ、無ければnull
   */
  async loadActiveGame() {
    try {
      const store = await this.getStore(STORES.ACTIVE_GAME, "readonly");
      return new Promise((resolve) => {
        const req = store.get("current");
        req.onsuccess = () => {
          if (req.result && req.result.state) {
            resolve(req.result.state);
          } else {
            // LocalStorage フォールバック確認
            const fallback = localStorage.getItem("gakudo_active_game_fallback");
            resolve(fallback ? JSON.parse(fallback) : null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn("アクティブゲーム復元失敗:", err);
      return null;
    }
  }

  /**
   * 試合終了時やリセット時に進行中データをクリア
   */
  async clearActiveGame() {
    try {
      const store = await this.getStore(STORES.ACTIVE_GAME, "readwrite");
      await new Promise((resolve) => {
        const req = store.delete("current");
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
      localStorage.removeItem("gakudo_active_game_fallback");
    } catch (e) {
      console.warn("アクティブゲームクリア失敗:", e);
    }
  }

  /**
   * 試合アーカイブの保存（試合終了時に実行）
   * @param {Object} gameRecord 試合メタ情報＋1球全レコード
   */
  async saveGameArchive(gameRecord) {
    try {
      const store = await this.getStore(STORES.GAMES, "readwrite");
      return new Promise((resolve, reject) => {
        const req = store.put(gameRecord);
        req.onsuccess = () => resolve(gameRecord.gameId);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.error("試合アーカイブ保存失敗:", err);
      throw err;
    }
  }

  /**
   * 保存済み全試合の一覧を取得（日付逆順）
   */
  async getAllGames() {
    try {
      const store = await this.getStore(STORES.GAMES, "readonly");
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn("試合一覧取得失敗:", err);
      return [];
    }
  }

  /**
   * 特定の試合データをIDで取得
   */
  async getGameById(gameId) {
    try {
      const store = await this.getStore(STORES.GAMES, "readonly");
      return new Promise((resolve) => {
        const req = store.get(gameId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      return null;
    }
  }

  /**
   * 団員名簿マスタの一括保存
   * @param {Array} rosterList 選手オブジェクトの配列
   */
  async saveRoster(rosterList) {
    try {
      const store = await this.getStore(STORES.ROSTER, "readwrite");
      // 一旦全件クリアして入れ直す
      await new Promise((res) => {
        const req = store.clear();
        req.onsuccess = () => res();
        req.onerror = () => res();
      });

      for (const player of rosterList) {
        store.put(player);
      }
      return true;
    } catch (err) {
      console.warn("名簿保存失敗 (IndexedDB):", err);
      return false;
    }
  }

  /**
   * 団員名簿マスタの全件取得
   */
  async loadRoster() {
    try {
      const store = await this.getStore(STORES.ROSTER, "readonly");
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn("名簿取得失敗 (IndexedDB):", err);
      return [];
    }
  }
}

// シングルトンインスタンスのエクスポート
export const dbStorage = new IndexedDBStorage();
