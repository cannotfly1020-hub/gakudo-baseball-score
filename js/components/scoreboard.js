/**
 * js/components/scoreboard.js
 * スコアボード ＆ 球数・時間制限タイマーコンポーネント（列揃え完全固定版）
 * 
 * 改善点:
 * - table-fixed による各列幅の完全均等・固定化（文字の揺らぎによるズレをゼロに）
 * - チーム名、イニング(1〜6)、TB、R/H/E の境界線とパディングの最適化
 * - 各マス・イニング・球数タップによる直接修正モーダルを搭載
 */

export class ScoreboardComponent {
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;
    this.timerInterval = null;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    this.gameState.subscribe((state) => {
      this.update(state);
    });

    this.update(this.gameState.getState());
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-lg select-none space-y-2">
        
        <!-- 1. ルール設定 ＆ タイマー制御バー -->
        <div class="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-1.5 text-xs">
          <!-- 球数上限トグル (60 / 70) -->
          <div class="flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded-lg border border-slate-800">
            <span class="text-[10px] text-slate-400 font-bold">上限:</span>
            <button type="button" id="btn-toggle-pitch-limit" class="text-xs font-black text-amber-400 hover:text-amber-300">
              70球
            </button>
          </div>

          <!-- タイブレークトグル -->
          <button type="button" id="btn-toggle-tiebreak" class="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition">
            TB: OFF
          </button>

          <!-- 試合時間タイマー -->
          <div class="flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded-lg border border-slate-800">
            <button type="button" id="btn-toggle-time-limit" class="text-[10px] text-slate-400 font-bold hover:text-white" title="上限時間切替">
              ⏱ 90分
            </button>
            <span id="timer-display" class="font-mono font-black text-xs text-emerald-400 min-w-[38px] text-center">
              90:00
            </span>
            <button type="button" id="btn-timer-toggle" class="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition">
              ▶
            </button>
            <button type="button" id="btn-timer-reset" class="text-[10px] text-slate-400 hover:text-slate-200 px-1 py-0.5" title="リセット">
              ↺
            </button>
          </div>
        </div>

        <!-- 2. イニング ＆ 球数メーター -->
        <div class="flex items-center justify-between bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
          <div class="flex items-center gap-2">
            <button type="button" id="display-inning" class="font-black text-amber-400 text-xs sm:text-sm hover:underline cursor-pointer flex items-center gap-1" title="タップしてイニング変更">
              <span>1回表</span>
              <span class="text-[9px] text-slate-500 font-normal">✎</span>
            </button>
            <span class="text-slate-600">|</span>
            <span id="display-attack-side" class="text-[11px] text-slate-300 font-bold">先攻 攻撃中</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-[10px] text-slate-400">投球数:</span>
            <button type="button" id="btn-edit-pitch-count" class="flex items-baseline gap-0.5 font-mono hover:bg-slate-800 px-1 rounded transition" title="タップして球数を直接補正">
              <span id="current-pitch-count" class="text-base sm:text-lg font-black text-white">0</span>
              <span class="text-slate-500 text-xs">/</span>
              <span id="target-pitch-limit" class="text-xs text-slate-400">70</span>
              <span class="text-[9px] text-slate-500 ml-0.5 font-sans">✎</span>
            </button>
            <span id="pitch-status-badge" class="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              順調
            </span>
          </div>
        </div>

