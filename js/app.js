/**
 * js/app.js
 * 学童野球 1球速報 アプリケーション・エントリーポイント（司令塔）
 * 全コンポーネントの初期化、新規試合安全リセット、 IndexedDB自動保存の統括
 */

import { GameState } from "./state.js";
import { ScoreboardComponent } from "./components/scoreboard.js";
import { RunnerDiamondComponent } from "./components/runnerDiamond.js";
import { ZoneComponent } from "./components/zone.js";
import { SprayModalComponent } from "./components/sprayModal.js";
import { RosterViewComponent } from "./components/rosterView.js";
import { dbStorage } from "./storage/indexedDb.js";
import { DataExporter } from "./storage/exporter.js";

class AppController {
  constructor() {
    this.gameState = new GameState();
    this.components = {};
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      this.initSynchronousUI();
      this.bindGlobalEvents();
      this.restoreSavedGame();
    } catch (err) {
      console.error("アプリケーション起動中にエラーが発生しました:", err);
      this.showInitError(err);
    }
  }

  initSynchronousUI() {
    // 1. スコアボード
    const scoreboardSlot = document.getElementById("scoreboard-slot");
    if (scoreboardSlot) {
      try {
        this.components.scoreboard = new ScoreboardComponent(scoreboardSlot, this.gameState);
      } catch (e) {
        console.warn("スコアボード初期化警告:", e);
      }
    }

    // 2. 走者ダイアモンド & BSO
    const diamondSlot = document.getElementById("diamond-slot");
    if (diamondSlot) {
      try {
        this.components.diamond = new RunnerDiamondComponent(diamondSlot, this.gameState);
      } catch (e) {
        console.warn("ダイアモンド初期化警告:", e);
      }
    }

    // 3. 打球スプレーモーダル
    const sprayModalSlot = document.getElementById("spray-modal-slot");
    if (sprayModalSlot) {
      try {
        this.components.sprayModal = new SprayModalComponent(sprayModalSlot, this.gameState);
      } catch (e) {
        console.warn("打球モーダル初期化警告:", e);
      }
    }

    // 4. 17分割投球コース盤面
    const zoneSlot = document.getElementById("zone-slot");
    if (zoneSlot) {
      try {
        this.components.zone = new ZoneComponent(zoneSlot, this.gameState, {
          onInPlay: (selectedCourse) => this.handleInPlay(selectedCourse)
        });
      } catch (e) {
        console.warn("盤面初期化警告:", e);
      }
    }

    // 5. オーダー・名簿モーダル
    const rosterModalSlot = document.getElementById("roster-modal-slot");
    if (rosterModalSlot) {
      try {
        this.components.rosterView = new RosterViewComponent(rosterModalSlot, this.gameState);
      } catch (e) {
        console.warn("オーダー画面初期化警告:", e);
      }
    }

    // 1球記録ごとにIndexedDBへ自動保存
    this.gameState.subscribe((state) => {
      try {
        if (dbStorage && typeof dbStorage.saveActiveGame === "function") {
          dbStorage.saveActiveGame(state);
        }
      } catch (e) {
        console.warn("自動保存スキップ:", e);
      }
    });
  }

  bindGlobalEvents() {
    // 1球取消（アンドゥ）
    const btnUndo = document.getElementById("btn-undo");
    if (btnUndo) {
      btnUndo.addEventListener("click", (e) => {
        e.preventDefault();
        this.gameState.undo();
      });
    }

    // 新規試合開始（安全確認モーダル）
    const btnReset = document.getElementById("btn-reset-game");
    if (btnReset) {
      btnReset.addEventListener("click", (e) => {
        e.preventDefault();
        this.openResetConfirmModal();
      });
    }

    // オーダー編成モーダル表示
    const btnRoster = document.getElementById("btn-open-roster");
    const rosterSlot = document.getElementById("roster-modal-slot");
    if (btnRoster && rosterSlot) {
      btnRoster.addEventListener("click", () => {
        rosterSlot.classList.remove("hidden");
        if (this.components.rosterView) {
          this.components.rosterView.render();
          this.components.rosterView.bindEvents();
        }
      });
    }

    // CSVエクスポート
    const btnCsv = document.getElementById("btn-export-csv");
    if (btnCsv) {
      btnCsv.addEventListener("click", () => {
        const state = this.gameState.getState();
        DataExporter.exportGameCsv(state);
      });
    }

    // PCキーボードショートカット (Ctrl + Z / Cmd + Z で1球取消)
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.gameState.undo();
      }
    });
  }

  openResetConfirmModal() {
    let modalSlot = document.getElementById("reset-modal-slot");
    if (!modalSlot) {
      modalSlot = document.createElement("div");
      modalSlot.id = "reset-modal-slot";
      document.body.appendChild(modalSlot);
    }

    modalSlot.innerHTML = `
      <div class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 select-none">
        <div class="bg-slate-900 border border-rose-800/80 rounded-2xl p-4 w-full max-w-sm space-y-3 shadow-2xl">
          <div class="flex items-center gap-2 text-rose-400 border-b border-slate-800 pb-2">
            <span class="text-xl">⚠️</span>
            <h3 class="text-sm font-black">試合データの初期化</h3>
          </div>
          
          <p class="text-xs text-slate-300 leading-relaxed">
            現在のスコア、投球数、全打席ログを消去して<strong class="text-amber-400">新しい試合を開始</strong>しますか？<br>
            <span class="text-[10px] text-slate-400 block pt-1">※ 必要な場合は先に「📤 CSV」で保存してください。</span>
          </p>

          <div class="flex gap-2 pt-2 border-t border-slate-800">
            <button type="button" id="btn-cancel-reset" class="w-1/2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition">
              キャンセル
            </button>
            <button type="button" id="btn-confirm-reset" class="w-1/2 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-xs shadow-lg transition">
              クリアして新規試合
            </button>
          </div>
        </div>
      </div>
    `;
    modalSlot.classList.remove("hidden");

    const close = () => modalSlot.classList.add("hidden");

    const cancelBtn = modalSlot.querySelector("#btn-cancel-reset");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", close);
    }

    const confirmBtn = modalSlot.querySelector("#btn-confirm-reset");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        try {
          if (dbStorage && typeof dbStorage.clearActiveGame === "function") {
            await dbStorage.clearActiveGame();
          }
        } catch (e) {
          console.warn("DBクリア警告:", e);
        }

        if (this.gameState && typeof this.gameState.resetGame === "function") {
          this.gameState.resetGame();
        }

        if (this.components.scoreboard && typeof this.components.scoreboard.resetTimer === "function") {
          this.components.scoreboard.resetTimer();
        }
        close();
      });
    }
  }

  handleInPlay(selectedCourse) {
    if (!this.components.sprayModal) return;

    this.components.sprayModal.open({
      course: selectedCourse,
      onComplete: (playResult) => {
        const state = this.gameState.getState();
        const snapshot = JSON.parse(JSON.stringify(state));

        let runsScored = playResult.runs || 0;
        let isOut = false;

        // 打球結果に応じた走者とカウント処理
        switch (playResult.type) {
          case "単打":
            if (state.runners[3]) { runsScored += 1; state.runners[3] = false; }
            if (state.runners[2]) { state.runners[3] = true; state.runners[2] = false; }
            if (state.runners[1]) { state.runners[2] = true; }
            state.runners[1] = true;
            break;
          case "二塁打":
            if (state.runners[3]) { runsScored += 1; state.runners[3] = false; }
            if (state.runners[2]) { runsScored += 1; state.runners[2] = false; }
            if (state.runners[1]) { state.runners[3] = true; state.runners[1] = false; }
            state.runners[2] = true;
            break;
          case "三塁打":
            if (state.runners[3]) runsScored += 1;
            if (state.runners[2]) runsScored += 1;
            if (state.runners[1]) runsScored += 1;
            state.runners = { 1: false, 2: false, 3: true };
            break;
          case "本塁打":
            runsScored += 1;
            if (state.runners[1]) runsScored += 1;
            if (state.runners[2]) runsScored += 1;
            if (state.runners[3]) runsScored += 1;
            state.runners = { 1: false, 2: false, 3: false };
            break;
          case "凡打":
          case "犠牲フライ":
          case "送りバント":
            isOut = true;
            break;
          default:
            break;
        }

        if (runsScored > 0) {
          this.gameState.addRun(runsScored);
        }

        const pitchEvent = {
          pitchNum: state.pitchCount + 1,
          inningStr: `${state.inning}回${state.isTop ? "表" : "裏"}`,
          course: selectedCourse,
          result: `打球 (${playResult.type})`,
          bsoBefore: `${state.balls}-${state.strikes}-${state.outs}`,
          play: playResult
        };

        state.pitchCount += 1;
        state.history.push({ snapshot, pitchEvent });

        if (isOut) {
          this.gameState.handleOut();
        }
        this.gameState.resetCount();
        this.gameState.notify();
      }
    });
  }

  async restoreSavedGame() {
    try {
      if (dbStorage && typeof dbStorage.loadActiveGame === "function") {
        const savedState = await dbStorage.loadActiveGame();
        if (savedState && savedState.history && savedState.history.length > 0) {
          this.gameState.state = savedState;
          this.gameState.notify();
        }
      }
    } catch (err) {
      console.warn("保存データの読み込みをスキップしました:", err);
    }
  }

  showInitError(err) {
    const mainSlot = document.querySelector("main");
    if (mainSlot) {
      mainSlot.innerHTML = `
        <div class="bg-rose-950/80 border border-rose-700 text-rose-200 p-4 rounded-xl text-xs space-y-2 m-4">
          <p class="font-bold text-sm">起動中にエラーが発生しました</p>
          <p class="font-mono text-[11px] bg-slate-950 p-2 rounded">${err.message}</p>
          <p class="text-[10px] text-slate-400">※ ブラウザを再読み込み（Ctrl + Shift + R）するか、新規試合ボタンをお試しください。</p>
        </div>
      `;
    }
  }
}

const app = new AppController();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => app.init());
} else {
  app.init();
}
