/**
 * js/components/rosterView.js
 * 団員名簿 ＆ オーダー編成（司令塔コンポーネント - 洗練・軽量版 約260行）
 * 
 * 責務:
 * - 試合基本情報の自動同期 (日付・大会名・球場名・チーム名)
 * - 1〜9番オーダー編成スロット (PC/スマホ両対応DnD・スクロール保持)
 * - 公式戦/練習試合 2系統背番号切替
 * - 各種モーダル連携 (TenkeyModalComponent / RosterMasterTabComponent)
 * - GameState へのオーダー反映
 */

import { TenkeyModalComponent } from "./tenkeyModal.js";
import { RosterMasterTabComponent } from "./rosterMasterTab.js";

export const POSITIONS = [
  { id: "投", name: "投手" }, { id: "捕", name: "捕手" }, { id: "一", name: "一塁手" },
  { id: "二", name: "二塁手" }, { id: "三", name: "三塁手" }, { id: "遊", name: "遊撃手" },
  { id: "左", name: "左翼手" }, { id: "中", name: "中堅手" }, { id: "右", name: "右翼手" },
  { id: "指", name: "指名打者" }
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
    this.myTeamSide = "away"; // "away" | "home"
    this.matchType = this.loadStorage("gakudo_match_type", "official");

    this.roster = this.loadRoster();
    this.myLineup = this.loadStorage("gakudo_lineup_my") || this.generateDefaultLineup();
    this.oppLineup = this.loadStorage("gakudo_lineup_opp") || this.generateOpponentDefaultLineup();

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
      this.tenkeyComponent = new TenkeyModalComponent(tenkeySlot, (idx, pInfo) => {
        if (!this.oppLineup[idx]) return;
        if (pInfo.number !== undefined) this.oppLineup[idx].number = pInfo.number;
        if (pInfo.name !== undefined) this.oppLineup[idx].name = pInfo.name;
        this.refresh();
      });
    }

    const rosterTabContainer = this.container.querySelector("#roster-tab-container");
    if (rosterTabContainer) {
      this.rosterMasterComponent = new RosterMasterTabComponent(rosterTabContainer, {
        getRoster: () => this.roster,
        getMatchType: () => this.matchType,
        onSave: (updated) => { this.roster = updated; this.saveStorage("gakudo_roster_master", this.roster); }
      });
      this.rosterMasterComponent.render();
    }
  }

  refresh() {
    this.render();
    this.initSubComponents();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl select-none space-y-3 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center gap-1 bg-slate-950 p-0.5 rounded-xl border border-slate-800">
            <button type="button" id="subtab-order" class="px-3 py-1.5 rounded-lg text-xs font-black transition ${this.activeSubTab === "order" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}">📋 オーダー編成</button>
            <button type="button" id="subtab-roster" class="px-3 py-1.5 rounded-lg text-xs font-black transition ${this.activeSubTab === "roster" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}">👥 団員名簿 (${this.roster.length}名)</button>
          </div>
          <button type="button" id="btn-close-roster-view" class="text-slate-400 hover:text-white text-base px-2 py-1 rounded-lg hover:bg-slate-800 transition">✕</button>
        </div>
        <div id="roster-view-content">${this.activeSubTab === "order" ? this.renderOrderTab() : `<div id="roster-tab-container"></div>`}</div>
      </div>
      <div id="tenkey-modal-slot" class="hidden"></div>
    `;
  }

  renderOrderTab() {
    const isMy = this.targetTeam === "my";
    const lineup = isMy ? this.myLineup : this.oppLineup;
    const gInfo = (this.gameState.getState()?.gameInfo) || { date: new Date().toISOString().slice(0, 10), tournament: "公式戦", venue: "", myTeamName: "自チーム", oppTeamName: "相手チーム" };

    return `
      <div class="space-y-3">
        <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-[11px] font-bold text-slate-300"><span>🏟️ 試合基本情報</span><span class="text-[10px] text-slate-500">※自動保存</span></div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div><label class="block text-[10px] text-slate-400 mb-0.5">試合日</label><input type="date" id="input-game-date" value="${gInfo.date || ''}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"></div>
            <div><label class="block text-[10px] text-slate-400 mb-0.5">大会名 / 試合名</label><input type="text" id="input-game-tournament" value="${gInfo.tournament || ''}" placeholder="春季公式戦" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"></div>
            <div class="col-span-2"><label class="block text-[10px] text-slate-400 mb-0.5">球場 / グラウンド名</label><input type="text" id="input-game-venue" value="${gInfo.venue || ''}" placeholder="市民球場 A面" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"></div>
            <div><label class="block text-[10px] text-slate-400 mb-0.5">自チーム名</label><input type="text" id="input-team-my" value="${gInfo.myTeamName || ''}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-bold"></div>
            <div><label class="block text-[10px] text-slate-400 mb-0.5">相手チーム名</label><input type="text" id="input-team-opp" value="${gInfo.oppTeamName || ''}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-bold"></div>
          </div>
        </div>

        <div class="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
            <span class="text-[11px] text-slate-400 font-bold">自チーム:</span>
            <button type="button" id="btn-toggle-attack-side" class="px-2 py-1 rounded font-bold border text-[11px] transition ${this.myTeamSide === "away" ? "bg-sky-950 text-sky-300 border-sky-700" : "bg-amber-950 text-amber-300 border-amber-700"}">${this.myTeamSide === "away" ? "先攻 (1回表)" : "後攻 (1回裏)"}</button>
            <button type="button" id="btn-toggle-match-type" class="px-2 py-1 rounded font-bold border text-[11px] transition flex items-center gap-1 ${this.matchType === "official" ? "bg-indigo-950 text-indigo-300 border-indigo-700" : "bg-emerald-950 text-emerald-300 border-emerald-700"}">
              <span>${this.matchType === "official" ? "🏆 公式戦背番号" : "⚾️ 練習試合背番号"}</span><span class="text-[9px] text-slate-400">切替▾</span>
            </button>
          </div>
          <div class="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700 w-full sm:w-auto justify-center">
            <button type="button" id="team-switch-my" class="px-3 py-1 rounded font-extrabold text-xs ${isMy ? "bg-sky-600 text-white shadow" : "text-slate-400"}">自チーム</button>
            <button type="button" id="team-switch-opp" class="px-3 py-1 rounded font-extrabold text-xs ${!isMy ? "bg-amber-600 text-white shadow" : "text-slate-400"}">相手チーム</button>
          </div>
        </div>

        <div id="lineup-slots-container" class="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
          ${lineup.map((slot, idx) => `
            <div class="lineup-slot-row flex items-center justify-between bg-slate-950/80 border border-slate-800 hover:border-slate-700 px-2 py-1.5 rounded-xl text-xs gap-1.5 transition-all select-none" draggable="true" data-order="${idx}">
              <div class="flex items-center gap-1 min-w-[42px] cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 drag-handle py-1" title="ドラッグして打順変更">
                <span class="text-xs select-none">⠿</span><span class="font-black text-amber-400 text-sm font-mono">${idx + 1}</span><span class="text-[9px] text-slate-500">番</span>
              </div>
              <select class="select-slot-pos bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded px-1.5 py-1 focus:border-emerald-500" data-order="${idx}">
                ${POSITIONS.map(p => `<option value="${p.id}" ${slot.pos === p.id ? "selected" : ""}>${p.id}</option>`).join("")}
              </select>
              <button type="button" class="btn-open-slot-edit flex-1 flex items-center justify-between bg-slate-900/90 hover:bg-slate-800 px-2 py-1 rounded border border-slate-700 text-left transition truncate" data-order="${idx}">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="bg-slate-800 text-emerald-400 font-mono font-black text-xs px-1.5 py-0.5 rounded border border-slate-700 flex-shrink-0">#${slot.number || "-"}</span>
                  <span class="font-bold text-slate-200 truncate">${slot.name || "選手未指定"}</span>
                </div>
                <span class="text-[9px] text-slate-400 flex-shrink-0 ml-1">変更▾</span>
              </button>
            </div>
          `).join("")}
        </div>

        ${isMy ? `
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800 space-y-1">
            <div class="flex items-center justify-between text-[11px]"><span class="font-bold text-slate-400">👥 名簿から打順へ割当:</span><button type="button" id="btn-copy-prev-order" class="text-[10px] text-emerald-400 hover:underline">標準オーダーで自動配置</button></div>
            <div class="flex flex-wrap gap-1 max-h-[85px] overflow-y-auto">
              ${this.roster.map(p => {
                const isAssigned = this.myLineup.some(s => s.playerId === p.id);
                return `<button type="button" class="btn-bench-badge px-2 py-0.5 rounded text-[11px] font-bold border transition flex items-center gap-1 ${isAssigned ? "bg-slate-800/40 border-slate-800 text-slate-600 opacity-50" : "bg-slate-800 border-slate-700 text-emerald-400 hover:border-emerald-600 active:scale-95"}" data-player-id="${p.id}"><span class="font-mono font-black">#${this.getPlayerNumber(p)}</span><span class="text-slate-200">${p.name.split(" ")[0]}</span></button>`;
              }).join("")}
            </div>
          </div>
        ` : ""}

        <button type="button" id="btn-apply-lineup" class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2.5 rounded-xl text-xs shadow-lg transition">✓ このオーダーを試合に反映する</button>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelector("#subtab-order")?.addEventListener("click", () => { this.activeSubTab = "order"; this.refresh(); });
    this.container.querySelector("#subtab-roster")?.addEventListener("click", () => { this.activeSubTab = "roster"; this.refresh(); });
    this.container.querySelector("#btn-close-roster-view")?.addEventListener("click", () => this.container.classList.add("hidden"));

    if (this.activeSubTab !== "order") return;

    const syncInfo = () => {
      this.gameState.updateGameInfo?.({
        date: this.container.querySelector("#input-game-date")?.value,
        tournament: this.container.querySelector("#input-game-tournament")?.value,
        venue: this.container.querySelector("#input-game-venue")?.value,
        myTeamName: this.container.querySelector("#input-team-my")?.value,
        oppTeamName: this.container.querySelector("#input-team-opp")?.value,
        myTeamSide: this.myTeamSide
      });
    };
    ["#input-game-date", "#input-game-tournament", "#input-game-venue", "#input-team-my", "#input-team-opp"].forEach(sel => {
      const el = this.container.querySelector(sel);
      el?.addEventListener("change", syncInfo);
      el?.addEventListener("blur", syncInfo);
    });

    this.container.querySelector("#btn-toggle-attack-side")?.addEventListener("click", () => { this.myTeamSide = this.myTeamSide === "away" ? "home" : "away"; syncInfo(); this.refresh(); });
    this.container.querySelector("#btn-toggle-match-type")?.addEventListener("click", () => {
      this.matchType = this.matchType === "official" ? "practice" : "official";
      this.saveStorage("gakudo_match_type", this.matchType);
      this.syncLineupNumbers();
      this.refresh();
    });
    this.container.querySelector("#team-switch-my")?.addEventListener("click", () => { this.targetTeam = "my"; this.refresh(); });
    this.container.querySelector("#team-switch-opp")?.addEventListener("click", () => { this.targetTeam = "opp"; this.refresh(); });
    this.container.querySelector("#btn-copy-prev-order")?.addEventListener("click", () => { this.myLineup = this.generateDefaultLineup(); this.refresh(); });
    this.container.querySelector("#btn-apply-lineup")?.addEventListener("click", () => this.applyLineupToGame());

    // イベント委譲（スロット編集、守備位置、ベンチバッジ）
    this.container.querySelector("#lineup-slots-container")?.addEventListener("change", (e) => {
      if (e.target.classList.contains("select-slot-pos")) {
        const idx = parseInt(e.target.dataset.order, 10);
        const lineup = this.targetTeam === "my" ? this.myLineup : this.oppLineup;
        if (lineup[idx]) lineup[idx].pos = e.target.value;
      }
    });

    this.container.querySelector("#lineup-slots-container")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-open-slot-edit");
      if (!btn) return;
      const idx = parseInt(btn.dataset.order, 10);
      if (this.targetTeam === "opp") this.tenkeyComponent?.open(idx, this.oppLineup[idx] || {});
      else this.openPlayerSelectPrompt(idx);
    });

    this.container.addEventListener("click", (e) => {
      const badge = e.target.closest(".btn-bench-badge");
      if (!badge) return;
      const player = this.roster.find(p => p.id === badge.dataset.playerId);
      if (!player) return;
      const targetIdx = Math.max(0, this.myLineup.findIndex(s => !s.playerId));
      this.myLineup[targetIdx] = { order: targetIdx + 1, playerId: player.id, number: this.getPlayerNumber(player), name: player.name, pos: player.pos };
      this.refresh();
    });

    this.bindDnD();
  }

  bindDnD() {
    const container = this.container.querySelector("#lineup-slots-container");
    if (!container) return;
    const rows = container.querySelectorAll(".lineup-slot-row");
    let dragIdx = null, touchRow = null;

    rows.forEach(row => {
      row.addEventListener("dragstart", (e) => { dragIdx = parseInt(row.dataset.order, 10); e.dataTransfer.setData("text/plain", dragIdx); row.classList.add("opacity-40", "border-emerald-500"); });
      row.addEventListener("dragover", (e) => { e.preventDefault(); row.classList.add("bg-emerald-950/40", "border-emerald-400"); });
      row.addEventListener("dragleave", () => row.classList.remove("bg-emerald-950/40", "border-emerald-400"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("bg-emerald-950/40", "border-emerald-400");
        const targetIdx = parseInt(row.dataset.order, 10);
        if (dragIdx !== null && dragIdx !== targetIdx) this.reorderLineup(dragIdx, targetIdx);
      });
      row.addEventListener("dragend", () => { rows.forEach(r => r.classList.remove("opacity-40", "border-emerald-500", "bg-emerald-950/40", "border-emerald-400")); dragIdx = null; });

      // スマホタッチDnD
      const handle = row.querySelector(".drag-handle");
      handle?.addEventListener("touchstart", () => { dragIdx = parseInt(row.dataset.order, 10); touchRow = row; row.classList.add("opacity-60", "border-emerald-500"); }, { passive: true });
      handle?.addEventListener("touchmove", (e) => {
        const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)?.closest(".lineup-slot-row");
        rows.forEach(r => r.classList.remove("bg-emerald-950/50", "border-emerald-400"));
        if (el && el !== touchRow) el.classList.add("bg-emerald-950/50", "border-emerald-400");
      }, { passive: true });
      handle?.addEventListener("touchend", (e) => {
        rows.forEach(r => r.classList.remove("opacity-60", "border-emerald-500", "bg-emerald-950/50", "border-emerald-400"));
        const el = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY)?.closest(".lineup-slot-row");
        if (el && dragIdx !== null) {
          const targetIdx = parseInt(el.dataset.order, 10);
          if (dragIdx !== targetIdx) this.reorderLineup(dragIdx, targetIdx);
        }
        dragIdx = touchRow = null;
      });
    });
  }

  reorderLineup(fromIdx, toIdx) {
    const lineup = this.targetTeam === "my" ? this.myLineup : this.oppLineup;
    if (!lineup[fromIdx] || !lineup[toIdx]) return;

    const modalScroll = this.container.querySelector(".overflow-y-auto")?.scrollTop || 0;
    const slotsScroll = this.container.querySelector("#lineup-slots-container")?.scrollTop || 0;

    const [moved] = lineup.splice(fromIdx, 1);
    lineup.splice(toIdx, 0, moved);
    lineup.forEach((s, i) => { s.order = i + 1; });

    this.saveStorage(`gakudo_lineup_${this.targetTeam}`, lineup);
    this.refresh();

    const mEl = this.container.querySelector(".overflow-y-auto");
    if (mEl) mEl.scrollTop = modalScroll;
    const sEl = this.container.querySelector("#lineup-slots-container");
    if (sEl) sEl.scrollTop = slotsScroll;
  }

  openPlayerSelectPrompt(idx) {
    const list = this.roster.map((p, i) => `${i + 1}: #${this.getPlayerNumber(p)} ${p.name} (${p.pos})`).join("\n");
    const sel = prompt(`【${idx + 1}番打者】割り当てる番号を入力してください:\n${list}`);
    if (!sel) return;
    const player = this.roster[parseInt(sel, 10) - 1];
    if (player) {
      this.myLineup[idx] = { order: idx + 1, playerId: player.id, number: this.getPlayerNumber(player), name: player.name, pos: player.pos };
      this.refresh();
    }
  }

  getPlayerNumber(p) {
    return this.matchType === "practice" ? (p.practiceNumber ?? p.number ?? 0) : (p.officialNumber ?? p.number ?? 0);
  }

  syncLineupNumbers() {
    this.myLineup.forEach(s => {
      const p = s?.playerId && this.roster.find(r => r.id === s.playerId);
      if (p) s.number = this.getPlayerNumber(p);
    });
    this.saveStorage("gakudo_lineup_my", this.myLineup);
  }

  applyLineupToGame() {
    const gInfo = {
      date: this.container.querySelector("#input-game-date")?.value,
      tournament: this.container.querySelector("#input-game-tournament")?.value,
      venue: this.container.querySelector("#input-game-venue")?.value,
      myTeamName: this.container.querySelector("#input-team-my")?.value,
      oppTeamName: this.container.querySelector("#input-team-opp")?.value,
      myTeamSide: this.myTeamSide
    };
    this.gameState.updateGameInfo?.(gInfo);

    const state = this.gameState.getState();
    if (!state?.teams) return;

    const away = this.myTeamSide === "away" ? this.myLineup : this.oppLineup;
    const home = this.myTeamSide === "home" ? this.myLineup : this.oppLineup;
    const aP = away.find(s => s.pos === "投") || away[0];
    const hP = home.find(s => s.pos === "投") || home[0];

    state.teams.away.roster = away.map((s, i) => ({ order: i + 1, number: s.number, name: s.name, pos: s.pos }));
    state.teams.away.pitcher = { name: aP?.name || "先発 投手", number: aP?.number || 1 };
    state.teams.home.roster = home.map((s, i) => ({ order: i + 1, number: s.number, name: s.name, pos: s.pos }));
    state.teams.home.pitcher = { name: hP?.name || "相手 投手", number: hP?.number || 1 };

    this.gameState.syncCurrentMatchup?.();
    this.saveStorage("gakudo_lineup_my", this.myLineup);
    this.saveStorage("gakudo_lineup_opp", this.oppLineup);
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
    return Array.from({ length: 9 }, (_, i) => ({ order: i + 1, number: i + 1, name: `相手 ${i + 1}番`, pos: POSITIONS[i]?.id || "外" }));
  }

  saveStorage(key, val) { try { localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val)); } catch (e) {} }
  loadStorage(key, fallback = null) { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch (e) { return localStorage.getItem(key) || fallback; } }
  loadRoster() {
    const list = this.loadStorage("gakudo_roster_master", DEFAULT_ROSTER);
    return list.map(p => ({ ...p, officialNumber: p.officialNumber ?? p.number ?? 99, practiceNumber: p.practiceNumber ?? p.number ?? 99 }));
  }
}
