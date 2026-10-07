/**
 * js/components/catcherVisualBoard.js
 * 【小学生キャッチャー専用】絵で見る捕手スコア盤コンポーネント（GameState正規連動版）
 * 
 * 修正点:
 * 1. state.js の正規データ構造（teams.away / teams.home, h.snapshot.currentBatter）に完全対応
 * 2. 1回表・裏が終了した時点で相手打者の打席が100%確実に絵画テーブルへ反映
 * 3. 打球結果（単打・長打・凡打・三振・四球）とコース位置をリアルタイムにビジュアル化
 */

export class CatcherVisualBoard {
  constructor(state) {
    this.state = state;
    this.isOpen = false;
    this.currentFocusEye = "all"; // 'all' | 'first' | 'hits' | 'twostrikes'
    this.modalEl = null;

    this._injectModalContainer();
  }

  /**
   * モーダル用DOM構造の注入
   */
  _injectModalContainer() {
    if (document.getElementById("catcher-visual-modal")) return;

    const container = document.createElement("div");
    container.id = "catcher-visual-modal";
    container.className = "fixed inset-0 z-50 hidden bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col justify-start items-center select-none";
    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        <!-- ヘッダー -->
        <div class="bg-slate-900/95 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div class="flex items-center space-x-2">
            <span class="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-lg font-black shadow-inner">
              🎯
            </span>
            <div>
              <div class="text-[9px] text-amber-400 font-extrabold tracking-widest uppercase">Visual Scorebook for Catchers</div>
              <h2 class="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
                <span>絵で見る捕手スコア盤</span>
                <span class="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold">打球×コース</span>
              </h2>
            </div>
          </div>
          <button id="cvb-close-btn" class="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg active:scale-95 transition">
            ✕
          </button>
        </div>

        <!-- 着眼点切り替えバー -->
        <div class="bg-slate-900/90 border-b border-slate-800 px-3 py-2 shrink-0">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
              <span class="text-base">👀</span>
              <span>なにに注目して絵を見る？：</span>
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              <button data-eye="all" class="cvb-eye-btn text-[11px] sm:text-xs font-black py-1.5 px-2 rounded-xl border transition active:scale-95 bg-sky-500 text-white border-sky-400 shadow">
                ぜんぶ見る
              </button>
              <button data-eye="first" class="cvb-eye-btn text-[11px] sm:text-xs font-black py-1.5 px-2 rounded-xl border transition active:scale-95 bg-slate-800 text-slate-300 border-slate-700">
                初球打ち
              </button>
              <button data-eye="hits" class="cvb-eye-btn text-[11px] sm:text-xs font-black py-1.5 px-2 rounded-xl border transition active:scale-95 bg-slate-800 text-slate-300 border-slate-700">
                打たれた球
              </button>
              <button data-eye="twostrikes" class="cvb-eye-btn text-[11px] sm:text-xs font-black py-1.5 px-2 rounded-xl border transition active:scale-95 bg-slate-800 text-slate-300 border-slate-700">
                2Sから痛打
              </button>
            </div>
          </div>
        </div>

        <!-- メイン表示領域（スクロール対応） -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          <!-- ヒントバー -->
          <div class="bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border border-slate-700/80 rounded-2xl p-2.5 flex items-center justify-between text-xs shadow-md">
            <div class="flex items-center gap-2">
              <span class="text-lg">💡</span>
              <span id="cvb-hint-text" class="font-bold text-slate-200">
                マス目の「コース枠」と「グラウンド矢印」を見て、相手がどこをどの方向へ打ったか探してみよう。
              </span>
            </div>
            <span class="text-[10px] text-amber-300 font-extrabold bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 shrink-0 hidden sm:inline">
              マスをタップで拡大
            </span>
          </div>

          <!-- ビジュアルスコアテーブル -->
          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-2 overflow-x-auto shadow-xl">
            <table class="w-full border-collapse min-w-[580px]">
              <thead>
                <tr class="text-[11px] font-extrabold text-slate-400 border-b border-slate-800">
                  <th class="py-2 px-2 text-left w-28">相手打者</th>
                  <th class="py-2 px-2 text-center">第1打席</th>
                  <th class="py-2 px-2 text-center">第2打席</th>
                  <th class="py-2 px-2 text-center">第3打席</th>
                </tr>
              </thead>
              <tbody id="cvb-table-rows" class="divide-y divide-slate-800/60">
                <!-- 動的レンダリング -->
              </tbody>
            </table>
          </div>

          <!-- 凡例ガイド -->
          <div class="bg-slate-900/60 border border-slate-800/70 rounded-2xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-black text-amber-300 shrink-0">コース枠:</span>
              <span class="inline-flex items-center gap-1 text-slate-300">
                <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[8px] flex items-center justify-center font-mono">①</span> 打球
              </span>
              <span class="inline-flex items-center gap-1 text-slate-300">
                <span class="w-3.5 h-3.5 rounded-full bg-rose-500 text-white font-black text-[8px] flex items-center justify-center font-mono">②</span> ストライク
              </span>
              <span class="inline-flex items-center gap-1 text-slate-300">
                <span class="w-3.5 h-3.5 rounded-full bg-blue-500 text-white font-black text-[8px] flex items-center justify-center font-mono">③</span> ボール
              </span>
            </div>
            <div class="flex items-center gap-2 text-slate-400">
              <span class="font-black text-sky-400 shrink-0">グラウンド矢印:</span>
              <span>打球方向（赤=長打 / 緑=単打 / 白=凡打）</span>
            </div>
          </div>
        </div>

        <!-- 拡大詳細サブモーダル（打席タップ時） -->
        <div id="cvb-detail-panel" class="hidden bg-slate-950/95 border-t border-slate-700 p-4 shrink-0 transition">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <span id="cvb-detail-player" class="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30"></span>
              <h3 id="cvb-detail-title" class="text-sm font-black text-white mt-0.5"></h3>
            </div>
            <button id="cvb-detail-close-btn" class="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg">
              閉じる
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3 py-3 items-center">
            <div class="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-xl p-2">
              <span class="text-[10px] font-bold text-slate-400 mb-1">拡大コース枠</span>
              <div id="cvb-detail-zone" class="w-24 h-24 flex justify-center"></div>
            </div>
            <div class="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-xl p-2">
              <span class="text-[10px] font-bold text-slate-400 mb-1">拡大打球方向</span>
              <div id="cvb-detail-spray" class="w-24 h-24 flex justify-center"></div>
            </div>
          </div>
          <div id="cvb-detail-pitch-list" class="space-y-1 max-h-28 overflow-y-auto text-xs"></div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.modalEl = container;

    // 閉じるボタン
    document.getElementById("cvb-close-btn").addEventListener("click", () => this.close());
    document.getElementById("cvb-detail-close-btn").addEventListener("click", () => this._hideDetail());

    // 着眼点切り替えボタン
    container.querySelectorAll(".cvb-eye-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const eye = e.currentTarget.getAttribute("data-eye");
        this.setFocusEye(eye);
      });
    });
  }

  /**
   * 現在のGameStateから相手打線の打席データを抽出
   */
  _extractOpponentAtBats() {
    const gameState = typeof this.state.getState === "function" ? this.state.getState() : this.state;
    if (!gameState || !gameState.teams) return [];

    // 自チームが away なら相手は home、自チームが home なら相手は away
    const mySide = gameState.gameInfo?.myTeamSide || "away";
    const oppSide = mySide === "away" ? "home" : "away";
    const oppTeam = gameState.teams[oppSide] || { roster: [] };
    const roster = oppTeam.roster || [];

    // 相手チームが攻撃していたイニングの判定（相手が home なら裏、away なら表）
    const oppIsTop = (oppSide === "away");

    const history = gameState.history || [];

    // 打者ごとに打席を整理
    return roster.map((player, idx) => {
      const orderNum = idx + 1;
      const playerName = player.name || `${orderNum}番 打者`;
      const playerPos = player.pos || "-";

      // この打者の投球を history から抽出（相手の攻撃イニング かつ この打順の打席）
      const batterPitches = [];
      let currentAtBat = [];
      let lastInning = null;

      history.forEach((h) => {
        const snap = h.snapshot;
        const pEv = h.pitchEvent;
        if (!snap || !pEv) return;

        // 相手チームの攻撃回であるか
        if (snap.isTop !== oppIsTop) return;

        // 打者の一致判定
        const bOrder = snap.currentBatter ? snap.currentBatter.order : null;
        if (bOrder !== orderNum) return;

        // イニングが変わった場合は新打席とみなす
        if (lastInning !== null && lastInning !== snap.inning) {
          if (currentAtBat.length > 0) {
            batterPitches.push([...currentAtBat]);
            currentAtBat = [];
          }
        }
        lastInning = snap.inning;

        currentAtBat.push({ snapshot: snap, pitchEvent: pEv });

        // 打席完了判定（3ストライク三振、4ボール四球、死球、打球インプレー、振り逃げなど）
        const res = pEv.result || "";
        const isStrikeOut = (res.includes("ストライク") || res === "空振り") && snap.strikes === 2;
        const isWalk = (res === "ボール" && snap.balls === 3) || (res === "死球");
        const isInPlay = res.startsWith("打球") || pEv.play;
        const isSpecialOut = res.includes("振り逃げ") || res.includes("打撃妨害");

        if (isStrikeOut || isWalk || isInPlay || isSpecialOut) {
          batterPitches.push([...currentAtBat]);
          currentAtBat = [];
        }
      });

      if (currentAtBat.length > 0) {
        batterPitches.push([...currentAtBat]);
      }

      // 各打席のビジュアル整形
      const atBats = batterPitches.map((pitches, abIdx) => this._formatAtBat(pitches, abIdx + 1));

      return {
        order: orderNum,
        name: playerName,
        pos: playerPos,
        atBats: atBats
      };
    });
  }

  /**
   * 1打席分のデータをビジュアル表示用に整形
   */
  _formatAtBat(pitches, atBatNum) {
    if (!pitches || pitches.length === 0) return null;

    const last = pitches[pitches.length - 1];
    const snap = last.snapshot;
    const ev = last.pitchEvent;

    const inning = snap ? snap.inning : 1;
    let resultText = ev.result || "完了";
    let resultType = "out";

    // 打球結果の解析
    if (resultText.startsWith("打球")) {
      const playType = ev.play ? ev.play.type : resultText;
      if (playType.includes("本") || playType.includes("二") || playType.includes("三")) {
        resultType = "extra";
      } else if (playType.includes("単打") || playType.includes("安")) {
        resultType = "single";
      } else {
        resultType = "out";
      }
      resultText = playType;
    } else if (resultText.includes("三振") || ((ev.result === "空振り" || ev.result.includes("ストライク")) && snap.strikes === 2)) {
      resultType = "so";
      resultText = ev.result === "空振り" ? "空三振" : "見三振";
    } else if (resultText === "ボール" && snap.balls === 3) {
      resultType = "walk";
      resultText = "四球";
    } else if (resultText === "死球") {
      resultType = "walk";
      resultText = "死球";
    }

    // 投球ドット配列の生成
    const formattedPitches = pitches.map((item, idx) => {
      const p = item.pitchEvent;
      const pNum = idx + 1;
      let pType = "ball";

      if (p.result === "ボール") pType = "ball";
      else if (p.result === "見逃しストライク") pType = "looking";
      else if (p.result === "空振り") pType = "swing";
      else if (p.result === "ファウル") pType = "foul";
      else if (p.result.startsWith("打球")) pType = "inplay";

      // コース座標のマッピング（コース名から自然な位置を推測、または安全なデフォルト）
      const coords = this._getCourseCoordinates(p.course);

      return {
        num: pNum,
        type: pType,
        x: coords.x,
        y: coords.y,
        courseName: p.course || "未指定",
        desc: `${pNum}球目・${p.result} (${p.course || "コース未指定"})`
      };
    });

    // スプレー（打球方向）の推測または保持データ
    const spray = this._getSprayForPlay(ev, resultType);

    return {
      inning: inning,
      atBatNum: atBatNum,
      result: resultText,
      resultType: resultType,
      hitPitchIndex: pitches.length,
      pitches: formattedPitches,
      spray: spray
    };
  }

  /**
   * コース名からパーセンテージ座標 (0-100) を算出
   */
  _getCourseCoordinates(courseName) {
    if (!courseName) return { x: 50, y: 50 };

    const map = {
      "高内": { x: 26, y: 26 }, "高中": { x: 50, y: 26 }, "高外": { x: 74, y: 26 },
      "中内": { x: 26, y: 50 }, "中央": { x: 50, y: 50 }, "中外": { x: 74, y: 50 },
      "低内": { x: 26, y: 74 }, "低中": { x: 50, y: 74 }, "低外": { x: 74, y: 74 },
      "左高内": { x: 12, y: 15 }, "右高外": { x: 88, y: 15 },
      "左低内": { x: 12, y: 85 }, "右低外": { x: 88, y: 85 },
      "ワンバウンド": { x: 50, y: 92 }, "抜け球": { x: 50, y: 8 }
    };

    return map[courseName] || { x: 50, y: 50 };
  }

  /**
   * 打球結果からスプレーベクトルを生成
   */
  _getSprayForPlay(pitchEvent, resultType) {
    if (!pitchEvent.result.startsWith("打球") && !pitchEvent.play) return null;

    const playType = pitchEvent.play ? pitchEvent.play.type : pitchEvent.result;
    let angle = 0;
    let dist = 55;

    if (playType.includes("二") || playType.includes("右")) angle = 30;
    else if (playType.includes("遊") || playType.includes("左") || playType.includes("三")) angle = -30;
    else angle = 0;

    if (resultType === "extra") dist = 85;
    else if (resultType === "single") dist = 60;
    else dist = 35;

    return {
      angle: angle,
      dist: dist,
      type: resultType
    };
  }

  /**
   * ミニ・ストライクゾーンSVGの描画
   */
  _createMiniZoneSvg(atBat, isHighlighted) {
    const w = 72, h = 72;
    const zX = 18, zY = 14, zW = 36, zH = 40;

    const dotsSvg = atBat.pitches.map((p) => {
      const cx = 8 + (p.x / 100) * 56;
      const cy = 6 + (p.y / 100) * 56;

      let fill = "#3b82f6";
      let stroke = "#1e3a8a";
      if (p.type === "inplay") { fill = "#22c55e"; stroke = "#ffffff"; }
      else if (p.type === "swing" || p.type === "looking") { fill = "#ef4444"; stroke = "#7f1d1d"; }
      else if (p.type === "foul") { fill = "#eab308"; stroke = "#713f12"; }

      const isBig = (p.type === "inplay");
      const r = isBig ? 6.5 : 5;

      return `
        <g>
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${isBig ? "1.5" : "1"}" />
          <text x="${cx.toFixed(1)}" y="${(cy + 3).toFixed(1)}" font-size="${isBig ? "8" : "7"}" font-weight="900" font-family="monospace" fill="${(p.type === "inplay" || p.type === "foul") ? "#0f172a" : "#ffffff"}" text-anchor="middle">
            ${p.num}
          </text>
        </g>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 ${w} ${h}" class="w-16 h-16 shrink-0" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="8" fill="rgba(15, 23, 42, 0.7)" stroke="#334155" stroke-width="1" />
        <polygon points="28,64 44,64 47,67 36,70 25,67" fill="#cbd5e1" opacity="0.35" />
        <rect x="${zX}" y="${zY}" width="${zW}" height="${zH}" fill="rgba(30, 41, 59, 0.5)" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="2 1" rx="3" />
        ${dotsSvg}
      </svg>
    `;
  }

  /**
   * ミニ・打球グラウンド（スプレー）SVGの描画
   */
  _createMiniSpraySvg(atBat, isHighlighted) {
    const w = 72, h = 72;
    const hX = 36, hY = 62;

    if (!atBat.spray) {
      return `
        <svg viewBox="0 0 ${w} ${h}" class="w-16 h-16 shrink-0" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="8" fill="rgba(15, 23, 42, 0.5)" stroke="#334155" stroke-width="1" />
          <path d="M 12,62 A 44,44 0 0,1 60,62 L 36,62 Z" fill="rgba(16, 185, 129, 0.08)" stroke="#334155" stroke-width="1" />
          <text x="36" y="42" font-size="9" font-weight="900" fill="#64748b" text-anchor="middle">打球なし</text>
        </svg>
      `;
    }

    const spray = atBat.spray;
    const rad = (spray.angle - 90) * (Math.PI / 180);
    const reach = 10 + (spray.dist / 100) * 44;
    const tX = hX + Math.cos(rad) * reach;
    const tY = hY + Math.sin(rad) * reach;

    let lineColor = "#94a3b8";
    let targetColor = "#e2e8f0";
    if (spray.type === "single") { lineColor = "#22c55e"; targetColor = "#4ade80"; }
    else if (spray.type === "extra") { lineColor = "#f43f5e"; targetColor = "#fb7185"; }

    return `
      <svg viewBox="0 0 ${w} ${h}" class="w-16 h-16 shrink-0" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="8" fill="rgba(15, 23, 42, 0.7)" stroke="#334155" stroke-width="1" />
        <path d="M 12,62 A 44,44 0 0,1 60,62 L 36,62 Z" fill="rgba(16, 185, 129, 0.12)" stroke="#1e293b" stroke-width="1" />
        <polygon points="36,62 44,53 36,44 28,53" fill="rgba(217, 119, 6, 0.2)" stroke="#78350f" stroke-width="1" />
        <line x1="${hX}" y1="${hY}" x2="${tX.toFixed(1)}" y2="${tY.toFixed(1)}" stroke="${lineColor}" stroke-width="${spray.type !== "out" ? "2.2" : "1.2"}" stroke-linecap="round" />
        <circle cx="${tX.toFixed(1)}" cy="${tY.toFixed(1)}" r="${spray.type !== "out" ? "4" : "3"}" fill="${targetColor}" stroke="#0f172a" stroke-width="1" />
        <circle cx="${hX}" cy="${hY}" r="2" fill="#cbd5e1" />
      </svg>
    `;
  }

  /**
   * テーブル全体の再描画
   */
  render() {
    const tbody = document.getElementById("cvb-table-rows");
    if (!tbody) return;
    tbody.innerHTML = "";

    const batters = this._extractOpponentAtBats();

    if (batters.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-8 text-xs font-bold text-slate-500">
            まだ相手打線の打席データがありません。試合が進むと絵が表示されます。
          </td>
        </tr>
      `;
      return;
    }

    batters.forEach((batter) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-800/30 transition";

      // 打者名
      const nameTd = document.createElement("td");
      nameTd.className = "py-2 px-2 align-middle border-r border-slate-800/80";
      nameTd.innerHTML = `
        <div class="flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 font-extrabold text-xs flex items-center justify-center font-mono shrink-0">
            ${batter.order}
          </span>
          <div class="truncate">
            <div class="font-extrabold text-xs text-white truncate">${batter.name}</div>
            <div class="text-[9px] text-slate-400">(${batter.pos})</div>
          </div>
        </div>
      `;
      tr.appendChild(nameTd);

      // 第1〜第3打席セル
      for (let i = 0; i < 3; i++) {
        const atBat = batter.atBats[i];
        const td = document.createElement("td");
        td.className = "p-1.5 align-middle border-r border-slate-800/80";

        if (!atBat) {
          td.innerHTML = `
            <div class="h-20 rounded-xl border border-dashed border-slate-800/80 flex items-center justify-center text-[10px] text-slate-600 font-bold">
              -
            </div>
          `;
          tr.appendChild(td);
          continue;
        }

        // 着眼点フィルターの判定
        let isHighlighted = false;
        let isDimmed = false;
        if (this.currentFocusEye === "first") {
          if (atBat.hitPitchIndex === 1) isHighlighted = true; else isDimmed = true;
        } else if (this.currentFocusEye === "hits") {
          if (atBat.resultType !== "out" && atBat.resultType !== "so") isHighlighted = true; else isDimmed = true;
        } else if (this.currentFocusEye === "twostrikes") {
          if (atBat.hitPitchIndex >= 3 && atBat.resultType !== "out") isHighlighted = true; else isDimmed = true;
        }

        let badgeBg = "bg-slate-700 text-slate-300";
        if (atBat.resultType === "single") badgeBg = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
        if (atBat.resultType === "extra") badgeBg = "bg-rose-500/25 text-rose-300 border border-rose-500/50";
        if (atBat.resultType === "so") badgeBg = "bg-sky-500/20 text-sky-400 border border-sky-500/40";

        const zoneSvg = this._createMiniZoneSvg(atBat, isHighlighted);
        const spraySvg = this._createMiniSpraySvg(atBat, isHighlighted);

        const card = document.createElement("div");
        card.className = `p-1.5 rounded-xl border transition cursor-pointer active:scale-95 flex flex-col justify-between ${isHighlighted ? "border-sky-400 bg-sky-950/20 shadow-md" : "border-slate-800 bg-slate-900/60"} ${isDimmed ? "opacity-30 grayscale" : ""}`;
        card.innerHTML = `
          <div class="flex items-center justify-between pb-1 border-b border-slate-800/60">
            <span class="text-[9px] font-mono text-slate-400">${atBat.inning}回</span>
            <span class="text-[9px] font-black px-1 rounded ${badgeBg}">${atBat.result}</span>
          </div>
          <div class="flex items-center justify-around py-1 gap-1">
            ${zoneSvg}
            ${spraySvg}
          </div>
          <div class="text-[8px] font-bold text-amber-300/80 text-center truncate">
            ${atBat.hitPitchIndex ? atBat.hitPitchIndex + "球目を打球" : "打席終了"}
          </div>
        `;

        card.addEventListener("click", () => this._showDetail(batter, atBat));
        td.appendChild(card);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });
  }

  _showDetail(batter, atBat) {
    const panel = document.getElementById("cvb-detail-panel");
    if (!panel) return;

    document.getElementById("cvb-detail-player").innerText = `${batter.order}番 ${batter.name} (${batter.pos})`;
    document.getElementById("cvb-detail-title").innerText = `第${atBat.atBatNum}打席 (${atBat.inning}回) ── 結果: ${atBat.result}`;

    document.getElementById("cvb-detail-zone").innerHTML = this._createMiniZoneSvg(atBat, false);
    document.getElementById("cvb-detail-spray").innerHTML = this._createMiniSpraySvg(atBat, false);

    const listEl = document.getElementById("cvb-detail-pitch-list");
    listEl.innerHTML = atBat.pitches.map((p) => `
      <div class="flex items-center justify-between p-1 bg-slate-900 rounded border border-slate-800">
        <span class="font-bold text-slate-300">${p.desc}</span>
        <span class="text-[10px] text-slate-500">${p.type}</span>
      </div>
    `).join("");

    panel.classList.remove("hidden");
  }

  _hideDetail() {
    const panel = document.getElementById("cvb-detail-panel");
    if (panel) panel.classList.add("hidden");
  }

  setFocusEye(eyeKey) {
    this.currentFocusEye = eyeKey;
    const container = this.modalEl;
    if (!container) return;

    container.querySelectorAll(".cvb-eye-btn").forEach((b) => {
      b.classList.remove("bg-sky-500", "text-white", "border-sky-400", "shadow");
      b.classList.add("bg-slate-800", "text-slate-300", "border-slate-700");
    });

    const activeBtn = container.querySelector(`[data-eye="${eyeKey}"]`);
    if (activeBtn) {
      activeBtn.classList.remove("bg-slate-800", "text-slate-300", "border-slate-700");
      activeBtn.classList.add("bg-sky-500", "text-white", "border-sky-400", "shadow");
    }

    this.render();
  }

  open() {
    if (!this.modalEl) this._injectModalContainer();
    this.modalEl.classList.remove("hidden");
    this.isOpen = true;
    this._hideDetail();
    this.render();
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    this.isOpen = false;
  }
}
