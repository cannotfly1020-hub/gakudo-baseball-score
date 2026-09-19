/**
 * js/components/zone.js
 * 17分割 投球コース盤面コンポーネント
 * 
 * 担当役割:
 * - 中央9分割ストライクゾーン、外枠4コーナーボール球、特殊球（ワンバウンド・抜け球）のレンダリング
 * - 投球判定ボタン（ボール、見逃し、空振り、ファウル、死球、打球詳細）のレンダリング
 * - コース選択状態の管理および投球数バッジの表示
 * - 判定アクション実行時に GameState へイベントを送出
 */

// 17分割の各コース定義
export const ZONE_COURSES = {
  CORNERS_TOP: [
    { id: "左高内", label: "左高内 (高内ボール)", type: "ball" },
    { id: "右高外", label: "右高外 (高外ボール)", type: "ball" }
  ],
  STRIKE_9: [
    { id: "高内", label: "① 高め内角", type: "strike" },
    { id: "高中", label: "② 高め真中", type: "strike" },
    { id: "高外", label: "③ 高め外角", type: "strike" },
    { id: "中内", label: "④ 真中内角", type: "strike" },
    { id: "中央", label: "⑤ ど真ん中", type: "strike" },
    { id: "中外", label: "⑥ 真中外角", type: "strike" },
    { id: "低内", label: "⑦ 低め内角", type: "strike" },
    { id: "低中", label: "⑧ 低め真中", type: "strike" },
    { id: "低外", label: "⑨ 低め外角", type: "strike" }
  ],
  CORNERS_BOTTOM: [
    { id: "左低内", label: "左低内 (低内ボール)", type: "ball" },
    { id: "右低外", label: "右低外 (低外ボール)", type: "ball" }
  ],
  SPECIAL: [
    { id: "ワンバウンド", label: "💥 ワンバウンド (低め暴投)", type: "special" },
    { id: "抜け球", label: "⚡️ 抜け球・暴投 (高め暴投)", type: "special" }
  ]
};

export class ZoneComponent {
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;

    // 現在タップ選択されているコース（初期値: ⑤ ど真ん中）
    this.selectedCourse = "中央";

