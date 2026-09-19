/**
 * js/components/sprayModal.js
 * 打球入力モーダル ＆ Canvasスプレーチャート描画コンポーネント（PCレスポンシブ最適化版）
 * 
 * 改善点:
 * - PC画面では「左: グラウンドCanvas」「右: 結果・球質・得点・決定」の横並び2カラム構成
 * - 縦スクロール一切不要で、着弾点指定から決定までをワン画面で完結
 * - スマホでは指で押しやすいコンパクトな縦並びを維持
 */

const RESULT_COLORS = {
  "単打": "#38bdf8",
  "二塁打": "#f43f5e",
  "三塁打": "#f43f5e",
  "本塁打": "#e11d48",
  "凡打": "#94a3b8",
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
    this.selectedRuns = 0;
    this.hitCoord = null;
    this.onCompleteCallback = null;

    this.canvas = null;
    this.ctx = null;

    this.init();
  }

  init() {
    this.render();
    this.setupCanvas();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div id="spray-modal-backdrop" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 select-none">
        <div class="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg md:max-w-3xl p-3 sm:p-4 shadow-2xl space-y-2.5">
          
          <!-- ヘッダー: タイトル & コース & 閉じる -->
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🏟</span>
              <h2 class="text-xs sm:text-sm font-black text-slate-100">打球着弾点 ＆ 結果詳細入力</h2>
              <span id="modal-current-course" class="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded">
                コース: 中央
              </span>
            </div>
            <button type="button" id="btn-modal-close" class="text-slate-400 hover:text-white text-base px-2 py-0.5 rounded-lg hover:bg-slate-800 transition">
              ✕
            </button>
          </div>

          <!-- メインボディ: PCでは左右横並び2カラム、スマホでは縦並び -->
          <div class="flex flex-col md:flex-row gap-3 items-center md:items-stretch">
            
            <!-- 【左カラム】グラウンドCanvas ＆ エリア表示 -->
            <div class="w-full md:w-[280px] flex-shrink-0 flex flex-col items-center justify-between gap-1.5 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div class="relative w-[240px] sm:w-[260px] md:w-[260px] aspect-square bg-[#0c281e] rounded-xl border border-emerald-700/60 overflow-hidden shadow-inner flex items-center justify-center">
                <canvas id="spray-canvas" class="w-full h-full cursor-crosshair touch-none"></canvas>
              </div>
              <div class="flex items-center justify-between w-full text-[10px] text-slate-400 px-1">
                <span>※ グラウンドをタップ</span>
                <span id="label-detected-area" class="text-emerald-300 font-bold bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded">
                  エリア: 二塁手
                </span>
              </div>
            </div>

            <!-- 【右カラム】結果・球質・得点選択 & 決定アクション -->
            <div class="w-full flex-1 flex flex-col justify-between gap-2">
              
              <!-- 1. 打球結果種別 -->
              <div>
                <span class="text-[11px] font-bold text-slate-300 block mb-1">① 打球結果:</span>
                <div class="grid grid-cols-4 gap-1" id="group-results">
                  <button type="button" class="btn-spray-opt active" data-val="凡打">凡打 (アウト)</button>
                  <button type="button" class="btn-spray-opt text-sky-300" data-val="単打">単打 (1塁打)</button>
                  <button type="button" class="btn-spray-opt text-rose-300 font-bold" data-val="二塁打">二塁打</button>
                  <button type="button" class="btn-spray-opt text-rose-400 font-black" data-val="本塁打">本塁打 (HR)</button>
                  <button type="button" class="btn-spray-opt text-rose-300 font-bold" data-val="三塁打">三塁打</button>
                  <button type="button" class="btn-spray-opt text-emerald-300" data-val="送りバント">送りバント</button>
                  <button type="button" class="btn-spray-opt text-emerald-300" data-val="スクイズ">スクイズ</button>
                  <button type="button" class="btn-spray-opt text-emerald-300" data-val="犠牲フライ">犠牲フライ</button>
                  <button type="button" class="btn-spray-opt text-amber-300" data-val="失策">失策 (エラー)</button>
                  <button type="button" class="btn-spray-opt text-amber-300" data-val="野選">野選 (FC)</button>
                  <button type="button" class="btn-spray-opt text-purple-300" data-val="振り逃げ">振り逃げ</button>
                </div>
              </div>

              <!-- 2. 打球の質 ＆ 発生得点 -->
              <div class="grid grid-cols-2 gap-2">
                <!-- 球質 -->
                <div>
                  <span class="text-[11px] font-bold text-slate-300 block mb-1">② 打球の質:</span>
                  <div class="grid grid-cols-2 gap-1" id="group-quality">
                    <button type="button" class="btn-spray-quality active" data-val="ゴロ">ゴロ</button>
                    <button type="button" class="btn-spray-quality" data-val="フライ">フライ</button>
                    <button type="button" class="btn-spray-quality" data-val="ライナー">ライナー</button>
                    <button type="button" class="btn-spray-quality" data-val="バント">バント</button>
                  </div>
                </div>

                <!-- 発生得点 -->
                <div>
                  <span class="text-[11px] font-bold text-slate-300 block mb-1">③ 発生得点:</span>
                  <div class="grid grid-cols-4 gap-1" id="group-runs">
                    <button type="button" class="btn-spray-runs active" data-val="0">0点</button>
                    <button type="button" class="btn-spray-runs" data-val="1">1点</button>
                    <button type="button" class="btn-spray-runs" data-val="2">2点</button>
                    <button type="button" class="btn-spray-runs" data-val="3">3+</button>
                  </div>
                </div>
              </div>

              <!-- 3. アクションボタン（決定 / キャンセル） -->
              <div class="flex items-center gap-2 pt-1 border-t border-slate-800">
                <button type="button" id="btn-modal-cancel" class="w-1/3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold py-2 sm:py-2.5 rounded-xl text-xs transition">
                  キャンセル
                </button>
                <button type="button" id="btn-modal-submit" class="w-2/3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2 sm:py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-1.5">
                  <span>✓ 打球結果を記録する</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    `;

    this.applyButtonStyles();
  }

  applyButtonStyles() {
    const styleOpt = (btn, isActive) => {
      btn.className = isActive
        ? "bg-sky-600 border-2 border-sky-300 text-white font-black py-1.5 px-1 rounded-lg text-[10px] text-center shadow transition"
        : "bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white font-medium py-1.5 px-1 rounded-lg text-[10px] text-center transition";
    };

    const styleQuality = (btn, isActive) => {
      btn.className = isActive
        ? "bg-emerald-600 border-2 border-emerald-300 text-white font-black py-1.5 rounded-lg text-[11px] text-center shadow transition"
        : "bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white py-1.5 rounded-lg text-[11px] text-center transition";
    };

    const styleRuns = (btn, isActive) => {
      btn.className = isActive
        ? "bg-amber-600 border-2 border-amber-300 text-white font-black py-1.5 rounded-lg text-[11px] text-center shadow transition"
        : "bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white py-1.5 rounded-lg text-[11px] text-center transition";
    };

    this.container.querySelectorAll(".btn-spray-opt").forEach((btn) => {
      styleOpt(btn, btn.getAttribute("data-val") === this.selectedResult);
    });
    this.container.querySelectorAll(".btn-spray-quality").forEach((btn) => {
      styleQuality(btn, btn.getAttribute("data-val") === this.selectedQuality);
    });
    this.container.querySelectorAll(".btn-spray-runs").forEach((btn) => {
      styleRuns(btn, parseInt(btn.getAttribute("data-val"), 10) === this.selectedRuns);
    });
  }

  setupCanvas() {
    this.canvas = this.container.querySelector("#spray-canvas");
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d");

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = rect.width || 260;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.scale(dpr, dpr);

    this.drawField();
  }

  drawField() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    const homeX = w / 2;
    const homeY = h * 0.88;
    const fenceRadius = w * 0.82;

    // 1. フェアグラウンド扇形
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.arc(homeX, homeY, fenceRadius, -Math.PI * 0.75, -Math.PI * 0.25, false);
    ctx.closePath();
    ctx.fillStyle = "#0c281e";
    ctx.fill();
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 2. 外野フェンス弧
    ctx.beginPath();
    ctx.arc(homeX, homeY, fenceRadius, -Math.PI * 0.75, -Math.PI * 0.25, false);
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. 内野クレー
    const infieldRadius = w * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.arc(homeX, homeY, infieldRadius, -Math.PI * 0.75, -Math.PI * 0.25, false);
    ctx.closePath();
    ctx.fillStyle = "#261911";
    ctx.fill();
    ctx.strokeStyle = "#5c3d26";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 4. 内野塁間ライン
    const baseDist = w * 0.24;
    const secondX = homeX;
    const secondY = homeY - baseDist * 1.414;
    const firstX = homeX + baseDist;
    const firstY = homeY - baseDist * 0.707;
    const thirdX = homeX - baseDist;
    const thirdY = homeY - baseDist * 0.707;

    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(firstX, firstY);
    ctx.lineTo(secondX, secondY);
    ctx.lineTo(thirdX, thirdY);
    ctx.closePath();
    ctx.strokeStyle = "rgba(241, 245, 249, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. 各ベース
    const drawSquareBase = (bx, by) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    };

    drawSquareBase(firstX, firstY);
    drawSquareBase(secondX, secondY);
    drawSquareBase(thirdX, thirdY);

    // ピッチャーズマウンド
    ctx.beginPath();
    ctx.arc(homeX, homeY - (baseDist * 1.414) / 2, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();

    // 本塁
    ctx.beginPath();
    ctx.moveTo(homeX, homeY - 4);
    ctx.lineTo(homeX + 4, homeY);
    ctx.lineTo(homeX + 4, homeY + 4);
    ctx.lineTo(homeX - 4, homeY + 4);
    ctx.lineTo(homeX - 4, homeY);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // 6. 過去の打球着弾点プロット
    this.drawPastHits(w, h, homeX, homeY);

    // 7. 現在選択中の着弾点とスプレーライン
    if (this.hitCoord) {
      this.drawCurrentHit(w, h, homeX, homeY);
    }
  }

  drawPastHits(w, h, homeX, homeY) {
    const state = this.gameState.getState();
    if (!state.history || state.history.length === 0) return;

    state.history.forEach((hItem) => {
      const p = hItem.pitchEvent;
      if (p && p.play && p.play.hitCoord) {
        const hx = p.play.hitCoord.x * w;
        const hy = p.play.hitCoord.y * h;
        const color = RESULT_COLORS[p.play.type] || "#94a3b8";

        this.ctx.beginPath();
        this.ctx.moveTo(homeX, homeY);
        this.ctx.lineTo(hx, hy);
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = 0.3;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
      }
    });
  }

  drawCurrentHit(w, h, homeX, homeY) {
    const ctx = this.ctx;
    const targetX = this.hitCoord.x * w;
    const targetY = this.hitCoord.y * h;
    const color = RESULT_COLORS[this.selectedResult] || "#38bdf8";

    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(targetX, targetY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector("#btn-modal-close");
    const cancelBtn = this.container.querySelector("#btn-modal-cancel");
    const closeHandler = () => this.close();

    if (closeBtn) closeBtn.addEventListener("click", closeHandler);
    if (cancelBtn) cancelBtn.addEventListener("click", closeHandler);

    if (this.canvas) {
      const handlePointer = (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        this.hitCoord = { x, y };

        const areaName = this.detectArea(x, y);
        const areaLabel = this.container.querySelector("#label-detected-area");
        if (areaLabel) {
          areaLabel.textContent = `エリア: ${areaName}`;
        }

        this.drawField();
      };

      this.canvas.addEventListener("click", handlePointer);
      this.canvas.addEventListener("touchstart", handlePointer, { passive: false });
    }

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

    const runsGroup = this.container.querySelector("#group-runs");
    if (runsGroup) {
      runsGroup.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-val]");
        if (btn) {
          this.selectedRuns = parseInt(btn.getAttribute("data-val"), 10);
          this.applyButtonStyles();
        }
      });
    }

    const submitBtn = this.container.querySelector("#btn-modal-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => this.submit());
    }
  }

  detectArea(x, y) {
    if (y > 0.82) return "捕手前 / 本塁付近";

    const isOutfield = y < 0.52;

    if (isOutfield) {
      if (x < 0.36) return "左翼手 (レフト)";
      if (x > 0.64) return "右翼手 (ライト)";
      return "中堅手 (センター)";
    } else {
      if (x < 0.38) return "三塁手 (サード)";
      if (x < 0.50) return "遊撃手 (ショート)";
      if (x < 0.62) return "二塁手 (セカンド)";
      return "一塁手 (ファースト)";
    }
  }

  open({ course = "中央", onComplete }) {
    this.currentCourse = course;
    this.onCompleteCallback = onComplete;

    this.hitCoord = { x: 0.5, y: 0.62 };
    this.selectedResult = "凡打";
    this.selectedQuality = "ゴロ";
    this.selectedRuns = 0;

    const courseLabel = this.container.querySelector("#modal-current-course");
    if (courseLabel) {
      courseLabel.textContent = `コース: ${course}`;
    }

    this.container.classList.remove("hidden");

    setTimeout(() => {
      this.setupCanvas();
      const areaLabel = this.container.querySelector("#label-detected-area");
      if (areaLabel) {
        areaLabel.textContent = `エリア: ${this.detectArea(0.5, 0.62)}`;
      }
      this.applyButtonStyles();
    }, 50);
  }

  close() {
    this.container.classList.add("hidden");
  }

  submit() {
    const area = this.hitCoord ? this.detectArea(this.hitCoord.x, this.hitCoord.y) : "不明";

    const playResult = {
      course: this.currentCourse,
      type: this.selectedResult,
      quality: this.selectedQuality,
      runs: this.selectedRuns,
      area: area,
      hitCoord: this.hitCoord || { x: 0.5, y: 0.6 }
    };

    if (typeof this.onCompleteCallback === "function") {
      this.onCompleteCallback(playResult);
    }

    this.close();
  }
}
