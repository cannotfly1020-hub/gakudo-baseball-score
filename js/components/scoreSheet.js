/

js/components/scoreSheet.js

学童野球 公式戦記録サマリーシート（A4 印刷・PDF保存対応コンポーネント）

改善点:

打順・守備・番号・氏名列の横幅をコンパクトに最適化

個人成績欄に「犠打」「犠飛」を独立追加し、打数・安打・打点・四死・三振をゆったりと視認性高く配置

A4横印刷時にも文字潰れや改行を起こさない厳密な列幅比率
*/

export class ScoreSheetComponent {
constructor(containerElement, gameState) {
this.container = containerElement;
this.gameState = gameState;
this.selectedTeam = "away"; // "away" (先攻) または "home" (後攻)

this.init();


}

init() {
this.render();
this.bindEvents();
}

render() {
this.container.innerHTML = `


    <!-- 操作アクションバー (印刷時は非表示) -->
    <div class="print:hidden w-full max-w-5xl mb-2 flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-2xl shadow-xl">
      <div class="flex items-center gap-2">
        <span class="text-base sm:text-lg">📄</span>
        <h2 class="text-xs sm:text-sm font-black text-slate-100">公式戦 記録サマリーシート</h2>
        
        <!-- チーム表示切替 -->
        <div class="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs ml-2">
          <button type="button" id="sheet-team-away" class="px-2.5 py-1 rounded font-bold transition ${
            this.selectedTeam === "away" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
          }">
            先攻シート
          </button>
          <button type="button" id="sheet-team-home" class="px-2.5 py-1 rounded font-bold transition ${
            this.selectedTeam === "home" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"
          }">
            後攻シート
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button type="button" id="btn-print-sheet" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black px-3.5 py-1.5 rounded-xl text-xs shadow-md transition flex items-center gap-1.5">
          <span>🖨️</span>
          <span>印刷 / PDF保存</span>
        </button>
        <button type="button" id="btn-close-sheet" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition">
          ✕ 閉じる
        </button>
      </div>
    </div>

    <!-- 印刷プレビュー領域（白地・A4横比率・高精細テーブル） -->
    <div id="printable-score-document" class="w-full max-w-5xl bg-white text-slate-900 p-4 sm:p-6 rounded-xl shadow-2xl space-y-3 font-sans border border-slate-300">
      ${this.generateSheetContent()}
    </div>

  </div>

  <!-- 印刷専用 CSS -->
  <style>
    @media print {
      body * {
        visibility: hidden !important;
      }
      #printable-score-document, #printable-score-document * {
        visibility: visible !important;
      }
      #printable-score-document {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 8mm !important;
        box-shadow: none !important;
        border: none !important;
        color: #000 !important;
        background: #fff !important;
      }
      @page {
        size: A4 landscape;
        margin: 0;
      }
    }
  </style>
`;


}

generateSheetContent() {
const state = this.gameState.getState();
const info = state.gameInfo || {};
const teams = state.teams || {};

const awayTeamName = (teams.away && teams.away.name) ? teams.away.name : (info.myTeamSide === "away" ? info.myTeamName : info.oppTeamName) || "先攻チーム";
const homeTeamName = (teams.home && teams.home.name) ? teams.home.name : (info.myTeamSide === "home" ? info.myTeamName : info.oppTeamName) || "後攻チーム";

const isAway = this.selectedTeam === "away";
const targetTeamName = isAway ? awayTeamName : homeTeamName;

// スコアボード集計
let totalAway = 0;
let totalHome = 0;
const inningScoresA = [];
const inningScoresH = [];

for (let i = 0; i < 6; i++) {
  const valA = (state.awayScore && state.awayScore[i] !== undefined) ? state.awayScore[i] : "-";
  const valH = (state.homeScore && state.homeScore[i] !== undefined) ? state.homeScore[i] : "-";
  inningScoresA.push(valA);
  inningScoresH.push(valH);
  if (typeof valA === "number") totalAway += valA;
  if (typeof valH === "number") totalHome += valH;
}

const tbA = state.isTieBreak && state.awayScore && state.awayScore[6] !== undefined ? state.awayScore[6] : "-";
const tbH = state.isTieBreak && state.homeScore && state.homeScore[6] !== undefined ? state.homeScore[6] : "-";
if (typeof tbA === "number") totalAway += tbA;
if (typeof tbH === "number") totalHome += tbH;

// 打者成績・打席一覧集計
const batterStats = this.calculateBatterStats(isAway);
// 投手成績集計
const pitcherStats = this.calculatePitcherStats();

return `
  <!-- 1. シート見出し -->
  <div class="border-b-2 border-slate-900 pb-2 flex items-end justify-between">
    <div>
      <span class="text-[10px] text-slate-500 font-bold tracking-wider">学童軟式野球 公式戦記録シート</span>
      <h1 class="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
        ${targetTeamName} <span class="text-sm font-normal text-slate-600">（${isAway ? "先攻" : "後攻"}）</span>
      </h1>
    </div>
    <div class="text-right text-xs space-y-0.5 font-mono">
      <div><span class="text-slate-500 font-bold">試合日:</span> <span class="font-black text-slate-900">${info.date || new Date().toISOString().slice(0, 10)}</span></div>
      <div><span class="text-slate-500 font-bold">大会名:</span> <span class="font-black text-slate-900">${info.tournament || "公式戦"}</span></div>
      <div><span class="text-slate-500 font-bold">対戦:</span> <span class="text-slate-700 font-bold">${awayTeamName} vs ${homeTeamName}</span></div>
    </div>
  </div>

  <!-- 2. スコアボード テーブル -->
  <div class="border border-slate-800 text-xs">
    <table class="w-full text-center border-collapse">
      <thead>
        <tr class="bg-slate-100 border-b border-slate-800 text-[10px] font-bold">
          <th class="py-1 px-2 text-left w-[20%] border-r border-slate-300">チーム名</th>
          <th class="py-1 w-[7%]">1</th>
          <th class="py-1 w-[7%]">2</th>
          <th class="py-1 w-[7%]">3</th>
          <th class="py-1 w-[7%]">4</th>
          <th class="py-1 w-[7%]">5</th>
          <th class="py-1 w-[7%]">6</th>
          <th class="py-1 w-[7%] text-amber-700">TB</th>
          <th class="py-1 w-[8%] font-black border-l-2 border-slate-800 bg-slate-200">R</th>
          <th class="py-1 w-[8%]">H</th>
          <th class="py-1 w-[8%]">E</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-300 font-mono">
        <tr class="${isAway ? 'bg-sky-50/50 font-bold' : ''}">
          <td class="py-1 px-2 text-left font-sans truncate border-r border-slate-300 text-[11px]">${awayTeamName}</td>
          ${inningScoresA.map(s => `<td>${s}</td>`).join("")}
          <td class="text-amber-800 font-bold">${tbA}</td>
          <td class="font-black border-l-2 border-slate-800 bg-slate-100 text-sm">${totalAway}</td>
          <td>-</td>
          <td>-</td>
        </tr>
        <tr class="${!isAway ? 'bg-amber-50/50 font-bold' : ''}">
          <td class="py-1 px-2 text-left font-sans truncate border-r border-slate-300 text-[11px]">${homeTeamName}</td>
          ${inningScoresH.map(s => `<td>${s}</td>`).join("")}
          <td class="text-amber-800 font-bold">${tbH}</td>
          <td class="font-black border-l-2 border-slate-800 bg-slate-100 text-sm">${totalHome}</td>
          <td>-</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 3. 打者成績 & 打席一覧 (1〜9番) レイアウト最適化版 -->
  <div>
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-xs font-black text-slate-800 flex items-center gap-1">
        <span>⚾️</span>
        <span>打撃成績 ＆ 各打席結果</span>
      </h3>
      <span class="text-[10px] text-slate-500 font-mono">対象チーム: ${targetTeamName}</span>
    </div>
    <div class="border border-slate-800 overflow-x-auto">
      <table class="w-full text-center text-xs border-collapse table-fixed">
        <thead>
          <tr class="bg-slate-100 border-b border-slate-800 text-[10px] font-bold">
            <!-- 基本情報（横幅をスリム化） -->
            <th class="py-1 px-0.5 w-[3.5%]">順</th>
            <th class="py-1 px-0.5 w-[4.5%]">守</th>
            <th class="py-1 px-0.5 w-[5%]">番号</th>
            <th class="py-1 px-1 text-left w-[13%] border-r border-slate-400">氏名</th>

            <!-- 打席詳細（各打席） -->
            <th class="py-1 w-[7%]">第1打席</th>
            <th class="py-1 w-[7%]">第2打席</th>
            <th class="py-1 w-[7%]">第3打席</th>
            <th class="py-1 w-[7%]">第4打席</th>
            <th class="py-1 w-[7%]">第5打席</th>
            <th class="py-1 w-[7%] border-r-2 border-slate-800">第6打席</th>

            <!-- 個人成績欄（幅をしっかり確保して見やすく配置） -->
            <th class="py-1 w-[4.5%] bg-slate-200">打数</th>
            <th class="py-1 w-[4.5%] bg-slate-200 text-emerald-800">安打</th>
            <th class="py-1 w-[4.5%] bg-slate-200">打点</th>
            <th class="py-1 w-[4.5%] bg-slate-200">四死</th>
            <th class="py-1 w-[4.5%] bg-slate-200">三振</th>
            <th class="py-1 w-[4.5%] bg-slate-200">犠打</th>
            <th class="py-1 w-[4.5%] bg-slate-200">犠飛</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-300">
          ${batterStats.map(b => `
            <tr class="hover:bg-slate-50 text-[11px]">
              <td class="py-1 font-mono font-bold">${b.order}</td>
              <td class="py-1 font-bold text-slate-700">${b.pos}</td>
              <td class="py-1 font-mono font-bold text-slate-600">#${b.number || '-'}</td>
              <td class="py-1 px-1 text-left font-bold text-slate-900 truncate border-r border-slate-400 text-xs">${b.name}</td>

              <td class="py-1 border-r border-slate-200 truncate">${b.plateAppearances[0] || '-'}</td>
              <td class="py-1 border-r border-slate-200 truncate">${b.plateAppearances[1] || '-'}</td>
              <td class="py-1 border-r border-slate-200 truncate">${b.plateAppearances[2] || '-'}</td>
              <td class="py-1 border-r border-slate-200 truncate">${b.plateAppearances[3] || '-'}</td>
              <td class="py-1 border-r border-slate-200 truncate">${b.plateAppearances[4] || '-'}</td>
              <td class="py-1 border-r-2 border-slate-800 truncate">${b.plateAppearances[5] || '-'}</td>

              <td class="py-1 font-mono font-bold bg-slate-50 text-xs">${b.ab}</td>
              <td class="py-1 font-mono font-black bg-slate-50 text-emerald-700 text-xs">${b.hits}</td>
              <td class="py-1 font-mono font-bold bg-slate-50 text-xs">${b.rbi}</td>
              <td class="py-1 font-mono font-bold bg-slate-50 text-xs">${b.bb}</td>
              <td class="py-1 font-mono font-bold bg-slate-50 text-xs">${b.so}</td>
              <td class="py-1 font-mono font-bold bg-slate-50 text-xs">${b.sh}</td>
              <td class="py-1 font-mono font-bold bg-slate-50 text-xs">${b.sf}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 4. 投手成績 ＆ 連盟球数管理表 -->
  <div class="pt-1">
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-xs font-black text-slate-800 flex items-center gap-1">
        <span>🎯</span>
        <span>登板投手成績 ＆ 球数管理表（連盟提出・上限70球照合用）</span>
      </h3>
      <span class="text-[10px] text-slate-500 font-mono">※投球制限ルール準拠</span>
    </div>
    <div class="border border-slate-800">
      <table class="w-full text-center text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 border-b border-slate-800 text-[10px] font-bold">
            <th class="py-1 px-2 text-left w-[18%]">チーム</th>
            <th class="py-1 px-2 text-left w-[20%]">投手氏名</th>
            <th class="py-1 w-[12%]">投球回</th>
            <th class="py-1 w-[14%] bg-amber-100 font-black text-amber-900 border-x border-slate-300">本日投球数</th>
            <th class="py-1 w-[9%]">被安打</th>
            <th class="py-1 w-[9%]">奪三振</th>
            <th class="py-1 w-[9%]">与四死</th>
            <th class="py-1 w-[9%]">失点</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-300 font-mono">
          ${pitcherStats.map(p => `
            <tr class="hover:bg-slate-50">
              <td class="py-1 px-2 text-left font-sans text-[11px]">${p.teamName}</td>
              <td class="py-1 px-2 text-left font-sans font-bold text-slate-900">${p.name}</td>
              <td class="py-1">${p.innings}</td>
              <td class="py-1 font-black text-sm bg-amber-50 border-x border-slate-300 ${p.pitchCount >= 70 ? 'text-rose-600' : 'text-slate-900'}">
                ${p.pitchCount} <span class="text-[10px] font-normal text-slate-500">/ 70</span>
              </td>
              <td class="py-1">${p.hits}</td>
              <td class="py-1 font-bold text-emerald-700">${p.so}</td>
              <td class="py-1">${p.bb}</td>
              <td class="py-1 font-bold text-rose-700">${p.runs}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 5. 署名・備考欄 (印刷用) -->
  <div class="border-t border-slate-300 pt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
    <div>出力システム: gakudo-baseball-score / 学童野球 1球速報</div>
    <div class="flex items-center gap-4">
      <span>球審: __________________</span>
      <span>記録員: __________________</span>
    </div>
  </div>
`;


}

calculateBatterStats(isAway) {
const state = this.gameState.getState();
const team = isAway ? (state.teams ? state.teams.away : null) : (state.teams ? state.teams.home : null);
const roster = (team && team.roster) ? team.roster : [];

// 1〜9番のベースデータ作成
const list = Array.from({ length: 9 }, (_, i) => {
  const r = roster[i] || {};
  return {
    order: i + 1,
    pos: r.pos || "-",
    number: r.number || (i + 1),
    name: r.name || `${i + 1}番 打者`,
    plateAppearances: [],
    ab: 0,
    hits: 0,
    rbi: 0,
    bb: 0,
    so: 0,
    sh: 0,
    sf: 0
  };
});

if (!state.history || state.history.length === 0) {
  return list;
}

// 履歴を走査し、打席完了イベントを抽出
let currentBatterOrder = 1;

state.history.forEach((h) => {
  const snap = h.snapshot;
  const event = h.pitchEvent;
  if (!snap || !event) return;

  const isTopEvent = snap.isTop;
  if (isTopEvent !== isAway) return;

  const res = event.result || "";
  const play = event.play;

  let paResultStr = null;
  let isHit = false;
  let isAb = false;
  let isBb = false;
  let isSo = false;
  let isSh = false;
  let isSf = false;
  let rbi = 0;

  if (res.includes("打球") && play) {
    const t = play.type;
    rbi = play.runs || 0;
    switch (t) {
      case "単打":
        paResultStr = "中安";
        isHit = true;
        isAb = true;
        break;
      case "二塁打":
        paResultStr = "左２";
        isHit = true;
        isAb = true;
        break;
      case "三塁打":
        paResultStr = "右３";
        isHit = true;
        isAb = true;
        break;
      case "本塁打":
        paResultStr = "本塁打";
        isHit = true;
        isAb = true;
        break;
      case "凡打":
        paResultStr = play.area ? play.area.slice(0, 2) + "ゴ" : "凡打";
        isAb = true;
        break;
      case "送りバント":
      case "スクイズ":
        paResultStr = "犠打";
        isSh = true;
        break;
      case "犠牲フライ":
        paResultStr = "犠飛";
        isSf = true;
        break;
      case "失策":
        paResultStr = "失策";
        isAb = true;
        break;
      default:
        paResultStr = t;
        isAb = true;
        break;
    }
  } else if (res === "ボール" && snap.balls === 3) {
    paResultStr = "四球";
    isBb = true;
  } else if (res === "死球") {
    paResultStr = "死球";
    isBb = true;
  } else if ((res === "見逃しストライク" || res === "空振り") && snap.strikes === 2) {
    paResultStr = "三振";
    isSo = true;
    isAb = true;
  }

  if (paResultStr) {
    const batterIdx = (currentBatterOrder - 1) % 9;
    const b = list[batterIdx];
    if (b) {
      b.plateAppearances.push(paResultStr);
      if (isAb) b.ab++;
      if (isHit) b.hits++;
      if (isBb) b.bb++;
      if (isSo) b.so++;
      if (isSh) b.sh++;
      if (isSf) b.sf++;
      b.rbi += rbi;
    }
    currentBatterOrder = (currentBatterOrder % 9) + 1;
  }
});

return list;


}

calculatePitcherStats() {
const state = this.gameState.getState();
const teams = state.teams || {};
const statsList = [];

const processTeam = (teamKey, teamName) => {
  const team = teams[teamKey];
  if (!team) return;

  const counts = team.pitcherCounts || {};
  const activePitcherName = team.pitcher ? team.pitcher.name : `${teamName} 投手`;

  if (!counts[activePitcherName]) {
    counts[activePitcherName] = 0;
  }

  Object.keys(counts).forEach(pName => {
    const count = counts[pName] || 0;
    let hits = 0;
    let so = 0;
    let bb = 0;
    let runs = 0;

    if (state.history) {
      state.history.forEach(h => {
        const ev = h.pitchEvent;
        const snap = h.snapshot;
        if (!ev) return;

        const pOfPitch = ev.pitcherName || (snap && snap.currentPitcher ? snap.currentPitcher.name : null);
        if (pOfPitch !== pName) return;

        if (ev.result && ev.result.includes("打球") && ev.play) {
          const t = ev.play.type;
          if (["単打", "二塁打", "三塁打", "本塁打"].includes(t)) hits++;
          if (ev.play.runs) runs += ev.play.runs;
        } else if (ev.result === "ボール" && snap && snap.balls === 3) {
          bb++;
        } else if (ev.result === "死球") {
          bb++;
        } else if ((ev.result === "見逃しストライク" || ev.result === "空振り") && snap && snap.strikes === 2) {
          so++;
        }
      });
    }

    statsList.push({
      teamName: teamName,
      name: pName,
      pitchCount: count,
      innings: "計",
      hits,
      so,
      bb,
      runs
    });
  });
};

const awayName = (teams.away && teams.away.name) ? teams.away.name : "先攻チーム";
const homeName = (teams.home && teams.home.name) ? teams.home.name : "後攻チーム";

processTeam("away", awayName);
processTeam("home", homeName);

return statsList;


}

bindEvents() {
const btnClose = this.container.querySelector("#btn-close-sheet");
if (btnClose) {
btnClose.addEventListener("click", () => {
this.close();
});
}

const btnPrint = this.container.querySelector("#btn-print-sheet");
if (btnPrint) {
  btnPrint.addEventListener("click", () => {
    window.print();
  });
}

const btnAway = this.container.querySelector("#sheet-team-away");
const btnHome = this.container.querySelector("#sheet-team-home");

if (btnAway) {
  btnAway.addEventListener("click", () => {
    this.selectedTeam = "away";
    this.render();
    this.bindEvents();
  });
}

if (btnHome) {
  btnHome.addEventListener("click", () => {
    this.selectedTeam = "home";
    this.render();
    this.bindEvents();
  });
}


}

open() {
this.render();
this.bindEvents();
this.container.classList.remove("hidden");
}

close() {
this.container.classList.add("hidden");
}
}
