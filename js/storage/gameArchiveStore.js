/**
 * js/storage/gameArchiveStore.js
 * 過去試合アーカイブ・CRUD（保存・一覧取得・個別取得・削除）ストレージモジュール
 * 
 * 特徴:
 * - 既存のリアルタイム1球保存（active_game）とは独立して動作
 * - 試合ごとの一意なID（game_YYYYMMDD_HHMMSS）を発行
 * - 試合サマリー（日付、大会名、対戦カード、スコア、勝敗）を即座に一覧表示できるよう最適化
 * - 年間成績集計のための「全試合一括取得」にも対応
 */

const DB_NAME = "GakudoBaseballDB";
const DB_VERSION = 2; // 過去試合用ストア追加に伴うバージョン定義
const STORE_SAVED_GAMES = "saved_games";

export class GameArchiveStore {
  constructor() {
    this.db = null;
  }

  /**
   * IndexedDBの初期化・接続
   * 既存のストアを壊さずに 'saved_games' ストアを安全に確保
   */
  async getDb() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // 過去試合アーカイブ用ストアが存在しなければ作成
        if (!db.objectStoreNames.contains(STORE_SAVED_GAMES)) {
          const store = db.createObjectStore(STORE_SAVED_GAMES, { keyPath: "id" });
          store.createIndex("savedAt", "savedAt", { unique: false });
          store.createIndex("date", "gameInfo.date", { unique: false });
        }
        // active_game（既存のリアルタイム保存）がなければ作成
        if (!db.objectStoreNames.contains("active_game")) {
          db.createObjectStore("active_game", { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("GameArchiveStore: DBオープン失敗", event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * 現在の GameState を過去試合アーカイブとして新規保存
   * @param {Object} gameState 試合の状態オブジェクト
   * @param {string} [customTitle] 任意の試合タイトル（未指定時は自動生成）
   * @returns {Promise<Object>} 保存された試合レコード
   */
  async saveGame(gameState, customTitle = "") {
    const db = await this.getDb();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const gameId = `game_${timestampStr}`;

    // 試合サマリー情報の抽出
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

    // 保存レコードの構築（ディープコピーで安全に分離）
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
      // 試合の完全な復元・スコア表表示・通算集計用の全データ
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
   * 保存済み全試合の一覧（サマリー）を新しい順（降順）で取得
   * @returns {Promise<Array>} 試合一覧の配列
   */
  async getAllGames() {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVED_GAMES, "readonly");
      const store = tx.objectStore(STORE_SAVED_GAMES);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        // savedAt の降順（新しい試合が一番上）に並び替え
        list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        resolve(list);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 特定の試合データを1件取得（スコア表閲覧や再開用）
   * @param {string} gameId 
   * @returns {Promise<Object|null>}
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
   * 特定の試合をアーカイブから削除
   * @param {string} gameId 
   * @returns {Promise<boolean>}
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

// シングルトンインスタンスとしてエクスポート
export const gameArchiveStore = new GameArchiveStore();
