/**
 * js/app.js
 * アプリ全体の司令塔・エントリーポイント（爆速起動・非同期復元版）
 * 
 * 改善点:
 * - IndexedDBの読み込み待ちによる起動フリーズ（1分待たされる現象）を根絶
 * - コンポーネント生成を最優先で即時実行し、0秒で画面を描画
 * - 過去データの復元は裏側で非同期かつタイムアウト付きで安全に実行
 */

import { GameState } from "./state.js";
import { ScoreboardComponent } from "./components/scoreboard.js";
import { RunnerDiamondComponent } from "./components/runnerDiamond.js";
import { ZoneComponent } from "./components/zone.js";
import { SprayModalComponent } from "./components/sprayModal.js";
import { RosterViewComponent } from "./components/rosterView.js";
import { dbStorage } from "./storage/indexedDb.js";
import { DataExporter } from "./storage/exporter.js";

class BaseballApp {
  constructor() {
    this.gameState = null;
    this.scoreboardComponent = null;
    this.runnerDiamondComponent = null;
    this.zoneComponent = null;
    this.sprayModalComponent = null;
    this.rosterViewComponent = null;
  }

  /**
   * アプリの初期化と全モジュール結合
   */
  async init() {
    // 1. 状態管理（金庫）のインスタンス生成
    this.gameState = new GameState();

    // 2. DOM要素の受け皿（スロット）を取得
    const scoreboardSlot = document.getElementById("scoreboard-slot");
    const diamondSlot = document.getElementById("diamond-slot");
    const zoneSlot = document.getElementById("zone-slot");
    const sprayModalSlot = document.getElementById("spray-modal-slot");
    const rosterSlot = document.getElementById("roster-modal-slot");

    // 3. 各コンポーネントを即時生成（待たずに0秒で画面を組み立てる）
    if (scoreboardSlot) {
      this.scoreboardComponent = new ScoreboardComponent(scoreboardSlot, this.gameState);
    }

    if (diamondSlot) {
      this.runnerDiamondComponent = new RunnerDiamondComponent(diamondSlot, this.gameState);
    }

    if (sprayModalSlot) {
      this.sprayModalComponent = new SprayModalComponent(sprayModalSlot, this.gameState);
    }

    if (rosterSlot) {
      this.rosterViewComponent = new RosterViewComponent(rosterSlot, this.gameState);
    }

    if (zoneSlot) {
      this.zoneComponent = new ZoneComponent(zoneSlot, this.gameState, {
        onInPlay: (selectedCourse) => this.handleInPlay(selectedCourse)
      });
    }

    // 4. グローバル操作（ヘッダーのアンドゥ、オーダー、CSV出力）をバインド
    this.bindGlobalActions();

    // 5. 初期画面を全コンポーネントへ即時描画
    this.gameState.notify();

    // 6. 1球ごとの完全オフライン自動保存リスナーを登録
    this.gameState.subscribe((state) => {
      try {
        dbStorage.saveActiveGame(state);
      } catch (err) {
        console.warn("自動保存エラー:", err);
      }
    });

    // 7. オフラインDB（IndexedDB）からの復元は裏側で非同期実行（画面を絶対にブロックしない）
    this.restoreSavedGameInBackground();

    console.log("⚾️ gakudo-baseball-score 爆速起動完了");
  }