    // コースごとの投球数集計マップ
    this.pitchCounts = {};

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    // GameState の変更通知を購読して投球数バッジ等を再計算
    this.gameState.subscribe((state) => {
      this.updatePitchCounts(state);
    });
  }

  /**
   * DOM骨組みの生成（Tailwind クラスを直接指定して確実にコンパクト化）
   */
  render() {
    this.container.innerHTML = `
      <div class="zone-container w-full max-w-[360px] mx-auto bg-slate-900/95 border border-slate-800 rounded-xl p-2 shadow-2xl flex flex-col gap-1.5 select-none">
        
        <!-- ヘッダー: 選択中コース表示（超薄型） -->
        <div class="flex items-center justify-between px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800/80 text-xs">
          <span class="text-slate-400 font-bold text-[11px]">選択コース:</span>
          <span id="selected-course-label" class="text-amber-400 font-extrabold text-xs tracking-wide">
            ⑤ ど真ん中
          </span>
        </div>

        <!-- 1. 高めボール球（必ず左右横並び2分割） -->
        <div class="flex flex-row gap-1.5 w-full">
          <button type="button" class="zone-corner-btn flex-1 h-7 flex flex-row items-center justify-center gap-1 bg-slate-800/90 hover:bg-slate-700 border border-dashed border-slate-600 rounded-md text-slate-300 text-[11px] font-bold transition relative" data-course="左高内">
            <span>左高内</span>
            <span class="text-[9px] text-slate-400">(高内)</span>
            <span class="pitch-count-badge hidden absolute top-0.5 right-1 text-[8px] bg-slate-950 px-1 rounded-full border border-slate-600" data-badge="左高内">0</span>
          </button>
          <button type="button" class="zone-corner-btn flex-1 h-7 flex flex-row items-center justify-center gap-1 bg-slate-800/90 hover:bg-slate-700 border border-dashed border-slate-600 rounded-md text-slate-300 text-[11px] font-bold transition relative" data-course="右高外">
            <span>右高外</span>
            <span class="text-[9px] text-slate-400">(高外)</span>
            <span class="pitch-count-badge hidden absolute top-0.5 right-1 text-[8px] bg-slate-950 px-1 rounded-full border border-slate-600" data-badge="右高外">0</span>
          </button>
        </div>

        <!-- 2. 中央9分割ストライクゾーン（高さを32pxに抑えたコンパクトグリッド） -->
        <div class="strike-zone-9 grid grid-cols-3 gap-1 bg-[#091e14] border-2 border-emerald-600 rounded-lg p-1 w-full">
          ${ZONE_COURSES.STRIKE_9.map((cell) => `
            <button type="button" class="zone-strike-cell h-8 flex flex-row items-center justify-center gap-1 bg-[#102d1d] hover:bg-[#18452c] border border-emerald-700/60 rounded text-slate-100 text-[11px] font-bold transition relative" data-course="${cell.id}">
              <span class="font-extrabold text-[11px] leading-none">${cell.label.split(" ")[0]}</span>
              <span class="text-[9px] text-emerald-300/80 leading-none">${cell.label.split(" ")[1]}</span>
              <span class="pitch-count-badge hidden absolute top-0.5 right-1 text-[8px] bg-slate-950 text-amber-300 px-1 rounded-full border border-slate-600" data-badge="${cell.id}">0</span>
            </button>
          `).join("")}
        </div>

        <!-- 3. 低めボール球（必ず左右横並び2分割） -->
        <div class="flex flex-row gap-1.5 w-full">
          <button type="button" class="zone-corner-btn flex-1 h-7 flex flex-row items-center justify-center gap-1 bg-slate-800/90 hover:bg-slate-700 border border-dashed border-slate-600 rounded-md text-slate-300 text-[11px] font-bold transition relative" data-course="左低内">
            <span>左低内</span>
            <span class="text-[9px] text-slate-400">(低内)</span>
            <span class="pitch-count-badge hidden absolute top-0.5 right-1 text-[8px] bg-slate-950 px-1 rounded-full border border-slate-600" data-badge="左低内">0</span>
          </button>
          <button type="button" class="zone-corner-btn flex-1 h-7 flex flex-row items-center justify-center gap-1 bg-slate-800/90 hover:bg-slate-700 border border-dashed border-slate-600 rounded-md text-slate-300 text-[11px] font-bold transition relative" data-course="右低外">
            <span>右低外</span>
            <span class="text-[9px] text-slate-400">(低外)</span>
            <span class="pitch-count-badge hidden absolute top-0.5 right-1 text-[8px] bg-slate-950 px-1 rounded-full border border-slate-600" data-badge="右低外">0</span>
          </button>
        </div>

        <!-- 4. 特殊球（ワンバウンド / 抜け球・暴投：左右横並び） -->
        <div class="flex flex-row gap-1.5 w-full">
          <button type="button" class="special-pitch-btn flex-1 h-6 flex flex-row items-center justify-center gap-1 bg-[#281a2e] hover:bg-[#3d2047] border border-[#701a75] rounded text-[#f472b6] text-[10px] font-bold transition relative" data-course="ワンバウンド">
            <span>💥 ワンバウンド</span>
            <span class="pitch-count-badge hidden absolute top-0.5 right-1 text-[8px] bg-slate-950 px-1 rounded-full border border-slate-600" data-badge="ワンバウンド">0</span>
          </button>
          <button type="button" class="special-pitch-btn flex-1 h-6 flex flex-row items-center justify-center gap-1 bg-[#281a2e] hover:bg-[#3d2047] border border-[#701a75] rounded text-[#f472b6] text-[10px] font-bold transition relative" data-course="抜け球">
            <span>⚡️ 抜け球・暴投</span>
            <span class="pitch-count-badge hidden absolute top-0.5 right-1 text-[8px] bg-slate-950 px-1 rounded-full border border-slate-600" data-badge="抜け球">0</span>
          </button>
        </div>

        <!-- 5. 投球判定アクションボタングリッド（高さと余白を引き締め） -->
        <div class="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800">
          <button type="button" id="btn-pitch-ball" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2 rounded-lg text-xs shadow flex flex-col items-center justify-center transition">
            <span class="text-xs">ボール</span>
            <span class="text-[9px] text-emerald-200 font-normal leading-tight">Bカウント</span>
          </button>

          <button type="button" id="btn-pitch-looking-strike" class="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black py-2 rounded-lg text-xs shadow flex flex-col items-center justify-center transition">
            <span class="text-xs">見逃し</span>
            <span class="text-[9px] text-amber-200 font-normal leading-tight">Sカウント</span>
          </button>

          <button type="button" id="btn-pitch-swinging-strike" class="bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-slate-950 font-black py-2 rounded-lg text-xs shadow flex flex-col items-center justify-center transition">
            <span class="text-xs">空振り</span>
            <span class="text-[9px] text-slate-900 font-normal leading-tight">Sカウント</span>
          </button>

          <button type="button" id="btn-pitch-foul" class="bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 font-bold py-1.5 rounded-lg text-[11px] shadow transition">
            <span>ファウル</span>
          </button>

          <button type="button" id="btn-pitch-hbp" class="bg-rose-800 hover:bg-rose-700 active:scale-95 text-rose-100 font-bold py-1.5 rounded-lg text-[11px] shadow transition">
            <span>死球 (HBP)</span>
          </button>

          <button type="button" id="btn-pitch-inplay" class="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black py-1.5 rounded-lg text-[11px] shadow border border-sky-400 flex items-center justify-center gap-1 transition">
            <span>⚾️ 打球・結果</span>
          </button>
        </div>

      </div>
    `;

    // 初期選択の見た目を反映
    this.updateActiveCellDisplay();
  }

  bindEvents() {
    // 盤面内の全コースボタンに対するタップイベント（イベント委譲）
    const container = this.container.querySelector(".zone-container");
    if (!container) return;

    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-course]");
      if (btn) {
        const courseId = btn.getAttribute("data-course");
        this.selectCourse(courseId);
      }
    });

    // 判定アクションボタン
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
    
    // 打球詳細モーダル起動コールバック
    bindBtn("btn-pitch-inplay", () => {
      if (typeof this.options.onInPlay === "function") {
        this.options.onInPlay(this.selectedCourse);
      }
    });
  }

  /**
   * コース選択時のハイライト切り替え
   */
  selectCourse(courseId) {
    this.selectedCourse = courseId;
    this.updateActiveCellDisplay();
  }

  /**
   * 選択中コースのクラス付与とラベル更新
   */
  updateActiveCellDisplay() {
    // 全コース要素から active クラスを削除
    const allBtns = this.container.querySelectorAll("[data-course]");
    allBtns.forEach((btn) => btn.classList.remove("active"));

    // 選択されたコースに active を付与
    const activeBtn = this.container.querySelector(`[data-course="${this.selectedCourse}"]`);
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    // ラベル表示の更新
    const labelEl = document.getElementById("selected-course-label");
    if (labelEl) {
      labelEl.textContent = this.getCourseReadableName(this.selectedCourse);
    }
  }

  /**
   * コースIDから見やすい表示名へ変換
   */
  getCourseReadableName(courseId) {
    const s9 = ZONE_COURSES.STRIKE_9.find((c) => c.id === courseId);
    if (s9) return s9.label;

    const corners = [...ZONE_COURSES.CORNERS_TOP, ...ZONE_COURSES.CORNERS_BOTTOM];
    const cMatch = corners.find((c) => c.id === courseId);
    if (cMatch) return cMatch.label;

    const sp = ZONE_COURSES.SPECIAL.find((c) => c.id === courseId);
    if (sp) return sp.label;

    return courseId;
  }

  handleAction(resultType) {
    // 状態管理へ1球の記録を指示
    this.gameState.recordPitch(this.selectedCourse, resultType);
  }

  /**
   * 履歴から各マスの投球数を集計しバッジを更新
   */
  updatePitchCounts(state) {
    const counts = {};

    state.history.forEach((h) => {
      const c = h.pitchEvent.course;
      counts[c] = (counts[c] || 0) + 1;
    });

    this.pitchCounts = counts;

    // バッジDOMの更新
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

  /**
   * 外部から現在選択中のコースを取得
   */
  getSelectedCourse() {
    return this.selectedCourse;
  }
}
