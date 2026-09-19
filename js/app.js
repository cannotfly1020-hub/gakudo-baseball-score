/**
 * js/app.js
 * アプリ全体の司令塔・エントリーポイント
 * 
 * 担当役割:
 * - 各コンポーネント（Scoreboard, RunnerDiamond, Zone）のインスタンス化
 * - 状態管理インスタンス（GameState）の生成と各部品への受け渡し
 * - ヘッダー操作（アンドゥ・1球取消）のバインド
 * - 打球モーダル起動時のインターフェース予約
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

    // 2. オフラインDB（IndexedDB）から前回の進行中データを自動復元確認
    try {
      const savedState = await dbStorage.loadActiveGame();
      if (savedState && savedState.history && savedState.history.length > 0) {
        this.gameState.state = savedState;
        console.log("⚾️ 直前の試合データを復元しました");
      }
    } catch (e) {
      console.warn("データ復元スキップ:", e);
    }

    // 3. DOM要素の受け皿（スロット）を取得
    const scoreboardSlot = document.getElementById("scoreboard-slot");
    const diamondSlot = document.getElementById("diamond-slot");
    const zoneSlot = document.getElementById("zone-slot");
    const sprayModalSlot = document.getElementById("spray-modal-slot");
    const rosterSlot = document.getElementById("roster-modal-slot");

    // 4. 各コンポーネントの初期化
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

    // 5. 1球ごとの完全オフライン自動保存リスナーを登録
    this.gameState.subscribe((state) => {
      dbStorage.saveActiveGame(state);
    });

    // 6. グローバル操作（ヘッダーのアンドゥ、オーダー、CSV出力）をバインド
    this.bindGlobalActions();

    // 7. 初期描画を全コンポーネントへ通知
    this.gameState.notify();

    console.log("⚾️ gakudo-baseball-score 全モジュール連携完了");
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
        // 2塁打: 2塁・3塁走者は生還、1塁走者は3塁へ、打者は2塁へ
        if (state.runners[3]) this.gameState.addRun(1);
        if (state.runners[2]) this.gameState.addRun(1);
        state.runners[3] = state.runners[1] || false;
        state.runners[2] = true;
        state.runners[1] = false;
        break;

      case "三塁打":
        // 3塁打: 走者一掃
        let tripleRuns = 0;
        if (state.runners[1]) tripleRuns++;
        if (state.runners[2]) tripleRuns++;
        if (state.runners[3]) tripleRuns++;
        if (tripleRuns > 0) this.gameState.addRun(tripleRuns);
        state.runners = { 1: false, 2: false, 3: true };
        break;

      case "本塁打":
        // 本塁打: 走者全員生還 ＋ 打者得点
        let hrRuns = 1;
        if (state.runners[1]) hrRuns++;
        if (state.runners[2]) hrRuns++;
        if (state.runners[3]) hrRuns++;
        state.runners = { 1: false, 2: false, 3: false };
        this.gameState.addRun(hrRuns);
        break;

      case "送りバント":
      case "スクイズ":
        // 走者1つ進塁 ＋ 打者アウト
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

    // ユーザー指定の追加得点がある場合
    if (runsFromPlay > 0 && type !== "本塁打") {
      this.gameState.addRun(runsFromPlay);
    }

    // 打者完了のためBSOカウントをリセット
    this.gameState.resetCount();

    // 1球履歴レコードの構築（CSV/JSON保存用）
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