  /**
   * 画面描画を邪魔しない裏側での安全データ復元（最大500msでタイムアウト）
   */
  async restoreSavedGameInBackground() {
    try {
      // 500ミリ秒以上応答がなければ諦めるタイムアウトガード
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("IndexedDBタイムアウト")), 500)
      );

      const savedState = await Promise.race([
        dbStorage.loadActiveGame(),
        timeoutPromise
      ]);

      if (savedState && savedState.history && savedState.history.length > 0) {
        this.gameState.state = savedState;
        this.gameState.notify();
        console.log("⚾️ 直前の試合データを復元しました");
      }
    } catch (e) {
      console.warn("データ復帰をスキップ（初期状態で開始）:", e.message || e);
    }
  }

  /**
   * ヘッダーや共通ボタンのイベント登録
   */
  bindGlobalActions() {
    // ヘッダーの「1球取消」ボタン
    const undoBtn = document.getElementById("btn-undo");
    if (undoBtn) {
      undoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.gameState.undo();
      });
    }

    // オーダー・名簿モーダルの開閉
    const rosterBtn = document.getElementById("btn-open-roster");
    const rosterSlot = document.getElementById("roster-modal-slot");
    if (rosterBtn && rosterSlot) {
      rosterBtn.addEventListener("click", () => {
        rosterSlot.classList.toggle("hidden");
      });
    }

    // CSVエクスポートボタン
    const exportBtn = document.getElementById("btn-export-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const state = this.gameState.getState();
        DataExporter.exportGameCsv({
          date: new Date().toISOString().slice(0, 10),
          opponent: "相手チーム",
          history: state.history
        });
      });
    }

    // キーボードショートカット（Ctrl+Z / Cmd+Z で1球取消）
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.gameState.undo();
      }
    });
  }

  /**
   * 打球結果ボタン（インプレー）タップ時: 打球Canvasモーダルを起動
   * @param {string} course 選択中の投球コース
   */
  handleInPlay(course) {
    if (!this.sprayModalComponent) return;

    this.sprayModalComponent.open({
      course: course,
      onComplete: (playResult) => {
        this.processPlayResult(playResult);
      }
    });
  }

  /**
   * 打球モーダルから返却された打球結果を状態に反映
   * @param {Object} playResult { course, type, quality, runs, area, hitCoord }
   */
  processPlayResult(playResult) {
    const state = this.gameState.getState();
    const snapshot = JSON.parse(JSON.stringify(state));

    state.pitchCount += 1;

    // 打球種別によるアウト・進塁・得点ロジック
    const type = playResult.type;
    const runsFromPlay = playResult.runs || 0;

    switch (type) {
      case "凡打":
      case "犠牲フライ":
        this.gameState.handleOut();
        break;

      case "単打":
      case "失策":
      case "野選":
      case "振り逃げ":
        this.gameState.advanceWalk();
        break;

      case "二塁打":
        if (state.runners[3]) this.gameState.addRun(1);
        if (state.runners[2]) this.gameState.addRun(1);
        state.runners[3] = state.runners[1] || false;
        state.runners[2] = true;
        state.runners[1] = false;
        break;

      case "三塁打":
        let tripleRuns = 0;
        if (state.runners[1]) tripleRuns++;
        if (state.runners[2]) tripleRuns++;
        if (state.runners[3]) tripleRuns++;
        if (tripleRuns > 0) this.gameState.addRun(tripleRuns);
        state.runners = { 1: false, 2: false, 3: true };
        break;

      case "本塁打":
        let hrRuns = 1;
        if (state.runners[1]) hrRuns++;
        if (state.runners[2]) hrRuns++;
        if (state.runners[3]) hrRuns++;
        state.runners = { 1: false, 2: false, 3: false };
        this.gameState.addRun(hrRuns);
        break;

      case "送りバント":
      case "スクイズ":
        this.gameState.handleOut();
        if (state.runners[3]) {
          state.runners[3] = false;
          this.gameState.addRun(1);
        }
        if (state.runners[2]) {
          state.runners[3] = true;
          state.runners[2] = false;
        }
        if (state.runners[1]) {
          state.runners[2] = true;
          state.runners[1] = false;
        }
        break;

      default:
        break;
    }

    if (runsFromPlay > 0 && type !== "本塁打") {
      this.gameState.addRun(runsFromPlay);
    }

    this.gameState.resetCount();

    const pitchEvent = {
      pitchNum: state.pitchCount,
      inningStr: `${state.inning}回${state.isTop ? "表" : "裏"}`,
      course: playResult.course,
      result: `打球 (${type})`,
      play: playResult,
      bsoBefore: `${snapshot.balls}-${snapshot.strikes}-${snapshot.outs}`
    };

    state.history.push({ snapshot, pitchEvent });
    this.gameState.notify();
  }
}

// DOMContentLoaded のタイミングで起動
document.addEventListener("DOMContentLoaded", () => {
  const app = new BaseballApp();
  app.init();
});
