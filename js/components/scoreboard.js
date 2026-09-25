/**
 * js/components/scoreboard.js
 * スコアボード ＆ 球数・時間制限タイマーコンポーネント（列揃え完全固定版）
 * 
 * 改善点:
 * - table-fixed による各列幅の完全均等・固定化（文字の揺らぎによるズレをゼロに）
 * - チーム名、イニング(1〜6)、TB、R/H/E の境界線とパディングの最適化
 * - 1回裏の得点が正確に「1」のマスに反映されるよう整合
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
            <span id="display-inning" class="font-black text-amber-400 text-xs sm:text-sm">
              1回表
            </span>
            <span class="text-slate-600">|</span>
            <span id="display-attack-side" class="text-[11px] text-slate-300 font-bold">先攻 攻撃中</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span id="pitcher-name-badge" class="text-[10px] text-slate-400 font-bold truncate max-w-[80px]">投手:</span>
            <div class="flex items-baseline gap-0.5 font-mono">
              <span id="current-pitch-count" class="text-base sm:text-lg font-black text-white">0</span>
              <span class="text-slate-500 text-xs">/</span>
              <span id="target-pitch-limit" class="text-xs text-slate-400">70</span>
            </div>
            <span id="pitch-status-badge" class="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              順調
            </span>
          </div>
        </div>

        <!-- 3. スコアボード テーブル（table-fixedで列ズレを根絶） -->
        <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-1">
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
              <tr id="row-away" class="h-6 hover:bg-slate-800/30 transition">
                <td class="text-left pl-2 font-sans font-black text-slate-200 truncate text-[11px]">先攻</td>
                <td id="score-a-1" class="text-slate-300">-</td>
                <td id="score-a-2" class="text-slate-300">-</td>
                <td id="score-a-3" class="text-slate-300">-</td>
                <td id="score-a-4" class="text-slate-300">-</td>
                <td id="score-a-5" class="text-slate-300">-</td>
                <td id="score-a-6" class="text-slate-300">-</td>
                <td id="score-a-tb" class="text-amber-300">-</td>
                <td id="score-a-r" class="text-emerald-400 font-black text-xs border-l border-slate-800">0</td>
                <td id="score-a-h" class="text-slate-300 text-[11px]">0</td>
                <td id="score-a-e" class="text-slate-400 text-[11px]">0</td>
              </tr>
              <!-- 後攻 -->
              <tr id="row-home" class="h-6 hover:bg-slate-800/30 transition">
                <td class="text-left pl-2 font-sans font-black text-slate-200 truncate text-[11px]">後攻</td>
                <td id="score-h-1" class="text-slate-300">-</td>
                <td id="score-h-2" class="text-slate-300">-</td>
                <td id="score-h-3" class="text-slate-300">-</td>
                <td id="score-h-4" class="text-slate-300">-</td>
                <td id="score-h-5" class="text-slate-300">-</td>
                <td id="score-h-6" class="text-slate-300">-</td>
                <td id="score-h-tb" class="text-amber-300">-</td>
                <td id="score-h-r" class="text-emerald-400 font-black text-xs border-l border-slate-800">0</td>
                <td id="score-h-h" class="text-slate-300 text-[11px]">0</td>
                <td id="score-h-e" class="text-slate-400 text-[11px]">0</td>
              </tr>
            </tbody>
          </table>
        </div>

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
    const pitcherBadge = this.container.querySelector("#pitcher-name-badge");

    // 全体の球数ではなく「現在マウンドに立っている投手の投球数」を取得
    const pitcherCount = (state.currentPitcher && typeof state.currentPitcher.pitchCount === "number")
      ? state.currentPitcher.pitchCount
      : 0;

    if (countEl) countEl.textContent = pitcherCount;
    if (targetEl) targetEl.textContent = state.pitchLimit;
    if (limitBtn) limitBtn.textContent = `${state.pitchLimit}球`;
    if (pitcherBadge && state.currentPitcher) {
      pitcherBadge.textContent = `${state.currentPitcher.name}:`;
    }

    if (!badgeEl || !countEl) return;

    countEl.classList.remove("text-amber-400", "text-rose-500");
    badgeEl.className = "text-[9px] px-1.5 py-0.2 rounded font-bold";

    const remaining = state.pitchLimit - pitcherCount;

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

    const currentInning = state.inning || 1;
    const isTop = state.isTop !== false;
    const isTb = !!state.isTieBreak;

    for (let i = 1; i <= 6; i++) {
      const awayCell = this.container.querySelector(`#score-a-${i}`);
      const homeCell = this.container.querySelector(`#score-h-${i}`);

      // 先攻 (表): 現在の回以下のイニングのみ得点表示（未来の回は "-"）
      let aVal = "-";
      if (i <= currentInning) {
        const val = state.awayScore ? state.awayScore[i - 1] : undefined;
        aVal = val !== undefined ? val : 0;
        totalAway += Number(aVal) || 0;
      }

      // 後攻 (裏): 過去の回、または「現在の回で既に裏に入っている」場合のみ得点表示
      let hVal = "-";
      if (i < currentInning || (i === currentInning && !isTop)) {
        const val = state.homeScore ? state.homeScore[i - 1] : undefined;
        hVal = val !== undefined ? val : 0;
        totalHome += Number(hVal) || 0;
      }

      if (awayCell) awayCell.textContent = aVal;
      if (homeCell) homeCell.textContent = hVal;
    }

    const tbAwayCell = this.container.querySelector("#score-a-tb");
    const tbHomeCell = this.container.querySelector("#score-h-tb");

    let tbValA = "-";
    let tbValH = "-";

    if (isTb) {
      const valA = state.awayScore ? state.awayScore[6] : undefined;
      tbValA = valA !== undefined ? valA : 0;
      totalAway += Number(tbValA) || 0;

      if (!isTop) {
        const valH = state.homeScore ? state.homeScore[6] : undefined;
        tbValH = valH !== undefined ? valH : 0;
        totalHome += Number(tbValH) || 0;
      }
    }

    if (tbAwayCell) tbAwayCell.textContent = tbValA;
    if (tbHomeCell) tbHomeCell.textContent = tbValH;

    const rAway = this.container.querySelector("#score-a-r");
    const rHome = this.container.querySelector("#score-h-r");
    if (rAway) rAway.textContent = totalAway;
    if (rHome) rHome.textContent = totalHome;
  }
}
