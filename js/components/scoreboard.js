/
​js/components/scoreboard.js
​スコアボード ＆ 球数・時間制限タイマーコンポーネント（列揃え完全固定 ＆ リカバリー直接修正対応版）
*/
​export class ScoreboardComponent {
constructor(containerElement, gameState, options = {}) {
this.container = containerElement;
this.gameState = gameState;
this.options = options;
this.timerInterval = null;
​this.init();
}
​init() {
this.render();
this.bindEvents();
​this.gameState.subscribe((state) => {
this.update(state);
});
​this.update(this.gameState.getState());
}
​render() {
this.container.innerHTML = `
<div class="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-lg select-none space-y-2">
​<!-- 1. ルール設定 ＆ タイマー制御バー -->
<div class="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-1.5 text-xs">
<!-- 球数上限トグル (60 / 70) -->
<div class="flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded-lg border border-slate-800">
<span class="text-[10px] text-slate-400 font-bold">上限:</span>
<button type="button" id="btn-toggle-pitch-limit" class="text-xs font-black text-amber-400 hover:text-amber-300">
70球
</button>
</div>
​<!-- タイブレークトグル -->
<button type="button" id="btn-toggle-tiebreak" class="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition">
TB: OFF
</button>
​<!-- 試合時間タイマー -->
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
​<!-- 2. イニング ＆ 球数メーター -->
<div class="flex items-center justify-between bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
<div class="flex items-center gap-2">
<button type="button" id="display-inning" class="font-black text-amber-400 text-xs sm:text-sm hover:underline active:scale-95" title="タップしてイニング変更">
1回表
</button>
<span class="text-slate-600">|</span>
<span id="display-attack-side" class="text-[11px] text-slate-300 font-bold">先攻 攻撃中</span>
</div>
​<div class="flex items-center gap-1.5">
<span class="text-[10px] text-slate-400">投球数:</span>
<button type="button" id="btn-edit-pitch-count" class="flex items-baseline gap-0.5 font-mono hover:bg-slate-800/60 px-1 rounded transition" title="タップして球数修正">
<span id="current-pitch-count" class="text-base sm:text-lg font-black text-white">0</span>
<span class="text-slate-500 text-xs">/</span>
<span id="target-pitch-limit" class="text-xs text-slate-400">70</span>
</button>
<span id="pitch-status-badge" class="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
順調
</span>
</div>
</div>
​<!-- 3. スコアボード テーブル（table-fixedで列ズレを根絶） -->
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
<td id="score-a-1" data-top="true" data-idx="0" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-a-2" data-top="true" data-idx="1" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-a-3" data-top="true" data-idx="2" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-a-4" data-top="true" data-idx="3" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-a-5" data-top="true" data-idx="4" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-a-6" data-top="true" data-idx="5" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-a-tb" data-top="true" data-idx="6" class="score-cell text-amber-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-a-r" class="text-emerald-400 font-black text-xs border-l border-slate-800">0</td>
<td id="score-a-h" class="text-slate-300 text-[11px]">0</td>
<td id="score-a-e" class="text-slate-400 text-[11px]">0</td>
</tr>
<!-- 後攻 -->
<tr id="row-home" class="h-6 hover:bg-slate-800/30 transition">
<td class="text-left pl-2 font-sans font-black text-slate-200 truncate text-[11px]">後攻</td>
<td id="score-h-1" data-top="false" data-idx="0" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-h-2" data-top="false" data-idx="1" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-h-3" data-top="false" data-idx="2" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-h-4" data-top="false" data-idx="3" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-h-5" data-top="false" data-idx="4" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-h-6" data-top="false" data-idx="5" class="score-cell text-slate-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-h-tb" data-top="false" data-idx="6" class="score-cell text-amber-300 cursor-pointer hover:bg-slate-800/80">-</td>
<td id="score-h-r" class="text-emerald-400 font-black text-xs border-l border-slate-800">0</td>
<td id="score-h-h" class="text-slate-300 text-[11px]">0</td>
<td id="score-h-e" class="text-slate-400 text-[11px]">0</td>
</tr>
</tbody>
</table>
</div>
​</div>
`;
}
​bindEvents() {
const btnPitchLimit = this.container.querySelector("#btn-toggle-pitch-limit");
if (btnPitchLimit) {
btnPitchLimit.addEventListener("click", () => {
const state = this.gameState.getState();
state.pitchLimit = state.pitchLimit === 70 ? 60 : 70;
this.gameState.notify();
});
}
​const btnTimeLimit = this.container.querySelector("#btn-toggle-time-limit");
if (btnTimeLimit) {
btnTimeLimit.addEventListener("click", () => {
const state = this.gameState.getState();
if (state.timerRunning) return;
state.timeLimitMinutes = state.timeLimitMinutes === 90 ? 60 : 90;
state.timerRemainingSeconds = state.timeLimitMinutes * 60;
this.gameState.notify();
});
}
​const btnTimerToggle = this.container.querySelector("#btn-timer-toggle");
if (btnTimerToggle) {
btnTimerToggle.addEventListener("click", () => this.toggleTimer());
}
​const btnTimerReset = this.container.querySelector("#btn-timer-reset");
if (btnTimerReset) {
btnTimerReset.addEventListener("click", () => this.resetTimer());
}
​const btnTiebreak = this.container.querySelector("#btn-toggle-tiebreak");
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
​// リカバリー1: スコアマスの直接タップによる点数修正
const scoreCells = this.container.querySelectorAll(".score-cell");
scoreCells.forEach((cell) => {
cell.addEventListener("click", () => {
const isTop = cell.getAttribute("data-top") === "true";
const idx = parseInt(cell.getAttribute("data-idx"), 10);
const teamName = isTop ? "先攻" : "後攻";
const inningName = idx === 6 ? "タイブレーク(TB)" : ${idx + 1}回;
​const currentVal = cell.textContent === "-" ? 0 : cell.textContent;
const input = window.prompt(${teamName} ${inningName}の得点を入力してください:, currentVal);
​if (input !== null && input.trim() !== "") {
const score = parseInt(input.trim(), 10);
if (!isNaN(score) && score >= 0) {
if (typeof this.gameState.setScore === "function") {
this.gameState.setScore(isTop, idx, score);
}
}
}
});
});
​// リカバリー2: 投球数メーターの直接タップによる球数補正
const btnEditPitch = this.container.querySelector("#btn-edit-pitch-count");
if (btnEditPitch) {
btnEditPitch.addEventListener("click", () => {
const state = this.gameState.getState();
const input = window.prompt("修正後の投球数を入力してください:", state.pitchCount);
if (input !== null && input.trim() !== "") {
const count = parseInt(input.trim(), 10);
if (!isNaN(count) && count >= 0) {
if (typeof this.gameState.setPitchCount === "function") {
this.gameState.setPitchCount(count);
}
}
}
});
}
​// リカバリー3: イニング表示のタップによる回数・表裏の手動切替
const inningDisplay = this.container.querySelector("#display-inning");
if (inningDisplay) {
inningDisplay.addEventListener("click", () => {
const state = this.gameState.getState();
const currentInningStr = ${state.inning}${state.isTop ? "表" : "裏"};
const input = window.prompt("変更先のイニングを入力してください（例: 2表, 3裏）:", currentInningStr);
​if (input) {
const trimmed = input.trim();
const match = trimmed.match(/^(\d+)(表|裏)$/);
if (match) {
const inningNum = parseInt(match[1], 10);
const isTop = match[2] === "表";
if (typeof this.gameState.setInning === "function") {
this.gameState.setInning(inningNum, isTop);
}
} else {
alert("入力形式が正しくありません。「1表」や「2裏」のように入力してください。");
}
}
});
}
}
​toggleTimer() {
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
​resetTimer() {
const state = this.gameState.getState();
clearInterval(this.timerInterval);
this.timerInterval = null;
state.timerRunning = false;
state.timerRemainingSeconds = state.timeLimitMinutes * 60;
this.gameState.notify();
}
​update(state) {
if (!state) return;
​// イニング表示 ＆ 攻撃チーム
const inningEl = this.container.querySelector("#display-inning");
const attackEl = this.container.querySelector("#display-attack-side");
if (inningEl) {
const topBottom = state.isTop ? "表" : "裏";
inningEl.textContent = state.isTieBreak ? TB${topBottom} : ${state.inning}回${topBottom};
}
if (attackEl) {
attackEl.textContent = state.isTop ? "先攻 攻撃中" : "後攻 攻撃中";
attackEl.className = state.isTop ? "text-[11px] text-sky-400 font-bold" : "text-[11px] text-amber-400 font-bold";
}
​this.updatePitchMeter(state);
this.updateTimerDisplay(state.timerRemainingSeconds);
​const btnTimeToggle = this.container.querySelector("#btn-timer-toggle");
if (btnTimeToggle) {
btnTimeToggle.textContent = state.timerRunning ? "⏸" : "▶";
btnTimeToggle.className = state.timerRunning
? "text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition"
: "text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-1.5 py-0.5 rounded active:scale-95 transition";
}
​const btnTb = this.container.querySelector("#btn-toggle-tiebreak");
if (btnTb) {
if (state.isTieBreak) {
btnTb.textContent = "TB: ON";
btnTb.className = "text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-500 bg-amber-950 text-amber-300";
} else {
btnTb.textContent = "TB: OFF";
btnTb.className = "text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white";
}
}
​this.updateScoreboardTable(state);
}
​updatePitchMeter(state) {
const countEl = this.container.querySelector("#current-pitch-count");
const targetEl = this.container.querySelector("#target-pitch-limit");
const limitBtn = this.container.querySelector("#btn-toggle-pitch-limit");
const badgeEl = this.container.querySelector("#pitch-status-badge");
​if (countEl) countEl.textContent = state.pitchCount;
if (targetEl) targetEl.textContent = state.pitchLimit;
if (limitBtn) limitBtn.textContent = ${state.pitchLimit}球;
​if (!badgeEl || !countEl) return;
​countEl.classList.remove("text-amber-400", "text-rose-500");
badgeEl.className = "text-[9px] px-1.5 py-0.2 rounded font-bold";
​const remaining = state.pitchLimit - state.pitchCount;
​if (remaining <= 0) {
countEl.classList.add("text-rose-500");
badgeEl.classList.add("bg-rose-950", "text-rose-400", "border", "border-rose-700");
badgeEl.textContent = "⚠️ 上限到達";
} else if (remaining <= 10) {
countEl.classList.add("text-amber-400");
badgeEl.classList.add("bg-amber-950", "text-amber-300", "border", "border-amber-700");
badgeEl.textContent = 残 ${remaining}球;
} else {
badgeEl.classList.add("bg-emerald-950", "text-emerald-400", "border", "border-emerald-800");
badgeEl.textContent = "順調";
}
}
​updateTimerDisplay(totalSeconds) {
const timerEl = this.container.querySelector("#timer-display");
if (!timerEl) return;
​const m = Math.floor(totalSeconds / 60);
const s = totalSeconds % 60;
timerEl.textContent = ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")};
}
​/
​現在のイニング進捗に基づき、未攻撃マスには「-」、攻撃済みマスには数値を厳密描画
*/
updateScoreboardTable(state) {
let totalAway = 0;
let totalHome = 0;
​const currentInningIdx = state.inning - 1;
​for (let i = 1; i <= 6; i++) {
const idx = i - 1;
const awayCell = this.container.querySelector(#score-a-${i});
const homeCell = this.container.querySelector(#score-h-${i});
​// 先攻: 現在のイニング以上で、まだ一度も到達していないイニングは「-」
const isAwayPlayed = idx < currentInningIdx || (idx === currentInningIdx);
// 後攻: 過去イニング、または現在イニングで既に裏に入っている場合は表示
const isHomePlayed = idx < currentInningIdx || (idx === currentInningIdx && !state.isTop);
​if (awayCell) {
if (isAwayPlayed && state.awayScore[idx] !== undefined) {
const val = state.awayScore[idx];
awayCell.textContent = val;
totalAway += val;
awayCell.classList.add("font-bold");
} else {
awayCell.textContent = "-";
awayCell.classList.remove("font-bold");
}
}
​if (homeCell) {
if (isHomePlayed && state.homeScore[idx] !== undefined) {
const val = state.homeScore[idx];
homeCell.textContent = val;
totalHome += val;
homeCell.classList.add("font-bold");
} else {
homeCell.textContent = "-";
homeCell.classList.remove("font-bold");
}
}
}
​// タイブレーク (インデックス 6)
const tbAwayCell = this.container.querySelector("#score-a-tb");
const tbHomeCell = this.container.querySelector("#score-h-tb");
const tbPlayedAway = state.isTieBreak || state.awayScore.length > 6;
const tbPlayedHome = (state.isTieBreak && !state.isTop) || state.homeScore.length > 6;
​if (tbAwayCell) {
if (tbPlayedAway && state.awayScore[6] !== undefined) {
const val = state.awayScore[6];
tbAwayCell.textContent = val;
totalAway += val;
} else {
tbAwayCell.textContent = "-";
}
}
​if (tbHomeCell) {
if (tbPlayedHome && state.homeScore[6] !== undefined) {
const val = state.homeScore[6];
tbHomeCell.textContent = val;
totalHome += val;
} else {
tbHomeCell.textContent = "-";
}
}
​// 合計得点 (R)
const rAway = this.container.querySelector("#score-a-r");
const rHome = this.container.querySelector("#score-h-r");
if (rAway) rAway.textContent = totalAway;
if (rHome) rHome.textContent = totalHome;
}
}
