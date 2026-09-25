/**
 * js/components/runnerDiamond.js
 * 走者ダイアモンド ＆ BSOランプコンポーネント
 * 
 * 担当役割:
 * - BSOランプ（ボール:緑3 / ストライク:黄2 / アウト:赤2）の点灯管理
 * - 走者ダイアモンド（SVG）の描画および各塁（1〜3塁）のワンタップ在塁トグル
 * - 現在の打者・投手情報の表示
 * - 走塁・野手イベントボタン（盗塁、盗塁刺、暴投進塁、牽制死）の発火
 * - 直近投球ログスロット（#log-slot）の自動更新
 */

export class RunnerDiamondComponent {
  /**
   * @param {HTMLElement} containerElement 描画対象の親要素 (#diamond-slot)
   * @param {GameState} gameState 試合状態管理インスタンス
   * @param {Object} options オプション設定
   */
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;
    this.logContainer = document.getElementById("log-slot");

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    // GameState の変更通知を受け取ってUIをリアルタイム更新
    this.gameState.subscribe((state) => {
      this.update(state);
    });

    // 初期状態を反映
    this.update(this.gameState.getState());
  }

  render() {
    this.container.innerHTML = `
      <div class="diamond-panel select-none">
        
        <!-- 左側: BSOカウントランプ群 -->
        <div class="bso-group">
          <!-- ボール (B) -->
          <div class="bso-row">
            <span class="bso-label text-emerald-400">B</span>
            <div id="lamp-b1" class="lamp"></div>
            <div id="lamp-b2" class="lamp"></div>
            <div id="lamp-b3" class="lamp"></div>
          </div>
          
          <!-- ストライク (S) -->
          <div class="bso-row">
            <span class="bso-label text-yellow-400">S</span>
            <div id="lamp-s1" class="lamp"></div>
            <div id="lamp-s2" class="lamp"></div>
          </div>
          
          <!-- アウト (O) -->
          <div class="bso-row">
            <span class="bso-label text-rose-500">O</span>
            <div id="lamp-o1" class="lamp"></div>
            <div id="lamp-o2" class="lamp"></div>
          </div>
        </div>

        <!-- 中央: 走者ダイアモンド (SVG) -->
        <div class="diamond-svg-wrap">
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <!-- 塁間ライン -->
            <polygon points="50,15 85,50 50,85 15,50" 
                     fill="none" 
                     stroke="#334155" 
                     stroke-width="2" 
                     stroke-dasharray="2 2" />
            
            <!-- 本塁 (ホーム) -->
            <polygon points="50,83 55,87 55,92 45,92 45,87" 
                     fill="#94a3b8" 
                     stroke="#cbd5e1" 
                     stroke-width="1.5" />
            
            <!-- 2塁 (Second) -->
            <polygon id="base-2" class="base-indicator" points="50,10 56,16 50,22 44,16" data-base="2" />
            
            <!-- 3塁 (Third) -->
            <polygon id="base-3" class="base-indicator" points="15,44 21,50 15,56 9,50" data-base="3" />
            
            <!-- 1塁 (First) -->
            <polygon id="base-1" class="base-indicator" points="85,44 91,50 85,56 79,50" data-base="1" />
          </svg>
          <span class="absolute bottom-0 text-[9px] text-slate-400 font-bold tracking-wider">塁タップで補正</span>
        </div>

        <!-- 右側: 対戦情報（投手 / 打者） -->
        <div class="flex flex-col justify-center gap-1.5 text-xs border-l border-slate-800 pl-3 min-w-[110px]">
          <div>
            <span class="text-[10px] text-slate-400 block leading-tight">打者:</span>
            <span id="current-batter-info" class="font-bold text-slate-100 block truncate">1番 打者 (投)</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block leading-tight">投手:</span>
            <span id="current-pitcher-info" class="font-bold text-emerald-400 block truncate">先発 投手</span>
          </div>
        </div>

      </div>

      <!-- 走塁・野手ワンタップイベントバー -->
      <div class="grid grid-cols-4 gap-1.5 mt-2">
        <button type="button" id="btn-runner-steal" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold py-1.5 rounded-lg text-[11px] border border-slate-700 shadow flex items-center justify-center gap-1 transition">
          <span>🏃 盗塁</span>
        </button>
        <button type="button" id="btn-runner-caught" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold py-1.5 rounded-lg text-[11px] border border-slate-700 shadow flex items-center justify-center gap-1 transition">
          <span>❌ 盗塁刺</span>
        </button>
        <button type="button" id="btn-runner-wildpitch" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 font-bold py-1.5 rounded-lg text-[11px] border border-amber-900/50 shadow flex items-center justify-center gap-1 transition">
          <span>⚡️ 暴投進塁</span>
        </button>
        <button type="button" id="btn-runner-pickoff" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold py-1.5 rounded-lg text-[11px] border border-slate-700 shadow flex items-center justify-center gap-1 transition">
          <span>🎯 牽制死</span>
        </button>
      </div>
    `;
  }

  bindEvents() {
    // 1塁・2塁・3塁のワンタップ手動トグル
    const bases = this.container.querySelectorAll(".base-indicator");
    bases.forEach((baseEl) => {
      baseEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const baseNum = parseInt(baseEl.getAttribute("data-base"), 10);
        this.gameState.toggleRunner(baseNum);
      });
    });

    // 走塁イベントボタン群の紐付け
    const bindBtn = (id, handler) => {
      const el = this.container.querySelector(`#${id}`);
      if (el) {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          handler();
        });
      }
    };

    bindBtn("btn-runner-steal", () => this.handleSteal());
    bindBtn("btn-runner-caught", () => this.handleCaughtStealing());
    bindBtn("btn-runner-wildpitch", () => this.handleWildPitchAdvance());
    bindBtn("btn-runner-pickoff", () => this.handlePickoff());
  }

  update(state) {
    if (!state) return;

    // 1. BSOランプの点灯切り替え
    this.updateLamp("lamp-b1", state.balls >= 1, "ball-on");
    this.updateLamp("lamp-b2", state.balls >= 2, "ball-on");
    this.updateLamp("lamp-b3", state.balls >= 3, "ball-on");

    this.updateLamp("lamp-s1", state.strikes >= 1, "strike-on");
    this.updateLamp("lamp-s2", state.strikes >= 2, "strike-on");

    this.updateLamp("lamp-o1", state.outs >= 1, "out-on");
    this.updateLamp("lamp-o2", state.outs >= 2, "out-on");

    // 2. 走者ダイアモンドの点灯切り替え
    const b1 = this.container.querySelector("#base-1");
    const b2 = this.container.querySelector("#base-2");
    const b3 = this.container.querySelector("#base-3");

    if (b1) b1.classList.toggle("runner-on", Boolean(state.runners[1]));
    if (b2) b2.classList.toggle("runner-on", Boolean(state.runners[2]));
    if (b3) b3.classList.toggle("runner-on", Boolean(state.runners[3]));

    // 3. 打者・投手情報の更新
    const batterEl = this.container.querySelector("#current-batter-info");
    const pitcherEl = this.container.querySelector("#current-pitcher-info");
    if (batterEl && state.currentBatter) {
      batterEl.textContent = `${state.currentBatter.order}番 ${state.currentBatter.name} (${state.currentBatter.pos || "打"})`;
    }
    if (pitcherEl && state.currentPitcher) {
      pitcherEl.textContent = state.currentPitcher.name;
    }

    // 4. 直近投球ログの更新（#log-slot が存在する場合）
    this.renderLog(state);
  }

  updateLamp(elementId, isOn, activeClass) {
    const lamp = this.container.querySelector(`#${elementId}`);
    if (!lamp) return;
    if (isOn) {
      lamp.classList.add(activeClass);
    } else {
      lamp.classList.remove(activeClass);
    }
  }

  renderLog(state) {
    if (!this.logContainer) return;

    if (!state.history || state.history.length === 0) {
      this.logContainer.innerHTML = `
        <div class="text-slate-400 text-center py-1 text-xs">
          投球履歴はありません（1球目を投球してください）
        </div>
      `;
      return;
    }

    // 登板中投手の球数と名前を取得
    const pitcherCount = (state.currentPitcher && typeof state.currentPitcher.pitchCount === "number")
      ? state.currentPitcher.pitchCount
      : 0;
    const pitcherName = (state.currentPitcher && state.currentPitcher.name)
      ? state.currentPitcher.name
      : "投手";

    // 直近5件を逆順（最新が上）で表示
    const recent = state.history.slice(-5).reverse();
    this.logContainer.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
        <span class="text-slate-400 font-bold text-[11px]">📋 直近の投球ログ</span>
        <span class="text-emerald-400 text-[10px] font-bold font-mono">${pitcherName}: ${pitcherCount}球</span>
      </div>
      <div class="space-y-1">
        ${recent.map((item, idx) => {
          const p = item.pitchEvent;
          return `
            <div class="flex items-center justify-between text-[11px] py-0.5 px-1.5 rounded ${idx === 0 ? "bg-slate-800/80 text-white font-bold" : "text-slate-300"}">
              <span class="text-slate-400 text-[10px] w-12">${p.inningStr}</span>
              <span class="text-amber-300 font-bold">${p.course}</span>
              <span class="text-slate-200">${p.result}</span>
              <span class="text-[10px] text-slate-400">BSO: ${p.bsoBefore}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  recordRunnerAction(description, updateFn) {
    const state = this.gameState.getState();
    const snapshot = JSON.parse(JSON.stringify(state));

    updateFn(state);

    const pitchEvent = {
      pitchNum: state.pitchCount,
      inningStr: `${state.inning}回${state.isTop ? "表" : "裏"}`,
      course: "走塁",
      result: description,
      bsoBefore: `${state.balls}-${state.strikes}-${state.outs}`
    };

    state.history.push({ snapshot, pitchEvent });
    this.gameState.notify();
  }

  // 盗塁成功処理
  handleSteal() {
    this.recordRunnerAction("盗塁成功", (state) => {
      // 2塁走者がいて3塁空きなら3盗、1塁走者がいて2塁空きなら2盗
      if (state.runners[2] && !state.runners[3]) {
        state.runners[3] = true;
        state.runners[2] = false;
      } else if (state.runners[1] && !state.runners[2]) {
        state.runners[2] = true;
        state.runners[1] = false;
      }
    });
  }

  // 盗塁刺処理（進塁先の走者を消去し1アウト追加）
  handleCaughtStealing() {
    this.recordRunnerAction("盗塁刺（アウト）", (state) => {
      if (state.runners[2]) {
        state.runners[2] = false;
      } else if (state.runners[1]) {
        state.runners[1] = false;
      } else if (state.runners[3]) {
        state.runners[3] = false;
      }
      this.gameState.handleOut();
    });
  }

  // 暴投進塁処理（各走者が1つ進塁、3塁走者は生還得点）
  handleWildPitchAdvance() {
    this.recordRunnerAction("暴投進塁", (state) => {
      if (state.runners[3]) {
        state.runners[3] = false;
        this.gameState.addRun(1);
      }
      if (state.runners[2]) {
        state.runners[3] = true;
        state.runners[2] = false;
      }
      if (state.runners[1]) {
        state.runners[2] = true;
        state.runners[1] = false;
      }
    });
  }

  // 牽制死処理（走者消去し1アウト追加）
  handlePickoff() {
    this.recordRunnerAction("牽制死", (state) => {
      if (state.runners[1]) {
        state.runners[1] = false;
      } else if (state.runners[2]) {
        state.runners[2] = false;
      } else if (state.runners[3]) {
        state.runners[3] = false;
      }
      this.gameState.handleOut();
    });
  }
}
