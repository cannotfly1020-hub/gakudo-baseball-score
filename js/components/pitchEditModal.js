/**
 * js/components/pitchEditModal.js
 * 投球履歴ピンポイント修正モーダルコンポーネント
 * 
 * 担当役割:
 * - 試合中の全投球履歴をツリー／リスト形式で一覧表示
 * - 誤審・誤入力があった過去の「特定の1球」をピンポイント選択
 * - 判定（ボール ⇄ 見逃しS ⇄ 空振りS ⇄ ファウル ⇄ 死球 ⇄ 打球）の変更
 * - 打球結果（単打 ⇄ 二塁打 ⇄ 三塁打 ⇄ 本塁打 ⇄ 凡打 ⇄ 犠打 ⇄ 失策 ⇄ 併殺）の補正
 * - GameState.patchPitchHistory を呼び出し、Undo連打なしで全自動高速リプレイ再計算
 * - alert() / confirm() を一切使わないインライン安全確定UI
 */

export class PitchEditModalComponent {
  /**
   * @param {GameState} gameState 状態管理インスタンス
   * @param {Object} options オプション設定
   */
  constructor(gameState, options = {}) {
    this.gameState = gameState;
    this.options = options;
    this.modalContainer = null;
    this.selectedIndex = -1;
    this.filterInning = "all";

    // 編集中の入力バッファ
    this.draftEvent = {
      result: "ボール",
      course: "",
      playType: "凡打",
      playRuns: 0
    };

    this.init();
  }

  init() {
    this.injectContainer();
    this.render();
    this.bindEvents();

    // 状態変更通知を受け取って再描画
    this.gameState.subscribe(() => {
      if (this.isOpen()) {
        this.renderHistoryList();
      }
    });
  }

  injectContainer() {
    let container = document.getElementById("pitch-edit-modal-slot");
    if (!container) {
      container = document.createElement("div");
      container.id = "pitch-edit-modal-slot";
      container.className = "hidden fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex items-center justify-center select-none";
      document.body.appendChild(container);
    }
    this.modalContainer = container;
  }

  isOpen() {
    return this.modalContainer && !this.modalContainer.classList.contains("hidden");
  }