        <!-- 3. スコアボード テーブル（クリックして得点を直接編集可能） -->
        <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-1">
          <div class="text-[9px] text-slate-500 pb-0.5 px-1 flex items-center justify-between">
            <span>※ 各マスをタップして得点を直接修正できます</span>
          </div>
          <table class="w-full table-fixed border-collapse text-center text-xs">
            <thead>
              <tr class="text-[10px] text-slate-400 border-b border-slate-800 h-6">
                <th class="w-[18%] text-left pl-2 font-bold">チーム</th>
                <th class="w-[7%]">1</th>
                <th class="w-[7%]">2</th>
                <th class="w-[7%]">3</th>
                <th class="w-[7%]">4</th>
                <th class="w-[7%]">5</th>
                <th class="w-[7%]">6</th>
                <th class="w-[8%] text-amber-400 font-bold">TB</th>
                <th class="w-[9%] text-emerald-400 font-black border-l border-slate-800">R</th>
                <th class="w-[8%] text-slate-400">H</th>
                <th class="w-[8%] text-slate-400">E</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80 font-mono">
              <!-- 先攻 -->
              <tr id="row-away" class="h-6">
                <td class="text-left pl-2 font-sans font-black text-slate-200 truncate text-[11px]">先攻</td>
                <td id="score-a-1" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="away" data-col="0">-</td>
                <td id="score-a-2" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="away" data-col="1">-</td>
                <td id="score-a-3" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="away" data-col="2">-</td>
                <td id="score-a-4" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="away" data-col="3">-</td>
                <td id="score-a-5" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="away" data-col="4">-</td>
                <td id="score-a-6" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="away" data-col="5">-</td>
                <td id="score-a-tb" class="score-cell cursor-pointer hover:bg-amber-900/40 text-amber-300 transition" data-team="away" data-col="6">-</td>
                <td id="score-a-r" class="text-emerald-400 font-black text-xs border-l border-slate-800">0</td>
                <td id="score-a-h" class="text-slate-300 text-[11px]">0</td>
                <td id="score-a-e" class="text-slate-400 text-[11px]">0</td>
              </tr>
              <!-- 後攻 -->
              <tr id="row-home" class="h-6">
                <td class="text-left pl-2 font-sans font-black text-slate-200 truncate text-[11px]">後攻</td>
                <td id="score-h-1" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="home" data-col="0">-</td>
                <td id="score-h-2" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="home" data-col="1">-</td>
                <td id="score-h-3" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="home" data-col="2">-</td>
                <td id="score-h-4" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="home" data-col="3">-</td>
                <td id="score-h-5" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="home" data-col="4">-</td>
                <td id="score-h-6" class="score-cell cursor-pointer hover:bg-slate-700/50 text-slate-300 transition" data-team="home" data-col="5">-</td>
                <td id="score-h-tb" class="score-cell cursor-pointer hover:bg-amber-900/40 text-amber-300 transition" data-team="home" data-col="6">-</td>
                <td id="score-h-r" class="text-emerald-400 font-black text-xs border-l border-slate-800">0</td>
                <td id="score-h-h" class="text-slate-300 text-[11px]">0</td>
                <td id="score-h-e" class="text-slate-400 text-[11px]">0</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 修正用ダイアログスロット -->
        <div id="scoreboard-modal-slot" class="hidden"></div>
      </div>
    `;
  }

  bindEvents() {
    const btnPitchLimit = this.container.querySelector("#btn-toggle-pitch-limit");
    if (btnPitchLimit) {
      btnPitchLimit.addEventListener("click", () => {
        const state = this.gameState.getState();
        state.pitchLimit = state.pitchLimit === 70 ? 60 : 70;
        this.gameState.notify();
      });
    }

    const btnTimeLimit = this.container.querySelector("#btn-toggle-time-limit");
    if (btnTimeLimit) {
      btnTimeLimit.addEventListener("click", () => {
        const state = this.gameState.getState();
        if (state.timerRunning) return;
        state.timeLimitMinutes = state.timeLimitMinutes === 90 ? 60 : 90;
        state.timerRemainingSeconds = state.timeLimitMinutes * 60;
        this.gameState.notify();
      });
    }

    const btnTimerToggle = this.container.querySelector("#btn-timer-toggle");
    if (btnTimerToggle) {
      btnTimerToggle.addEventListener("click", () => this.toggleTimer());
    }

    const btnTimerReset = this.container.querySelector("#btn-timer-reset");
    if (btnTimerReset) {
      btnTimerReset.addEventListener("click", () => this.resetTimer());
    }

    const btnTiebreak = this.container.querySelector("#btn-toggle-tiebreak");
    if (btnTiebreak) {
      btnTiebreak.addEventListener("click", () => {
        const state = this.gameState.getState();
        state.isTieBreak = !state.isTieBreak;
        if (state.isTieBreak) {
          state.runners[1] = true;
          state.runners[2] = true;
        }
        this.gameState.notify();
      });
    }

    // スコアセルのタップで直接得点修正
    this.container.querySelectorAll(".score-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        const isTop = cell.getAttribute("data-team") === "away";
        const colIdx = parseInt(cell.getAttribute("data-col"), 10);
        this.openScoreEditModal(isTop, colIdx);
      });
    });

    // イニング表示タップでイニング変更
    const inningBtn = this.container.querySelector("#display-inning");
    if (inningBtn) {
      inningBtn.addEventListener("click", () => this.openInningEditModal());
    }

    // 球数表示タップで球数補正
    const pitchBtn = this.container.querySelector("#btn-edit-pitch-count");
    if (pitchBtn) {
      pitchBtn.addEventListener("click", () => this.openPitchEditModal());
    }
  }

  openScoreEditModal(isTop, colIdx) {
    const modalSlot = this.container.querySelector("#scoreboard-modal-slot");
    if (!modalSlot) return;

    const teamLabel = isTop ? "先攻" : "後攻";
    const inningLabel = colIdx === 6 ? "タイブレーク(TB)" : `${colIdx + 1}回`;
    const state = this.gameState.getState();
    const currentVal = isTop ? (state.awayScore[colIdx] || 0) : (state.homeScore[colIdx] || 0);

    modalSlot.innerHTML = `
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 select-none">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-xs space-y-3 shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="text-xs font-black text-amber-400">✎ 得点修正: ${inningLabel} (${teamLabel})</span>
            <button type="button" id="btn-close-score-modal" class="text-slate-400 hover:text-white text-base">✕</button>
          </div>
          
