/**
 * js/components/rosterView.js
 * 団員名簿マスタ ＆ オーダー編成（先攻・後攻・打順自動送り完全連動版）
 */

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
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;

    this.activeSubTab = "order"; // "order" | "roster"
    this.targetTeam = "my"; // "my" | "opp"
    this.myTeamSide = "away"; // "away" (先攻) または "home" (後攻)

    this.roster = this.loadRoster();
    this.myLineup = this.loadLineup("my") || this.generateDefaultLineup();
    this.oppLineup = this.loadLineup("opp") || this.generateOpponentDefaultLineup();

    this.tenkeyTargetSlot = null;
    this.tenkeyValue = "";

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl select-none space-y-3 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        
        <!-- ヘッダーナビゲーション -->
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
              👥 団員名簿 (${this.roster.length}名)
            </button>
          </div>

          <button type="button" id="btn-close-roster-view" class="text-slate-400 hover:text-white text-base px-2 py-1 rounded-lg hover:bg-slate-800 transition">
            ✕
          </button>
        </div>

        <!-- タブコンテンツ -->
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
    const state = this.gameState.getState();
    const gameInfo = (state && state.gameInfo) ? state.gameInfo : {
      date: new Date().toISOString().slice(0, 10),
      tournament: "公式戦",
      myTeamName: "自チーム",
      oppTeamName: "相手チーム",
      myTeamSide: "away"
    };

    return `
      <div class="space-y-3">
        <!-- 試合基本情報 入力枠（日付・大会名・自チーム名・相手チーム名） -->
        <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <span>🏟️</span>
              <span>試合基本情報</span>
            </span>
            <span class="text-[10px] text-slate-500">※入力内容は自動保存されます</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label class="block text-[10px] text-slate-400 mb-0.5">試合日</label>
              <input type="date" id="input-game-date" value="${gameInfo.date || ''}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono">
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 mb-0.5">大会名 / 試合名</label>
              <input type="text" id="input-game-tournament" value="${gameInfo.tournament || ''}" placeholder="例: 春季公式戦" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500">
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 mb-0.5">自チーム名</label>
              <input type="text" id="input-team-my" value="${gameInfo.myTeamName || ''}" placeholder="自チーム名" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-bold">
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 mb-0.5">相手チーム名</label>
              <input type="text" id="input-team-opp" value="${gameInfo.oppTeamName || ''}" placeholder="相手チーム名" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-bold">
            </div>
          </div>
        </div>

        <!-- 先攻・後攻トグル & 自チーム・相手チーム切替 -->
        <div class="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          
          <!-- 攻守設定 -->
          <div class="flex items-center gap-1.5 w-full sm:w-auto">
            <span class="text-[11px] text-slate-400 font-bold">自チーム:</span>
            <button type="button" id="btn-toggle-attack-side" class="px-2 py-1 rounded font-bold border text-[11px] transition ${
              this.myTeamSide === "away"
                ? "bg-sky-950 text-sky-300 border-sky-700"
                : "bg-amber-950 text-amber-300 border-amber-700"
            }">
              ${this.myTeamSide === "away" ? "先攻 (1回表)" : "後攻 (1回裏)"}
            </button>
          </div>

          <!-- 編集対象チーム切替 -->
          <div class="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700 w-full sm:w-auto justify-center">
            <button type="button" id="team-switch-my" class="px-3 py-1 rounded font-extrabold transition text-xs ${
              isMyTeam ? "bg-sky-600 text-white shadow" : "text-slate-400 hover:text-white"
            }">
              自チーム
            </button>
            <button type="button" id="team-switch-opp" class="px-3 py-1 rounded font-extrabold transition text-xs ${
              !isMyTeam ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"
            }">
              相手チーム
            </button>
          </div>
        </div>

        <!-- 1〜9番 打順スロット一覧 -->
        <div class="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
          ${currentLineup
            .map((slot, index) => `
              <div class="flex items-center justify-between bg-slate-950/80 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs gap-2">
                <div class="flex items-center gap-1 min-w-[36px]">
                  <span class="font-black text-amber-400 text-sm font-mono">${index + 1}</span>
                  <span class="text-[10px] text-slate-500">番</span>
                </div>

                <!-- 守備位置セレクタ -->
                <select class="select-slot-pos bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500" data-order="${index}">
                  ${POSITIONS.map(
                    (p) => `<option value="${p.id}" ${slot.pos === p.id ? "selected" : ""}>${p.id}</option>`
                  ).join("")}
                </select>

                <!-- 背番号 ＆ 氏名 -->
                <button type="button" class="btn-open-slot-edit flex-1 flex items-center justify-between bg-slate-900/90 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-700 text-left transition" data-order="${index}">
                  <div class="flex items-center gap-2">
                    <span class="bg-slate-800 text-emerald-400 font-mono font-black text-xs px-1.5 py-0.5 rounded border border-slate-700">
                      #${slot.number || "-"}
                    </span>
                    <span class="font-bold text-slate-200 truncate max-w-[130px]">
                      ${slot.name || "選手未指定"}
                    </span>
                  </div>
                  <span class="text-[10px] text-slate-400">変更 ▾</span>
                </button>
              </div>
            `)
            .join("")}
        </div>

        <!-- 自チームの場合: ベンチ名簿バッジ一覧 -->
        ${
          isMyTeam
            ? `
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-400">👥 名簿から打順へ割当:</span>
              <button type="button" id="btn-copy-prev-order" class="text-[10px] text-emerald-400 hover:underline">
                標準オーダーで全自動配置
              </button>
            </div>
            <div class="flex flex-wrap gap-1 max-h-[85px] overflow-y-auto">
              ${this.roster
                .map((p) => {
                  const isAssigned = this.myLineup.some((slot) => slot.playerId === p.id);
                  return `
                  <button type="button" class="btn-bench-badge px-2 py-0.5 rounded text-[11px] font-bold border transition flex items-center gap-1 ${
                    isAssigned
                      ? "bg-slate-800/40 border-slate-800 text-slate-600 opacity-50"
                      : "bg-slate-800 border-slate-700 text-emerald-400 hover:bg-emerald-950/50 hover:border-emerald-600 active:scale-95"
                  }" data-player-id="${p.id}">
                    <span class="font-mono font-black">#${p.number}</span>
                    <span class="text-slate-200">${p.name.split(" ")[0]}</span>
                  </button>
                `;
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <!-- 決定・試合反映ボタン -->
        <button type="button" id="btn-apply-lineup" class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-1.5">
          <span>✓ このオーダーを試合に反映する</span>
        </button>
      </div>
    `;
  }

  renderRosterTab() {
    return `
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <button type="button" id="btn-open-add-player" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
            <span>＋ 選手を追加</span>
          </button>
          <button type="button" id="btn-open-batch-import" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-400 border border-sky-900/50 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
            <span>📥 テキスト一括取込</span>
          </button>
        </div>

        <div class="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-950 sticky top-0 border-b border-slate-800 text-[10px] text-slate-400">
              <tr>
                <th class="py-1.5 px-2">背番号</th>
                <th class="py-1.5 px-2">氏名</th>
                <th class="py-1.5 px-1">学年</th>
                <th class="py-1.5 px-1">守備</th>
                <th class="py-1.5 px-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              ${this.roster
                .map(
                  (p, idx) => `
                <tr class="hover:bg-slate-800/40">
                  <td class="py-1.5 px-2 font-mono font-black text-emerald-400">#${p.number}</td>
                  <td class="py-1.5 px-2 font-bold text-slate-200">${p.name}</td>
                  <td class="py-1.5 px-1 text-slate-400">${p.grade}年</td>
                  <td class="py-1.5 px-1 font-bold text-amber-300">${p.pos}</td>
                  <td class="py-1.5 px-2 text-right">
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

    const btnClose = this.container.querySelector("#btn-close-roster-view");
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        this.container.classList.add("hidden");
      });
    }

    if (this.activeSubTab === "order") {
      this.bindOrderEvents();
    } else {
      this.bindRosterEvents();
    }
  }

  bindOrderEvents() {
    // 試合基本情報の入力変更をGameStateに自動同期
    const inputDate = this.container.querySelector("#input-game-date");
    const inputTournament = this.container.querySelector("#input-game-tournament");
    const inputMyTeam = this.container.querySelector("#input-team-my");
    const inputOppTeam = this.container.querySelector("#input-team-opp");

    const syncGameInfo = () => {
      if (typeof this.gameState.updateGameInfo === "function") {
        this.gameState.updateGameInfo({
          date: inputDate ? inputDate.value : undefined,
          tournament: inputTournament ? inputTournament.value : undefined,
          myTeamName: inputMyTeam ? inputMyTeam.value : undefined,
          oppTeamName: inputOppTeam ? inputOppTeam.value : undefined,
          myTeamSide: this.myTeamSide
        });
      }
    };

    [inputDate, inputTournament, inputMyTeam, inputOppTeam].forEach((el) => {
      if (el) {
        el.addEventListener("change", syncGameInfo);
        el.addEventListener("blur", syncGameInfo);
      }
    });

    // 攻守トグル
    const btnSide = this.container.querySelector("#btn-toggle-attack-side");
    if (btnSide) {
      btnSide.addEventListener("click", () => {
        this.myTeamSide = this.myTeamSide === "away" ? "home" : "away";
        syncGameInfo();
        this.render();
        this.bindEvents();
      });
    }

    // チーム切替
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

    // デフォルト一括配置
    const btnCopy = this.container.querySelector("#btn-copy-prev-order");
    if (btnCopy) {
      btnCopy.addEventListener("click", () => {
        this.myLineup = this.generateDefaultLineup();
        this.render();
        this.bindEvents();
      });
    }

    // 守備位置セレクト
    this.container.querySelectorAll(".select-slot-pos").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const orderIdx = parseInt(e.target.getAttribute("data-order"), 10);
        const lineup = this.targetTeam === "my" ? this.myLineup : this.oppLineup;
        if (lineup[orderIdx]) {
          lineup[orderIdx].pos = e.target.value;
        }
      });
    });

    // スロット編集（相手: テンキー / 自: 名簿選択）
    this.container.querySelectorAll(".btn-open-slot-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderIdx = parseInt(btn.getAttribute("data-order"), 10);
        if (this.targetTeam === "opp") {
          this.openTenkeyModal(orderIdx);
        } else {
          this.openPlayerSelectPrompt(orderIdx);
        }
      });
    });

    // ベンチバッジタップで空き枠または先頭へ割当
    this.container.querySelectorAll(".btn-bench-badge").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pId = btn.getAttribute("data-player-id");
        const player = this.roster.find((p) => p.id === pId);
        if (!player) return;

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

    // 試合への反映
    const btnApply = this.container.querySelector("#btn-apply-lineup");
    if (btnApply) {
      btnApply.addEventListener("click", () => {
        this.applyLineupToGame();
      });
    }
  }

  bindRosterEvents() {
    const btnAdd = this.container.querySelector("#btn-open-add-player");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        const numStr = prompt("背番号を入力してください (例: 10):");
        if (!numStr) return;
        const nameStr = prompt("選手氏名を入力してください (例: 高橋 翔太):");
        if (!nameStr) return;
        const posStr = prompt("守備位置 (例: 投, 捕, 一, 外):", "投") || "投";

        this.roster.push({
          id: `p_${Date.now()}`,
          number: parseInt(numStr, 10) || 99,
          name: nameStr.trim(),
          grade: 6,
          throws: "右",
          bats: "右",
          pos: posStr.trim()
        });

        this.saveRoster();
        this.render();
        this.bindEvents();
      });
    }

    const btnBatch = this.container.querySelector("#btn-open-batch-import");
    if (btnBatch) {
      btnBatch.addEventListener("click", () => {
        const text = prompt("テキストを貼り付けてください:\n例:\n1, 山田 太郎, 6, 投\n2, 佐藤 健一, 6, 捕");
        if (!text) return;
        this.importBatchText(text);
      });
    }

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

    slotEl.className = "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4";
    slotEl.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-[280px] p-3.5 shadow-2xl space-y-3">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 class="text-xs font-black text-amber-400">${orderIdx + 1}番 相手背番号入力</h3>
          <button type="button" id="btn-tenkey-close" class="text-slate-400 hover:text-white text-base">✕</button>
        </div>

        <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono font-black text-2xl text-white">
          # <span id="tenkey-display">_</span>
        </div>

        <div class="grid grid-cols-3 gap-1.5" id="tenkey-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"]
            .map((key) => {
              const bgClass =
                key === "OK"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black"
                  : key === "C"
                  ? "bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-bold"
                  : "bg-slate-800 hover:bg-slate-700 text-white font-bold";
              return `
              <button type="button" class="btn-tenkey-key py-2.5 rounded-xl text-sm shadow active:scale-95 transition ${bgClass}" data-key="${key}">
                ${key}
              </button>
            `;
            })
            .join("")}
        </div>
      </div>
    `;

    const displayEl = slotEl.querySelector("#tenkey-display");
    const closeBtn = slotEl.querySelector("#btn-tenkey-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        slotEl.className = "hidden";
      });
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
            this.oppLineup[this.tenkeyTargetSlot].name = `${num}番 打者`;
          }
          slotEl.className = "hidden";
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

  openPlayerSelectPrompt(orderIdx) {
    const listStr = this.roster.map((p, idx) => `${idx + 1}: #${p.number} ${p.name} (${p.pos})`).join("\n");
    const selectIdx = prompt(`【${orderIdx + 1}番打者】割り当てる番号を入力してください:\n${listStr}`);
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

  importBatchText(text) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    let count = 0;

    lines.forEach((line) => {
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

  /**
   * GameState の teams (away / home) に9人オーダーを完全反映し、即座に同期
   */
  applyLineupToGame() {
    // 反映時に入力枠の内容も最終確認して反映
    const inputDate = this.container.querySelector("#input-game-date");
    const inputTournament = this.container.querySelector("#input-game-tournament");
    const inputMyTeam = this.container.querySelector("#input-team-my");
    const inputOppTeam = this.container.querySelector("#input-team-opp");

    if (typeof this.gameState.updateGameInfo === "function") {
      this.gameState.updateGameInfo({
        date: inputDate ? inputDate.value : undefined,
        tournament: inputTournament ? inputTournament.value : undefined,
        myTeamName: inputMyTeam ? inputMyTeam.value : undefined,
        oppTeamName: inputOppTeam ? inputOppTeam.value : undefined,
        myTeamSide: this.myTeamSide
      });
    }

    const state = this.gameState.getState();
    if (!state.teams) return;

    const awayLineup = this.myTeamSide === "away" ? this.myLineup : this.oppLineup;
    const homeLineup = this.myTeamSide === "home" ? this.myLineup : this.oppLineup;

    const awayPitcher = awayLineup.find((s) => s.pos === "投") || awayLineup[0];
    const homePitcher = homeLineup.find((s) => s.pos === "投") || homeLineup[0];

    // 先攻チームへの反映
    state.teams.away.roster = awayLineup.map((s, idx) => ({
      order: idx + 1,
      number: s.number,
      name: s.name,
      pos: s.pos
    }));
    state.teams.away.pitcher = {
      name: awayPitcher ? awayPitcher.name : "先発 投手",
      number: awayPitcher ? awayPitcher.number : 1
    };

    // 後攻チームへの反映
    state.teams.home.roster = homeLineup.map((s, idx) => ({
      order: idx + 1,
      number: s.number,
      name: s.name,
      pos: s.pos
    }));
    state.teams.home.pitcher = {
      name: homePitcher ? homePitcher.name : "相手 投手",
      number: homePitcher ? homePitcher.number : 1
    };

    // 現在の対戦（打者・投手）を最新のオーダーから即座に再計算
    if (typeof this.gameState.syncCurrentMatchup === "function") {
      this.gameState.syncCurrentMatchup();
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
