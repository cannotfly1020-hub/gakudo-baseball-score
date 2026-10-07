/**
 * js/app.js
 * アプリ全体の司令塔
 * （完全非同期・ゼロ遅延レスポンス版 ＆ 過去試合アーカイブ・捕手ボード・Wake Lock・炎天下モード統合）
 * 
 * 機能強化:
 * - 【現場過酷環境対策】Screen Wake Lock API による画面自動スリープ完全抑止（復帰時自動再取得付き）
 * - 【熱暴走・直射日光防止】炎天下ペーパーホワイトモードのトグル制御 ＆ LocalStorage永続化
 * - 【小学生捕手機能】絵で見る捕手スコア盤（CatcherVisualBoard）の完全統合
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
import { GameArchiveModalComponent } from "./components/gameArchiveModal.js";
import { CatcherVisualBoard } from "./components/catcherVisualBoard.js";
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
    this.gameArchiveModalComponent = null;
    this.catcherVisualBoardComponent = null;
    this.saveTimer = null;

    // Screen Wake Lock インスタンス保持
    this.wakeLockSentinel = null;
  }

  async init() {
    this.gameState = new GameState();

    // 炎天下モードの前回状態を即時復元（初期描画チラつき防止）
    this.initSunlightMode();

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

    // 過去試合アーカイブ受皿スロット（自動生成フォールバック付き）
    let archiveModalSlot = document.getElementById("archive-modal-slot");
    if (!archiveModalSlot) {
      archiveModalSlot = document.createElement("div");
      archiveModalSlot.id = "archive-modal-slot";
      archiveModalSlot.className = "hidden";
      document.body.appendChild(archiveModalSlot);
    }

    // 絵で見る捕手スコア盤受皿スロット（自動生成フォールバック付き）
    let catcherModalSlot = document.getElementById("catcher-modal-slot");
    if (!catcherModalSlot) {
      catcherModalSlot = document.createElement("div");
      catcherModalSlot.id = "catcher-modal-slot";
      document.body.appendChild(catcherModalSlot);
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

    // 絵で見る捕手スコア盤の安全な初期化
    try {
      this.catcherVisualBoardComponent = new CatcherVisualBoard(this.gameState);
    } catch (err) {
      console.error("CatcherVisualBoard 初期化エラー:", err);
    }

    if (archiveModalSlot) {
      try {
        this.gameArchiveModalComponent = new GameArchiveModalComponent(
          archiveModalSlot,
          this.gameState,
          {
            // 過去試合のスコア表閲覧（過去試合の状態を一時スコアシートで描画）
            onViewScoreSheet: (targetGameState) => {
              try {
                const tempStateWrapper = { getState: () => targetGameState };
                const tempSheet = new ScoreSheetComponent(scoresheetSlot, tempStateWrapper);
                tempSheet.open();
              } catch (err) {
                console.error("過去試合のスコア表閲覧エラー:", err);
              }
            },
            // 過去試合の復元・再開
            onResumeGame: (restoredState) => {
              this.gameState.state = JSON.parse(JSON.stringify(restoredState));
              this.gameState.notify();
              try {
                dbStorage.saveActiveGame(this.gameState.getState());
              } catch (err) {
                console.warn("再開時のバックグラウンド保存スキップ:", err);
              }
            }
          }
        );
      } catch (err) {
        console.error("GameArchiveModalComponent 初期化エラー:", err);
      }
    }

    if (zoneSlot) {
      this.zoneComponent = new ZoneComponent(zoneSlot, this.gameState, {
        onInPlay: (selectedCourse) => this.handleInPlay(selectedCourse)
      });
    }

    this.bindGlobalActions();
    this.gameState.notify();

    // 画面スリープ完全抑止（Wake Lock）の起動
    this.initScreenWakeLock();

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

  async initScreenWakeLock() {
    // Screen Wake Lock API がブラウザでサポートされているか確認
    if (!("wakeLock" in navigator)) {
      console.info("Screen Wake Lock API はこのブラウザでサポートされていません。");
      return;
    }

    const requestLock = async () => {
      try {
        if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
          return;
        }
        this.wakeLockSentinel = await navigator.wakeLock.request("screen");
        this.wakeLockSentinel.addEventListener("release", () => {
          this.wakeLockSentinel = null;
        });
        console.log("☀️ 画面スリープ抑止（Wake Lock）を取得しました。");
      } catch (err) {
        // バッテリー低下時やバックグラウンド時は例外が発生する可能性があるため安全に捕捉
        console.warn("Wake Lock 取得スキップ:", err.message);
      }
    };

    // 初回取得
    await requestLock();

    // タブ切り替えやアプリ復帰時に自動で再取得
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        await requestLock();
      }
    });
  }

  initSunlightMode() {
    const isSunlight = localStorage.getItem("gakudo_sunlight_mode") === "true";
    if (isSunlight) {
      document.body.classList.add("sunlight-mode");
    }
    this.updateSunlightButtonUI(isSunlight);
  }

  updateSunlightButtonUI(isActive) {
    const btn = document.getElementById("btn-toggle-sunlight");
    const label = document.getElementById("sunlight-btn-label");
    if (!btn) return;

    if (isActive) {
      btn.classList.add("ring-2", "ring-amber-500", "bg-amber-100", "text-amber-950");
      btn.classList.remove("bg-slate-800", "text-amber-300");
      if (label) label.innerText = "標準";
    } else {
      btn.classList.remove("ring-2", "ring-amber-500", "bg-amber-100", "text-amber-950");
      btn.classList.add("bg-slate-800", "text-amber-300");
      if (label) label.innerText = "炎天下";
    }
  }

  bindGlobalActions() {
    // 炎天下モードトグルボタン
    const sunlightBtn = document.getElementById("btn-toggle-sunlight");
    if (sunlightBtn) {
      sunlightBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const willBeActive = !document.body.classList.contains("sunlight-mode");
        document.body.classList.toggle("sunlight-mode", willBeActive);
        try {
          localStorage.setItem("gakudo_sunlight_mode", willBeActive ? "true" : "false");
        } catch (err) {
          console.warn("LocalStorage保存スキップ:", err);
        }
        this.updateSunlightButtonUI(willBeActive);
      });
    }

    // 絵で見る捕手スコア盤 ワンタップ呼び出し
    const catcherBtn = document.getElementById("btn-open-catcher-board");
    if (catcherBtn) {
      catcherBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (this.catcherVisualBoardComponent) {
          this.catcherVisualBoardComponent.open();
        }
      });
    }

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

    // 過去試合アーカイブモーダル オープンボタン
    const archiveBtn = document.getElementById("btn-open-archive");
    if (archiveBtn) {
      archiveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (this.gameArchiveModalComponent) {
          this.gameArchiveModalComponent.open();
        }
      });
    }

    // スコア表オープン処理（alert禁止原則に準拠した安全なハンドリング）
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
          console.error("スコア表起動エラー:", err);
        }
      });
    }

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
        this.gameState.resetGame();

        try {
          dbStorage.saveActiveGame(this.gameState.getState());
        } catch (err) {
          console.warn("リセット時のDB保存スキップ:", err);
        }

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
    this.gameState.incrementCurrentPitcherCount();
    this.gameState.advanceBatter();

    const type = playResult.type;
    const runsFromPlay = playResult.runs || 0;

    switch (type) {
      case "凡打":
      case "犠牲フライ":
        this.gameState.handleOut();
        break;

      case "併殺打":
        if (state.runners[1]) {
          state.runners[1] = false;
          if (state.runners[2] && !state.runners[3]) {
            state.runners[3] = true;
            state.runners[2] = false;
          }
        } else if (state.runners[2]) {
          state.runners[2] = false;
        } else if (state.runners[3]) {
          state.runners[3] = false;
        }
        this.gameState.handleOut();
        if (state.outs > 0) {
          this.gameState.handleOut();
        }
        break;

      case "単打":
      case "失策":
      case "振り逃げ":
        if (state.runners[3]) {
          state.runners[3] = false;
          if (runsFromPlay === 0) {
            this.gameState.addRun(1);
          }
        }
        state.runners[3] = state.runners[2] || false;
        state.runners[2] = state.runners[1] || false;
        state.runners[1] = true;
        break;

      case "野選":
        this.gameState.handleOut();
        if (state.outs > 0) {
          if (state.runners[3]) {
            state.runners[3] = false;
          } else if (state.runners[2]) {
            state.runners[2] = false;
          } else if (state.runners[1]) {
            state.runners[1] = false;
          }
          state.runners[1] = true;
        }
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
