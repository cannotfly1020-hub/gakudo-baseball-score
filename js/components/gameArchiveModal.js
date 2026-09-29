/**
 * js/components/gameArchiveModal.js
 * 過去試合アーカイブ・履歴管理モーダルコンポーネント（完全自律・確実開閉版）
 * 
 * 構造設計の刷新:
 * - 親コンテナ (#archive-modal-slot) へのクラス競合 (hidden vs flex) を完全撤廃
 * - 内部に独立した #archive-modal-backdrop を構築し、安全にオーバーレイを描画
 * - 初期化時に style.display = "none" を直接指定し、起動時即座の非表示を物理的に保証
 * - CSV出力（現在試合・過去試合）を完全統合
 */

import { gameArchiveStore } from "../storage/gameArchiveStore.js";
import { DataExporter } from "../storage/exporter.js";

export class GameArchiveModalComponent {
  /**
   * @param {HTMLElement} containerElement 描画対象の親要素 (#archive-modal-slot)
   * @param {GameState} gameState 試合状態管理インスタンス
   * @param {Object} options コールバック等
   */
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;

    this.pendingDeleteId = null;

    // 1. 初期状態として物理的に非表示を最優先確定
    this.container.classList.add("hidden");
    this.container.style.display = "none";

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    // 2. 描画後も確実に非表示状態を二重保証
    this.close();
  }

  render() {
    // 親要素の className は汚さず、クラス競合をゼロにする
    this.container.innerHTML = `
      <!-- モーダル背景オーバーレイ（flex はこの内部要素でのみ使用） -->
      <div id="archive-modal-backdrop" class="fixed inset-0 bg-black/85 z-50 p-2 sm:p-4 overflow-y-auto flex items-center justify-center select-none animate-fadeIn">
        
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
          
          <!-- モーダルヘッダー -->
          <div class="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/70 flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-base sm:text-lg">📁</span>
              <h2 class="text-xs sm:text-sm font-black text-slate-100">試合アーカイブ・履歴管理</h2>
              <span class="text-[10px] bg-slate-800 text-indigo-400 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-900/50">
                オフライン保存
              </span>
            </div>
            <button type="button" id="btn-close-archive-modal" class="text-slate-400 hover:text-white text-base px-2 py-1 rounded-lg hover:bg-slate-800 transition">
              ✕
            </button>
          </div>

          <!-- スクロール可能コンテンツ領域 -->
          <div class="p-3 overflow-y-auto space-y-3 flex-1">
            
            <!-- 現在の試合 保存アクションカード -->
            <div class="bg-slate-950/80 border border-emerald-900/60 rounded-xl p-3 flex-shrink-0 space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <span>⚾️</span>
                  <span>現在記録中の試合:</span>
                </span>
                <span id="current-game-quick-summary" class="text-[10px] text-emerald-400 font-bold font-mono">
                  集計中...
                </span>
              </div>

              <div class="flex items-center gap-2">
                <button type="button" id="btn-save-current-game" class="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2 px-2 rounded-lg text-xs shadow-md transition flex items-center justify-center gap-1.5">
                  <span>💾</span>
                  <span class="truncate">アーカイブに保存</span>
                </button>
                <button type="button" id="btn-export-current-csv" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 font-bold py-2 px-3 rounded-lg text-xs border border-emerald-900/60 transition flex items-center justify-center gap-1" title="現在の試合のCSVを出力">
                  <span>📤</span>
                  <span class="truncate">CSV</span>
                </button>
              </div>
              <p id="save-status-msg" class="text-[10px] text-slate-400 text-center hidden"></p>
            </div>

            <!-- 保存済み試合一覧ヘッダー -->
            <div class="flex items-center justify-between pt-1">
              <span class="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <span>📚</span>
                <span>保存済みの試合一覧</span>
              </span>
              <span id="saved-games-count" class="text-[10px] text-slate-500 font-mono font-bold">0試合</span>
            </div>

            <!-- 過去試合カードリスト受皿 -->
            <div id="saved-games-list" class="space-y-2 min-h-[140px]">
              <div class="text-center py-8 text-xs text-slate-500">
                読み込み中...
              </div>
            </div>

          </div>

        </div>

        <!-- 削除確認ダイアログ（2段階確認） -->
        <div id="delete-confirm-dialog" class="hidden fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-rose-900/80 rounded-2xl w-full max-w-xs p-3.5 shadow-2xl space-y-2.5 animate-fadeIn" onclick="event.stopPropagation()">
            <div class="flex items-center gap-2 text-rose-400 border-b border-slate-800 pb-1.5">
              <span class="text-base">⚠️</span>
              <h4 class="font-black text-xs text-slate-200">過去試合の削除</h4>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">
              選択した試合データをアーカイブから完全に削除します。<br>
              <span class="text-rose-400 font-bold">※この操作は元に戻せません。</span>
            </p>
            <div class="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
              <button type="button" id="btn-cancel-delete" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition">
                キャンセル
              </button>
              <button type="button" id="btn-confirm-delete" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-lg transition shadow">
                削除実行
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  renderGameCard(game) {
    const s = game.summary || {};
    let winnerBadge = "";

    if (s.winner === "away") {
      winnerBadge = `<span class="bg-sky-950 text-sky-400 border border-sky-800/80 text-[9px] font-bold px-1.5 py-0.2 rounded">${s.awayTeamName} 勝利</span>`;
    } else if (s.winner === "home") {
      winnerBadge = `<span class="bg-amber-950 text-amber-400 border border-amber-800/80 text-[9px] font-bold px-1.5 py-0.2 rounded">${s.homeTeamName} 勝利</span>`;
    } else {
      winnerBadge = `<span class="bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-bold px-1.5 py-0.2 rounded">引き分け</span>`;
    }

    return `
      <div class="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 space-y-2 transition shadow" data-card-id="${game.id}">
        <!-- 上段: 日付・大会名・勝敗バッジ -->
        <div class="flex items-center justify-between text-[10px]">
          <div class="flex items-center gap-1.5 text-slate-400 font-mono">
            <span>📅</span>
            <span class="text-slate-300 font-bold">${s.date || "-"}</span>
            <span class="text-slate-600">|</span>
            <span class="text-slate-400 truncate max-w-[130px] font-sans">${s.tournament || "公式戦"}</span>
          </div>
          <div>${winnerBadge}</div>
        </div>

        <!-- 中段: 対戦カード ＆ スコア表示 -->
        <div class="flex items-center justify-between bg-slate-900/60 rounded-lg px-2.5 py-1.5 border border-slate-800/80">
          <div class="flex-1 text-left truncate">
            <span class="font-bold text-xs text-slate-200 block truncate">${s.awayTeamName}</span>
            <span class="text-[9px] text-slate-500 font-sans">先攻</span>
          </div>
          
          <!-- スコア -->
          <div class="px-3 flex items-center gap-1.5 font-mono">
            <span class="text-sm font-black ${s.awayScoreTotal > s.homeScoreTotal ? 'text-sky-400' : 'text-slate-300'}">${s.awayScoreTotal}</span>
            <span class="text-xs text-slate-600">-</span>
            <span class="text-sm font-black ${s.homeScoreTotal > s.awayScoreTotal ? 'text-amber-400' : 'text-slate-300'}">${s.homeScoreTotal}</span>
          </div>

          <div class="flex-1 text-right truncate">
            <span class="font-bold text-xs text-slate-200 block truncate">${s.homeTeamName}</span>
            <span class="text-[9px] text-slate-500 font-sans">後攻</span>
          </div>
        </div>

        <!-- 下段: 操作アクションボタン群 -->
        <div class="flex items-center justify-between gap-1.5 pt-0.5">
          <button type="button" class="btn-card-scoresheet flex-1 py-1 px-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-amber-400 font-bold rounded-lg border border-amber-900/40 text-[11px] flex items-center justify-center gap-1 transition" data-id="${game.id}">
            <span>📄</span>
            <span>スコア表</span>
          </button>
          <button type="button" class="btn-card-resume flex-1 py-1 px-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-sky-400 font-bold rounded-lg border border-sky-900/40 text-[11px] flex items-center justify-center gap-1 transition" data-id="${game.id}">
            <span>🔄</span>
            <span>再開</span>
          </button>
          <button type="button" class="btn-card-csv py-1 px-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-emerald-400 font-bold rounded-lg border border-emerald-900/40 text-[11px] flex items-center justify-center gap-1 transition" data-id="${game.id}" title="この過去試合のCSVを出力">
            <span>📤</span>
            <span>CSV</span>
          </button>
          <button type="button" class="btn-card-delete py-1 px-2 bg-slate-900 hover:bg-rose-950/60 active:scale-95 text-rose-400 font-bold rounded-lg border border-rose-900/40 text-[11px] flex items-center justify-center transition" data-id="${game.id}" title="この試合を削除">
            <span>🗑</span>
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 閉じるボタン
    const btnClose = this.container.querySelector("#btn-close-archive-modal");
    if (btnClose) {
      btnClose.addEventListener("click", () => this.close());
    }

    // 現在の試合を保存
    const btnSave = this.container.querySelector("#btn-save-current-game");
    if (btnSave) {
      btnSave.addEventListener("click", () => this.handleSaveCurrentGame());
    }

    // 現在の試合のCSV出力
    const btnExportCurrent = this.container.querySelector("#btn-export-current-csv");
    if (btnExportCurrent) {
      btnExportCurrent.addEventListener("click", () => {
        const state = this.gameState.getState();
        const info = state.gameInfo || {};
        DataExporter.exportGameCsv({
          date: info.date || new Date().toISOString().slice(0, 10),
          opponent: info.oppTeamName || "相手チーム",
          history: state.history || []
        });
      });
    }

    // 削除確認モーダルのキャンセル
    const btnCancelDelete = this.container.querySelector("#btn-cancel-delete");
    const deleteDialog = this.container.querySelector("#delete-confirm-dialog");
    if (btnCancelDelete && deleteDialog) {
      btnCancelDelete.addEventListener("click", () => {
        deleteDialog.classList.add("hidden");
        this.pendingDeleteId = null;
      });
    }

    // 削除確定
    const btnConfirmDelete = this.container.querySelector("#btn-confirm-delete");
    if (btnConfirmDelete && deleteDialog) {
      btnConfirmDelete.addEventListener("click", async () => {
        if (this.pendingDeleteId) {
          await gameArchiveStore.deleteGame(this.pendingDeleteId);
          this.pendingDeleteId = null;
          deleteDialog.classList.add("hidden");
          await this.loadAndRenderSavedGames();
        }
      });
    }

    // 背景黒部分タップで閉じる
    const backdrop = this.container.querySelector("#archive-modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          this.close();
        }
      });
    }
  }

  bindCardEvents() {
    // スコア表閲覧
    this.container.querySelectorAll(".btn-card-scoresheet").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const gameId = btn.getAttribute("data-id");
        const record = await gameArchiveStore.getGameById(gameId);
        if (record && record.gameState) {
          if (typeof this.options.onViewScoreSheet === "function") {
            this.options.onViewScoreSheet(record.gameState);
          }
        }
      });
    });

    // 試合再開
    this.container.querySelectorAll(".btn-card-resume").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gameId = btn.getAttribute("data-id");
        this.handleResumeGame(gameId);
      });
    });

    // 過去試合のCSV出力
    this.container.querySelectorAll(".btn-card-csv").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const gameId = btn.getAttribute("data-id");
        const record = await gameArchiveStore.getGameById(gameId);
        if (!record || !record.gameState) return;
        const gState = record.gameState;
        const info = gState.gameInfo || {};
        DataExporter.exportGameCsv({
          date: info.date || (record.savedAt ? record.savedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
          opponent: info.oppTeamName || (record.summary ? record.summary.homeTeamName : "相手チーム"),
          history: gState.history || []
        });
      });
    });

    // 削除確認モーダル展開
    this.container.querySelectorAll(".btn-card-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gameId = btn.getAttribute("data-id");
        this.pendingDeleteId = gameId;
        const deleteDialog = this.container.querySelector("#delete-confirm-dialog");
        if (deleteDialog) {
          deleteDialog.classList.remove("hidden");
        }
      });
    });
  }

  async handleSaveCurrentGame() {
    const statusMsg = this.container.querySelector("#save-status-msg");
    const saveBtn = this.container.querySelector("#btn-save-current-game");

    try {
      if (saveBtn) saveBtn.disabled = true;
      const state = this.gameState.getState();
      await gameArchiveStore.saveGame(state);

      if (statusMsg) {
        statusMsg.textContent = "✓ アーカイブに保存しました";
        statusMsg.className = "text-[10px] text-emerald-400 font-bold text-center block animate-pulse";
        setTimeout(() => {
          statusMsg.className = "hidden";
        }, 2500);
      }

      await this.loadAndRenderSavedGames();
    } catch (err) {
      console.error("試合保存失敗:", err);
      if (statusMsg) {
        statusMsg.textContent = "⚠️ 保存に失敗しました";
        statusMsg.className = "text-[10px] text-rose-400 font-bold text-center block";
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async handleResumeGame(gameId) {
    const record = await gameArchiveStore.getGameById(gameId);
    if (!record || !record.gameState) return;

    if (typeof this.options.onResumeGame === "function") {
      this.options.onResumeGame(record.gameState);
      this.close();
    }
  }

  async loadAndRenderSavedGames() {
    const listContainer = this.container.querySelector("#saved-games-list");
    const countBadge = this.container.querySelector("#saved-games-count");
    if (!listContainer) return;

    try {
      const games = await gameArchiveStore.getAllGames();
      if (countBadge) countBadge.textContent = `${games.length}試合`;

      if (games.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-8 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60 p-4 space-y-1">
            <span class="text-xl block mb-1">📭</span>
            <span>保存済みの過去試合はありません</span>
            <p class="text-[10px] text-slate-600">試合終了後に上の「アーカイブに保存」を押すとここに蓄積されます</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = games.map((g) => this.renderGameCard(g)).join("");
      this.bindCardEvents();
    } catch (err) {
      console.error("過去試合一覧ロードエラー:", err);
      listContainer.innerHTML = `
        <div class="text-center py-6 text-xs text-rose-400 bg-rose-950/20 rounded-xl border border-rose-900/40">
          データの読み込みに失敗しました
        </div>
      `;
    }
  }

  updateCurrentGameQuickSummary() {
    const summaryEl = this.container.querySelector("#current-game-quick-summary");
    if (!summaryEl) return;

    const state = this.gameState.getState();
    const info = state.gameInfo || {};
    const teams = state.teams || {};

    const awayName = (teams.away && teams.away.name) ? teams.away.name : (info.myTeamSide === "away" ? info.myTeamName : info.oppTeamName) || "先攻";
    const homeName = (teams.home && teams.home.name) ? teams.home.name : (info.myTeamSide === "home" ? info.myTeamName : info.oppTeamName) || "後攻";

    const awayScoreTotal = (state.awayScore || []).reduce((a, b) => a + (Number(b) || 0), 0);
    const homeScoreTotal = (state.homeScore || []).reduce((a, b) => a + (Number(b) || 0), 0);

    summaryEl.textContent = `${awayName} ${awayScoreTotal} - ${homeScoreTotal} ${homeName} (${state.inning || 1}回)`;
  }

  /**
   * モーダルを展開する
   * CSSクラスとインラインスタイルの双方で確実に表示
   */
  open() {
    this.updateCurrentGameQuickSummary();
    this.loadAndRenderSavedGames();
    this.container.classList.remove("hidden");
    this.container.style.display = "block";
  }

  /**
   * モーダルを閉じる（非表示にする）
   * CSSクラスとインラインスタイルの双方で物理的に非表示を強制
   */
  close() {
    this.container.classList.add("hidden");
    this.container.style.display = "none";
  }
}
