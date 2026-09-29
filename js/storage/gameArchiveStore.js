/**
 * js/storage/gameArchiveStore.js
 * 過去試合アーカイブ・CRUD（保存・一覧取得・個別取得・削除）ストレージモジュール
 * 
 * 改善点:
 * - 既存のリアルタイム1球保存DBとのバージョン競合（IndexedDB Blocked問題）を完全根絶するため、
 *   アーカイブ専用の独立データベース "GakudoBaseballArchiveDB" を採用。
 * - 接続ハングを防ぐタイムアウト安全弁（3秒）と onblocked 検知を完備。
 */

const DB_NAME = "GakudoBaseballArchiveDB"; // 独立したアーカイブ専用DB
const DB_VERSION = 1;
const STORE_SAVED_GAMES = "saved_games";

export class GameArchiveStore {
  constructor() {
    this.db = null;
  }

  /**
   * IndexedDBの初期化・接続（完全独立・非競合）
   */
  async getDb() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      // 3秒以上応答がない場合の安全タイムアウト
      const timer = setTimeout(() => {
        reject(new Error("IndexedDBの接続がタイムアウトしました。"));
      }, 3000);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_SAVED_GAMES)) {
          const store = db.createObjectStore(STORE_SAVED_GAMES, { keyPath: "id" });
          store.createIndex("savedAt", "savedAt", { unique: false });
          store.createIndex("date", "summary.date", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        clearTimeout(timer);
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        clearTimeout(timer);
        console.error("GameArchiveStore: DBオープン失敗", event.target.error);
        reject(event.target.error);
      };

      request.onblocked = () => {
        clearTimeout(timer);
        console.warn("GameArchiveStore: DBが別タブでブロックされています。");
        reject(new Error("データベースがロックされています。他のタブを閉じてお試しください。"));
      };
    });
  }

  /**
   * 現在の GameState を過去試合アーカイブとして新規保存
   */
  async saveGame(gameState, customTitle = "") {
    const db = await this.getDb();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const gameId = `game_${timestampStr}`;

    const info = gameState.gameInfo || {};
    const teams = gameState.teams || {};
    const awayScore = gameState.awayScore || [];
    const homeScore = gameState.homeScore || [];

    const awayTotal = awayScore.reduce((a, b) => a + (Number(b) || 0), 0);
    const homeTotal = homeScore.reduce((a, b) => a + (Number(b) || 0), 0);

    const awayTeamName = (teams.away && teams.away.name) ? teams.away.name : (info.myTeamSide === "away" ? info.myTeamName : info.oppTeamName) || "先攻";
    const homeTeamName = (teams.home && teams.home.name) ? teams.home.name : (info.myTeamSide === "home" ? info.myTeamName : info.oppTeamName) || "後攻";

    let winner = "tie";
    if (awayTotal > homeTotal) winner = "away";
    else if (homeTotal > awayTotal) winner = "home";

    const record = {
      id: gameId,
      savedAt: now.toISOString(),
      displayTitle: customTitle || `${info.tournament || "公式戦"} (${awayTeamName} vs ${homeTeamName})`,
      summary: {
        date: info.date || now.toISOString().slice(0, 10),
        tournament: info.tournament || "公式戦",
        venue: info.venue || "",
        awayTeamName,
        homeTeamName,
        awayScoreTotal: awayTotal,
        homeScoreTotal: homeTotal,
        winner,
        innings: gameState.inning || 1,
        totalPitches: gameState.pitchCount || 0
      },
      gameState: JSON.parse(JSON.stringify(gameState))
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVED_GAMES, "readwrite");
      const store = tx.objectStore(STORE_SAVED_GAMES);
      const req = store.put(record);

      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 保存済み全試合の一覧を降順で取得
   */
  async getAllGames() {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVED_GAMES, "readonly");
      const store = tx.objectStore(STORE_SAVED_GAMES);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        resolve(list);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 特定の試合データを1件取得
   */
  async getGameById(gameId) {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVED_GAMES, "readonly");
      const store = tx.objectStore(STORE_SAVED_GAMES);
      const req = store.get(gameId);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 特定の試合を削除
   */
  async deleteGame(gameId) {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVED_GAMES, "readwrite");
      const store = tx.objectStore(STORE_SAVED_GAMES);
      const req = store.delete(gameId);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }
}

export const gameArchiveStore = new GameArchiveStore();
