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
    this.saveTimer = null;
  }

  async init() {
    this.gameState = new GameState();

    const scoreboardSlot = document.getElementById("scoreboard-slot");
    const diamondSlot = document.getElementById("diamond-slot");
    const zoneSlot = document.getElementById("zone-slot");
    const sprayModalSlot = document.getElementById("spray-modal-slot");
    const rosterSlot = document.getElementById("roster-modal-slot");

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

document.addEventListener("DOMContentLoaded", () => {
  const app = new BaseballApp();
  app.init();
});