          <div class="text-center">
            <span class="text-xs text-slate-400 block mb-1">現在の得点</span>
            <div class="flex items-center justify-center gap-3">
              <button type="button" id="btn-score-minus" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-lg font-black text-white active:scale-95 transition">-</button>
              <span id="score-modal-val" class="font-mono text-3xl font-black text-emerald-400 w-12 text-center">${currentVal}</span>
              <button type="button" id="btn-score-plus" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-lg font-black text-white active:scale-95 transition">+</button>
            </div>
          </div>

          <div class="grid grid-cols-5 gap-1.5 pt-1">
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `
              <button type="button" class="btn-quick-score bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold py-1.5 rounded-lg text-xs" data-n="${n}">${n}</button>
            `).join("")}
          </div>

          <div class="flex gap-2 pt-2 border-t border-slate-800">
            <button type="button" id="btn-cancel-score-edit" class="w-1/2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs">キャンセル</button>
            <button type="button" id="btn-save-score-edit" class="w-1/2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow">確定する</button>
          </div>
        </div>
      </div>
    `;
    modalSlot.classList.remove("hidden");

    let val = currentVal;
    const valEl = modalSlot.querySelector("#score-modal-val");
    const close = () => modalSlot.classList.add("hidden");

    modalSlot.querySelector("#btn-close-score-modal").addEventListener("click", close);
    modalSlot.querySelector("#btn-cancel-score-edit").addEventListener("click", close);

    modalSlot.querySelector("#btn-score-minus").addEventListener("click", () => {
      val = Math.max(0, val - 1);
      valEl.textContent = val;
    });
    modalSlot.querySelector("#btn-score-plus").addEventListener("click", () => {
      val += 1;
      valEl.textContent = val;
    });

    modalSlot.querySelectorAll(".btn-quick-score").forEach(b => {
      b.addEventListener("click", () => {
        val = parseInt(b.getAttribute("data-n"), 10);
        valEl.textContent = val;
      });
    });

    modalSlot.querySelector("#btn-save-score-edit").addEventListener("click", () => {
      this.gameState.setInningScore(isTop, colIdx, val);
      close();
    });
  }

  openInningEditModal() {
    const modalSlot = this.container.querySelector("#scoreboard-modal-slot");
    if (!modalSlot) return;

    const state = this.gameState.getState();

    modalSlot.innerHTML = `
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 select-none">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-xs space-y-3 shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="text-xs font-black text-amber-400">✎ イニング・表裏の手動変更</span>
            <button type="button" id="btn-close-inn-modal" class="text-slate-400 hover:text-white text-base">✕</button>
          </div>

          <div class="space-y-2">
            <label class="text-xs text-slate-300 block font-bold">イニング選択:</label>
            <div class="grid grid-cols-6 gap-1" id="group-inn-nums">
              ${[1, 2, 3, 4, 5, 6].map(i => `
                <button type="button" class="btn-sel-inn py-2 rounded-lg font-mono font-black text-xs ${i === state.inning ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"}" data-inn="${i}">${i}回</button>
              `).join("")}
            </div>
            
            <label class="text-xs text-slate-300 block font-bold pt-2">攻撃側選択:</label>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" id="btn-sel-top" class="py-2 rounded-xl text-xs font-black ${state.isTop ? "bg-sky-600 text-white ring-2 ring-white" : "bg-slate-800 text-slate-400"}">表 (先攻 攻撃)</button>
              <button type="button" id="btn-sel-bottom" class="py-2 rounded-xl text-xs font-black ${!state.isTop ? "bg-amber-600 text-white ring-2 ring-white" : "bg-slate-800 text-slate-400"}">裏 (後攻 攻撃)</button>
            </div>
          </div>

          <div class="flex gap-2 pt-2 border-t border-slate-800">
            <button type="button" id="btn-cancel-inn" class="w-1/2 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">キャンセル</button>
            <button type="button" id="btn-save-inn" class="w-1/2 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs shadow">確定する</button>
          </div>
        </div>
      </div>
    `;
    modalSlot.classList.remove("hidden");

    let selInning = state.inning;
    let selTop = state.isTop;
    const close = () => modalSlot.classList.add("hidden");

    modalSlot.querySelector("#btn-close-inn-modal").addEventListener("click", close);
    modalSlot.querySelector("#btn-cancel-inn").addEventListener("click", close);

    modalSlot.querySelectorAll(".btn-sel-inn").forEach(b => {
      b.addEventListener("click", () => {
        modalSlot.querySelectorAll(".btn-sel-inn").forEach(x => x.className = "btn-sel-inn py-2 rounded-lg font-mono font-black text-xs bg-slate-800 text-slate-300");
        b.className = "btn-sel-inn py-2 rounded-lg font-mono font-black text-xs bg-amber-500 text-slate-950";
        selInning = parseInt(b.getAttribute("data-inn"), 10);
      });
    });

    const btnTop = modalSlot.querySelector("#btn-sel-top");
    const btnBottom = modalSlot.querySelector("#btn-sel-bottom");
    btnTop.addEventListener("click", () => {
      selTop = true;
      btnTop.className = "py-2 rounded-xl text-xs font-black bg-sky-600 text-white ring-2 ring-white";
      btnBottom.className = "py-2 rounded-xl text-xs font-black bg-slate-800 text-slate-400";
    });
    btnBottom.addEventListener("click", () => {
      selTop = false;
      btnBottom.className = "py-2 rounded-xl text-xs font-black bg-amber-600 text-white ring-2 ring-white";
      btnTop.className = "py-2 rounded-xl text-xs font-black bg-slate-800 text-slate-400";
    });

    modalSlot.querySelector("#btn-save-inn").addEventListener("click", () => {
      this.gameState.setInning(selInning, selTop);
      close();
    });
  }

  openPitchEditModal() {
    const modalSlot = this.container.querySelector("#scoreboard-modal-slot");
    if (!modalSlot) return;

    const state = this.gameState.getState();
    let currentCount = state.pitchCount;

    modalSlot.innerHTML = `
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 select-none">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-xs space-y-3 shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="text-xs font-black text-amber-400">✎ 投球数カウント直接補正</span>
            <button type="button" id="btn-close-pitch-modal" class="text-slate-400 hover:text-white text-base">✕</button>
          </div>

          <div class="text-center space-y-2">
            <span class="text-xs text-slate-400 block">現在の投球数</span>
            <div class="flex items-center justify-center gap-3">
              <button type="button" id="btn-pitch-minus" class="w-10 h-10 rounded-xl bg-slate-800 text-lg font-black text-white active:scale-95">-</button>
              <span id="pitch-modal-val" class="font-mono text-3xl font-black text-amber-400 w-16 text-center">${currentCount}</span>
              <button type="button" id="btn-pitch-plus" class="w-10 h-10 rounded-xl bg-slate-800 text-lg font-black text-white active:scale-95">+</button>
            </div>
            <div class="flex justify-center gap-1.5 pt-1">
              <button type="button" class="btn-add-p bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-xs text-slate-300 font-bold" data-v="-5">-5</button>
              <button type="button" class="btn-add-p bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-xs text-slate-300 font-bold" data-v="-1">-1</button>
              <button type="button" class="btn-add-p bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-xs text-slate-300 font-bold" data-v="1">+1</button>
              <button type="button" class="btn-add-p bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-xs text-slate-300 font-bold" data-v="5">+5</button>
            </div>
          </div>

          <div class="flex gap-2 pt-2 border-t border-slate-800">
            <button type="button" id="btn-cancel-pitch" class="w-1/2 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">キャンセル</button>
            <button type="button" id="btn-save-pitch" class="w-1/2 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs shadow">確定する</button>
          </div>
        </div>
      </div>
    `;
    modalSlot.classList.remove("hidden");

    const valEl = modalSlot.querySelector("#pitch-modal-val");
    const close = () => modalSlot.classList.add("hidden");

    modalSlot.querySelector("#btn-close-pitch-modal").addEventListener("click", close);
    modalSlot.querySelector("#btn-cancel-pitch").addEventListener("click", close);

    modalSlot.querySelector("#btn-pitch-minus").addEventListener("click", () => {
      currentCount = Math.max(0, currentCount - 1);
      valEl.textContent = currentCount;
    });
    modalSlot.querySelector("#btn-pitch-plus").addEventListener("click", () => {
      currentCount += 1;
      valEl.textContent = currentCount;
    });

    modalSlot.querySelectorAll(".btn-add-p").forEach(b => {
      b.addEventListener("click", () => {
        const diff = parseInt(b.getAttribute("data-v"), 10);
        currentCount = Math.max(0, currentCount + diff);
        valEl.textContent = currentCount;
      });
    });

    modalSlot.querySelector("#btn-save-pitch").addEventListener("click", () => {
      this.gameState.setPitchCount(currentCount);
      close();
    });
  }

  toggleTimer() {
    const state = this.gameState.getState();
    if (state.timerRunning) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      state.timerRunning = false;
    } else {
      state.timerRunning = true;
      this.timerInterval = setInterval(() => {
        if (state.timerRemainingSeconds > 0) {
          state.timerRemainingSeconds -= 1;
          this.updateTimerDisplay(state.timerRemainingSeconds);
        } else {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          state.timerRunning = false;
          this.gameState.notify();
        }
      }, 1000);
    }
    this.gameState.notify();
  }

  resetTimer() {
    const state = this.gameState.getState();
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    state.timerRunning = false;
    state.timerRemainingSeconds = state.timeLimitMinutes * 60;
    this.gameState.notify();
  }

  update(state) {
    if (!state) return;

    // イニング表示 ＆ 攻撃チーム
    const inningEl = this.container.querySelector("#display-inning");
    const attackEl = this.container.querySelector("#display-attack-side");
    if (inningEl) {
      const topBottom = state.isTop ? "表" : "裏";
      inningEl.textContent = state.isTieBreak ? `TB${topBottom}` : `${state.inning}回${topBottom}`;
    }
    if (attackEl) {
      attackEl.textContent = state.isTop ? "先攻 攻撃中" : "後攻 攻撃中";
      attackEl.className = state.isTop ? "text-[11px] text-sky-400 font-bold" : "text-[11px] text-amber-400 font-bold";
    }

    this.updatePitchMeter(state);
    this.updateTimerDisplay(state.timerRemainingSeconds);

    const btnTimeToggle = this.container.querySelector("#btn-timer-toggle");
    if (btnTimeToggle) {
      btnTimeToggle.textContent = state.timerRunning ? "⏸" : "▶";
      btnTimeToggle.className = state.timerRunning
        ? "text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition"
        : "text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition";
    }

    const btnTb = this.container.querySelector("#btn-toggle-tiebreak");
    if (btnTb) {
      if (state.isTieBreak) {
        btnTb.textContent = "TB: ON";
        btnTb.className = "text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-500 bg-amber-950 text-amber-300";
      } else {
        btnTb.textContent = "TB: OFF";
        btnTb.className = "text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white";
      }
    }

    this.updateScoreboardTable(state);
  }

  updatePitchMeter(state) {
    const countEl = this.container.querySelector("#current-pitch-count");
    const targetEl = this.container.querySelector("#target-pitch-limit");
    const limitBtn = this.container.querySelector("#btn-toggle-pitch-limit");
    const badgeEl = this.container.querySelector("#pitch-status-badge");

    if (countEl) countEl.textContent = state.pitchCount;
    if (targetEl) targetEl.textContent = state.pitchLimit;
    if (limitBtn) limitBtn.textContent = `${state.pitchLimit}球`;

    if (!badgeEl || !countEl) return;

    countEl.classList.remove("text-amber-400", "text-rose-500");
    badgeEl.className = "text-[9px] px-1.5 py-0.2 rounded font-bold";

    const remaining = state.pitchLimit - state.pitchCount;

    if (remaining <= 0) {
      countEl.classList.add("text-rose-500");
      badgeEl.classList.add("bg-rose-950", "text-rose-400", "border", "border-rose-700");
      badgeEl.textContent = "⚠️ 上限到達";
    } else if (remaining <= 10) {
      countEl.classList.add("text-amber-400");
      badgeEl.classList.add("bg-amber-950", "text-amber-300", "border", "border-amber-700");
      badgeEl.textContent = `残 ${remaining}球`;
    } else {
      badgeEl.classList.add("bg-emerald-950", "text-emerald-400", "border", "border-emerald-800");
      badgeEl.textContent = "順調";
    }
  }

  updateTimerDisplay(totalSeconds) {
    const timerEl = this.container.querySelector("#timer-display");
    if (!timerEl) return;

    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    timerEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  updateScoreboardTable(state) {
    let totalAway = 0;
    let totalHome = 0;

    for (let i = 1; i <= 6; i++) {
      const awayCell = this.container.querySelector(`#score-a-${i}`);
      const homeCell = this.container.querySelector(`#score-h-${i}`);

      const aVal = state.awayScore[i - 1];
      const hVal = state.homeScore[i - 1];

      if (awayCell) {
        awayCell.textContent = aVal !== undefined ? aVal : "-";
        if (aVal !== undefined) totalAway += aVal;
      }

      if (homeCell) {
        homeCell.textContent = hVal !== undefined ? hVal : "-";
        if (hVal !== undefined) totalHome += hVal;
      }
    }

    const tbAwayCell = this.container.querySelector("#score-a-tb");
    const tbHomeCell = this.container.querySelector("#score-h-tb");
    const tbValA = state.awayScore[6];
    const tbValH = state.homeScore[6];

    if (tbAwayCell) {
      tbAwayCell.textContent = tbValA !== undefined ? tbValA : "-";
      if (tbValA !== undefined) totalAway += tbValA;
    }
    if (tbHomeCell) {
      tbHomeCell.textContent = tbValH !== undefined ? tbValH : "-";
      if (tbValH !== undefined) totalHome += tbValH;
    }

    const rAway = this.container.querySelector("#score-a-r");
    const rHome = this.container.querySelector("#score-h-r");
    if (rAway) rAway.textContent = totalAway;
    if (rHome) rHome.textContent = totalHome;
  }
}
