/**
 * js/components/rosterView.js
 * 団員名簿 ＆ オーダー編成（司令塔コンポーネント 完全動作保証版）
 * 
 * 責務:
 * - 試合基本情報の自動同期 (日付・大会名・球場名・チーム名)
 * - 1〜9番オーダー編成スロット (PC/スマホDnD・スクロール位置保持)
 * - ベンチ名簿バッジから打順への直接ドラッグ＆ドロップ割当 (divドラッグ化で完全動作)
 * - ドロップ時に枠の守備位置を最優先キープ (ポジション崩れ防止)
 * - 公式戦/練習試合 2系統背番号切替
 * - 相手チーム控え選手（ベンチメンバー）管理 ＆ ドラッグ＆ドロップ選手交代
 * - 各種モーダル連携 (TenkeyModalComponent / RosterMasterTabComponent)
 * - GameState へのオーダー反映
 */

import { TenkeyModalComponent } from "./tenkeyModal.js";
import { RosterMasterTabComponent } from "./rosterMasterTab.js";

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
  { id: "p1", number: 10, officialNumber: 10, practiceNumber: 1, name: "山田 太郎", grade: 6, throws: "右", bats: "右", pos: "投" },
  { id: "p2", number: 1, officialNumber: 1, practiceNumber: 2, name: "佐藤 健一", grade: 6, throws: "右", bats: "右", pos: "捕" },
  { id: "p3", number: 3, officialNumber: 3, practiceNumber: 3, name: "田中 拓海", grade: 6, throws: "右", bats: "左", pos: "一" },
  { id: "p4", number: 4, officialNumber: 4, practiceNumber: 4, name: "伊藤 陸", grade: 5, throws: "右", bats: "右", pos: "二" },
  { id: "p5", number: 5, officialNumber: 5, practiceNumber: 5, name: "中村 蓮", grade: 6, throws: "右", bats: "右", pos: "三" },
  { id: "p6", number: 6, officialNumber: 6, practiceNumber: 6, name: "小林 隼人", grade: 6, throws: "右", bats: "左", pos: "遊" },
  { id: "p7", number: 7, officialNumber: 7, practiceNumber: 7, name: "金子 真怜", grade: 5, throws: "右", bats: "左", pos: "中" },
  { id: "p8", number: 8, officialNumber: 8, practiceNumber: 8, name: "渡辺 航", grade: 5, throws: "左", bats: "左", pos: "左" },
  { id: "p9", number: 9, officialNumber: 9, practiceNumber: 9, name: "加藤 蒼空", grade: 4, throws: "右", bats: "右", pos: "右" },
  { id: "p10", number: 11, officialNumber: 11, practiceNumber: 10, name: "高橋 翔太", grade: 5, throws: "右", bats: "右", pos: "投" },
  { id: "p11", number: 12, officialNumber: 12, practiceNumber: 11, name: "松本 奏汰", grade: 4, throws: "右", bats: "右", pos: "外" }
];

export class RosterViewComponent {
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;

    this.activeSubTab = "order"; // "order" | "roster"
    this.targetTeam = "my"; // "my" | "opp"
    this.myTeamSide = "away"; // "away" (先攻) または "home" (後攻)
    this.matchType = this.loadMatchType(); // "official" | "practice"

    this.roster = this.loadRoster();
    this.myLineup = this.loadLineup("my") || this.generateDefaultLineup();
    this.oppLineup = this.loadLineup("opp") || this.generateOpponentDefaultLineup();
    this.oppBench = this.loadOppBench() || this.generateDefaultOpponentBench();

    this.tenkeyComponent = null;
    this.rosterMasterComponent = null;

