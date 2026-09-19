/**
 * js/components/sprayModal.js
 * 打球入力モーダル ＆ Canvasスプレーチャート描画コンポーネント
 * 
 * 担当役割:
 * - 打球結果入力モーダルの表示・非表示制御
 * - HTML5 Canvas による野球グラウンド（扇形フェア地域・内野ダイヤモンド）の描画
 * - タップ・クリック位置（X, Y 座標: 0.0〜1.0）のプロットとスプレーライン描画
 * - 打球結果（単打、長打、凡打、犠打、失策等）、球質（ゴロ/フライ/ライナー/バント）、発生得点の選択
 * - 着弾座標に基づく守備エリア（左翼・中堅・右翼・三塁・遊撃・二塁・一塁等）の自動判定
 */

// 打球結果ごとの描画カラー定義
const RESULT_COLORS = {
  "単打": "#38bdf8",     // スカイブルー
  "二塁打": "#f43f5e",   // ローズ（長打）
  "三塁打": "#f43f5e",   // ローズ（長打）
  "本塁打": "#e11d48",   // ディープレッド（長打）
  "凡打": "#94a3b8",     // スレートグレー
  "送りバント": "#10b981", // エメラルド（犠打）
  "スクイズ": "#10b981",   // エメラルド（犠打）
  "犠牲フライ": "#10b981", // エメラルド（犠打）
  "失策": "#fbbf24",     // アンバー（エラー）
  "野選": "#fbbf24",     // アンバー（FC）
  "振り逃げ": "#a855f7"  // パープル
};

export class SprayModalComponent {
  /**
   * @param {HTMLElement} containerElement モーダル配置親要素 (#spray-modal-slot)
   * @param {GameState} gameState 試合状態管理インスタンス
   */
  constructor(containerElement, gameState) {
    this.container = containerElement;
    this.gameState = gameState;

    // 現在モーダルで編集中の一時データ
    this.currentCourse = "中央";
    this.selectedResult = "凡打";
    this.selectedQuality = "ゴロ";
    this.selectedRuns = 0;
    this.hitCoord = null; // { x: 0.5, y: 0.6 }
    this.onCompleteCallback = null;

    // Canvas関連
    this.canvas = null;
    this.ctx = null;

    this.init();
  }

  init() {
    this.render();
    this.setupCanvas();
    this.bindEvents();
  }

