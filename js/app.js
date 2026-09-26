/**
 * js/app.js
 * アプリ全体の司令塔（完全非同期・ゼロ遅延レスポンス版）
 * 
 * 改善点:
 * - データベース保存（IndexedDB）を完全非同期デバウンス化し、タップ直後の画面描画を一切ブロックしない
 * - processPlayResult 内の snapshot を createSnapshot に統一
 */

import { GameState } from "./state.js";
import { ScoreboardComponent } from "./components/scoreboard.js";
import { RunnerDiamondComponent } from "./components/runnerDiamond.js";
import { ZoneComponent } from "./components/zone.js";
import { SprayModalComponent } from "./components/sprayModal.js";
import { RosterViewComponent } from "./components/rosterView.js";
import { ScoreSheetComponent } from "./components/scoreSheet.js";
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
    this.scoreSheetComponent = null;
    this.saveTimer = null;
  }

  async init() {
    this.gameState = new GameState();

    const scoreboardSlot = document.getElementById("scoreboard-slot");
    const diamondSlot = document.getElementById("diamond-slot");
    const zoneSlot = document.getElementById("zone-slot");
    const sprayModalSlot = document.getElementById("spray-modal-slot");
    const rosterSlot = document.getElementById("roster-modal-slot");
    
    // スコア表受皿スロット（index.html に万が一なくても自動生成して確実に動作させる）
    let scoresheetSlot = document.getElementById("scoresheet-modal-slot");
    if (!scoresheetSlot) {
      scoresheetSlot = document.createElement("div");
      scoresheetSlot.id = "scoresheet-modal-slot";
      scoresheetSlot.className = "hidden";
      document.body.appendChild(scoresheetSlot);
    }

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

    if (scoresheetSlot) {
      try {
        this.scoreSheetComponent = new ScoreSheetComponent(scoresheetSlot, this.gameState);
      } catch (err) {
        console.error("ScoreSheetComponent 初期化エラー:", err);
      }
    }

    if (zoneSlot) {
      this.zoneComponent = new ZoneComponent(zoneSlot, this.gameState, {
        onInPlay: (selectedCourse) => this.handleInPlay(selectedCourse)
      });
    }

    this.bindGlobalActions();
    this.gameState.notify();

    // タップの反応を邪魔しない非同期デバウンス保存（UI描画を優先）
    this.gameState.subscribe((state) => {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        try {
          dbStorage.saveActiveGame(state);
        } catch (err) {
          console.warn("バックグラウンド保存スキップ:", err);
        }
      }, 300);
    });

    this.restoreSavedGameInBackground();
  }

  async restoreSavedGameInBackground() {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("IndexedDBタイムアウト")), 400)
      );

      const savedState = await Promise.race([
        dbStorage.loadActiveGame(),
        timeoutPromise
      ]);

      if (savedState && savedState.history && savedState.history.length > 0) {
        this.gameState.state = savedState;
        this.gameState.notify();
      }
    } catch (e) {
      // 復元失敗時は初期状態で即座に操作可能とする
    }
  }

  bindGlobalActions() {
    const undoBtn = document.getElementById("btn-undo");
    if (undoBtn) {
      undoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.gameState.undo();
      });
    }

    const rosterBtn = document.getElementById("btn-open-roster");
    const rosterSlot = document.getElementById("roster-modal-slot");
    if (rosterBtn && rosterSlot) {
      rosterBtn.addEventListener("click", () => {
        rosterSlot.classList.toggle("hidden");
      });
    }

    // スコア表オープン処理（診断用通知付き）
    const scoresheetBtn = document.getElementById("btn-open-scoresheet");
    if (scoresheetBtn) {
      scoresheetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        try {
          if (!this.scoreSheetComponent) {
            let slot = document.getElementById("scoresheet-modal-slot");
            if (!slot) {
              slot = document.createElement("div");
              slot.id = "scoresheet-modal-slot";
              document.body.appendChild(slot);
            }
            this.scoreSheetComponent = new ScoreSheetComponent(slot, this.gameState);
          }
          this.scoreSheetComponent.open();
        } catch (err) {
          // 万が一エラーが出た場合、画面に直接理由を表示
          window.alert("スコア表起動エラー:\n" + err.message);
          console.error(err);
        }
      });
    } else {
      console.warn("btn-open-scoresheet が見つかりません");
    }

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

    // --- 試合リセット確認モーダルの制御 ---
    const resetOpenBtn = document.getElementById("btn-reset-game");
    const resetModal = document.getElementById("reset-confirm-modal");
    const resetCancelBtn = document.getElementById("btn-cancel-reset");
    const resetConfirmBtn = document.getElementById("btn-confirm-reset");

    // リセットボタン押下時: 確認モーダルを表示
    if (resetOpenBtn && resetModal) {
      resetOpenBtn.addEventListener("click", () => {
        resetModal.classList.remove("hidden");
      });
    }

    // キャンセルボタン押下時: モーダルを閉じる
    if (resetCancelBtn && resetModal) {
      resetCancelBtn.addEventListener("click", () => {
        resetModal.classList.add("hidden");
      });
    }

    // モーダルの背景黒部分タップでもキャンセル
    if (resetModal) {
      resetModal.addEventListener("click", (e) => {
        if (e.target === resetModal) {
          resetModal.classList.add("hidden");
        }
      });
    }

    // 確定ボタン押下時: 試合データを初期化してIndexedDBに即時同期
    if (resetConfirmBtn && resetModal) {
      resetConfirmBtn.addEventListener("click", () => {
        // 1. メモリ上の試合状態・履歴を完全初期化
        this.gameState.resetGame();

        // 2. データベース（IndexedDB）の保存領域も白紙状態に即座に同期
        try {
          dbStorage.saveActiveGame(this.gameState.getState());
        } catch (err) {
          console.warn("リセット時のDB保存スキップ:", err);
        }

        // 3. モーダルを閉じる
        resetModal.classList.add("hidden");
      });
    }

    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.gameState.undo();
      }
    });
  }

  handleInPlay(course) {
    if (!this.sprayModalComponent) return;

    this.sprayModalComponent.open({
      course: course,
      onComplete: (playResult) => {
        this.processPlayResult(playResult);
      }
    });
  }

  processPlayResult(playResult) {
    const state = this.gameState.getState();
    const snapshot = this.gameState.createSnapshot();

    state.pitchCount += 1;
    // 登板中投手の投球数を加算
    this.gameState.incrementCurrentPitcherCount();

    // 打席完了に伴い、攻撃チームの打順を自動送り（1番〜9番ループ）
    this.gameState.advanceBatter();

    const type = playResult.type;
    const runsFromPlay = playResult.runs || 0;

    switch (type) {
      case "凡打":
      case "犠牲フライ":
        this.gameState.handleOut();
        break;

      case "併殺打":
        // 1. 塁上の前走者（1塁、いなければ2塁・3塁）をアウトにして消去
        if (state.runners[1]) {
          state.runners[1] = false;
        } else if (state.runners[2]) {
          state.runners[2] = false;
        } else if (state.runners[3]) {
          state.runners[3] = false;
        }
        // 2. 打者アウト ＋ 走者アウト（計2アウト加算）
        this.gameState.handleOut();
        // 3アウトチェンジになっていなければ、もう1アウト加算
        if (state.outs > 0) {
          this.gameState.handleOut();
        }
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
      inningStr: `${snapshot.inning}回${snapshot.isTop ? "表" : "裏"}`,
      course: playResult.course,
      result: `打球 (${type})`,
      play: playResult,
      bsoBefore: `${snapshot.balls}-${snapshot.strikes}-${snapshot.outs}`
    };

    state.history.push({ snapshot, pitchEvent });
    this.gameState.notify();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new BaseballApp();
  app.init();
});
