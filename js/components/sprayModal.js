/**
 * js/components/sprayModal.js
 * 打球入力モーダル ＆ Canvasスプレーチャート
 * 
 * 機能:
 * - 過去の打球着弾点を先攻（青）・後攻（橙）で明確に自動色分け
 * - モーダル展開時、現在攻撃中チームの打球のみを初期自動表示（自動追従）
 * - グラウンド上部に「今攻 / 先攻 / 後攻 / 全」のクイック切替トグルを配置
 * - 打球着弾エリアの自動判定（投手前・捕手前・内野各ポジション・外野）
 * - 「① 結果」「② 球質」の直感操作パレット（発生得点ボタンは撤廃済）
 */

const RESULT_COLORS = {
  "単打": "#38bdf8",
  "二塁打": "#f43f5e",
  "三塁打": "#f43f5e",
  "本塁打": "#e11d48",
  "凡打": "#94a3b8",
  "併殺打": "#f97316",
  "送りバント": "#10b981",
  "スクイズ": "#10b981",
  "犠牲フライ": "#10b981",
  "失策": "#fbbf24",
  "野選": "#fbbf24",
  "振り逃げ": "#a855f7"
};

export class SprayModalComponent {
  constructor(containerElement, gameState) {
    this.container = containerElement;
    this.gameState = gameState;

    this.currentCourse = "中央";
    this.selectedResult = "凡打";
    this.selectedQuality = "ゴロ";
    this.hitCoord = { x: 0.5, y: 0.62 };
    this.onCompleteCallback = null;

    // フィルタ状態: "current"（現在攻撃チームのみ・デフォルト） | "away"（先攻のみ） | "home"（後攻のみ） | "all"（全チーム）
    this.filterSide = "current";

    this.canvas = null;
    this.ctx = null;
    this.canvasSize = 240;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div id="spray-modal-backdrop" class="fixed inset-0 bg-black/90 flex items-center justify-center p-2 sm:p-4 z-50 select-none overflow-y-auto">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg md:max-w-3xl p-3 shadow-2xl space-y-2">
          
          <!-- ヘッダー -->
          <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div class="flex items-center gap-2">
              <span class="text-sm">🏟</span>
              <h2 class="text-xs sm:text-sm font-black text-slate-100">打球着弾点 ＆ 結果入力</h2>
              <span id="modal-current-course" class="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                中央
              </span>
            </div>
            <button type="button" id="btn-modal-close" class="text-slate-400 hover:text-white text-lg px-2 py-0.5 rounded hover:bg-slate-800">
              ✕
            </button>
          </div>

          <!-- メイン -->
          <div class="flex flex-col md:flex-row gap-2.5 items-center md:items-stretch">
            
            <!-- グラウンドCanvas ＆ チーム着弾点切替 -->
            <div class="w-full md:w-[260px] flex-shrink-0 flex flex-col items-center justify-between gap-1 bg-slate-950 p-2 rounded-xl border border-slate-800">
              
              <!-- チーム着弾点表示切替トグルバー -->
              <div class="w-full flex items-center justify-between gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button type="button" class="btn-filter-side flex-1 py-1 rounded font-bold transition text-center" data-filter="current">
                  今攻
                </button>
                <button type="button" class="btn-filter-side flex-1 py-1 rounded font-bold transition text-center" data-filter="away">
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 mr-0.5"></span>先攻
                </button>
                <button type="button" class="btn-filter-side flex-1 py-1 rounded font-bold transition text-center" data-filter="home">
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-0.5"></span>後攻
                </button>
                <button type="button" class="btn-filter-side flex-1 py-1 rounded font-bold transition text-center" data-filter="all">
                  全
                </button>
              </div>

              <!-- グラウンドCanvas -->
              <div class="relative w-[230px] aspect-square bg-[#0c281e] rounded-lg border border-emerald-800 overflow-hidden flex items-center justify-center">
                <canvas id="spray-canvas" class="cursor-crosshair touch-none" width="230" height="230"></canvas>
              </div>

              <!-- 判定位置ラベル -->
              <div class="flex items-center justify-between w-full text-[10px] text-slate-400 px-1">
                <span>※ 着弾点をタップ</span>
                <span id="label-detected-area" class="text-emerald-300 font-bold bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 rounded">
                  二塁手 (セカンド)
                </span>
              </div>
            </div>

            <!-- 操作パレット -->
            <div class="w-full flex-1 flex flex-col justify-between gap-2">
              
              <!-- ① 結果 -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] font-bold text-slate-300">① 打球結果:</span>
                  <span id="label-selected-result" class="text-[10px] text-sky-400 font-bold bg-sky-950/80 px-2 py-0.2 rounded border border-sky-800">
                    選択中: 凡打
                  </span>
                </div>
                <div class="grid grid-cols-4 gap-1" id="group-results">
                  <button type="button" class="btn-spray-opt" data-val="凡打">凡打</button>
                  <button type="button" class="btn-spray-opt" data-val="単打">単打</button>
                  <button type="button" class="btn-spray-opt" data-val="二塁打">二塁打</button>
                  <button type="button" class="btn-spray-opt" data-val="本塁打">本塁打</button>
                  <button type="button" class="btn-spray-opt" data-val="三塁打">三塁打</button>
                  <button type="button" class="btn-spray-opt" data-val="送りバント">犠打</button>
                  <button type="button" class="btn-spray-opt" data-val="スクイズ">スクイズ</button>
                  <button type="button" class="btn-spray-opt" data-val="犠牲フライ">犠飛</button>
                  <button type="button" class="btn-spray-opt" data-val="失策">失策</button>
                  <button type="button" class="btn-spray-opt" data-val="野選">野選</button>
                  <button type="button" class="btn-spray-opt" data-val="振り逃げ">振逃</button>
                  <button type="button" class="btn-spray-opt" data-val="併殺打">併殺打</button>
                </div>
              </div>