  /**
   * モーダルDOMの骨組みを生成
   */
  render() {
    this.container.innerHTML = `
      <div id="spray-modal-backdrop" class="modal-backdrop select-none">
        <div class="modal-content max-h-[92vh] overflow-y-auto space-y-3">
          
          <!-- モーダルヘッダー -->
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🏟</span>
              <h2 class="text-sm font-black text-slate-100">打球着弾点 ＆ 結果詳細入力</h2>
            </div>
            <button type="button" id="btn-modal-close" class="text-slate-400 hover:text-white text-lg px-2">
              ✕
            </button>
          </div>

          <!-- 1. グラウンドCanvas（着弾点タップ） -->
          <div class="flex flex-col items-center gap-1">
            <div class="relative w-full max-w-[320px] aspect-square bg-[#0f241a] rounded-xl border border-emerald-800 overflow-hidden shadow-inner">
              <canvas id="spray-canvas" class="w-full h-full cursor-crosshair touch-none"></canvas>
            </div>
            <div class="flex items-center justify-between w-full max-w-[320px] text-[10px] text-slate-400 px-1">
              <span>※ グラウンドをタップして着弾点を指定</span>
              <span id="label-detected-area" class="text-emerald-400 font-bold">エリア: 未指定</span>
            </div>
          </div>

          <!-- 2. 打球結果種別（必須選択） -->
          <div>
            <span class="text-[11px] font-bold text-slate-300 block mb-1">打球結果:</span>
            <div class="grid grid-cols-4 gap-1.5" id="group-results">
              <button type="button" class="btn-spray-opt active" data-val="凡打">凡打(アウト)</button>
              <button type="button" class="btn-spray-opt text-sky-300" data-val="単打">単打 (1塁打)</button>
              <button type="button" class="btn-spray-opt text-rose-300" data-val="二塁打">二塁打</button>
              <button type="button" class="btn-spray-opt text-rose-400 font-extrabold" data-val="本塁打">本塁打(HR)</button>
              <button type="button" class="btn-spray-opt text-rose-300" data-val="三塁打">三塁打</button>
              <button type="button" class="btn-spray-opt text-emerald-300" data-val="送りバント">送りバント</button>
              <button type="button" class="btn-spray-opt text-emerald-300" data-val="スクイズ">スクイズ</button>
              <button type="button" class="btn-spray-opt text-emerald-300" data-val="犠牲フライ">犠牲フライ</button>
              <button type="button" class="btn-spray-opt text-amber-300" data-val="失策">失策(エラー)</button>
              <button type="button" class="btn-spray-opt text-amber-300" data-val="野選">野選(FC)</button>
              <button type="button" class="btn-spray-opt text-purple-300" data-val="振り逃げ">振り逃げ</button>
            </div>
          </div>

          <!-- 3. 打球の質 (ゴロ / フライ / ライナー / バント) -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="text-[11px] font-bold text-slate-300 block mb-1">打球の質:</span>
              <div class="grid grid-cols-2 gap-1" id="group-quality">
                <button type="button" class="btn-spray-quality active" data-val="ゴロ">ゴロ</button>
                <button type="button" class="btn-spray-quality" data-val="フライ">フライ</button>
                <button type="button" class="btn-spray-quality" data-val="ライナー">ライナー</button>
                <button type="button" class="btn-spray-quality" data-val="バント">バント</button>
              </div>
            </div>

            <!-- 4. 発生得点 (0 / 1 / 2 / 3+) -->
            <div>
              <span class="text-[11px] font-bold text-slate-300 block mb-1">この打球での得点:</span>
              <div class="grid grid-cols-4 gap-1" id="group-runs">
                <button type="button" class="btn-spray-runs active" data-val="0">0点</button>
                <button type="button" class="btn-spray-runs" data-val="1">1点</button>
                <button type="button" class="btn-spray-runs" data-val="2">2点</button>
                <button type="button" class="btn-spray-runs" data-val="3">3点+</button>
              </div>
            </div>
          </div>

          <!-- 5. 決定・キャンセルアクション -->
          <div class="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button type="button" id="btn-modal-cancel" class="flex-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition">
              キャンセル
            </button>
            <button type="button" id="btn-modal-submit" class="flex-2 w-2/3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-lg transition">
              ✓ 打球結果を記録する
            </button>
          </div>

        </div>
      </div>
    `;

    // 共通ボタンスタイルのクラス適用（components.css を補助）
    this.applyButtonStyles();
  }