  render() {
    if (!this.modalContainer) return;

    this.modalContainer.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        <!-- モーダルヘッダー -->
        <div class="bg-slate-900/95 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div class="flex items-center space-x-2">
            <span class="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-lg font-black shadow-inner">
              ✏️
            </span>
            <div>
              <div class="text-[9px] text-amber-400 font-extrabold tracking-widest uppercase">PITCH REPLAY CORRECTION</div>
              <h2 class="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
                <span>過去履歴ピンポイント修正</span>
                <span class="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold">自動再計算</span>
              </h2>
            </div>
          </div>
          <button type="button" id="btn-close-pitch-edit" class="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg active:scale-95 transition">
            ✕
          </button>
        </div>

        <!-- イニング別クイックフィルタバー -->
        <div class="bg-slate-900/90 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
            <span>イニング絞込:</span>
            <select id="select-filter-inning" class="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none">
              <option value="all">全イニング</option>
            </select>
          </div>
          <span class="text-[10px] text-slate-400 font-mono" id="label-history-count">0球のログ</span>
        </div>

        <!-- 2分割メイン領域: 左=履歴一覧、右=編集パネル -->
        <div class="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          
          <!-- 左側: 投球履歴リスト（スクロール対応） -->
          <div class="overflow-y-auto p-2.5 max-h-[42vh] md:max-h-[58vh] space-y-1.5 bg-slate-950/40" id="pitch-history-list">
            <!-- 動的レンダリング -->
          </div>

          <!-- 右側: 選択中の投球編集パネル -->
          <div class="p-3.5 flex flex-col justify-between overflow-y-auto max-h-[50vh] md:max-h-[58vh] space-y-3 bg-slate-900" id="pitch-editor-panel">
            <div id="editor-empty-state" class="text-center py-10 text-xs text-slate-400 font-bold">
              左の一覧から修正したい投球をタップしてください
            </div>

            <div id="editor-form-area" class="hidden flex-1 flex flex-col space-y-3">
              <!-- 選択中の投球メタ情報 -->
              <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs">
                <div class="flex items-center justify-between border-b border-slate-800/80 pb-1 mb-1.5">
                  <span id="edit-pitch-num-badge" class="font-black text-amber-400 font-mono text-sm">#1球目</span>
                  <span id="edit-pitch-inning-badge" class="text-slate-400 font-bold">1回表</span>
                </div>
                <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                  <div>投手: <span id="edit-pitcher-name" class="font-bold text-white">-</span></div>
                  <div>カウント: <span id="edit-bso-before" class="font-mono text-emerald-400">-</span></div>
                </div>
              </div>

              <!-- 判定切り替えボタン群 -->
              <div>
                <label class="block text-[11px] font-bold text-slate-400 mb-1">投球判定の差し替え:</label>
                <div class="grid grid-cols-3 gap-1.5 text-xs font-black">
                  <button type="button" class="btn-pitch-result-choice py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition active:scale-95 text-center" data-result="ボール">
                    ボール (青)
                  </button>
                  <button type="button" class="btn-pitch-result-choice py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition active:scale-95 text-center" data-result="見逃しストライク">
                    見逃しS (赤)
                  </button>
                  <button type="button" class="btn-pitch-result-choice py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition active:scale-95 text-center" data-result="空振り">
                    空振りS (赤)
                  </button>
                  <button type="button" class="btn-pitch-result-choice py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition active:scale-95 text-center" data-result="ファウル">
                    ファウル (黄)
                  </button>
                  <button type="button" class="btn-pitch-result-choice py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition active:scale-95 text-center" data-result="死球">
                    死球 (デッド)
                  </button>
                  <button type="button" class="btn-pitch-result-choice py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition active:scale-95 text-center" data-result="打球 (凡打)">
                    打球 (インプレー)
                  </button>
                </div>
              </div>

              <!-- 打球詳細設定（打球選択時のみ表示） -->
              <div id="play-detail-section" class="hidden bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 space-y-2">
                <span class="text-[11px] font-bold text-amber-400 block">打球結果の詳細:</span>
                <div class="grid grid-cols-4 gap-1 text-[11px] font-bold">
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="単打">単打</button>
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="二塁打">二塁打</button>
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="三塁打">三塁打</button>
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="本塁打">本塁打</button>
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="凡打">凡打</button>
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="失策">失策(エラー)</button>
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="送りバント">犠打</button>
                  <button type="button" class="btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center" data-type="併殺打">併殺打</button>
                </div>
              </div>

              <!-- インライン実行メッセージエリア -->
              <div id="patch-status-message" class="hidden text-xs py-1.5 px-2.5 rounded-lg bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 font-bold text-center"></div>

              <!-- 確定実行ボタン -->
              <button type="button" id="btn-apply-patch" class="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-1.5">
                <span>⚡️</span>
                <span>この1球を差し替えて自動再計算</span>
              </button>

              <!-- 1球削除セクション（インライン二段階確認） -->
              <div class="pt-2 border-t border-slate-800">
                <button type="button" id="btn-show-delete-confirm" class="w-full py-1.5 bg-slate-950 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-900/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95">
                  <span>🗑️</span>
                  <span>この1球を取り消して削除（誤入力抹消）</span>
                </button>

                <!-- 削除確認ボックス（初期状態は非表示） -->
                <div id="delete-confirm-box" class="hidden mt-2 p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-2">
                  <div class="text-[11px] font-bold text-rose-300 text-center leading-snug">
                    ⚠️ 選択中の1球を履歴から完全に消去し、以降の全カウント・スコア・球数を自動再計算します。よろしいですか？
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button type="button" id="btn-cancel-delete" class="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold">
                      キャンセル
                    </button>
                    <button type="button" id="btn-execute-delete" class="py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black shadow transition active:scale-95">
                      はい、削除実行
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- フッターガイド -->
        <div class="bg-slate-950 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>※修正後、以降のカウント・スコア・球数がすべて自動整合されます。</span>
          <button type="button" id="btn-footer-close" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 font-bold">
            閉じる
          </button>
        </div>

      </div>
    `;
  }

  bindEvents() {
    if (!this.modalContainer) return;

    // 閉じるボタン群
    const closeBtn = this.modalContainer.querySelector("#btn-close-pitch-edit");
    const footerCloseBtn = this.modalContainer.querySelector("#btn-footer-close");
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    if (footerCloseBtn) footerCloseBtn.addEventListener("click", () => this.close());

    // 外側クリックで閉じる
    this.modalContainer.addEventListener("click", (e) => {
      if (e.target === this.modalContainer) {
        this.close();
      }
    });

    // イニングフィルタ切替
    const filterSelect = this.modalContainer.querySelector("#select-filter-inning");
    if (filterSelect) {
      filterSelect.addEventListener("change", (e) => {
        this.filterInning = e.target.value;
        this.renderHistoryList();
      });
    }

    // 判定選択ボタン群
    const resultButtons = this.modalContainer.querySelectorAll(".btn-pitch-result-choice");
    resultButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const res = btn.getAttribute("data-result");
        this.selectResultType(res);
      });
    });

    // 打球種別ボタン群
    const playButtons = this.modalContainer.querySelectorAll(".btn-play-type-choice");
    playButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const pType = btn.getAttribute("data-type");
        this.selectPlayType(pType);
      });
    });

    // 確定実行ボタン
    const applyBtn = this.modalContainer.querySelector("#btn-apply-patch");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => this.applyPatch());
    }

    // 削除確認ボックスの制御
    const showDeleteBtn = this.modalContainer.querySelector("#btn-show-delete-confirm");
    const confirmBox = this.modalContainer.querySelector("#delete-confirm-box");
    const cancelDeleteBtn = this.modalContainer.querySelector("#btn-cancel-delete");
    const executeDeleteBtn = this.modalContainer.querySelector("#btn-execute-delete");

    if (showDeleteBtn && confirmBox) {
      showDeleteBtn.addEventListener("click", () => {
        confirmBox.classList.remove("hidden");
        showDeleteBtn.classList.add("hidden");
      });
    }

    if (cancelDeleteBtn && confirmBox && showDeleteBtn) {
      cancelDeleteBtn.addEventListener("click", () => {
        confirmBox.classList.add("hidden");
        showDeleteBtn.classList.remove("hidden");
      });
    }

    if (executeDeleteBtn) {
      executeDeleteBtn.addEventListener("click", () => this.executeDeletePitch());
    }
  }

  executeDeletePitch() {
    if (this.selectedIndex < 0) return;

    const targetIdx = this.selectedIndex;
    const success = this.gameState.deletePitchHistory(targetIdx);

    const msgEl = this.modalContainer.querySelector("#patch-status-message");
    const confirmBox = this.modalContainer.querySelector("#delete-confirm-box");
    const showDeleteBtn = this.modalContainer.querySelector("#btn-show-delete-confirm");

    if (confirmBox) confirmBox.classList.add("hidden");
    if (showDeleteBtn) showDeleteBtn.classList.remove("hidden");

    if (success && msgEl) {
      msgEl.textContent = `🗑️ #${targetIdx + 1}球目を削除し、全試合整合性を自動再計算しました！`;
      msgEl.classList.remove("hidden");

      setTimeout(() => {
        msgEl.classList.add("hidden");
        const state = this.gameState.getState();
        const history = state.history || [];

        if (history.length === 0) {
          this.selectedIndex = -1;
          const formArea = this.modalContainer.querySelector("#editor-form-area");
          const emptyState = this.modalContainer.querySelector("#editor-empty-state");
          if (formArea) formArea.classList.add("hidden");
          if (emptyState) emptyState.classList.remove("hidden");
        } else {
          const nextIdx = Math.min(targetIdx, history.length - 1);
          this.selectHistoryItem(nextIdx);
        }
        this.renderHistoryList();
      }, 500);
    }
  }

  selectResultType(resultType) {
    this.draftEvent.result = resultType;

    const buttons = this.modalContainer.querySelectorAll(".btn-pitch-result-choice");
    buttons.forEach((btn) => {
      const isMatch = btn.getAttribute("data-result") === resultType;
      if (isMatch) {
        btn.className = "btn-pitch-result-choice py-2 rounded-xl border border-amber-400 bg-amber-500/20 text-amber-300 font-black shadow transition active:scale-95 text-center";
      } else {
        btn.className = "btn-pitch-result-choice py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold transition active:scale-95 text-center";
      }
    });

    const playSection = this.modalContainer.querySelector("#play-detail-section");
    if (playSection) {
      if (resultType.startsWith("打球")) {
        playSection.classList.remove("hidden");
      } else {
        playSection.classList.add("hidden");
      }
    }
  }

  selectPlayType(playType) {
    this.draftEvent.playType = playType;
    this.draftEvent.result = `打球 (${playType})`;

    const buttons = this.modalContainer.querySelectorAll(".btn-play-type-choice");
    buttons.forEach((btn) => {
      const isMatch = btn.getAttribute("data-type") === playType;
      if (isMatch) {
        btn.className = "btn-play-type-choice py-1.5 rounded-lg border border-emerald-400 bg-emerald-500/25 text-emerald-300 font-black shadow text-center";
      } else {
        btn.className = "btn-play-type-choice py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-center";
      }
    });
  }

  renderHistoryList() {
    const listEl = this.modalContainer.querySelector("#pitch-history-list");
    const countEl = this.modalContainer.querySelector("#label-history-count");
    const filterSelect = this.modalContainer.querySelector("#select-filter-inning");
    if (!listEl) return;

    const state = this.gameState.getState();
    const history = state.history || [];

    if (countEl) countEl.textContent = `${history.length}球のログ`;

    // イニングセレクトボックスの選択肢を動的構築
    if (filterSelect) {
      const innings = Array.from(new Set(history.map(h => h.pitchEvent?.inningStr || ""))).filter(Boolean);
      const currentVal = filterSelect.value;
      filterSelect.innerHTML = `<option value="all">全イニング</option>` +
        innings.map(inn => `<option value="${inn}">${inn}</option>`).join("");
      filterSelect.value = innings.includes(currentVal) ? currentVal : "all";
    }

    if (history.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-xs text-slate-500 font-bold">
          投球履歴がありません（試合が進むと一覧に表示されます）
        </div>
      `;
      return;
    }

    // フィルタリング適用
    const filteredItems = history.map((item, idx) => ({ item, originalIndex: idx })).filter(({ item }) => {
      if (this.filterInning === "all") return true;
      return item.pitchEvent?.inningStr === this.filterInning;
    });

    // 最新の球が上に来るよう逆順で描画
    listEl.innerHTML = filteredItems.slice().reverse().map(({ item, originalIndex }) => {
      const p = item.pitchEvent || {};
      const isSelected = this.selectedIndex === originalIndex;

      let badgeColor = "bg-slate-700 text-slate-300 border-slate-600";
      if (p.result === "ボール") badgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/40";
      else if (p.result.includes("ストライク") || p.result === "空振り") badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
      else if (p.result === "ファウル") badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      else if (p.result.startsWith("打球")) badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

      return `
        <div class="history-item-row p-2 rounded-xl border transition cursor-pointer active:scale-95 flex items-center justify-between text-xs ${isSelected ? 'border-amber-400 bg-amber-500/15 shadow-md ring-1 ring-amber-400/50' : 'border-slate-800 bg-slate-900/80 hover:bg-slate-800/60'}" data-index="${originalIndex}">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-[11px] text-amber-300 flex items-center justify-center shrink-0">
              #${p.pitchNum || (originalIndex + 1)}
            </span>
            <div>
              <div class="font-bold text-white text-[11px] flex items-center gap-1.5">
                <span>${p.inningStr || "-"}</span>
                <span class="text-[10px] text-slate-400 font-normal">(${p.pitcherName || "投手"})</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono">BSO: ${p.bsoBefore || "0-0-0"}</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] font-bold text-slate-400 font-mono">${p.course || "-"}</span>
            <span class="text-[10px] font-black px-1.5 py-0.5 rounded border ${badgeColor}">
              ${p.result || "未判定"}
            </span>
          </div>
        </div>
      `;
    }).join("");

    // 行タップイベントの紐付け
    listEl.querySelectorAll(".history-item-row").forEach((row) => {
      row.addEventListener("click", () => {
        const idx = parseInt(row.getAttribute("data-index"), 10);
        this.selectHistoryItem(idx);
      });
    });
  }

  selectHistoryItem(targetIndex) {
    const state = this.gameState.getState();
    const history = state.history || [];
    if (targetIndex < 0 || targetIndex >= history.length) return;

    this.selectedIndex = targetIndex;
    const item = history[targetIndex];
    const p = item.pitchEvent || {};

    const emptyState = this.modalContainer.querySelector("#editor-empty-state");
    const formArea = this.modalContainer.querySelector("#editor-form-area");
    if (emptyState) emptyState.classList.add("hidden");
    if (formArea) formArea.classList.remove("hidden");

    // メタ情報の流し込み
    const numBadge = this.modalContainer.querySelector("#edit-pitch-num-badge");
    const innBadge = this.modalContainer.querySelector("#edit-pitch-inning-badge");
    const pName = this.modalContainer.querySelector("#edit-pitcher-name");
    const bsoBefore = this.modalContainer.querySelector("#edit-bso-before");

    if (numBadge) numBadge.textContent = `#${p.pitchNum || (targetIndex + 1)}球目`;
    if (innBadge) innBadge.textContent = p.inningStr || "1回表";
    if (pName) pName.textContent = p.pitcherName || "投手";
    if (bsoBefore) bsoBefore.textContent = p.bsoBefore || "0-0-0";

    // 現在の判定をドラフトバッファへセット
    this.draftEvent.result = p.result || "ボール";
    this.draftEvent.course = p.course || "";

    if (p.play) {
      this.draftEvent.playType = p.play.type || "凡打";
      this.draftEvent.playRuns = p.play.runs || 0;
    } else {
      this.draftEvent.playType = "凡打";
      this.draftEvent.playRuns = 0;
    }

    // UIボタンの活性切り替え
    let baseResult = this.draftEvent.result;
    if (baseResult.startsWith("打球")) {
      baseResult = "打球 (凡打)";
      this.selectPlayType(this.draftEvent.playType);
    }
    this.selectResultType(baseResult);

    // リストの選択枠を再描画
    this.renderHistoryList();

    // 削除確認ボックスのリセット
    const confirmBox = this.modalContainer.querySelector("#delete-confirm-box");
    const showDeleteBtn = this.modalContainer.querySelector("#btn-show-delete-confirm");
    if (confirmBox) confirmBox.classList.add("hidden");
    if (showDeleteBtn) showDeleteBtn.classList.remove("hidden");
  }

  applyPatch() {
    if (this.selectedIndex < 0) return;

    const patchData = {
      result: this.draftEvent.result,
      course: this.draftEvent.course || null
    };

    if (this.draftEvent.result.startsWith("打球")) {
      patchData.play = {
        type: this.draftEvent.playType || "凡打",
        runs: this.draftEvent.playRuns || 0
      };
    } else {
      patchData.play = null;
    }

    // GameState のピンポイントパッチ＆自動リプレイ再計算を実行
    const success = this.gameState.patchPitchHistory(this.selectedIndex, patchData);

    const msgEl = this.modalContainer.querySelector("#patch-status-message");
    if (success && msgEl) {
      msgEl.textContent = `✅ #${this.selectedIndex + 1}球目を修正し、全試合整合性を自動再計算しました！`;
      msgEl.classList.remove("hidden");

      setTimeout(() => {
        msgEl.classList.add("hidden");
        this.close();
      }, 700);
    }
  }

  /**
   * モーダルを開く（指定インデックスがあれば即座に選択）
   * @param {number} [targetIndex=null]
   */
  open(targetIndex = null) {
    if (!this.modalContainer) this.injectContainer();
    this.modalContainer.classList.remove("hidden");

    this.renderHistoryList();

    const state = this.gameState.getState();
    const history = state.history || [];

    if (typeof targetIndex === "number" && targetIndex >= 0 && targetIndex < history.length) {
      this.selectHistoryItem(targetIndex);
    } else if (history.length > 0) {
      // 指定がなければ最新の球を選択
      this.selectHistoryItem(history.length - 1);
    }
  }

  close() {
    if (!this.modalContainer) return;
    this.modalContainer.classList.add("hidden");
    this.selectedIndex = -1;
  }
}