              <!-- ② 球質 (横4列でスッキリ配置) -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] font-bold text-slate-300">② 球質:</span>
                  <span id="label-selected-quality" class="text-[10px] text-emerald-400 font-bold">ゴロ</span>
                </div>
                <div class="grid grid-cols-4 gap-1" id="group-quality">
                  <button type="button" class="btn-spray-quality" data-val="ゴロ">ゴロ</button>
                  <button type="button" class="btn-spray-quality" data-val="フライ">フライ</button>
                  <button type="button" class="btn-spray-quality" data-val="ライナー">ライナー</button>
                  <button type="button" class="btn-spray-quality" data-val="バント">バント</button>
                </div>
              </div>

              <!-- 決定ボタン -->
              <div class="flex items-center gap-2 pt-1.5 border-t border-slate-800">
                <button type="button" id="btn-modal-cancel" class="w-1/3 bg-slate-800 text-slate-300 font-bold py-2 rounded-xl text-xs active:bg-slate-700">
                  キャンセル
                </button>
                <button type="button" id="btn-modal-submit" class="w-2/3 bg-emerald-600 active:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs shadow-md">
                  ✓ 打球結果を記録
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    `;

    this.canvas = this.container.querySelector("#spray-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d", { alpha: false });
    }
  }

  bindEvents() {
    const closeBtn = this.container.querySelector("#btn-modal-close");
    const cancelBtn = this.container.querySelector("#btn-modal-cancel");
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    if (cancelBtn) cancelBtn.addEventListener("click", () => this.close());

    // 表示チーム切替トグル
    this.container.querySelectorAll(".btn-filter-side").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.filterSide = btn.getAttribute("data-filter") || "current";
        this.updateFilterButtons();
        this.drawField();
      });
    });

    // スマホ・PC共通のポインターイベント
    if (this.canvas) {
      const handlePointer = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;

        const x = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
        const y = Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height));

        this.hitCoord = { x, y };

        const areaName = this.detectArea(x, y);
        const areaLabel = this.container.querySelector("#label-detected-area");
        if (areaLabel) areaLabel.textContent = areaName;

        this.drawField();
      };

      this.canvas.addEventListener("pointerdown", handlePointer);
    }

    // 各ボタン選択
    const resultGroup = this.container.querySelector("#group-results");
    if (resultGroup) {
      resultGroup.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-val]");
        if (btn) {
          this.selectedResult = btn.getAttribute("data-val");
          this.applyButtonStyles();
          this.drawField();
        }
      });
    }

    const qualityGroup = this.container.querySelector("#group-quality");
    if (qualityGroup) {
      qualityGroup.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-val]");
        if (btn) {
          this.selectedQuality = btn.getAttribute("data-val");
          this.applyButtonStyles();
        }
      });
    }

    const submitBtn = this.container.querySelector("#btn-modal-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => this.submit());
    }
  }

  updateFilterButtons() {
    const filterBtns = this.container.querySelectorAll(".btn-filter-side");
    filterBtns.forEach((btn) => {
      const isSel = btn.getAttribute("data-filter") === this.filterSide;
      if (isSel) {
        btn.className = "btn-filter-side flex-1 py-1 rounded font-black transition text-center bg-slate-700 text-white shadow";
      } else {
        btn.className = "btn-filter-side flex-1 py-1 rounded font-bold transition text-center text-slate-400 hover:text-slate-200";
      }
    });
  }

  applyButtonStyles() {
    const resBtns = this.container.querySelectorAll(".btn-spray-opt");
    for (let i = 0; i < resBtns.length; i++) {
      const b = resBtns[i];
      const isActive = b.getAttribute("data-val") === this.selectedResult;
      b.className = isActive
        ? "btn-spray-opt bg-sky-500 text-white font-black py-1.5 rounded text-[11px] ring-2 ring-white shadow"
        : "btn-spray-opt bg-slate-800 text-slate-300 font-medium py-1.5 rounded text-[11px] border border-slate-700";
    }

    const qBtns = this.container.querySelectorAll(".btn-spray-quality");
    for (let i = 0; i < qBtns.length; i++) {
      const b = qBtns[i];
      const isActive = b.getAttribute("data-val") === this.selectedQuality;
      b.className = isActive
        ? "btn-spray-quality bg-emerald-500 text-white font-black py-1.5 rounded text-xs ring-2 ring-white shadow"
        : "btn-spray-quality bg-slate-800 text-slate-300 font-medium py-1.5 rounded text-xs border border-slate-700";
    }

    const lr = this.container.querySelector("#label-selected-result");
    if (lr) lr.textContent = `選択中: ${this.selectedResult}`;

    const lq = this.container.querySelector("#label-selected-quality");
    if (lq) lq.textContent = this.selectedQuality;

    this.updateFilterButtons();
  }

  drawField() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = 230;
    const h = 230;

    ctx.fillStyle = "#0c281e";
    ctx.fillRect(0, 0, w, h);

    const homeX = w / 2;
    const homeY = h * 0.88;
    const fenceRadius = w * 0.82;

    // 外野芝生扇形
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.arc(homeX, homeY, fenceRadius, -Math.PI * 0.75, -Math.PI * 0.25, false);
    ctx.closePath();
    ctx.fillStyle = "#0e3427";
    ctx.fill();
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 内野クレー
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.arc(homeX, homeY, w * 0.42, -Math.PI * 0.75, -Math.PI * 0.25, false);
    ctx.closePath();
    ctx.fillStyle = "#261911";
    ctx.fill();

    // 塁間ライン
    const baseDist = w * 0.24;
    const firstX = homeX + baseDist, firstY = homeY - baseDist * 0.707;
    const secondX = homeX, secondY = homeY - baseDist * 1.414;
    const thirdX = homeX - baseDist, thirdY = homeY - baseDist * 0.707;

    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(firstX, firstY);
    ctx.lineTo(secondX, secondY);
    ctx.lineTo(thirdX, thirdY);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // ピッチャーマウンド
    const moundX = homeX;
    const moundY = homeY - baseDist * 0.707;
    ctx.beginPath();
    ctx.arc(moundX, moundY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(moundX - 2, moundY - 1, 4, 2);

    // ベース
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(firstX - 3, firstY - 3, 6, 6);
    ctx.fillRect(secondX - 3, secondY - 3, 6, 6);
    ctx.fillRect(thirdX - 3, thirdY - 3, 6, 6);
    ctx.fillRect(homeX - 3, homeY - 3, 6, 6);

    // 過去の打球描画（先攻:スカイブルー / 後攻:アンバーオレンジ）
    const state = this.gameState.getState();
    const isCurrentTop = state.isTop !== false;

    if (state.history && state.history.length > 0) {
      state.history.forEach((item) => {
        const p = item.pitchEvent;
        const snap = item.snapshot;
        if (!p || !p.play || !p.play.hitCoord) return;

        // 打撃を行った側の判定（snap.isTop が true なら先攻、false なら後攻）
        const isTopHit = snap ? snap.isTop !== false : true;

        // フィルタリング判定（今攻 / 先攻 / 後攻 / 全）
        if (this.filterSide === "current" && isTopHit !== isCurrentTop) return;
        if (this.filterSide === "away" && !isTopHit) return;
        if (this.filterSide === "home" && isTopHit) return;

        const hx = p.play.hitCoord.x * w;
        const hy = p.play.hitCoord.y * h;

        // 色分け（先攻: スカイブルー #38bdf8 / 後攻: アンバー #f59e0b）
        const dotColor = isTopHit ? "#38bdf8" : "#f59e0b";

        ctx.beginPath();
        ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
    }

    // 現在の着弾点（ハイライト線と大きなマーカー）
    if (this.hitCoord) {
      const targetX = this.hitCoord.x * w;
      const targetY = this.hitCoord.y * h;
      const color = RESULT_COLORS[this.selectedResult] || "#38bdf8";

      ctx.beginPath();
      ctx.moveTo(homeX, homeY);
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(targetX, targetY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }

  detectArea(x, y) {
    if (y > 0.81) return "捕手前 (キャッチャー)";

    if (y >= 0.64 && y <= 0.81 && x >= 0.40 && x <= 0.60) {
      return "投手前 (ピッチャー)";
    }

    if (y < 0.52) {
      if (x < 0.36) return "左翼手 (レフト)";
      if (x > 0.64) return "右翼手 (ライト)";
      return "中堅手 (センター)";
    } 
    
    if (x < 0.38) return "三塁手 (サード)";
    if (x < 0.50) return "遊撃手 (ショート)";
    if (x < 0.62) return "二塁手 (セカンド)";
    return "一塁手 (ファースト)";
  }

  open({ course = "中央", onComplete }) {
    this.currentCourse = course;
    this.onCompleteCallback = onComplete;

    this.hitCoord = { x: 0.5, y: 0.62 };
    this.selectedResult = "凡打";
    this.selectedQuality = "ゴロ";

    // モーダルを開いたときは、自動で「現在攻撃チーム（今攻）」を初期選択
    this.filterSide = "current";

    const courseLabel = this.container.querySelector("#modal-current-course");
    if (courseLabel) courseLabel.textContent = course;

    const areaLabel = this.container.querySelector("#label-detected-area");
    if (areaLabel) areaLabel.textContent = "二塁手 (セカンド)";

    this.applyButtonStyles();
    this.drawField();

    this.container.classList.remove("hidden");
  }

  close() {
    this.container.classList.add("hidden");
  }

  submit() {
    const area = this.detectArea(this.hitCoord.x, this.hitCoord.y);

    const playResult = {
      course: this.currentCourse,
      type: this.selectedResult,
      quality: this.selectedQuality,
      area: area,
      hitCoord: this.hitCoord
    };

    if (typeof this.onCompleteCallback === "function") {
      this.onCompleteCallback(playResult);
    }

    this.close();
  }
}
