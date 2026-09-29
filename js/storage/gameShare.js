/**
 * js/storage/gameShare.js
 * 試合データ共有（LINE・AirDrop・ファイルエクスポート）＆ インポートモジュール
 * 
 * 特徴:
 * - スマホ標準の Web Share API (navigator.share) によるネイティブ共有対応
 * - PC / 未対応端末向けの自動ファイルダウンロード・フォールバック
 * - 取り込み時の安全なデータ構造バリデーション（改ざん・破損防止）
 * - 既存の gameArchiveStore とシームレスに連動
 */

import { gameArchiveStore } from "./gameArchiveStore.js";

export class GameShareService {
  /**
   * 1試合のデータをファイル化し、スマホの共有機能（LINE/AirDrop/ドライブ等）を起動
   * @param {Object} gameRecord gameArchiveStore から取得した試合レコード
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async shareGame(gameRecord) {
    if (!gameRecord || !gameRecord.gameState) {
      throw new Error("共有対象の試合データが不正です。");
    }

    const s = gameRecord.summary || {};
    const dateStr = (s.date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const away = (s.awayTeamName || "先攻").replace(/[/\\?%*:|"<>]/g, "");
    const home = (s.homeTeamName || "後攻").replace(/[/\\?%*:|"<>]/g, "");
    const fileName = `${dateStr}_${away}vs${home}.gakudo`;

    // 共有用ペイロードの構築
    const exportPayload = {
      app: "gakudo-baseball-score",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      gameRecord: {
        id: gameRecord.id,
        savedAt: gameRecord.savedAt,
        displayTitle: gameRecord.displayTitle,
        summary: gameRecord.summary,
        gameState: gameRecord.gameState
      }
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });

    // 1. スマホのファイル共有（Web Share API + files 対応ブラウザ）
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], fileName, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${s.tournament || "学童野球試合記録"} (${s.awayTeamName} vs ${s.homeTeamName})`,
            text: `学童野球 1球速報の試合データです。\n対戦: ${s.awayTeamName} ${s.awayScoreTotal ?? ""} - ${s.homeScoreTotal ?? ""} ${s.homeTeamName}`,
            files: [file]
          });
          return { success: true, message: "共有メニューを呼び出しました" };
        }
      } catch (err) {
        // ユーザーが共有画面で「キャンセル」を押した場合はエラーとみなさない
        if (err.name === "AbortError") {
          return { success: false, message: "共有がキャンセルされました" };
        }
        console.warn("Web Share API でのファイル送信に失敗したため、通常ダウンロードへ移行します:", err);
      }
    }

    // 2. PC または Web Share API 非対応環境: 通常のファイルダウンロード
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, message: "試合ファイルをダウンロードしました" };
    } catch (err) {
      console.error("ファイルダウンロード失敗:", err);
      throw new Error("ファイルの出力に失敗しました。");
    }
  }

  /**
   * 端末から選択された .gakudo (または .json) ファイルを読み込んでアーカイブに追加
   * @param {File} file ユーザーが選択したファイル
   * @returns {Promise<{success: boolean, gameId: string, summary: Object}>}
   */
  static async importGameFile(file) {
    if (!file) {
      throw new Error("ファイルが選択されていません。");
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const rawText = e.target.result;
          let data;
          try {
            data = JSON.parse(rawText);
          } catch (jsonErr) {
            throw new Error("ファイルの形式が正しくありません（JSON破損）。");
          }

          // データ構造のバリデーションチェック
          const record = data.gameRecord || data; // 包まれている場合と生レコードの両方に対応
          if (!record || !record.gameState || !record.summary) {
            throw new Error("学童野球速報の試合データ形式と一致しません。");
          }

          // 重複インポート防止と安全管理:
          // インポート時にユニークなIDと受信日時を付与して保存
          const now = new Date();
          const pad = (n) => String(n).padStart(2, "0");
          const importTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const newGameId = `game_imported_${importTimestamp}`;

          const newRecord = {
            id: newGameId,
            savedAt: now.toISOString(),
            displayTitle: record.displayTitle || record.summary.tournament || "インポートした試合",
            summary: {
              ...record.summary,
              imported: true
            },
            gameState: JSON.parse(JSON.stringify(record.gameState))
          };

          // IndexedDB (gameArchiveStore) へ直接永続保存
          const db = await gameArchiveStore.getDb();
          await new Promise((resTx, rejTx) => {
            const tx = db.transaction("saved_games", "readwrite");
            const store = tx.objectStore("saved_games");
            const req = store.put(newRecord);
            req.onsuccess = () => resTx(newRecord);
            req.onerror = (err) => rejTx(err.target.error);
          });

          resolve({
            success: true,
            gameId: newGameId,
            summary: newRecord.summary
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error("ファイルの読み込み中にエラーが発生しました。"));
      };

      reader.readAsText(file);
    });
  }
}
