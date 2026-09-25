/**
 * js/components/zone.js
 * 17分割 投球コース盤面コンポーネント（プロ仕様コンソール版）
 * 
 * 担当役割:
 * - キャッチャー目線の自然なプロポーションを持つ17分割投球盤面
 * - ボール球（外枠4隅）と特殊球（ワンバウンド・暴投）の直感配置
 * - 洗練された配色の判定アクションボタングリッド
 * - 左パネルと美しく調和する統一されたカードUI
 */

export const ZONE_COURSES = {
  CORNERS_TOP: [
    { id: "左高内", label: "左高内", sub: "高内ボール" },
    { id: "右高外", label: "右高外", sub: "高外ボール" }
  ],
  STRIKE_9: [
    { id: "高内", num: "1", label: "高め内角" },
    { id: "高中", num: "2", label: "高め真中" },
    { id: "高外", num: "3", label: "高め外角" },
    { id: "中内", num: "4", label: "真中内角" },
    { id: "中央", num: "5", label: "ど真ん中" },
    { id: "中外", num: "6", label: "真中外角" },
    { id: "低内", num: "7", label: "低め内角" },
    { id: "低中", num: "8", label: "低め真中" },
    { id: "低外", num: "9", label: "低め外角" }
  ],
  CORNERS_BOTTOM: [
    { id: "左低内", label: "左低内", sub: "低内ボール" },
    { id: "右低外", label: "右低外", sub: "低外ボール" }
  ],
  SPECIAL: [
    { id: "ワンバウンド", label: "💥 ワンバウンド", sub: "低め暴投" },
    { id: "抜け球", label: "⚡️ 抜け球・暴投", sub: "高め暴投" }
  ]
};

export class ZoneComponent {
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;