  applyButtonStyles() {
    const styleOpt = (btn, isActive) => {
      btn.className = isActive
        ? "bg-sky-700/80 border-2 border-sky-400 text-white font-extrabold py-1.5 px-1 rounded-lg text-[10px] text-center shadow transition"
        : "bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white font-medium py-1.5 px-1 rounded-lg text-[10px] text-center transition";
    };

    const styleQuality = (btn, isActive) => {
      btn.className = isActive
        ? "bg-emerald-700/80 border-2 border-emerald-400 text-white font-extrabold py-1.5 rounded-lg text-[11px] text-center shadow transition"
        : "bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white py-1.5 rounded-lg text-[11px] text-center transition";
    };

    const styleRuns = (btn, isActive) => {
      btn.className = isActive
        ? "bg-amber-600 border-2 border-amber-300 text-white font-extrabold py-1.5 rounded-lg text-[11px] text-center shadow transition"
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

    // 高解像度ディスプレイ対応（Retina対応）
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = (rect.width || 320) * dpr;
    this.canvas.height = (rect.height || 320) * dpr;
    this.ctx.scale(dpr, dpr);

    this.drawField();
  }

  /**
   * グラウンド（扇形フェア地域、内野ダイヤモンド、ベース）の描画
   */
  drawField() {
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    const homeX = w / 2;
    const homeY = h * 0.88;
    const fenceRadius = w * 0.82;

    // 1. フェアグラウンド扇形（天然芝深緑）
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
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. 内野クレー（土グラウンド部分）
    const infieldRadius = w * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.arc(homeX, homeY, infieldRadius, -Math.PI * 0.75, -Math.PI * 0.25, false);
    ctx.closePath();
    ctx.fillStyle = "#291b12";
    ctx.fill();
    ctx.strokeStyle = "#5c3d26";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 4. 内野ダイヤモンド（白線塁間ライン）
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
    ctx.strokeStyle = "rgba(241, 245, 249, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. 各ベース（1塁、2塁、3塁、本塁、マウンド）
    const drawSquareBase = (bx, by) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    };

    drawSquareBase(firstX, firstY);
    drawSquareBase(secondX, secondY);
    drawSquareBase(thirdX, thirdY);

    // ピッチャーズマウンド
    ctx.beginPath();
    ctx.arc(homeX, homeY - (baseDist * 1.414) / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();

    // 本塁（五角形ホームベース）
    ctx.beginPath();
    ctx.moveTo(homeX, homeY - 4);
    ctx.lineTo(homeX + 5, homeY);
    ctx.lineTo(homeX + 5, homeY + 4);
    ctx.lineTo(homeX - 5, homeY + 4);
    ctx.lineTo(homeX - 5, homeY);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // 6. 過去の打球着弾点プロット（薄くオーバーレイ）
    this.drawPastHits(w, h, homeX, homeY);

    // 7. 現在選択中の着弾点とスプレーラインの描画
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

        // 過去ライン
        this.ctx.beginPath();
        this.ctx.moveTo(homeX, homeY);
        this.ctx.lineTo(hx, hy);
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = 0.35;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // 過去着弾点
        this.ctx.beginPath();
        this.ctx.arc(hx, hy, 3, 0, Math.PI * 2);
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

    // 本塁から着弾点へのスプレーライン
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(targetX, targetY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 着弾点マーカー（強調リング＆中心点）
    ctx.beginPath();
    ctx.arc(targetX, targetY, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  bindEvents() {
    // 1. モーダルを閉じる / キャンセル
    const closeBtn = this.container.querySelector("#btn-modal-close");
    const cancelBtn = this.container.querySelector("#btn-modal-cancel");
    const closeHandler = () => this.close();

    if (closeBtn) closeBtn.addEventListener("click", closeHandler);
    if (cancelBtn) cancelBtn.addEventListener("click", closeHandler);

    // 2. Canvasタップ・クリックによる着弾座標取得
    if (this.canvas) {
      const handlePointer = (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        this.hitCoord = { x, y };

        // エリアの自動判定ラベル更新
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

    // 3. 結果種別ボタングループの選択
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

    // 4. 打球の質ボタングループの選択
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

    // 5. 発生得点ボタングループの選択
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

    // 6. 決定ボタン
    const submitBtn = this.container.querySelector("#btn-modal-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => this.submit());
    }
  }

  /**
   * 着弾座標 (X, Y: 0.0〜1.0) から学童7守備エリアを幾何学的に判定
   */
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

  /**
   * モーダルを開く（コース情報と完了コールバックを受け取る）
   */
  open({ course = "中央", onComplete }) {
    this.currentCourse = course;
    this.onCompleteCallback = onComplete;

    // デフォルト着弾点（ピッチャー付近）
    this.hitCoord = { x: 0.5, y: 0.62 };
    this.selectedResult = "凡打";
    this.selectedQuality = "ゴロ";
    this.selectedRuns = 0;

    this.container.classList.remove("hidden");

    // レイアウト確定後にCanvasを初期化＆再描画
    setTimeout(() => {
      this.setupCanvas();
      const areaLabel = this.container.querySelector("#label-detected-area");
      if (areaLabel) {
        areaLabel.textContent = `エリア: ${this.detectArea(0.5, 0.62)}`;
      }
      this.applyButtonStyles();
    }, 50);
  }

  /**
   * モーダルを閉じる
   */
  close() {
    this.container.classList.add("hidden");
  }

  /**
   * 打球結果を確定して上位コールバックへ引き渡し
   */
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
