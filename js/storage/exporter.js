/**
 * js/storage/exporter.js
 * 試合データ ＆ 団員名簿マスタの CSV / JSON エクスポート ＆ インポートモジュール
 * 
 * 担当役割:
 * - 1球ごとの全投球・打球・BSO推移を含む公式スコアCSVの自動生成（Excel文字化け防止BOM対応）
 * - 試合データの完全バックアップ用JSONエクスポート ＆ 復元インポート
 * - 団員名簿マスタのCSV / JSON エクスポート ＆ インポート
 * - Web Share APIによるスマホ（LINE・AirDrop・メール等）へのワンタップ共有
 */

/**
 * 文字列をCSVの安全なセル値にエスケープ
 * @param {string|number|null|undefined} val 
 * @returns {string}
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Blobデータをブラウザからダウンロード
 * @param {Blob} blob 
 * @param {string} fileName 
 */
function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 試合データ（1球ごとの全履歴）をCSV形式へ変換
 * @param {Object} gameRecord 試合データ（メタデータ＋全投球履歴）
 * @returns {string} CSV文字列（BOM付き）
 */
export function generateGameCsv(gameRecord) {
  const headers = [
    "球数",
    "イニング",
    "投手",
    "打者名",
    "打順",
    "守備位置",
    "投球コース",
    "判定・結果",
    "打球結果",
    "打球の質",
    "打球守備エリア",
    "発生得点",
    "着弾点X",
    "着弾点Y",
    "投球前BSO",
    "投球前1塁",
    "投球前2塁",
    "投球前3塁"
  ];

  const rows = [];
  rows.push(headers.map(escapeCsvValue).join(","));

  const history = gameRecord.history || [];

  history.forEach((item, index) => {
    const p = item.pitchEvent || {};
    const snap = item.snapshot || {};
    const play = p.play || {};

    const row = [
      p.pitchNum || index + 1,
      p.inningStr || `${snap.inning || 1}回${snap.isTop ? "表" : "裏"}`,
      snap.currentPitcher ? snap.currentPitcher.name : "先発",
      snap.currentBatter ? snap.currentBatter.name : "打者",
      snap.currentBatter ? snap.currentBatter.order : "-",
      snap.currentBatter ? (snap.currentBatter.pos || "-") : "-",
      p.course || "-",
      p.result || "-",
      play.type || "-",
      play.quality || "-",
      play.area || "-",
      play.runs !== undefined ? play.runs : 0,
      play.hitCoord ? play.hitCoord.x.toFixed(3) : "-",
      play.hitCoord ? play.hitCoord.y.toFixed(3) : "-",
      p.bsoBefore || `${snap.balls || 0}-${snap.strikes || 0}-${snap.outs || 0}`,
      snap.runners && snap.runners[1] ? "有" : "無",
      snap.runners && snap.runners[2] ? "有" : "無",
      snap.runners && snap.runners[3] ? "有" : "無"
    ];

    rows.push(row.map(escapeCsvValue).join(","));
  });

  return "\uFEFF" + rows.join("\r\n");
}

/**
 * 団員名簿マスタをCSV文字列に変換
 * @param {Array<Object>} rosterList 
 * @returns {string} CSV文字列（BOM付き）
 */
export function generateRosterCsv(rosterList) {
  const headers = ["背番号", "氏名", "学年", "投", "打", "主な守備"];
  const rows = [headers.map(escapeCsvValue).join(",")];

  rosterList.forEach((player) => {
    const row = [
      player.number,
      player.name,
      player.grade || 6,
      player.throws || "右",
      player.bats || "右",
      player.pos || "投"
    ];
    rows.push(row.map(escapeCsvValue).join(","));
  });

  return "\uFEFF" + rows.join("\r\n");
}

/**
 * CSV文字列から団員名簿オブジェクト配列を生成
 * @param {string} csvText 
 * @returns {Array<Object>}
 */
export function parseRosterCsv(csvText) {
  const cleanText = csvText.replace(/^\uFEFF/, "").trim();
  const lines = cleanText.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const roster = [];

  // 1行目はヘッダーとみなし2行目から解析
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",").map((s) => s.replace(/^"|"$/g, "").trim());
    if (parts.length >= 2) {
      const num = parseInt(parts[0], 10);
      const name = parts[1];
      if (!isNaN(num) && name) {
        roster.push({
          id: `p_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
          number: num,
          name: name,
          grade: parts[2] ? parseInt(parts[2], 10) || 6 : 6,
          throws: parts[3] || "右",
          bats: parts[4] || "右",
          pos: parts[5] || "投"
        });
      }
    }
  }

  return roster;
}

export class DataExporter {
  /**
   * 試合CSVファイルをダウンロード
   * @param {Object} gameRecord 
   * @param {string} optionalName 
   */
  static exportGameCsv(gameRecord, optionalName = null) {
    const csvContent = generateGameCsv(gameRecord);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const dateStr = (gameRecord.date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const fileName = optionalName || `game_score_${dateStr}_vs_${gameRecord.opponent || "match"}.csv`;
    triggerDownload(blob, fileName);
  }

  /**
   * 試合データをJSONファイルとしてエクスポート
   * @param {Object} gameRecord 
   * @param {string} optionalName 
   */
  static exportGameJson(gameRecord, optionalName = null) {
    const jsonStr = JSON.stringify(gameRecord, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const dateStr = (gameRecord.date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const fileName = optionalName || `game_backup_${dateStr}.json`;
    triggerDownload(blob, fileName);
  }

  /**
   * 団員名簿マスタをCSVダウンロード
   * @param {Array<Object>} rosterList 
   */
  static exportRosterCsv(rosterList) {
    const csvContent = generateRosterCsv(rosterList);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `gakudo_roster_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  /**
   * 団員名簿マスタをJSONダウンロード
   * @param {Array<Object>} rosterList 
   */
  static exportRosterJson(rosterList) {
    const jsonStr = JSON.stringify(rosterList, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    triggerDownload(blob, `gakudo_roster_${new Date().toISOString().slice(0, 10)}.json`);
  }

  /**
   * ユーザー端末からファイル（JSON/CSV）を読み込む
   * @param {string} acceptType 
   * @returns {Promise<string>} ファイル内容テキスト
   */
  static async importFile(acceptType = ".json,.csv") {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = acceptType;
      input.style.display = "none";

      input.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
      };

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }

  /**
   * スマホのネイティブ共有機能（Web Share API）でCSV/JSONを送信
   * LINE、AirDrop、メール等への即時受け渡しに対応
   * @param {Blob} blob 
   * @param {string} fileName 
   * @param {string} title 
   */
  static async shareFile(blob, fileName, title = "学童野球スコアデータ") {
    if (navigator.canShare && navigator.share) {
      try {
        const file = new File([blob], fileName, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: title,
            files: [file]
          });
          return true;
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Web Share 失敗、通常ダウンロードへ移行:", err);
        }
      }
    }

    // Web Share未対応環境またはキャンセルの場合は通常ダウンロードにフォールバック
    triggerDownload(blob, fileName);
    return false;
  }
}
