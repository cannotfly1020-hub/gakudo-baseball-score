/**
 * js/components/rosterView.js
 * 団員名簿マスタ ＆ オーダー編成（背番号タップ・相手テンキー）コンポーネント
 * 
 * 担当役割:
 * - 自チーム団員名簿マスタ（背番号・氏名・学年・投打・メイン守備）の管理
 * - LINE・メモ帳テキスト貼り付けによる一括取込（カンマ・空白・タブ区切り対応）
 * - スタメンオーダー爆速編成（背番号バッジタップによる打順割り当て）
 * - 前回のスタメンオーダー即時呼出（3秒展開）
 * - 相手チーム専用「大型背番号テンキー入力モード」（名前入力不要で即座に試合開始）
 * - 守備位置・打順・リエントリー（再出場）の柔軟な変更
 */

// 守備位置の定義リスト
export const POSITIONS = [
  { id: "投", name: "投手 (ピッチャー)" },
  { id: "捕", name: "捕手 (キャッチャー)" },
  { id: "一", name: "一塁手 (ファースト)" },
  { id: "二", name: "二塁手 (セカンド)" },
  { id: "三", name: "三塁手 (サード)" },
  { id: "遊", name: "遊撃手 (ショート)" },
  { id: "左", name: "左翼手 (レフト)" },
  { id: "中", name: "中堅手 (センター)" },
  { id: "右", name: "右翼手 (ライト)" },
  { id: "指", name: "指名打者 (DH)" }
];

// 初期サンプル名簿（初回起動時のプレースホルダー）
const DEFAULT_ROSTER = [
  { id: "p1", number: 1, name: "山田 太郎", grade: 6, throws: "右", bats: "右", pos: "投" },
  { id: "p2", number: 2, name: "佐藤 健一", grade: 6, throws: "右", bats: "右", pos: "捕" },
  { id: "p3", number: 3, name: "田中 拓海", grade: 6, throws: "右", bats: "左", pos: "一" },
  { id: "p4", number: 4, name: "伊藤 陸", grade: 5, throws: "右", bats: "右", pos: "二" },
  { id: "p5", number: 5, name: "中村 蓮", grade: 6, throws: "右", bats: "右", pos: "三" },
  { id: "p6", number: 6, name: "小林 隼人", grade: 6, throws: "右", bats: "左", pos: "遊" },
  { id: "p7", number: 7, name: "金子 真怜", grade: 5, throws: "右", bats: "左", pos: "中" },
  { id: "p8", number: 8, name: "渡辺 航", grade: 5, throws: "左", bats: "左", pos: "左" },
  { id: "p9", number: 9, name: "加藤 蒼空", grade: 4, throws: "右", bats: "右", pos: "右" },
  { id: "p10", number: 10, name: "高橋 翔太", grade: 5, throws: "右", bats: "右", pos: "投" },
  { id: "p11", number: 11, name: "松本 奏汰", grade: 4, throws: "右", bats: "右", pos: "外" }
];

export class RosterViewComponent {
  /**
   * @param {HTMLElement} containerElement 描画対象の親要素
   * @param {GameState} gameState 試合状態管理インスタンス
   * @param {Object} options コールバック等
   */
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;

    // 現在のアクティブタブ: "order" (オーダー編成) または "roster" (名簿マスタ)
    this.activeSubTab = "order";
    // 編集対象チーム: "my" (自チーム) または "opp" (相手チーム)
    this.targetTeam = "my";

    // 自チーム名簿データ（LocalStorageから復元、なければ初期データ）
    this.roster = this.loadRoster();

    // 自チーム・相手チームの1〜9番スタメン
    this.myLineup = this.loadLineup("my") || this.generateDefaultLineup();
    this.oppLineup = this.loadLineup("opp") || this.generateOpponentDefaultLineup();

    // テンキーモーダル用の状態
    this.tenkeyTargetSlot = null; // { team: "opp", order: 1 }
    this.tenkeyValue = "";

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg select-none space-y-3">
        
