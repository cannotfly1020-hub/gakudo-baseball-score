/**
 * js/app.js
 * アプリ全体の司令塔
 * （完全非同期・ゼロ遅延レスポンス版 ＆ 試合終了・過去試合アーカイブ・捕手ボード・Wake Lock・炎天下モード・打球メタ刻印統合）
 * 
 * 機能強化:
 * - 【新設】「🏁 試合終了」ボタンによるゲームセット確定＆過去試合アーカイブ独立保存
 * - 【Safari7日間対策】試合終了時の端末バックアップ（.gakudoファイル）自動ダウンロード二重安全弁
 * - 【現場過酷環境対策】Screen Wake Lock API による画面自動スリープ完全抑止（復帰時自動再取得付き）
 * - 【熱暴走・直射日光防止】炎天下ペーパーホワイトモードのトグル制御 ＆ LocalStorage永続化
 * - 【小学生捕手機能】絵で見る捕手スコア盤（CatcherVisualBoard）の完全統合
 * - 【データ整合性保証】打球処理（processPlayResult）時に打者情報・表裏メタを pitchEvent に二重刻印
 * - データベース保存（IndexedDB）を完全非同期デバウンス化し、タップ直後の画面描画を一切ブロックしない
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
import { PitchEditModalComponent } from "./components/pitchEditModal.js";
import { dbStorage } from "./storage/indexedDb.js";
import { gameArchiveStore } from "./storage/gameArchiveStore.js";
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
    this.pitchEditModalComponent = null;
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

    // 投球履歴ピンポイント修正モーダルの初期化
    try {
      this.pitchEditModalComponent = new PitchEditModalComponent(this.gameState);
    } catch (err) {
      console.error("PitchEditModalComponent 初期化エラー:", err);
    }

    if (diamondSlot) {
      this.runnerDiamondComponent = new RunnerDiamondComponent(diamondSlot, this.gameState, {
        onEditPitch: (targetIndex) => {
          if (this.pitchEditModalComponent) {
            this.pitchEditModalComponent.open(targetIndex);
          }
        }
      });
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

    // スコア表オープン処理
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

    // =========================================================================
    // 【新設】「🏁 試合終了」ボタン＆確認モーダルの制御
    // =========================================================================
    const finishBtn = document.getElementById("btn-finish-game");
    const finishModal = document.getElementById("finish-game-modal");
    const closeFinishBtn = document.getElementById("btn-close-finish-modal");
    const cancelFinishBtn = document.getElementById("btn-cancel-finish");
    const confirmSaveFinishBtn = document.getElementById("btn-confirm-save-finish");
    const discardFinishBtn = document.getElementById("btn-discard-finish");

    if (finishBtn && finishModal) {
      finishBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.openFinishGameModal();
      });
    }

    if (closeFinishBtn && finishModal) {
      closeFinishBtn.addEventListener("click", () => {
        finishModal.classList.add("hidden");
      });
    }

    if (cancelFinishBtn && finishModal) {
      cancelFinishBtn.addEventListener("click", () => {
        finishModal.classList.add("hidden");
      });
    }

    // モーダルの背景黒部分タップでも閉じる
    if (finishModal) {
      finishModal.addEventListener("click", (e) => {
        if (e.target === finishModal) {
          finishModal.classList.add("hidden");
        }
      });
    }

    // 「★ アーカイブに保存して試合終了」実行
    if (confirmSaveFinishBtn && finishModal) {
      confirmSaveFinishBtn.addEventListener("click", async () => {
        await this.executeSaveAndFinishGame();
        finishModal.classList.add("hidden");
      });
    }

    // 「保存せず初期化」実行
    if (discardFinishBtn && finishModal) {
      discardFinishBtn.addEventListener("click", () => {
        this.gameState.resetGame();
        try {
          dbStorage.saveActiveGame(this.gameState.getState());
        } catch (err) {
          console.warn("初期化時のDB保存スキップ:", err);
        }
        finishModal.classList.add("hidden");
      });
    }

    // 旧リセットモーダルのフォールバック処理（万が一残っている場合用）
    const resetOpenBtn = document.getElementById("btn-reset-game");
    const resetModal = document.getElementById("reset-confirm-modal");
    const resetCancelBtn = document.getElementById("btn-cancel-reset");
    const resetConfirmBtn = document.getElementById("btn-confirm-reset");

    if (resetOpenBtn && resetModal) {
      resetOpenBtn.addEventListener("click", () => resetModal.classList.remove("hidden"));
    }
    if (resetCancelBtn && resetModal) {
      resetCancelBtn.addEventListener("click", () => resetModal.classList.add("hidden"));
    }
    if (resetModal) {
      resetModal.addEventListener("click", (e) => {
        if (e.target === resetModal) resetModal.classList.add("hidden");
      });
    }
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

  /**
   * 試合終了モーダルを開き、現在のスコアと対戦サマリーを流し込む
   */
  openFinishGameModal() {
    const modal = document.getElementById("finish-game-modal");
    if (!modal) return;

    const state = this.gameState.getState();
    const info = state.gameInfo || {};

    const awayName = state.teams?.away?.name || "先攻チーム";
    const homeName = state.teams?.home?.name || "後攻チーム";

    const totalAway = (state.awayScore || []).reduce((acc, cur) => acc + (Number(cur) || 0), 0);
    const totalHome = (state.homeScore || []).reduce((acc, cur) => acc + (Number(cur) || 0), 0);

    const dateEl = document.getElementById("finish-summary-date");
    const tourEl = document.getElementById("finish-summary-tournament");
    const teamAwayEl = document.getElementById("finish-team-away");
    const teamHomeEl = document.getElementById("finish-team-home");
    const scoreAwayEl = document.getElementById("finish-score-away");
    const scoreHomeEl = document.getElementById("finish-score-home");
    const pitchInfoEl = document.getElementById("finish-pitch-count-info");

    if (dateEl) dateEl.textContent = info.date || new Date().toISOString().slice(0, 10);
    if (tourEl) tourEl.textContent = info.tournament || "公式戦";
    if (teamAwayEl) teamAwayEl.textContent = awayName;
    if (teamHomeEl) teamHomeEl.textContent = homeName;
    if (scoreAwayEl) scoreAwayEl.textContent = totalAway;
    if (scoreHomeEl) scoreHomeEl.textContent = totalHome;

    if (pitchInfoEl) {
      const elapsedMinutes = Math.floor(((state.timeLimitMinutes * 60) - (state.timerRemainingSeconds || 0)) / 60);
      pitchInfoEl.textContent = `総投球数: ${state.pitchCount || 0}球 | 経過時間: 約${Math.max(0, elapsedMinutes)}分 | イニング: ${state.inning}回`;
    }

    modal.classList.remove("hidden");
  }

  /**
   * 試合を過去試合アーカイブへ保存し、安全にバックアップをダウンロードして初期化
   */
  async executeSaveAndFinishGame() {
    const state = this.gameState.getState();

    // 1. 過去試合専用の独立IndexedDB（gameArchiveStore）へ保存
    try {
      if (gameArchiveStore && typeof gameArchiveStore.saveGame === "function") {
        await gameArchiveStore.saveGame(state);
        console.log("📁 過去試合アーカイブへ正式保存しました。");
      }
    } catch (err) {
      console.warn("過去試合アーカイブ保存エラー:", err);
    }

    // 2. 【Safari 7日間パージ対策】端末のダウンロードへ .gakudo バックアップを静かに自動書き出し
    try {
      this.triggerAutoBackupDownload(state);
    } catch (err) {
      console.warn("自動バックアップダウンロードスキップ:", err);
    }

    // 3. 画面と進行中DBをリセットして次の試合準備
    this.gameState.resetGame();
    try {
      dbStorage.saveActiveGame(this.gameState.getState());
    } catch (err) {
      console.warn("初期化時の進行中DB更新スキップ:", err);
    }
  }

  /**
   * 試合終了時の自動ローカルバックアップ（.gakudo形式）
   */
  triggerAutoBackupDownload(state) {
    const info = state.gameInfo || {};
    const dateStr = info.date || new Date().toISOString().slice(0, 10);
    const awayName = state.teams?.away?.name || "先攻";
    const homeName = state.teams?.home?.name || "後攻";
    const filename = `試合記録_${dateStr}_${awayName}vs${homeName}.gakudo`;

    const jsonStr = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
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

    const currentBatterSnapshot = snapshot.currentBatter || {};
    const pitchEvent = {
      pitchNum: state.pitchCount,
      inningStr: `${snapshot.inning}回${snapshot.isTop ? "表" : "裏"}`,
      isTop: snapshot.isTop,
      batterOrder: currentBatterSnapshot.order,
      batterName: currentBatterSnapshot.name,
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
