/**
 * js/components/zone.js
 * 投球判定コンソール ＆ コース選択コンポーネント（現場ファースト版）
 * 
 * 改善点:
 * 1. 判定アクションボタン群を最上部に配置（片手・親指での最速入力を実現）
 * 2. コースは「選択した時だけ反応する」オプショナル仕様（初期状態は未指定）
 * 3. 投球記録後にコース選択を自動クリア（前回のコースが誤って残る事故を根絶）
 * 4. コースの再タップによるトグル解除 ＆ クリアボタン常設
 * 5. 登板中投手のコース別球数バッジ集計機能を完全維持
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

    // 初期状態はコース「未指定 (null)」
    this.selectedCourse = null;
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
        
        <!-- =================================================================== -->
        <!-- 1. 【最上段配置】投球判定アクションボタン群（最優先・主役エリア） -->
        <!-- =================================================================== -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-black text-slate-300 flex items-center gap-1">
              <span>⚡️</span>
              <span>ワンタップ判定入力:</span>
            </span>
            <span class="text-[10px] text-slate-400">※コース指定なしでも即記録可能</span>
          </div>

          <!-- 上段: 3大主要判定（ボール / 見逃しS / 空振りS） -->
          <div class="grid grid-cols-3 gap-2">
            <button type="button" id="btn-pitch-ball" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white py-2.5 rounded-xl text-xs font-black shadow-lg transition flex flex-col items-center justify-center">
              <span class="text-sm sm:text-base font-black">ボール</span>
              <span class="text-[9px] text-emerald-200 font-bold leading-tight">B カウント</span>
            </button>

            <button type="button" id="btn-pitch-looking-strike" class="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white py-2.5 rounded-xl text-xs font-black shadow-lg transition flex flex-col items-center justify-center">
              <span class="text-sm sm:text-base font-black">見逃し</span>
              <span class="text-[9px] text-amber-200 font-bold leading-tight">S カウント</span>
            </button>

            <button type="button" id="btn-pitch-swinging-strike" class="bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-slate-950 py-2.5 rounded-xl text-xs font-black shadow-lg transition flex flex-col items-center justify-center">
              <span class="text-sm sm:text-base font-black">空振り</span>
              <span class="text-[9px] text-slate-900 font-black leading-tight">S カウント</span>
            </button>
          </div>

          <!-- 下段: 特殊判定 & 打球結果（ファウル / 死球 / 打球詳細） -->
          <div class="grid grid-cols-3 gap-2">
            <button type="button" id="btn-pitch-foul" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold py-2 rounded-xl text-xs border border-slate-700 shadow transition flex items-center justify-center">
              ファウル
            </button>

            <button type="button" id="btn-pitch-hbp" class="bg-rose-900/80 hover:bg-rose-800 active:scale-95 text-rose-200 font-bold py-2 rounded-xl text-xs border border-rose-700/60 shadow transition flex items-center justify-center">
              死球 (HBP)
            </button>

            <button type="button" id="btn-pitch-inplay" class="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black py-2 rounded-xl text-xs border border-sky-400/80 shadow-lg transition flex items-center justify-center gap-1">
              <span>⚾️ 打球・結果</span>
            </button>
          </div>
        </div>

        <!-- =================================================================== -->
        <!-- 2. 【下段配置】コース選択エリア（オプショナル・余裕がある時だけ入力） -->
        <!-- =================================================================== -->
        <div class="border-t border-slate-800 pt-2 flex flex-col gap-2">
          
          <!-- コース状態バー & クリアボタン -->
          <div class="flex items-center justify-between px-2 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800/80">
            <div class="flex items-center gap-1.5">
              <span class="text-xs">🎯</span>
              <span class="text-xs font-bold text-slate-300">投球コース:</span>
              <span id="selected-course-label" class="text-xs font-black text-slate-400 bg-slate-800/70 border border-slate-700 px-2 py-0.5 rounded-md transition">
                未指定（記録なし）
              </span>
            </div>
            
            <button type="button" id="btn-clear-course" class="hidden text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-700 transition active:scale-95">
              ✕ クリア
            </button>
          </div>

          <!-- 17分割 投球盤面（タップされた時だけ選択状態になる） -->
          <div class="flex flex-col gap-1.5 bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
            
            <!-- 高めボール球（左右横並び） -->
            <div class="grid grid-cols-2 gap-2">
              ${ZONE_COURSES.CORNERS_TOP.map((c) => `
                <button type="button" class="zone-corner-btn h-8 flex items-center justify-center gap-1.5 bg-slate-800/70 hover:bg-slate-700/80 border border-dashed border-slate-600 rounded-lg text-slate-300 text-xs font-bold transition relative" data-course="${c.id}">
                  <span>${c.label}</span>
                  <span class="text-[9px] text-slate-400 font-normal">(${c.sub})</span>
                  <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-sky-900 text-sky-200 px-1.5 py-0.2 rounded-full border border-sky-500 font-mono font-bold" data-badge="${c.id}">0</span>
                </button>
              `).join("")}
            </div>

            <!-- 中央9分割ストライクゾーン -->
            <div class="grid grid-cols-3 gap-1.5 bg-[#091b13] border-2 border-emerald-600/80 rounded-xl p-1.5 shadow-inner">
              ${ZONE_COURSES.STRIKE_9.map((cell) => `
                <button type="button" class="zone-strike-cell h-10 sm:h-11 flex flex-col items-center justify-center bg-[#112f20] hover:bg-[#19452f] border border-emerald-700/50 rounded-lg text-slate-100 transition relative group" data-course="${cell.id}">
                  <span class="font-black text-sm text-emerald-300 group-hover:text-white leading-none">${cell.num}</span>
                  <span class="text-[9px] text-slate-300 font-medium leading-none mt-0.5">${cell.label}</span>
                  <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-amber-900 text-amber-200 px-1.5 py-0.2 rounded-full border border-amber-500 font-mono font-bold" data-badge="${cell.id}">0</span>
                </button>
              `).join("")}
            </div>

            <!-- 低めボール球（左右横並び） -->
            <div class="grid grid-cols-2 gap-2">
              ${ZONE_COURSES.CORNERS_BOTTOM.map((c) => `
                <button type="button" class="zone-corner-btn h-8 flex items-center justify-center gap-1.5 bg-slate-800/70 hover:bg-slate-700/80 border border-dashed border-slate-600 rounded-lg text-slate-300 text-xs font-bold transition relative" data-course="${c.id}">
                  <span>${c.label}</span>
                  <span class="text-[9px] text-slate-400 font-normal">(${c.sub})</span>
                  <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-sky-900 text-sky-200 px-1.5 py-0.2 rounded-full border border-sky-500 font-mono font-bold" data-badge="${c.id}">0</span>
                </button>
              `).join("")}
            </div>

            <!-- 特殊球（ワンバウンド / 抜け球・暴投） -->
            <div class="grid grid-cols-2 gap-2">
              ${ZONE_COURSES.SPECIAL.map((s) => `
                <button type="button" class="special-pitch-btn h-7 flex items-center justify-center gap-1.5 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/70 rounded-lg text-purple-300 text-[10px] font-bold transition relative" data-course="${s.id}">
                  <span>${s.label}</span>
                  <span class="pitch-count-badge hidden absolute -top-1.5 -right-1.5 text-[9px] bg-purple-900 text-purple-200 px-1.5 py-0.2 rounded-full border border-purple-500 font-mono font-bold" data-badge="${s.id}">0</span>
                </button>
              `).join("")}
            </div>

          </div>
        </div>

      </div>
    `;

    this.updateActiveCellDisplay();
  }

  bindEvents() {
    const container = this.container;
    if (!container) return;

    // コース盤タップ時の処理（同じコースを再タップしたら解除するトグル動作）
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-course]");
      if (btn) {
        const courseId = btn.getAttribute("data-course");
        if (this.selectedCourse === courseId) {
          // 既に選択中のものを再度タップした場合は選択解除（未指定に戻す）
          this.selectCourse(null);
        } else {
          this.selectCourse(courseId);
        }
      }
    });

    // クリアボタンタップ時
    const clearBtn = container.querySelector("#btn-clear-course");
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.selectCourse(null);
      });
    }

    const bindBtn = (id, action) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          action();
        });
      }
    };

    // 判定ボタン群の紐付け
    bindBtn("btn-pitch-ball", () => this.handleAction("ボール"));
    bindBtn("btn-pitch-looking-strike", () => this.handleAction("見逃しストライク"));
    bindBtn("btn-pitch-swinging-strike", () => this.handleAction("空振り"));
    bindBtn("btn-pitch-foul", () => this.handleAction("ファウル"));
    bindBtn("btn-pitch-hbp", () => this.handleAction("死球"));

    // 打球・結果モーダル呼び出し
    bindBtn("btn-pitch-inplay", () => {
      if (typeof this.options.onInPlay === "function") {
        const currentCourse = this.selectedCourse;
        // 打球結果入力へ遷移したらコース選択は自動クリア
        this.selectCourse(null);
        this.options.onInPlay(currentCourse);
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

    const labelEl = this.container.querySelector("#selected-course-label");
    const clearBtn = this.container.querySelector("#btn-clear-course");

    if (this.selectedCourse) {
      const activeBtn = this.container.querySelector(`[data-course="${this.selectedCourse}"]`);
      if (activeBtn) {
        activeBtn.classList.add("ring-2", "ring-amber-400", "bg-amber-500/30", "border-amber-400");
      }
      if (labelEl) {
        labelEl.textContent = this.getCourseReadableName(this.selectedCourse);
        labelEl.className = "text-xs font-black text-amber-300 bg-amber-950/60 border border-amber-500/80 px-2 py-0.5 rounded-md shadow";
      }
      if (clearBtn) clearBtn.classList.remove("hidden");
    } else {
      // 未指定状態
      if (labelEl) {
        labelEl.textContent = "未指定（記録なし）";
        labelEl.className = "text-xs font-bold text-slate-400 bg-slate-800/70 border border-slate-700 px-2 py-0.5 rounded-md";
      }
      if (clearBtn) clearBtn.classList.add("hidden");
    }
  }

  getCourseReadableName(courseId) {
    if (!courseId) return "未指定";

    const s9 = ZONE_COURSES.STRIKE_9.find((c) => c.id === courseId);
    if (s9) return `${s9.num} ${s9.label}`;

    const corners = [...ZONE_COURSES.CORNERS_TOP, ...ZONE_COURSES.CORNERS_BOTTOM];
    const cMatch = corners.find((c) => c.id === courseId);
    if (cMatch) return `${cMatch.label} (${cMatch.sub})`;

    const sp = ZONE_COURSES.SPECIAL.find((c) => c.id === courseId);
    if (sp) return sp.label;

    return courseId;
  }

  handleAction(resultType) {
    const courseToRecord = this.selectedCourse;

    // 投球を記録（コースが未選択なら null または空文字として安全に記録）
    this.gameState.recordPitch(courseToRecord, resultType);

    // 記録完了と同時にコース選択を自動クリア（前回のコースが誤って残るのを防ぐ）
    if (this.selectedCourse !== null) {
      this.selectCourse(null);
    }
  }

  updatePitchCounts(state) {
    const counts = {};
    const currentPitcherName = state.currentPitcher ? state.currentPitcher.name : null;

    if (state.history) {
      state.history.forEach((h) => {
        // 登板中投手が投げた投球のみを抽出
        const pitcherOfPitch = h.snapshot && h.snapshot.currentPitcher ? h.snapshot.currentPitcher.name : null;
        if (currentPitcherName && pitcherOfPitch && pitcherOfPitch !== currentPitcherName) {
          return;
        }

        const c = h.pitchEvent?.course;
        if (c) {
          counts[c] = (counts[c] || 0) + 1;
        }
      });
    }
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