        <!-- ヘッダーサブナビゲーション (オーダー編成 ⇄ 団員名簿マスタ) -->
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center gap-1 bg-slate-950 p-0.5 rounded-xl border border-slate-800">
            <button type="button" id="subtab-order" class="px-3 py-1.5 rounded-lg text-xs font-black transition ${
              this.activeSubTab === "order" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }">
              📋 オーダー編成
            </button>
            <button type="button" id="subtab-roster" class="px-3 py-1.5 rounded-lg text-xs font-black transition ${
              this.activeSubTab === "roster" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }">
              👥 団員名簿マスタ (${this.roster.length}名)
            </button>
          </div>

          <button type="button" id="btn-close-roster-view" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1.5 rounded-lg transition">
            ✕ 閉じる
          </button>
        </div>

        <!-- コンテンツエリア -->
        <div id="roster-view-content">
          ${this.activeSubTab === "order" ? this.renderOrderTab() : this.renderRosterTab()}
        </div>

      </div>

      <!-- 相手チーム用 背番号大型テンキーモーダル -->
      <div id="tenkey-modal-slot" class="hidden"></div>
    `;
  }

  renderOrderTab() {
    const isMyTeam = this.targetTeam === "my";
    const currentLineup = isMyTeam ? this.myLineup : this.oppLineup;

    return `
      <div class="space-y-3">
        <!-- チーム切り替え ＆ 省力化アクションバー -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button type="button" id="team-switch-my" class="px-2.5 py-1 rounded-md font-extrabold transition ${
              isMyTeam ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
            }">
              自チーム (先発)
            </button>
            <button type="button" id="team-switch-opp" class="px-2.5 py-1 rounded-md font-extrabold transition ${
              !isMyTeam ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"
            }">
              相手チーム
            </button>
          </div>

          ${
            isMyTeam
              ? `
            <button type="button" id="btn-copy-prev-order" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 border border-emerald-900/50 text-[11px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
              <span>↩️ 前回オーダー呼出</span>
            </button>
          `
              : `
            <span class="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-1 rounded-lg">
              ※ 背番号のみで即座に開始可能
            </span>
          `
          }
        </div>

        <!-- 1〜9番 スタメンスロット一覧 -->
        <div class="space-y-1.5">
          ${currentLineup
            .map((slot, index) => {
              return `
              <div class="flex items-center justify-between bg-slate-950/80 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs gap-2">
                <div class="flex items-center gap-2 min-w-[50px]">
                  <span class="font-black text-amber-400 text-sm font-mono">${index + 1}</span>
                  <span class="text-[10px] text-slate-500">番</span>
                </div>

                <!-- 守備位置セレクタ -->
                <select class="select-slot-pos bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500" data-order="${index}">
                  ${POSITIONS.map(
                    (p) => `<option value="${p.id}" ${slot.pos === p.id ? "selected" : ""}>${p.id} (${p.name.split(" ")[0]})</option>`
                  ).join("")}
                </select>

                <!-- 背番号 ＆ 選手名表示・編集ボタン -->
                <button type="button" class="btn-open-slot-edit flex-1 flex items-center justify-between bg-slate-900/90 hover:bg-slate-800 px-2 py-1 rounded border border-slate-700 text-left transition" data-order="${index}">
                  <div class="flex items-center gap-2">
                    <span class="bg-slate-800 text-emerald-400 font-mono font-black text-xs px-1.5 py-0.5 rounded border border-slate-700">
                      #${slot.number || "-"}
                    </span>
                    <span class="font-bold text-slate-200 truncate max-w-[120px]">
                      ${slot.name || "選手未指定"}
                    </span>
                  </div>
                  <span class="text-[10px] text-slate-400">変更 ▾</span>
                </button>
              </div>
            `;
            })
            .join("")}
        </div>

        <!-- 自チームの場合: 下部にベンチ選手「背番号バッジ」一覧を表示（タップで配置） -->
        ${
          isMyTeam
            ? `
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-300">👥 ベンチ登録選手（タップして空き枠へ割当）:</span>
              <span class="text-[10px] text-slate-500">計 ${this.roster.length} 名</span>
            </div>
            <div class="flex flex-wrap gap-1.5" id="bench-badges-list">
              ${this.roster
                .map((p) => {
                  const isAssigned = this.myLineup.some((slot) => slot.playerId === p.id);
                  return `
                  <button type="button" class="btn-bench-badge px-2 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
                    isAssigned
                      ? "bg-slate-800/40 border-slate-800 text-slate-600 opacity-60"
                      : "bg-slate-800 border-slate-700 text-emerald-400 hover:bg-emerald-950/50 hover:border-emerald-600 active:scale-95"
                  }" data-player-id="${p.id}" ${isAssigned ? "disabled" : ""}>
                    <span class="font-mono font-black">#${p.number}</span>
                    <span class="text-[11px] text-slate-200">${p.name.split(" ")[0]}</span>
                  </button>
                `;
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <!-- 決定して試合に反映するボタン -->
        <button type="button" id="btn-apply-lineup" class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-1">
          <span>✓ このオーダーを試合に反映する</span>
        </button>
      </div>
    `;
  }

  renderRosterTab() {
    return `
      <div class="space-y-3">
        <!-- 名簿操作アクションバー -->
        <div class="flex items-center justify-between gap-2">
          <button type="button" id="btn-open-add-player" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
            <span>＋ 選手を追加</span>
          </button>

          <button type="button" id="btn-open-batch-import" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-400 border border-sky-900/50 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
            <span>📥 LINE・テキスト一括取込</span>
          </button>
        </div>

        <!-- 選手一覧テーブル -->
        <div class="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-950 sticky top-0 border-b border-slate-800 text-[10px] text-slate-400">
              <tr>
                <th class="py-1.5 px-2">背番号</th>
                <th class="py-1.5 px-2">氏名</th>
                <th class="py-1.5 px-1">学年</th>
                <th class="py-1.5 px-1">投/打</th>
                <th class="py-1.5 px-1">主守備</th>
                <th class="py-1.5 px-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              ${this.roster
                .map(
                  (p, idx) => `
                <tr class="hover:bg-slate-800/40">
                  <td class="py-2 px-2 font-mono font-black text-emerald-400">#${p.number}</td>
                  <td class="py-2 px-2 font-bold text-slate-200">${p.name}</td>
                  <td class="py-2 px-1 text-slate-400">${p.grade}年</td>
                  <td class="py-2 px-1 text-slate-400">${p.throws}/${p.bats}</td>
                  <td class="py-2 px-1 font-bold text-amber-300">${p.pos}</td>
                  <td class="py-2 px-2 text-right space-x-1">
                    <button type="button" class="btn-delete-player text-rose-400 hover:text-rose-300 text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-900" data-idx="${idx}">
                      削除
                    </button>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 1. サブタブ切り替え (オーダー編成 ⇄ 団員名簿)
    const btnOrder = this.container.querySelector("#subtab-order");
    const btnRoster = this.container.querySelector("#subtab-roster");

    if (btnOrder) {
      btnOrder.addEventListener("click", () => {
        this.activeSubTab = "order";
        this.render();
        this.bindEvents();
      });
    }

    if (btnRoster) {
      btnRoster.addEventListener("click", () => {
        this.activeSubTab = "roster";
        this.render();
        this.bindEvents();
      });
    }

    // 閉じるボタン
    const btnClose = this.container.querySelector("#btn-close-roster-view");
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        this.container.classList.add("hidden");
      });
    }

    // 2. オーダー編成タブ内のイベント
    if (this.activeSubTab === "order") {
      this.bindOrderEvents();
    } else {
      this.bindRosterEvents();
    }
  }

  bindOrderEvents() {
    // チーム切り替え
    const btnMy = this.container.querySelector("#team-switch-my");
    const btnOpp = this.container.querySelector("#team-switch-opp");

    if (btnMy) {
      btnMy.addEventListener("click", () => {
        this.targetTeam = "my";
        this.render();
        this.bindEvents();
      });
    }
    if (btnOpp) {
      btnOpp.addEventListener("click", () => {
        this.targetTeam = "opp";
        this.render();
        this.bindEvents();
      });
    }

    // 前回オーダー呼出
    const btnCopy = this.container.querySelector("#btn-copy-prev-order");
    if (btnCopy) {
      btnCopy.addEventListener("click", () => {
        this.myLineup = this.generateDefaultLineup();
        this.render();
        this.bindEvents();
      });
    }

    // 守備位置変更セレクト
    this.container.querySelectorAll(".select-slot-pos").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const orderIdx = parseInt(e.target.getAttribute("data-order"), 10);
        const lineup = this.targetTeam === "my" ? this.myLineup : this.oppLineup;
        if (lineup[orderIdx]) {
          lineup[orderIdx].pos = e.target.value;
        }
      });
    });

    // スロット編集（相手チームならテンキー起動、自チームなら選択）
    this.container.querySelectorAll(".btn-open-slot-edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const orderIdx = parseInt(btn.getAttribute("data-order"), 10);
        if (this.targetTeam === "opp") {
          this.openTenkeyModal(orderIdx);
        } else {
          this.openPlayerSelectPrompt(orderIdx);
        }
      });
    });

    // ベンチバッジタップで空きスロットへ自動配置
    this.container.querySelectorAll(".btn-bench-badge").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pId = btn.getAttribute("data-player-id");
        const player = this.roster.find((p) => p.id === pId);
        if (!player) return;

        // 最初の空きスロットを探す
        const emptyIdx = this.myLineup.findIndex((slot) => !slot.playerId);
        const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;

        this.myLineup[targetIdx] = {
          order: targetIdx + 1,
          playerId: player.id,
          number: player.number,
          name: player.name,
          pos: player.pos
        };

        this.render();
        this.bindEvents();
      });
    });

    // 試合への反映ボタン
    const btnApply = this.container.querySelector("#btn-apply-lineup");
    if (btnApply) {
      btnApply.addEventListener("click", () => {
        this.applyLineupToGame();
      });
    }
  }

  bindRosterEvents() {
    // 選手追加
    const btnAdd = this.container.querySelector("#btn-open-add-player");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        const numStr = prompt("背番号を入力してください (例: 10):");
        if (!numStr) return;
        const nameStr = prompt("選手氏名を入力してください (例: 高橋 翔太):");
        if (!nameStr) return;
        const posStr = prompt("主な守備位置を入力してください (例: 投, 捕, 内, 外):", "投") || "投";

        const newPlayer = {
          id: `p_${Date.now()}`,
          number: parseInt(numStr, 10) || 99,
          name: nameStr.trim(),
          grade: 6,
          throws: "右",
          bats: "右",
          pos: posStr.trim()
        };

        this.roster.push(newPlayer);
        this.saveRoster();
        this.render();
        this.bindEvents();
      });
    }

    // LINE・テキスト一括取込
    const btnBatch = this.container.querySelector("#btn-open-batch-import");
    if (btnBatch) {
      btnBatch.addEventListener("click", () => {
        const text = prompt(
          "LINEやメモ帳のテキストを貼り付けてください:\n（形式: 背番号, 氏名, 学年, 守備）\n例:\n1, 山田 太郎, 6, 投\n2, 佐藤 健一, 6, 捕\n7, 金子 真怜, 5, 中"
        );
        if (!text) return;
        this.importBatchText(text);
      });
    }

    // 選手削除
    this.container.querySelectorAll(".btn-delete-player").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        this.roster.splice(idx, 1);
        this.saveRoster();
        this.render();
        this.bindEvents();
      });
    });
  }

  openTenkeyModal(orderIdx) {
    this.tenkeyTargetSlot = orderIdx;
    this.tenkeyValue = "";
    const slotEl = this.container.querySelector("#tenkey-modal-slot");
    if (!slotEl) return;

    slotEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-content max-w-[280px] space-y-3">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 class="text-xs font-black text-amber-400">${orderIdx + 1}番 相手背番号入力</h3>
            <button type="button" id="btn-tenkey-close" class="text-slate-400 text-sm">✕</button>
          </div>

          <!-- 入力ディスプレイ -->
          <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono font-black text-2xl text-white">
            # <span id="tenkey-display">_</span>
          </div>

          <!-- 大型数字テンキー -->
          <div class="grid grid-cols-3 gap-2" id="tenkey-pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"]
              .map((key) => {
                const isAction = key === "C" || key === "OK";
                const bgClass =
                  key === "OK"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold"
                    : key === "C"
                    ? "bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-bold"
                    : "bg-slate-800 hover:bg-slate-700 text-white font-bold";
                return `
                <button type="button" class="btn-tenkey-key py-3 rounded-xl text-base shadow active:scale-95 transition ${bgClass}" data-key="${key}">
                  ${key}
                </button>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
    slotEl.classList.remove("hidden");

    // テンキーの入力処理
    const displayEl = slotEl.querySelector("#tenkey-display");
    const closeBtn = slotEl.querySelector("#btn-tenkey-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => slotEl.classList.add("hidden"));
    }

    slotEl.querySelectorAll(".btn-tenkey-key").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-key");
        if (key === "C") {
          this.tenkeyValue = "";
        } else if (key === "OK") {
          const num = parseInt(this.tenkeyValue, 10);
          if (!isNaN(num)) {
            this.oppLineup[this.tenkeyTargetSlot].number = num;
            this.oppLineup[this.tenkeyTargetSlot].name = `背番号 ${num}`;
          }
          slotEl.classList.add("hidden");
          this.render();
          this.bindEvents();
          return;
        } else {
          if (this.tenkeyValue.length < 3) {
            this.tenkeyValue += key;
          }
        }
        if (displayEl) {
          displayEl.textContent = this.tenkeyValue || "_";
        }
      });
    });
  }

  importBatchText(text) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    let count = 0;

    lines.forEach((line) => {
      // カンマ、空白、タブなどで分割
      const parts = line.split(/[,、\s\t]+/).filter(Boolean);
      if (parts.length >= 2) {
        const num = parseInt(parts[0], 10);
        const name = parts[1];
        const grade = parts[2] ? parseInt(parts[2], 10) || 6 : 6;
        const pos = parts[3] || "投";

        if (!isNaN(num) && name) {
          this.roster.push({
            id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            number: num,
            name: name,
            grade: grade,
            throws: "右",
            bats: "右",
            pos: pos
          });
          count++;
        }
      }
    });

    if (count > 0) {
      this.saveRoster();
      this.render();
      this.bindEvents();
    }
  }

  openPlayerSelectPrompt(orderIdx) {
    const listStr = this.roster.map((p, idx) => `${idx + 1}: #${p.number} ${p.name} (${p.pos})`).join("\n");
    const selectIdx = prompt(`【${orderIdx + 1}番打者】割り当てる選手の番号を入力してください:\n${listStr}`);
    if (!selectIdx) return;

    const idx = parseInt(selectIdx, 10) - 1;
    const player = this.roster[idx];
    if (player) {
      this.myLineup[orderIdx] = {
        order: orderIdx + 1,
        playerId: player.id,
        number: player.number,
        name: player.name,
        pos: player.pos
      };
      this.render();
      this.bindEvents();
    }
  }

  applyLineupToGame() {
    const state = this.gameState.getState();
    const currentSlot = this.myLineup[0];

    // 現在の打者・投手を反映
    if (currentSlot) {
      state.currentBatter = {
        order: 1,
        number: currentSlot.number,
        name: currentSlot.name,
        pos: currentSlot.pos
      };
    }

    const pitcherSlot = this.myLineup.find((s) => s.pos === "投") || this.myLineup[0];
    if (pitcherSlot) {
      state.currentPitcher = {
        number: pitcherSlot.number,
        name: pitcherSlot.name
      };
    }

    this.saveLineup("my", this.myLineup);
    this.saveLineup("opp", this.oppLineup);

    this.gameState.notify();
    this.container.classList.add("hidden");
  }

  generateDefaultLineup() {
    return [
      { order: 1, playerId: "p1", number: 1, name: "山田 太郎", pos: "投" },
      { order: 2, playerId: "p2", number: 2, name: "佐藤 健一", pos: "捕" },
      { order: 3, playerId: "p6", number: 6, name: "小林 隼人", pos: "遊" },
      { order: 4, playerId: "p3", number: 3, name: "田中 拓海", pos: "一" },
      { order: 5, playerId: "p5", number: 5, name: "中村 蓮", pos: "三" },
      { order: 6, playerId: "p4", number: 4, name: "伊藤 陸", pos: "二" },
      { order: 7, playerId: "p7", number: 7, name: "金子 真怜", pos: "中" },
      { order: 8, playerId: "p8", number: 8, name: "渡辺 航", pos: "左" },
      { order: 9, playerId: "p9", number: 9, name: "加藤 蒼空", pos: "右" }
    ];
  }

  generateOpponentDefaultLineup() {
    return Array.from({ length: 9 }, (_, i) => ({
      order: i + 1,
      number: i + 1,
      name: `相手 ${i + 1}番`,
      pos: POSITIONS[i] ? POSITIONS[i].id : "外"
    }));
  }

  saveRoster() {
    try {
      localStorage.setItem("gakudo_roster_master", JSON.stringify(this.roster));
    } catch (e) {
      console.warn("名簿保存失敗", e);
    }
  }

  loadRoster() {
    try {
      const data = localStorage.getItem("gakudo_roster_master");
      return data ? JSON.parse(data) : DEFAULT_ROSTER;
    } catch (e) {
      return DEFAULT_ROSTER;
    }
  }

  saveLineup(team, lineup) {
    try {
      localStorage.setItem(`gakudo_lineup_${team}`, JSON.stringify(lineup));
    } catch (e) {
      console.warn("オーダー保存失敗", e);
    }
  }

  loadLineup(team) {
    try {
      const data = localStorage.getItem(`gakudo_lineup_${team}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
}
