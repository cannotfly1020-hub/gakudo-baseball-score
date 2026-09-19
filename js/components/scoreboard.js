/**
 * js/components/scoreboard.js
 * スコアボード ＆ 球数・時間制限タイマーコンポーネント
 * 
 * 担当役割:
 * - 1〜6回 ＋ TB（タイブレーク） ＋ R/H/E スコアボードの描画・更新
 * - 球数上限（60球 / 70球）のワンタップ切り替えと警告表示（残り10球: 黄、超過: 赤）
 * - 試合時間タイマー（60分 / 90分）のカウントダウン・開始・一時停止・リセット
 * - タイブレーク（無死1・2塁）突入トグル
 */

export class ScoreboardComponent {
  /**
   * @param {HTMLElement} containerElement 描画対象の親要素 (#scoreboard-slot)
   * @param {GameState} gameState 試合状態管理インスタンス
   * @param {Object} options オプション設定
   */
  constructor(containerElement, gameState, options = {}) {
    this.container = containerElement;
    this.gameState = gameState;
    this.options = options;

    // タイマーインターバルID
    this.timerInterval = null;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    // GameState の変更通知を購読して表示更新
    this.gameState.subscribe((state) => {
      this.update(state);
    });

    // 初期表示の反映
    this.update(this.gameState.getState());
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg select-none space-y-2.5">
        
        <!-- 1. ルール設定 ＆ タイマー制御バー -->
        <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 text-xs">
          <!-- 球数上限トグル (60 / 70) -->
          <div class="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <span class="text-[10px] text-slate-400 font-bold">上限球数:</span>
            <button type="button" id="btn-toggle-pitch-limit" class="text-xs font-extrabold text-amber-400 hover:text-amber-300">
              70球
            </button>
          </div>

          <!-- タイブレークトグル -->
          <button type="button" id="btn-toggle-tiebreak" class="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition">
            TB: OFF
          </button>

          <!-- 試合時間タイマー (60分 / 90分 + 開始/一時停止) -->
          <div class="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <button type="button" id="btn-toggle-time-limit" class="text-[10px] text-slate-400 font-bold hover:text-white" title="上限時間切替">
              ⏱ 90分
            </button>
            <span id="timer-display" class="font-mono font-extrabold text-xs text-emerald-400 min-w-[42px] text-center">
              90:00
            </span>
            <button type="button" id="btn-timer-toggle" class="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition">
              ▶
            </button>
            <button type="button" id="btn-timer-reset" class="text-[10px] text-slate-400 hover:text-slate-200 px-1 py-0.5" title="タイマーリセット">
              ↺
            </button>
          </div>
        </div>

        <!-- 2. 球数メーター ＆ イニング進捗 -->
        <div class="flex items-center justify-between bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <div class="flex items-center gap-2">
            <span id="display-inning" class="font-black text-amber-400 text-sm">
              1回表
            </span>
            <span class="text-slate-500">|</span>
            <span class="text-[11px] text-slate-400">先攻 攻撃中</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[11px] text-slate-400">投球数:</span>
            <div class="flex items-baseline gap-1 font-mono">
              <span id="current-pitch-count" class="text-lg font-black text-white">0</span>
              <span class="text-slate-500">/</span>
              <span id="target-pitch-limit" class="text-xs text-slate-400">70</span>
            </div>
            <span id="pitch-status-badge" class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
              順調
            </span>
          </div>
        </div>

        <!-- 3. スコアボード テーブル (1〜6回 ＋ TB ＋ R/H/E) -->
        <div class="overflow-x-auto">
          <table class="scoreboard-table">
            <thead>
              <tr>
                <th class="w-16 text-left pl-2">チーム</th>
                <th class="w-6">1</th>
                <th class="w-6">2</th>
                <th class="w-6">3</th>
                <th class="w-6">4</th>
                <th class="w-6">5</th>
                <th class="w-6">6</th>
                <th id="th-tb" class="w-7 text-amber-400">TB</th>
                <th class="w-7 text-emerald-400 font-bold">R</th>
                <th class="w-6 text-slate-400">H</th>
                <th class="w-6 text-slate-400">E</th>
              </tr>
            </thead>
            <tbody>
              <!-- 先攻 (Away) -->
              <tr id="row-away">
                <td class="text-left pl-2 font-bold text-slate-200 truncate max-w-[70px]">先攻</td>
                <td id="score-a-1">-</td>
                <td id="score-a-2">-</td>
                <td id="score-a-3">-</td>
                <td id="score-a-4">-</td>
                <td id="score-a-5">-</td>
                <td id="score-a-6">-</td>
                <td id="score-a-tb">-</td>
                <td id="score-a-r" class="text-emerald-400 font-black text-xs">0</td>
                <td id="score-a-h" class="text-slate-300">0</td>
                <td id="score-a-e" class="text-slate-400">0</td>
              </tr>
              <!-- 後攻 (Home) -->
              <tr id="row-home">
                <td class="text-left pl-2 font-bold text-slate-200 truncate max-w-[70px]">後攻</td>
                <td id="score-h-1">-</td>
                <td id="score-h-2">-</td>
                <td id="score-h-3">-</td>
                <td id="score-h-4">-</td>
                <td id="score-h-5">-</td>
                <td id="score-h-6">-</td>
                <td id="score-h-tb">-</td>
                <td id="score-h-r" class="text-emerald-400 font-black text-xs">0</td>
                <td id="score-h-h" class="text-slate-300">0</td>
                <td id="score-h-e" class="text-slate-400">0</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    `;
  }

  bindEvents() {
    // 1. 球数上限トグル (70球 ⇄ 60球)
    const btnPitchLimit = this.container.querySelector("#btn-toggle-pitch-limit");
    if (btnPitchLimit) {
      btnPitchLimit.addEventListener("click", () => {
        const state = this.gameState.getState();
        state.pitchLimit = state.pitchLimit === 70 ? 60 : 70;
        this.gameState.notify();
      });
    }

    // 2. 時間上限トグル (90分 ⇄ 60分)
    const btnTimeLimit = this.container.querySelector("#btn-toggle-time-limit");
    if (btnTimeLimit) {
      btnTimeLimit.addEventListener("click", () => {
        const state = this.gameState.getState();
        if (state.timerRunning) return; // 動作中は切替不可
        state.timeLimitMinutes = state.timeLimitMinutes === 90 ? 60 : 90;
        state.timerRemainingSeconds = state.timeLimitMinutes * 60;
        this.gameState.notify();
      });
    }

    // 3. タイマー開始 / 一時停止
    const btnTimerToggle = this.container.querySelector("#btn-timer-toggle");
    if (btnTimerToggle) {
      btnTimerToggle.addEventListener("click", () => {
        this.toggleTimer();
      });
    }

    // 4. タイマーリセット
    const btnTimerReset = this.container.querySelector("#btn-timer-reset");
    if (btnTimerReset) {
      btnTimerReset.addEventListener("click", () => {
        this.resetTimer();
      });
    }

    // 5. タイブレークトグル (無死1・2塁自動セット)
    const btnTiebreak = this.container.querySelector("#btn-toggle-tiebreak");
    if (btnTiebreak) {
      btnTiebreak.addEventListener("click", () => {
        const state = this.gameState.getState();
        state.isTieBreak = !state.isTieBreak;
        if (state.isTieBreak) {
          // タイブレーク突入時: 無死1・2塁を自動セット
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
      // 停止
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      state.timerRunning = false;
    } else {
      // 開始
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

    // 1. イニング表示更新
    const inningEl = this.container.querySelector("#display-inning");
    if (inningEl) {
      const topBottom = state.isTop ? "表" : "裏";
      inningEl.textContent = state.isTieBreak ? `TB${topBottom}` : `${state.inning}回${topBottom}`;
    }

    // 2. 球数メーター ＆ 警告ステータス更新
    this.updatePitchMeter(state);

    // 3. タイマー表示 ＆ ボタントグル更新
    this.updateTimerDisplay(state.timerRemainingSeconds);
    const btnTimeToggle = this.container.querySelector("#btn-timer-toggle");
    if (btnTimeToggle) {
      btnTimeToggle.textContent = state.timerRunning ? "⏸" : "▶";
      btnTimeToggle.className = state.timerRunning
        ? "text-[11px] bg-amber-600 hover:bg-amber-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition"
        : "text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition";
    }

    // 上限時間ラベル更新
    const btnTimeLimit = this.container.querySelector("#btn-toggle-time-limit");
    if (btnTimeLimit) {
      btnTimeLimit.textContent = `⏱ ${state.timeLimitMinutes}分`;
    }

    // 4. タイブレークボタン表示
    const btnTb = this.container.querySelector("#btn-toggle-tiebreak");
    if (btnTb) {
      if (state.isTieBreak) {
        btnTb.textContent = "TB: ON";
        btnTb.className = "text-[10px] font-extrabold px-2 py-1 rounded-lg border border-amber-500 bg-amber-950/80 text-amber-300";
      } else {
        btnTb.textContent = "TB: OFF";
        btnTb.className = "text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white";
      }
    }

    // 5. スコアボード各マスの更新
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

    // クラス初期化
    countEl.classList.remove("pitch-warning", "pitch-danger");
    badgeEl.className = "text-[9px] px-1.5 py-0.5 rounded font-bold";

    const remaining = state.pitchLimit - state.pitchCount;

    if (remaining <= 0) {
      // 球数超過: 赤アラート（点滅）
      countEl.classList.add("pitch-danger");
      badgeEl.classList.add("bg-rose-950/90", "text-rose-400", "border", "border-rose-700");
      badgeEl.textContent = "⚠️ 上限到達";
    } else if (remaining <= 10) {
      // 残り10球以内: 黄警告
      countEl.classList.add("pitch-warning");
      badgeEl.classList.add("bg-amber-950/90", "text-amber-300", "border", "border-amber-700");
      badgeEl.textContent = `残 ${remaining}球`;
    } else {
      // 順調
      badgeEl.classList.add("bg-emerald-950/80", "text-emerald-400", "border", "border-emerald-800");
      badgeEl.textContent = "順調";
    }
  }

  updateTimerDisplay(totalSeconds) {
    const timerEl = this.container.querySelector("#timer-display");
    if (!timerEl) return;

    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const str = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    timerEl.textContent = str;

    if (totalSeconds <= 300 && totalSeconds > 0) {
      // 残り5分以内は黄表示
      timerEl.className = "font-mono font-extrabold text-xs text-amber-400 min-w-[42px] text-center";
    } else if (totalSeconds === 0) {
      // タイムアップは赤表示
      timerEl.className = "font-mono font-extrabold text-xs text-rose-500 min-w-[42px] text-center";
    } else {
      timerEl.className = "font-mono font-extrabold text-xs text-emerald-400 min-w-[42px] text-center";
    }
  }

  updateScoreboardTable(state) {
    let totalAway = 0;
    let totalHome = 0;

    // 1〜6回の得点
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

    // タイブレーク得点 (7イニング目以降に該当)
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

    // 合計得点 (R) の反映
    const rAway = this.container.querySelector("#score-a-r");
    const rHome = this.container.querySelector("#score-h-r");
    if (rAway) rAway.textContent = totalAway;
    if (rHome) rHome.textContent = totalHome;
  }
}