    this.selectedCourse = "中央";
    this.pitchCounts = {};

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    this.gameState.subscribe((state) => {
      this.updatePitchCounts(state);
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg select-none flex flex-col gap-2.5">
        
        <!-- ヘッダー: タイトル & 選択中コース表示 -->
        <div class="flex items-center justify-between px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div class="flex items-center gap-1.5">
            <span class="text-xs">🎯</span>
            <span class="text-xs font-bold text-slate-300">投球コース選択</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] text-slate-500 font-bold">現在:</span>
            <span id="selected-course-label" class="text-xs font-black text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-md">
              ⑤ ど真ん中
            </span>
          </div>
        </div>

        <!-- 盤面エリア（外枠ボール球 ＋ 9分割ゾーン ＋ 特殊球） -->
        <div class="flex flex-col gap-1.5 bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
          
          <!-- 1. 高めボール球（左右横並び） -->
          <div class="grid grid-cols-2 gap-2">
            ${ZONE_COURSES.CORNERS_TOP.map((c) => `
              <button type="button" class="zone-corner-btn h-9 flex items-center justify-center gap-1.5 bg-slate-800/70 hover:bg-slate-700/80 border border-dashed border-slate-600 rounded-lg text-slate-300 text-xs font-bold transition relative" data-course="${c.id}">
                <span>${c.label}</span>
                <span class="text-[9px] text-slate-400 font-normal">(${c.sub})</span>
                <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-sky-900 text-sky-200 px-1.5 py-0.2 rounded-full border border-sky-500 font-mono font-bold" data-badge="${c.id}">0</span>
              </button>
            `).join("")}
          </div>

          <!-- 2. 中央9分割ストライクゾーン（自然な縦横比・プロポーション） -->
          <div class="grid grid-cols-3 gap-1.5 bg-[#091b13] border-2 border-emerald-600/80 rounded-xl p-1.5 shadow-inner">
            ${ZONE_COURSES.STRIKE_9.map((cell) => `
              <button type="button" class="zone-strike-cell h-11 sm:h-12 flex flex-col items-center justify-center bg-[#112f20] hover:bg-[#19452f] border border-emerald-700/50 rounded-lg text-slate-100 transition relative group" data-course="${cell.id}">
                <span class="font-black text-sm text-emerald-300 group-hover:text-white leading-none">${cell.num}</span>
                <span class="text-[9px] text-slate-300 font-medium leading-none mt-0.5">${cell.label}</span>
                <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-amber-900 text-amber-200 px-1.5 py-0.2 rounded-full border border-amber-500 font-mono font-bold" data-badge="${cell.id}">0</span>
              </button>
            `).join("")}
          </div>

          <!-- 3. 低めボール球（左右横並び） -->
          <div class="grid grid-cols-2 gap-2">
            ${ZONE_COURSES.CORNERS_BOTTOM.map((c) => `
              <button type="button" class="zone-corner-btn h-9 flex items-center justify-center gap-1.5 bg-slate-800/70 hover:bg-slate-700/80 border border-dashed border-slate-600 rounded-lg text-slate-300 text-xs font-bold transition relative" data-course="${c.id}">
                <span>${c.label}</span>
                <span class="text-[9px] text-slate-400 font-normal">(${c.sub})</span>
                <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-sky-900 text-sky-200 px-1.5 py-0.2 rounded-full border border-sky-500 font-mono font-bold" data-badge="${c.id}">0</span>
              </button>
            `).join("")}
          </div>

          <!-- 4. 特殊球（ワンバウンド / 抜け球・暴投） -->
          <div class="grid grid-cols-2 gap-2">
            ${ZONE_COURSES.SPECIAL.map((s) => `
              <button type="button" class="special-pitch-btn h-8 flex items-center justify-center gap-1.5 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/70 rounded-lg text-purple-300 text-[11px] font-bold transition relative" data-course="${s.id}">
                <span>${s.label}</span>
                <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-purple-900 text-purple-200 px-1.5 py-0.2 rounded-full border border-purple-500 font-mono font-bold" data-badge="${s.id}">0</span>
              </button>
            `).join("")}
          </div>

        </div>

        <!-- 5. 投球判定アクションボタン群（プロ仕様の明瞭配色） -->
        <div class="space-y-1.5 pt-1">
          <!-- 上段: 3大判定（ボール / 見逃し / 空振り） -->
          <div class="grid grid-cols-3 gap-2">
            <button type="button" id="btn-pitch-ball" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white py-2 rounded-xl text-xs font-black shadow transition flex flex-col items-center justify-center">
              <span class="text-sm">ボール</span>
              <span class="text-[9px] text-emerald-200 font-normal">Bカウント</span>
            </button>

            <button type="button" id="btn-pitch-looking-strike" class="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white py-2 rounded-xl text-xs font-black shadow transition flex flex-col items-center justify-center">
              <span class="text-sm">見逃し</span>
              <span class="text-[9px] text-amber-200 font-normal">Sカウント</span>
            </button>

            <button type="button" id="btn-pitch-swinging-strike" class="bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-slate-950 py-2 rounded-xl text-xs font-black shadow transition flex flex-col items-center justify-center">
              <span class="text-sm">空振り</span>
              <span class="text-[9px] text-slate-900 font-bold">Sカウント</span>
            </button>
          </div>

          <!-- 下段: 特殊判定 & 打球詳細（ファウル / 死球 / 打球結果） -->
          <div class="grid grid-cols-3 gap-2">
            <button type="button" id="btn-pitch-foul" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold py-2 rounded-xl text-xs border border-slate-700 shadow transition">
              ファウル
            </button>

            <button type="button" id="btn-pitch-hbp" class="bg-rose-900/80 hover:bg-rose-800 active:scale-95 text-rose-200 font-bold py-2 rounded-xl text-xs border border-rose-700/60 shadow transition">
              死球 (HBP)
            </button>

            <button type="button" id="btn-pitch-inplay" class="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black py-2 rounded-xl text-xs border border-sky-400/80 shadow transition flex items-center justify-center gap-1">
              <span>⚾️ 打球・結果</span>
            </button>
          </div>
        </div>

      </div>
    `;

    this.updateActiveCellDisplay();
  }

  bindEvents() {
    const container = this.container;
    if (!container) return;

    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-course]");
      if (btn) {
        const courseId = btn.getAttribute("data-course");
        this.selectCourse(courseId);
      }
    });

    const bindBtn = (id, action) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          action();
        });
      }
    };

    bindBtn("btn-pitch-ball", () => this.handleAction("ボール"));
    bindBtn("btn-pitch-looking-strike", () => this.handleAction("見逃しストライク"));
    bindBtn("btn-pitch-swinging-strike", () => this.handleAction("空振り"));
    bindBtn("btn-pitch-foul", () => this.handleAction("ファウル"));
    bindBtn("btn-pitch-hbp", () => this.handleAction("死球"));

    bindBtn("btn-pitch-inplay", () => {
      if (typeof this.options.onInPlay === "function") {
        this.options.onInPlay(this.selectedCourse);
      }
    });
  }

  selectCourse(courseId) {
    this.selectedCourse = courseId;
    this.updateActiveCellDisplay();
  }

  updateActiveCellDisplay() {
    const allBtns = this.container.querySelectorAll("[data-course]");
    allBtns.forEach((btn) => {
      btn.classList.remove("ring-2", "ring-amber-400", "bg-amber-500/30", "border-amber-400");
    });

    const activeBtn = this.container.querySelector(`[data-course="${this.selectedCourse}"]`);
    if (activeBtn) {
      activeBtn.classList.add("ring-2", "ring-amber-400", "bg-amber-500/30", "border-amber-400");
    }

    const labelEl = document.getElementById("selected-course-label");
    if (labelEl) {
      labelEl.textContent = this.getCourseReadableName(this.selectedCourse);
    }
  }

  getCourseReadableName(courseId) {
    const s9 = ZONE_COURSES.STRIKE_9.find((c) => c.id === courseId);
    if (s9) return `➄ ${s9.num} ${s9.label}`.replace("➄ ", "");

    const corners = [...ZONE_COURSES.CORNERS_TOP, ...ZONE_COURSES.CORNERS_BOTTOM];
    const cMatch = corners.find((c) => c.id === courseId);
    if (cMatch) return `${cMatch.label} (${cMatch.sub})`;

    const sp = ZONE_COURSES.SPECIAL.find((c) => c.id === courseId);
    if (sp) return sp.label;

    return courseId;
  }

  handleAction(resultType) {
    this.gameState.recordPitch(this.selectedCourse, resultType);
  }

  updatePitchCounts(state) {
    const counts = {};
    const currentPitcherName = state.currentPitcher ? state.currentPitcher.name : null;

    state.history.forEach((h) => {
      // 登板中投手が投げた投球のみをカウント対象に抽出
      const pitcherOfPitch = h.snapshot && h.snapshot.currentPitcher ? h.snapshot.currentPitcher.name : null;
      if (currentPitcherName && pitcherOfPitch && pitcherOfPitch !== currentPitcherName) {
        return;
      }

      const c = h.pitchEvent.course;
      counts[c] = (counts[c] || 0) + 1;
    });
    this.pitchCounts = counts;

    const badges = this.container.querySelectorAll("[data-badge]");
    badges.forEach((badge) => {
      const courseId = badge.getAttribute("data-badge");
      const count = this.pitchCounts[courseId] || 0;
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    });
  }

  getSelectedCourse() {
    return this.selectedCourse;
  }
}
