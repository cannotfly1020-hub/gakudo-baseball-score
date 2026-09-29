/**
 * js/components/gameArchiveModal.js
 * 過去試合一覧 ＆ アーカイブ管理モーダルコンポーネント
 * 
 * 担当役割:
 * - 保存済み過去試合の一覧をカード形式（日付、大会名、対戦カード、スコア、勝敗）で表示
 * - 「現在の試合を保存」ボタンの実行と即時一覧更新
 * - 各試合カードの「📄 スコア表を見る」「🔄 この試合を再開」「🗑 削除」の操作
 * - 誤操作防止の確認モーダル（削除確認・再開時の上書き確認）
 */

import { gameArchiveStore } from "../storage/gameArchiveStore.js";

export class GameArchiveModalComponent {
  /**
   * @param {HTMLElement} containerElement モーダル受皿要素 (#archive-modal-slot)
   * @param {GameState} gameState 試合状態管理インスタンス
   * @param {Object} callbacks コールバック群 ({ onViewScoreSheet, onResumeGame })
   */
  constructor(containerElement, gameState, callbacks = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.callbacks = callbacks;
    this.savedGames = [];
    this.selectedGameId = null;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div id="archive-modal-backdrop" class="fixed inset-0 bg-black/85 z-50 overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-center select-none">
        
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-3 sm:p-4 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
          
          <!-- ヘッダー -->
          <div class="flex items-center justify-between border-b border-slate-800 pb-2 flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-lg">📁</span>
              <h2 class="text-sm sm:text-base font-black text-slate-100">試合アーカイブ・履歴管理</h2>
              <span id="archive-game-count" class="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                0件
              </span>
            </div>
            <button type="button" id="btn-close-archive-modal" class="text-slate-400 hover:text-white text-lg px-2 py-0.5 rounded hover:bg-slate-800 transition">
              ✕
            </button>
          </div>

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
              <button type="button" id="btn-save-current-game" class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2 px-3 rounded-lg text-xs shadow-md transition flex items-center justify-center gap-1.5">
                <span>💾</span>
                <span>現在の試合をアーカイブに新規保存する</span>
              </button>
            </div>
            <p id="save-status-msg" class="text-[10px] text-slate-400 text-center hidden"></p>
          </div>

          <!-- 保存済み試合一覧ヘッダー -->
          <div class="flex items-center justify-between px-1 flex-shrink-0">
            <span class="text-xs font-bold text-slate-300">保存済みの過去試合一覧</span>
            <span class="text-[10px] text-slate-500">※新しい試合順</span>
          </div>

          <!-- 過去試合カードリスト（スクロール領域） -->
          <div id="archive-list-container" class="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
            <div class="text-center text-slate-500 text-xs py-8">
              読み込み中...
            </div>
          </div>

        </div>

      </div>

      <!-- 削除確認モーダル（誤タップ防止） -->
      <div id="archive-delete-confirm-modal" class="hidden fixed inset-0 bg-black/90 z-60 flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-rose-900/60 rounded-xl w-full max-w-xs p-3.5 shadow-2xl space-y-2.5">
          <div class="flex items-center gap-2 text-rose-400 border-b border-slate-800 pb-1.5">
            <span>⚠️</span>
            <span class="text-xs font-bold text-slate-100">試合データの削除</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            選択した試合をアーカイブから完全に削除しますか？<br>
            <span class="text-rose-400 font-bold text-[10px]">※この操作は取り消せません。</span>
          </p>
          <div class="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button type="button" id="btn-cancel-archive-delete" class="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700">
              キャンセル
            </button>
            <button type="button" id="btn-confirm-archive-delete" class="px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-500 shadow">
              削除する
            </button>
          </div>
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

    // 削除確認モーダルのキャンセル
    const btnCancelDelete = this.container.querySelector("#btn-cancel-archive-delete");
    if (btnCancelDelete) {
      btnCancelDelete.addEventListener("click", () => {
        const modal = this.container.querySelector("#archive-delete-confirm-modal");
        if (modal) modal.classList.add("hidden");
        this.selectedGameId = null;
      });
    }

    // 削除確定
    const btnConfirmDelete = this.container.querySelector("#btn-confirm-archive-delete");
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener("click", () => this.handleDeleteConfirmed());
    }
  }

  async open() {
    this.updateCurrentGamePreview();
    this.container.classList.remove("hidden");
    await this.reloadGamesList();
  }

  close() {
    this.container.classList.add("hidden");
  }

  updateCurrentGamePreview() {
    const previewEl = this.container.querySelector("#current-game-quick-summary");
    if (!previewEl) return;

    const state = this.gameState.getState();
    const info = state.gameInfo || {};
    const teams = state.teams || {};

    const awayScore = state.awayScore || [];
    const homeScore = state.homeScore || [];
    const awayTotal = awayScore.reduce((a, b) => a + (Number(b) || 0), 0);
    const homeTotal = homeScore.reduce((a, b) => a + (Number(b) || 0), 0);

    const awayName = (teams.away && teams.away.name) ? teams.away.name : (info.myTeamSide === "away" ? info.myTeamName : info.oppTeamName) || "先攻";
    const homeName = (teams.home && teams.home.name) ? teams.home.name : (info.myTeamSide === "home" ? info.myTeamName : info.oppTeamName) || "後攻";

    previewEl.textContent = `${awayName} ${awayTotal} - ${homeTotal} ${homeName} (${state.pitchCount || 0}球)`;
  }

  async reloadGamesList() {
    const listContainer = this.container.querySelector("#archive-list-container");
    const countBadge = this.container.querySelector("#archive-game-count");

    try {
      this.savedGames = await gameArchiveStore.getAllGames();

      if (countBadge) {
        countBadge.textContent = `${this.savedGames.length}件`;
      }

      if (!listContainer) return;

      if (this.savedGames.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center text-slate-500 text-xs py-8 bg-slate-950/40 rounded-xl border border-slate-800">
            保存された過去試合はありません。<br>
            上の「現在の試合を保存する」ボタンを押すとここに蓄積されます。
          </div>
        `;
        return;
      }

      listContainer.innerHTML = this.savedGames.map((game) => this.renderGameCard(game)).join("");
      this.bindCardEvents();
    } catch (err) {
      console.error("過去試合読み込み失敗:", err);
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="text-center text-rose-400 text-xs py-6">
            過去試合の読み込みに失敗しました。
          </div>
        `;
      }
    }
  }

  renderGameCard(game) {
    const s = game.summary || {};
    const formattedDate = s.date || (game.savedAt ? game.savedAt.slice(0, 10) : "-");

    // 勝敗バッジのスタイル定義
    let resultBadge = `<span class="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-bold">引分</span>`;
    if (s.winner === "away") {
      resultBadge = `<span class="bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.5 rounded text-[10px] font-bold">${s.awayTeamName} 勝利</span>`;
    } else if (s.winner === "home") {
      resultBadge = `<span class="bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">${s.homeTeamName} 勝利</span>`;
    }

    return `
      <div class="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 space-y-2 transition shadow" data-game-id="${game.id}">
        <!-- 上段: 日付・大会名・勝敗 -->
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <span>📅 ${formattedDate}</span>
            <span class="text-slate-600">|</span>
            <span class="text-slate-300 font-sans font-bold truncate max-w-[120px] sm:max-w-[160px]">${s.tournament || "公式戦"}</span>
          </div>
          <div>${resultBadge}</div>
        </div>

        <!-- 中段: 対戦カード ＆ スコア表示 -->
        <div class="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
          <div class="flex items-center gap-2 flex-1 truncate">
            <span class="font-bold text-slate-200 text-xs truncate max-w-[110px] sm:max-w-[150px]">${s.awayTeamName}</span>
            <span class="text-slate-500 text-[10px]">vs</span>
            <span class="font-bold text-slate-200 text-xs truncate max-w-[110px] sm:max-w-[150px]">${s.homeTeamName}</span>
          </div>
          <div class="flex items-baseline gap-1 font-mono font-black text-sm text-emerald-400 pl-2">
            <span>${s.awayScoreTotal}</span>
            <span class="text-slate-600 text-xs">-</span>
            <span>${s.homeScoreTotal}</span>
            <span class="text-[9px] text-slate-500 font-normal ml-1">(${s.totalPitches || 0}球)</span>
          </div>
        </div>

        <!-- 下段: 操作アクションボタン群 -->
        <div class="flex items-center justify-between gap-1.5 pt-0.5">
          <button type="button" class="btn-card-scoresheet flex-1 py-1 px-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-amber-400 font-bold rounded-lg border border-amber-900/40 text-[11px] flex items-center justify-center gap-1 transition" data-id="${game.id}">
            <span>📄</span>
            <span>スコア表</span>
          </button>
          <button type="button" class="btn-card-resume flex-1 py-1 px-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-sky-400 font-bold rounded-lg border border-sky-900/40 text-[11px] flex items-center justify-center gap-1 transition" data-id="${game.id}">
            <span>🔄</span>
            <span>復元・再開</span>
          </button>
          <button type="button" class="btn-card-delete py-1 px-2.5 bg-slate-900 hover:bg-rose-950/60 active:scale-95 text-rose-400 font-bold rounded-lg border border-rose-900/40 text-[11px] flex items-center justify-center transition" data-id="${game.id}" title="この試合を削除">
            <span>🗑</span>
          </button>
        </div>
      </div>
    `;
  }

  bindCardEvents() {
    // スコア表閲覧
    this.container.querySelectorAll(".btn-card-scoresheet").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gameId = btn.getAttribute("data-id");
        this.handleViewScoreSheet(gameId);
      });
    });

    // 試合再開
    this.container.querySelectorAll(".btn-card-resume").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gameId = btn.getAttribute("data-id");
        this.handleResumeGame(gameId);
      });
    });

    // 削除確認モーダル展開
    this.container.querySelectorAll(".btn-card-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gameId = btn.getAttribute("data-id");
        this.selectedGameId = gameId;
        const modal = this.container.querySelector("#archive-delete-confirm-modal");
        if (modal) modal.classList.remove("hidden");
      });
    });
  }

  async handleSaveCurrentGame() {
    const statusMsg = this.container.querySelector("#save-status-msg");
    const state = this.gameState.getState();

    try {
      if (statusMsg) {
        statusMsg.classList.remove("hidden");
        statusMsg.className = "text-[10px] text-amber-400 text-center";
        statusMsg.textContent = "保存中...";
      }

      await gameArchiveStore.saveGame(state);

      if (statusMsg) {
        statusMsg.className = "text-[10px] text-emerald-400 text-center font-bold";
        statusMsg.textContent = "✓ アーカイブに正常保存しました！";
        setTimeout(() => {
          statusMsg.classList.add("hidden");
        }, 3000);
      }

      await this.reloadGamesList();
    } catch (err) {
      console.error("試合保存失敗:", err);
      if (statusMsg) {
        statusMsg.className = "text-[10px] text-rose-400 text-center font-bold";
        statusMsg.textContent = "保存に失敗しました。";
      }
    }
  }

  async handleViewScoreSheet(gameId) {
    const record = await gameArchiveStore.getGameById(gameId);
    if (!record || !record.gameState) return;

    if (typeof this.callbacks.onViewScoreSheet === "function") {
      this.callbacks.onViewScoreSheet(record.gameState);
    }
  }

  async handleResumeGame(gameId) {
    const record = await gameArchiveStore.getGameById(gameId);
    if (!record || !record.gameState) return;

    // 現在記録中の試合を置き換える確認
    const ok = window.confirm("この過去試合のデータを現在の画面に復元（再開）しますか？\n※現在の画面で未保存の内容は上書きされます。");
    if (!ok) return;

    if (typeof this.callbacks.onResumeGame === "function") {
      this.callbacks.onResumeGame(record.gameState);
      this.close();
    }
  }

  async handleDeleteConfirmed() {
    if (!this.selectedGameId) return;

    try {
      await gameArchiveStore.deleteGame(this.selectedGameId);
      this.selectedGameId = null;
      const modal = this.container.querySelector("#archive-delete-confirm-modal");
      if (modal) modal.classList.add("hidden");
      await this.reloadGamesList();
    } catch (err) {
      console.error("試合削除失敗:", err);
    }
  }
}