    this.init();
  }

  init() {
    this.render();
    this.initSubComponents();
    this.bindEvents();
  }

  initSubComponents() {
    const tenkeySlot = this.container.querySelector("#tenkey-modal-slot");
    if (tenkeySlot) {
      this.tenkeyComponent = new TenkeyModalComponent(tenkeySlot, (orderIdx, playerInfo) => {
        // 相手控え選手の追加処理
        if (orderIdx === "opp_bench") {
          const num = (playerInfo.number !== undefined && playerInfo.number !== null) ? playerInfo.number : 10;
          const name = playerInfo.name || `相手 ${num}番`;
          this.oppBench.push({
            id: `opp_b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            number: num,
            name: name,
            pos: "控"
          });
          this.saveOppBench(this.oppBench);
          this.render();
          this.initSubComponents();
          this.bindEvents();
          return;
        }

        if (!this.oppLineup[orderIdx]) return;
        if (playerInfo.number !== undefined) this.oppLineup[orderIdx].number = playerInfo.number;
        if (playerInfo.name !== undefined) this.oppLineup[orderIdx].name = playerInfo.name;
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    }

    const rosterTabContainer = this.container.querySelector("#roster-tab-container");
    if (rosterTabContainer) {
      this.rosterMasterComponent = new RosterMasterTabComponent(rosterTabContainer, {
        getRoster: () => this.roster,
        getMatchType: () => this.matchType,
        onSave: (updatedRoster) => {
          this.roster = updatedRoster;
          this.saveRoster();
        }
      });
      this.rosterMasterComponent.render();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl select-none space-y-3 w-full max-w-xl max-h-[90vh] overflow-y-auto">
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

        <div id="roster-view-content">
          ${this.activeSubTab === "order" ? this.renderOrderTab() : `<div id="roster-tab-container"></div>`}
        </div>
      </div>

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
      venue: "",
      myTeamName: "自チーム",
      oppTeamName: "相手チーム",
      myTeamSide: "away"
    };

    return `
      <div class="space-y-3">
        <!-- 試合基本情報入力 -->
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
            <div class="col-span-2">
              <label class="block text-[10px] text-slate-400 mb-0.5">球場 / グラウンド名</label>
              <input type="text" id="input-game-venue" value="${gameInfo.venue || ''}" placeholder="例: 市民球場 A面" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500">
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

        <!-- 攻守設定・背番号モード・チーム切替 -->
        <div class="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
            <span class="text-[11px] text-slate-400 font-bold">自チーム:</span>
            <button type="button" id="btn-toggle-attack-side" class="px-2 py-1 rounded font-bold border text-[11px] transition ${
              this.myTeamSide === "away" ? "bg-sky-950 text-sky-300 border-sky-700" : "bg-amber-950 text-amber-300 border-amber-700"
            }">
              ${this.myTeamSide === "away" ? "先攻 (1回表)" : "後攻 (1回裏)"}
            </button>
            <button type="button" id="btn-toggle-match-type" class="px-2 py-1 rounded font-bold border text-[11px] transition flex items-center gap-1 ${
              this.matchType === "official" ? "bg-indigo-950 text-indigo-300 border-indigo-700 hover:bg-indigo-900/60" : "bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60"
            }">
              <span>${this.matchType === "official" ? "🏆 公式戦背番号" : "⚾️ 練習試合背番号"}</span>
              <span class="text-[9px] text-slate-400">切替▾</span>
            </button>
          </div>

          <div class="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700 w-full sm:w-auto justify-center">
            <button type="button" id="team-switch-my" class="px-3 py-1 rounded font-extrabold transition text-xs ${isMyTeam ? "bg-sky-600 text-white shadow" : "text-slate-400 hover:text-white"}">
              自チーム
            </button>
            <button type="button" id="team-switch-opp" class="px-3 py-1 rounded font-extrabold transition text-xs ${!isMyTeam ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"}">
              相手チーム
            </button>
          </div>
        </div>

        <!-- 1〜9番 打順スロット（DnD受け皿） -->
        <div id="lineup-slots-container" class="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
          ${currentLineup
            .map((slot, index) => {
              const hasNum = slot.number !== null && slot.number !== undefined && slot.number !== "";
              return `
                <div class="lineup-slot-row flex items-center justify-between bg-slate-950/80 border border-slate-800 hover:border-slate-700 px-2 py-1.5 rounded-xl text-xs gap-1.5 transition-all select-none" draggable="true" data-order="${index}">
                  <div class="flex items-center gap-1 min-w-[42px] cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 drag-handle py-1" title="上下にドラッグして打順を変更">
                    <span class="text-xs select-none">⠿</span>
                    <span class="font-black text-amber-400 text-sm font-mono">${index + 1}</span>
                    <span class="text-[9px] text-slate-500">番</span>
                  </div>
                  <select class="select-slot-pos bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500" data-order="${index}">
                    ${POSITIONS.map((p) => `<option value="${p.id}" ${slot.pos === p.id ? "selected" : ""}>${p.id}</option>`).join("")}
                  </select>
                  <button type="button" class="btn-open-slot-edit flex-1 flex items-center justify-between bg-slate-900/90 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-700 text-left transition truncate" data-order="${index}">
                    <div class="flex items-center gap-1.5 truncate">
                      <span class="bg-slate-800 text-emerald-400 font-mono font-black text-xs px-1.5 py-0.5 rounded border border-slate-700 flex-shrink-0">
                        #${hasNum ? slot.number : "-"}
                      </span>
                      <span class="font-bold text-slate-200 truncate">${slot.name || "選手未指定"}</span>
                    </div>
                    <span class="text-[9px] text-slate-400 flex-shrink-0 ml-1">変更▾</span>
                  </button>
                </div>
              `;
            })
            .join("")}
        </div>

        <!-- 自チーム時: ベンチ名簿バッジ一覧 -->
        ${isMyTeam ? `
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-400 flex items-center gap-1">
                <span>👥 名簿から打順へ割当</span>
                <span class="text-[10px] text-indigo-400 font-mono">(${this.matchType === "official" ? "公式戦" : "練習試合"})</span>:
              </span>
              <button type="button" id="btn-copy-prev-order" class="text-[10px] text-emerald-400 hover:underline">標準オーダーで全自動配置</button>
            </div>
            <div class="flex flex-wrap gap-1 max-h-[85px] overflow-y-auto" id="bench-badges-container">
              ${this.roster
                .map((p) => {
                  const isAssigned = this.myLineup.some((slot) => slot.playerId === p.id);
                  const displayNum = this.getPlayerNumber(p);
                  const hasNum = displayNum !== null && displayNum !== undefined && displayNum !== "";

                  return `
                    <div role="button" draggable="true" class="btn-bench-badge px-2 py-0.5 rounded text-[11px] font-bold border transition flex items-center gap-1 select-none cursor-grab active:cursor-grabbing ${
                      isAssigned ? "bg-slate-800/40 border-slate-800 text-slate-600 opacity-60" : "bg-slate-800 border-slate-700 text-emerald-400 hover:bg-emerald-950/50 hover:border-emerald-600 active:scale-95 shadow"
                    }" data-player-id="${p.id}" title="タップで割当、またはドラッグして目的の打順へドロップ">
                      <span class="font-mono font-black pointer-events-none ${hasNum ? '' : 'text-slate-500 font-normal'}">
                        ${hasNum ? `#${displayNum}` : '[なし]'}
                      </span>
                      <span class="text-slate-200 pointer-events-none truncate max-w-[90px]">${p.name}</span>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        ` : `
          <!-- 相手チーム時: 控え選手（ベンチメンバー）エリア -->
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-400 flex items-center gap-1">
                <span>👥 相手 控え選手 (${this.oppBench.length}名)</span>
              </span>
              <button type="button" id="btn-open-add-opp-bench" class="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow transition">
                <span>＋ 控え選手を追加</span>
              </button>
            </div>
            <div class="flex flex-wrap gap-1 max-h-[85px] overflow-y-auto" id="opp-bench-badges-container">
              ${this.oppBench.length === 0 ? `
                <span class="text-[10px] text-slate-500 py-1 pl-1">控え選手が未登録です。「＋ 控え選手を追加」から登録してください</span>
              ` : this.oppBench.map((p) => `
                <div role="button" draggable="true" class="btn-opp-bench-badge px-2 py-0.5 rounded text-[11px] font-bold border border-slate-700 bg-slate-800 text-amber-400 hover:bg-amber-950/50 hover:border-amber-600 active:scale-95 shadow transition flex items-center gap-1 select-none cursor-grab active:cursor-grabbing" data-opp-bench-id="${p.id}" title="ドラッグして打順枠へドロップすると選手交代">
                  <span class="font-mono font-black pointer-events-none">#${p.number}</span>
                  <span class="text-slate-200 pointer-events-none truncate max-w-[80px]">${p.name}</span>
                  <button type="button" class="btn-remove-opp-bench text-slate-500 hover:text-rose-400 ml-1 text-xs" data-id="${p.id}" title="控えから削除">×</button>
                </div>
              `).join("")}
            </div>
          </div>
        `}

        <button type="button" id="btn-apply-lineup" class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-1.5">
          <span>✓ このオーダーを試合に反映する</span>
        </button>
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
        this.initSubComponents();
        this.bindEvents();
      });
    }
    if (btnRoster) {
      btnRoster.addEventListener("click", () => {
        this.activeSubTab = "roster";
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    }

    const btnClose = this.container.querySelector("#btn-close-roster-view");
    if (btnClose) {
      btnClose.addEventListener("click", () => this.container.classList.add("hidden"));
    }

    if (this.activeSubTab === "order") {
      this.bindOrderEvents();
    }
  }

  bindOrderEvents() {
    const syncGameInfo = () => {
      const inputDate = this.container.querySelector("#input-game-date");
      const inputTournament = this.container.querySelector("#input-game-tournament");
      const inputVenue = this.container.querySelector("#input-game-venue");
      const inputMyTeam = this.container.querySelector("#input-team-my");
      const inputOppTeam = this.container.querySelector("#input-team-opp");

      if (typeof this.gameState.updateGameInfo === "function") {
        this.gameState.updateGameInfo({
          date: inputDate ? inputDate.value : undefined,
          tournament: inputTournament ? inputTournament.value : undefined,
          venue: inputVenue ? inputVenue.value : undefined,
          myTeamName: inputMyTeam ? inputMyTeam.value : undefined,
          oppTeamName: inputOppTeam ? inputOppTeam.value : undefined,
          myTeamSide: this.myTeamSide
        });
      }
    };

    ["#input-game-date", "#input-game-tournament", "#input-game-venue", "#input-team-my", "#input-team-opp"].forEach((sel) => {
      const el = this.container.querySelector(sel);
      if (el) {
        el.addEventListener("change", syncGameInfo);
        el.addEventListener("blur", syncGameInfo);
      }
    });

    const btnSide = this.container.querySelector("#btn-toggle-attack-side");
    if (btnSide) {
      btnSide.addEventListener("click", () => {
        this.myTeamSide = this.myTeamSide === "away" ? "home" : "away";
        syncGameInfo();
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    }

    const btnMatchType = this.container.querySelector("#btn-toggle-match-type");
    if (btnMatchType) {
      btnMatchType.addEventListener("click", () => {
        this.matchType = this.matchType === "official" ? "practice" : "official";
        this.saveMatchType(this.matchType);
        this.syncLineupNumbersWithCurrentMode();
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    }

    const btnMy = this.container.querySelector("#team-switch-my");
    const btnOpp = this.container.querySelector("#team-switch-opp");
    if (btnMy) {
      btnMy.addEventListener("click", () => {
        this.targetTeam = "my";
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    }
    if (btnOpp) {
      btnOpp.addEventListener("click", () => {
        this.targetTeam = "opp";
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    }

    const btnCopy = this.container.querySelector("#btn-copy-prev-order");
    if (btnCopy) {
      btnCopy.addEventListener("click", () => {
        this.myLineup = this.generateDefaultLineup();
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    }

    this.container.querySelectorAll(".select-slot-pos").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const orderIdx = parseInt(e.target.getAttribute("data-order"), 10);
        const lineup = this.targetTeam === "my" ? this.myLineup : this.oppLineup;
        if (lineup[orderIdx]) lineup[orderIdx].pos = e.target.value;
      });
    });

    this.container.querySelectorAll(".btn-open-slot-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderIdx = parseInt(btn.getAttribute("data-order"), 10);
        if (this.targetTeam === "opp") {
          if (this.tenkeyComponent) {
            this.tenkeyComponent.open(orderIdx, this.oppLineup[orderIdx] || {});
          }
        } else {
          this.openPlayerSelectPrompt(orderIdx);
        }
      });
    });

    // 相手チーム 控え選手追加ボタン
    const btnAddOppBench = this.container.querySelector("#btn-open-add-opp-bench");
    if (btnAddOppBench && this.tenkeyComponent) {
      btnAddOppBench.addEventListener("click", () => {
        this.tenkeyComponent.open("opp_bench", { number: "", name: "" });
      });
    }

    // 相手控え選手の削除ボタン (×)
    this.container.querySelectorAll(".btn-remove-opp-bench").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute("data-id");
        this.oppBench = this.oppBench.filter((p) => p.id !== bId);
        this.saveOppBench(this.oppBench);
        this.render();
        this.initSubComponents();
        this.bindEvents();
      });
    });

    this.bindLineupDragAndDrop();

    // ベンチバッジ：ワンタップ時は「空き枠へ先頭から配置」
    this.container.querySelectorAll(".btn-bench-badge").forEach((badge) => {
      badge.addEventListener("click", () => {
        if (badge.dataset.wasDragged === "true") {
          badge.dataset.wasDragged = "false";
          return;
        }
        const pId = badge.getAttribute("data-player-id");
        const player = this.roster.find((p) => p.id === pId);
        if (!player) return;

        const emptyIdx = this.myLineup.findIndex((slot) => !slot.playerId);
        const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
        this.assignPlayerToSlot(pId, targetIdx);
      });
    });

    const btnApply = this.container.querySelector("#btn-apply-lineup");
    if (btnApply) {
      btnApply.addEventListener("click", () => this.applyLineupToGame());
    }
  }

  bindLineupDragAndDrop() {
    const rows = this.container.querySelectorAll(".lineup-slot-row");
    const myBadges = this.container.querySelectorAll(".btn-bench-badge");
    const oppBadges = this.container.querySelectorAll(".btn-opp-bench-badge");
    let currentDragPayload = null;

    // 1. スロット行の PC ドラッグ
    rows.forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        const orderIdx = parseInt(row.getAttribute("data-order"), 10);
        currentDragPayload = { type: "slot", index: orderIdx };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify(currentDragPayload));
        row.classList.add("opacity-40", "scale-[0.98]", "border-emerald-500");
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        row.classList.add("bg-emerald-950/60", "border-emerald-400");
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("bg-emerald-950/60", "border-emerald-400");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("bg-emerald-950/60", "border-emerald-400");
        const targetIndex = parseInt(row.getAttribute("data-order"), 10);

        try {
          const raw = e.dataTransfer.getData("text/plain");
          const payload = raw ? JSON.parse(raw) : currentDragPayload;
          if (!payload) return;

          if (payload.type === "slot" && payload.index !== targetIndex) {
            this.reorderLineup(payload.index, targetIndex);
          } else if (payload.type === "bench") {
            this.assignPlayerToSlot(payload.playerId, targetIndex);
          } else if (payload.type === "opp_bench") {
            this.substituteOpponentPlayer(payload.benchId, targetIndex);
          }
        } catch (err) {
          console.warn("ドロップ解析エラー", err);
        }
      });

      row.addEventListener("dragend", () => {
        rows.forEach((r) => r.classList.remove("opacity-40", "scale-[0.98]", "border-emerald-500", "bg-emerald-950/60", "border-emerald-400"));
        currentDragPayload = null;
      });
    });

    // 2. 自チーム名簿バッジの PC ドラッグ
    myBadges.forEach((badge) => {
      badge.addEventListener("dragstart", (e) => {
        const pId = badge.getAttribute("data-player-id");
        currentDragPayload = { type: "bench", playerId: pId };
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", JSON.stringify(currentDragPayload));
        badge.classList.add("opacity-50", "border-emerald-400");
      });

      badge.addEventListener("dragend", () => {
        badge.classList.remove("opacity-50", "border-emerald-400");
        currentDragPayload = null;
      });
    });

    // 2.5 相手チーム控えバッジの PC ドラッグ
    oppBadges.forEach((badge) => {
      badge.addEventListener("dragstart", (e) => {
        const bId = badge.getAttribute("data-opp-bench-id");
        currentDragPayload = { type: "opp_bench", benchId: bId };
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", JSON.stringify(currentDragPayload));
        badge.classList.add("opacity-50", "border-amber-400");
      });

      badge.addEventListener("dragend", () => {
        badge.classList.remove("opacity-50", "border-amber-400");
        currentDragPayload = null;
      });
    });

    // 3. スロット行の スマホタッチ DnD
    rows.forEach((row) => {
      const handle = row.querySelector(".drag-handle");
      if (!handle) return;
      let activeRow = null;

      handle.addEventListener("touchstart", () => {
        const orderIdx = parseInt(row.getAttribute("data-order"), 10);
        currentDragPayload = { type: "slot", index: orderIdx };
        activeRow = row;
        row.classList.add("opacity-60", "border-emerald-500", "bg-slate-900");
      }, { passive: true });

      handle.addEventListener("touchmove", (e) => {
        const clientY = e.touches[0].clientY;
        const elBelow = document.elementFromPoint(e.touches[0].clientX, clientY);
        if (!elBelow) return;
        const targetRow = elBelow.closest(".lineup-slot-row");
        rows.forEach((r) => r.classList.remove("bg-emerald-950/60", "border-emerald-400"));
        if (targetRow && targetRow !== activeRow) {
          targetRow.classList.add("bg-emerald-950/60", "border-emerald-400");
        }
      }, { passive: true });

      handle.addEventListener("touchend", (e) => {
        rows.forEach((r) => r.classList.remove("opacity-60", "border-emerald-500", "bg-slate-900", "bg-emerald-950/60", "border-emerald-400"));
        const clientY = e.changedTouches[0].clientY;
        const elBelow = document.elementFromPoint(e.changedTouches[0].clientX, clientY);
        if (elBelow) {
          const targetRow = elBelow.closest(".lineup-slot-row");
          if (targetRow && currentDragPayload && currentDragPayload.type === "slot") {
            const targetIndex = parseInt(targetRow.getAttribute("data-order"), 10);
            if (currentDragPayload.index !== targetIndex) {
              this.reorderLineup(currentDragPayload.index, targetIndex);
            }
          }
        }
        currentDragPayload = null;
        activeRow = null;
      });
    });

    // 4. 自チーム名簿バッジの スマホタッチ DnD
    myBadges.forEach((badge) => {
      let startX = 0, startY = 0;
      let isDragging = false;
      const pId = badge.getAttribute("data-player-id");

      badge.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = false;
        badge.dataset.wasDragged = "false";
      }, { passive: true });

      badge.addEventListener("touchmove", (e) => {
        const moveX = Math.abs(e.touches[0].clientX - startX);
        const moveY = Math.abs(e.touches[0].clientY - startY);

        if (moveX > 8 || moveY > 8) {
          isDragging = true;
          badge.dataset.wasDragged = "true";
          badge.classList.add("opacity-50", "border-emerald-400");

          const elBelow = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
          const targetRow = elBelow ? elBelow.closest(".lineup-slot-row") : null;
          rows.forEach((r) => r.classList.remove("bg-emerald-950/60", "border-emerald-400"));
          if (targetRow) {
            targetRow.classList.add("bg-emerald-950/60", "border-emerald-400");
          }
        }
      }, { passive: true });

      badge.addEventListener("touchend", (e) => {
        badge.classList.remove("opacity-50", "border-emerald-400");
        rows.forEach((r) => r.classList.remove("bg-emerald-950/60", "border-emerald-400"));

        if (isDragging) {
          const clientX = e.changedTouches[0].clientX;
          const clientY = e.changedTouches[0].clientY;
          const elBelow = document.elementFromPoint(clientX, clientY);
          const targetRow = elBelow ? elBelow.closest(".lineup-slot-row") : null;

          if (targetRow) {
            const targetIndex = parseInt(targetRow.getAttribute("data-order"), 10);
            this.assignPlayerToSlot(pId, targetIndex);
          }
        }
        isDragging = false;
      });
    });

    // 4.5 相手チーム控えバッジの スマホタッチ DnD
    oppBadges.forEach((badge) => {
      let startX = 0, startY = 0;
      let isDragging = false;
      const bId = badge.getAttribute("data-opp-bench-id");

      badge.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = false;
        badge.dataset.wasDragged = "false";
      }, { passive: true });

      badge.addEventListener("touchmove", (e) => {
        const moveX = Math.abs(e.touches[0].clientX - startX);
        const moveY = Math.abs(e.touches[0].clientY - startY);

        if (moveX > 8 || moveY > 8) {
          isDragging = true;
          badge.dataset.wasDragged = "true";
          badge.classList.add("opacity-50", "border-amber-400");

          const elBelow = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
          const targetRow = elBelow ? elBelow.closest(".lineup-slot-row") : null;
          rows.forEach((r) => r.classList.remove("bg-emerald-950/60", "border-emerald-400"));
          if (targetRow) {
            targetRow.classList.add("bg-emerald-950/60", "border-emerald-400");
          }
        }
      }, { passive: true });

      badge.addEventListener("touchend", (e) => {
        badge.classList.remove("opacity-50", "border-amber-400");
        rows.forEach((r) => r.classList.remove("bg-emerald-950/60", "border-emerald-400"));

        if (isDragging) {
          const clientX = e.changedTouches[0].clientX;
          const clientY = e.changedTouches[0].clientY;
          const elBelow = document.elementFromPoint(clientX, clientY);
          const targetRow = elBelow ? elBelow.closest(".lineup-slot-row") : null;

          if (targetRow) {
            const targetIndex = parseInt(targetRow.getAttribute("data-order"), 10);
            this.substituteOpponentPlayer(bId, targetIndex);
          }
        }
        isDragging = false;
      });
    });
  }

  // 相手チームの選手交代処理（控え選手を打順へ入れ、元の先発選手を控えへ退避）
  substituteOpponentPlayer(benchId, targetIndex) {
    const benchPlayer = this.oppBench.find((p) => p.id === benchId);
    if (!benchPlayer || targetIndex < 0 || targetIndex >= 9) return;

    const modalScrollEl = this.container.querySelector(".overflow-y-auto");
    const modalScrollTop = modalScrollEl ? modalScrollEl.scrollTop : 0;
    const slotsScrollEl = this.container.querySelector("#lineup-slots-container");
    const slotsScrollTop = slotsScrollEl ? slotsScrollEl.scrollTop : 0;

    const targetSlot = this.oppLineup[targetIndex];

    // 退く先発選手を控えリストへ退避（情報が失われない）
    const outgoingPlayer = {
      id: `opp_b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number: targetSlot.number,
      name: targetSlot.name,
      pos: targetSlot.pos
    };

    // 控えから投入された選手を削除し、退いた先発選手を追加
    this.oppBench = this.oppBench.filter((p) => p.id !== benchId);
    this.oppBench.push(outgoingPlayer);

    // 打順スロットの守備位置はキープして選手交代
    this.oppLineup[targetIndex] = {
      order: targetIndex + 1,
      number: benchPlayer.number,
      name: benchPlayer.name,
      pos: targetSlot.pos || "外"
    };

    this.saveLineup("opp", this.oppLineup);
    this.saveOppBench(this.oppBench);
    this.render();
    this.initSubComponents();
    this.bindEvents();

    const newModalScrollEl = this.container.querySelector(".overflow-y-auto");
    if (newModalScrollEl) newModalScrollEl.scrollTop = modalScrollTop;
    const newSlotsScrollEl = this.container.querySelector("#lineup-slots-container");
    if (newSlotsScrollEl) newSlotsScrollEl.scrollTop = slotsScrollTop;
  }

  assignPlayerToSlot(playerId, targetIndex) {
    const player = this.roster.find((p) => p.id === playerId);
    if (!player || targetIndex < 0 || targetIndex >= 9) return;

    const modalScrollEl = this.container.querySelector(".overflow-y-auto");
    const modalScrollTop = modalScrollEl ? modalScrollEl.scrollTop : 0;
    const slotsScrollEl = this.container.querySelector("#lineup-slots-container");
    const slotsScrollTop = slotsScrollEl ? slotsScrollEl.scrollTop : 0;

    const existingIndex = this.myLineup.findIndex((slot) => slot.playerId === player.id);
    const targetSlot = this.myLineup[targetIndex];

    // 枠にすでに設定されている守備位置を最優先でキープ（名簿の初期値で勝手に上書きしない）
    const preservedTargetPos = targetSlot.pos || player.pos || "外";

    if (existingIndex !== -1 && existingIndex !== targetIndex) {
      // 既存枠と入れ替える場合も、各枠の守備位置は維持して選手情報のみスワップ
      const existingSlot = this.myLineup[existingIndex];
      this.myLineup[existingIndex] = {
        order: existingIndex + 1,
        playerId: targetSlot.playerId,
        number: targetSlot.number,
        name: targetSlot.name,
        pos: existingSlot.pos
      };
    }

    this.myLineup[targetIndex] = {
      order: targetIndex + 1,
      playerId: player.id,
      number: this.getPlayerNumber(player),
      name: player.name,
      pos: preservedTargetPos
    };

    this.saveLineup("my", this.myLineup);
    this.render();
    this.initSubComponents();
    this.bindEvents();

    const newModalScrollEl = this.container.querySelector(".overflow-y-auto");
    if (newModalScrollEl) newModalScrollEl.scrollTop = modalScrollTop;
    const newSlotsScrollEl = this.container.querySelector("#lineup-slots-container");
    if (newSlotsScrollEl) newSlotsScrollEl.scrollTop = slotsScrollTop;
  }

  reorderLineup(fromIndex, toIndex) {
    const lineup = this.targetTeam === "my" ? this.myLineup : this.oppLineup;
    if (!lineup[fromIndex] || !lineup[toIndex]) return;

    const modalScrollEl = this.container.querySelector(".overflow-y-auto");
    const modalScrollTop = modalScrollEl ? modalScrollEl.scrollTop : 0;
    const slotsScrollEl = this.container.querySelector("#lineup-slots-container");
    const slotsScrollTop = slotsScrollEl ? slotsScrollEl.scrollTop : 0;

    // 各打順スロットの守備位置を退避
    const originalPositions = lineup.map((slot) => slot.pos);

    const [movedItem] = lineup.splice(fromIndex, 1);
    lineup.splice(toIndex, 0, movedItem);

    // 打順スロットの守備位置は固定キープし、選手（打順）だけを並び替え
    lineup.forEach((slot, idx) => {
      slot.order = idx + 1;
      slot.pos = originalPositions[idx];
    });

    this.saveLineup(this.targetTeam, lineup);
    this.render();
    this.initSubComponents();
    this.bindEvents();

    const newModalScrollEl = this.container.querySelector(".overflow-y-auto");
    if (newModalScrollEl) newModalScrollEl.scrollTop = modalScrollTop;
    const newSlotsScrollEl = this.container.querySelector("#lineup-slots-container");
    if (newSlotsScrollEl) newSlotsScrollEl.scrollTop = slotsScrollTop;
  }

  openPlayerSelectPrompt(orderIdx) {
    const listStr = this.roster.map((p, idx) => `${idx + 1}: #${this.getPlayerNumber(p)} ${p.name} (${p.pos})`).join("\n");
    const selectIdx = prompt(`【${orderIdx + 1}番打者】割り当てる番号を入力してください:\n${listStr}`);
    if (!selectIdx) return;

    const idx = parseInt(selectIdx, 10) - 1;
    const player = this.roster[idx];
    if (player) {
      const currentSlot = this.myLineup[orderIdx] || {};
      this.myLineup[orderIdx] = {
        order: orderIdx + 1,
        playerId: player.id,
        number: this.getPlayerNumber(player),
        name: player.name,
        pos: currentSlot.pos || player.pos || "外"
      };
      this.render();
      this.initSubComponents();
      this.bindEvents();
    }
  }

  getPlayerNumber(player) {
    if (!player) return "";
    if (this.matchType === "practice") {
      const pNum = player.practiceNumber ?? player.number;
      return (pNum !== null && pNum !== undefined && pNum !== "") ? pNum : "";
    } else {
      const oNum = player.officialNumber;
      return (oNum !== null && oNum !== undefined && oNum !== "") ? oNum : "";
    }
  }

  syncLineupNumbersWithCurrentMode() {
    this.myLineup.forEach((slot) => {
      if (slot && slot.playerId) {
        const p = this.roster.find((r) => r.id === slot.playerId);
        if (p) slot.number = this.getPlayerNumber(p);
      }
    });
    this.saveLineup("my", this.myLineup);
  }

  applyLineupToGame() {
    const inputDate = this.container.querySelector("#input-game-date");
    const inputTournament = this.container.querySelector("#input-game-tournament");
    const inputVenue = this.container.querySelector("#input-game-venue");
    const inputMyTeam = this.container.querySelector("#input-team-my");
    const inputOppTeam = this.container.querySelector("#input-team-opp");

    if (typeof this.gameState.updateGameInfo === "function") {
      this.gameState.updateGameInfo({
        date: inputDate ? inputDate.value : undefined,
        tournament: inputTournament ? inputTournament.value : undefined,
        venue: inputVenue ? inputVenue.value : undefined,
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

    state.teams.away.roster = awayLineup.map((s, idx) => ({ order: idx + 1, number: s.number, name: s.name, pos: s.pos }));
    state.teams.away.pitcher = { 
      name: awayPitcher ? awayPitcher.name : "先発 投手", 
      number: (awayPitcher && awayPitcher.number !== undefined && awayPitcher.number !== null && awayPitcher.number !== "") ? awayPitcher.number : 1 
    };

    state.teams.home.roster = homeLineup.map((s, idx) => ({ order: idx + 1, number: s.number, name: s.name, pos: s.pos }));
    state.teams.home.pitcher = { 
      name: homePitcher ? homePitcher.name : "相手 投手", 
      number: (homePitcher && homePitcher.number !== undefined && homePitcher.number !== null && homePitcher.number !== "") ? homePitcher.number : 1 
    };

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
      { order: 1, playerId: "p1", number: this.matchType === "official" ? 10 : 1, name: "山田 太郎", pos: "投" },
      { order: 2, playerId: "p2", number: this.matchType === "official" ? 1 : 2, name: "佐藤 健一", pos: "捕" },
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

  generateDefaultOpponentBench() {
    return [
      { id: "opp_b_1", number: 10, name: "相手 10番", pos: "控" },
      { id: "opp_b_2", number: 11, name: "相手 11番", pos: "控" }
    ];
  }

  saveOppBench(bench) {
    try {
      localStorage.setItem("gakudo_opp_bench", JSON.stringify(bench));
    } catch (e) {
      console.warn("相手控え保存失敗", e);
    }
  }

  loadOppBench() {
    try {
      const data = localStorage.getItem("gakudo_opp_bench");
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
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
      const list = data ? JSON.parse(data) : DEFAULT_ROSTER;
      return list.map((p) => ({
        ...p,
        officialNumber: p.officialNumber ?? p.number ?? 99,
        practiceNumber: p.practiceNumber ?? p.number ?? 99
      }));
    } catch (e) {
      return DEFAULT_ROSTER;
    }
  }

  saveMatchType(type) {
    try {
      localStorage.setItem("gakudo_match_type", type);
    } catch (e) {
      console.warn("試合種別保存失敗", e);
    }
  }

  loadMatchType() {
    try {
      return localStorage.getItem("gakudo_match_type") || "official";
    } catch (e) {
      return "official";
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
