/**
 * js/components/catcherVisualBoard.js
 * 【小学生キャッチャー専用】絵で見る捕手スコア盤コンポーネント（完全連動・データ自動検知版）
 * 
 * 根本修正:
 * 1. 先攻/後攻の決め打ちによる1回表データ破棄を完全根絶
 * 2. どちらのチームでもワンタップで切り替えられる「チーム切替バー」を新設
 * 3. 1回表・裏のどちらか一方しか入力されていない場合でも、データが存在するチームを自動検知して即時描画
 * 4. 打席完了（三振・四球・打球）はもちろん、打席途中の配球もリアルタイムにビジュアル化
 */

export class CatcherVisualBoard {
  constructor(state) {
    this.state = state;
    this.isOpen = false;
    this.currentFocusEye = "all"; // 'all' | 'first' | 'hits' | 'twostrikes'
    this.selectedTeamSide = null; // 'away' | 'home' | null (自動)
    this.modalEl = null;

    this._injectModalContainer();
  }

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

        <!-- チーム切替バー（先攻/後攻の即時切り替え） -->
        <div class="bg-slate-950/90 border-b border-slate-800 px-3 py-2 shrink-0 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
            <span>相手打線を表示:</span>
          </div>
          <div class="flex items-center gap-1.5" id="cvb-team-toggle-group">
            <button type="button" id="cvb-team-away-btn" class="px-2.5 py-1 rounded-xl text-xs font-black border transition active:scale-95 bg-sky-600 text-white border-sky-400 shadow">
              先攻チーム (表)
            </button>
            <button type="button" id="cvb-team-home-btn" class="px-2.5 py-1 rounded-xl text-xs font-black border transition active:scale-95 bg-slate-800 text-slate-300 border-slate-700">
              後攻チーム (裏)
            </button>
          </div>
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
                  <th class="py-2 px-2 text-left w-28">打者</th>
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

    // チーム切替ボタンイベント
    document.getElementById("cvb-team-away-btn").addEventListener("click", () => this.setTeamSide("away"));
    document.getElementById("cvb-team-home-btn").addEventListener("click", () => this.setTeamSide("home"));

    // 着眼点切り替えボタン
    container.querySelectorAll(".cvb-eye-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const eye = e.currentTarget.getAttribute("data-eye");
        this.setFocusEye(eye);
      });
    });
  }

  /**
   * 現在のGameStateから対象チームの打席データを抽出
   */
  _extractOpponentAtBats() {
    const gameState = typeof this.state.getState === "function" ? this.state.getState() : this.state;
    if (!gameState || !gameState.teams) return [];

    const history = gameState.history || [];

    // 履歴に存在する投球の攻守（表/裏）をカウントして、データが存在する側を自動判定
    let awayPitches = 0;
    let homePitches = 0;
    history.forEach((h) => {
      const isTop = h.snapshot ? h.snapshot.isTop : (h.pitchEvent ? h.pitchEvent.isTop : true);
      if (isTop) awayPitches++;
      else homePitches++;
    });

    // ユーザー指定がない場合のインテリジェント初期選択
    if (!this.selectedTeamSide) {
      const mySide = gameState.gameInfo?.myTeamSide || "away";
      const oppSide = mySide === "away" ? "home" : "away";

      // 相手チーム側にデータがあれば相手を表示、なければデータが存在する側を自動選択
      if (oppSide === "home" && homePitches > 0) {
        this.selectedTeamSide = "home";
      } else if (oppSide === "away" && awayPitches > 0) {
        this.selectedTeamSide = "away";
      } else if (awayPitches > 0) {
        this.selectedTeamSide = "away"; // 1回表のみ入力されている場合は先攻を自動表示
      } else if (homePitches > 0) {
        this.selectedTeamSide = "home";
      } else {
        this.selectedTeamSide = oppSide;
      }
    }

    const currentSide = this.selectedTeamSide || "away";
    const targetTeam = gameState.teams[currentSide] || { roster: [] };
    const roster = targetTeam.roster || [];
    const isTargetTop = (currentSide === "away");

    // UIボタンのアクティブ状態を同期
    this._updateTeamButtonsUI(gameState, currentSide, awayPitches, homePitches);

    // 打者ごとに打席を整理
    return roster.map((player, idx) => {
      const orderNum = idx + 1;
      const playerName = player.name || `${orderNum}番 打者`;
      const playerPos = player.pos || "-";

      const batterPitches = [];
      let currentAtBat = [];
      let lastInning = null;

      history.forEach((h) => {
        const snap = h.snapshot;
        const pEv = h.pitchEvent;
        if (!snap && !pEv) return;

        // 投球の表裏（isTop）判定
        const pitchIsTop = snap ? snap.isTop : (pEv.inningStr ? pEv.inningStr.includes("表") : true);
        if (pitchIsTop !== isTargetTop) return;

        // 打者の一致判定（厳格な型比較を避けて安全に比較）
        let bOrder = null;
        if (snap && snap.currentBatter) {
          bOrder = Number(snap.currentBatter.order);
        } else if (pEv && pEv.batterOrder) {
          bOrder = Number(pEv.batterOrder);
        }

        if (bOrder !== orderNum) return;

        const currentInning = snap ? snap.inning : (parseInt(pEv.inningStr, 10) || 1);

        // イニングが変わった場合は新打席とみなす
        if (lastInning !== null && lastInning !== currentInning) {
          if (currentAtBat.length > 0) {
            batterPitches.push([...currentAtBat]);
            currentAtBat = [];
          }
        }
        lastInning = currentInning;

        currentAtBat.push({ snapshot: snap, pitchEvent: pEv });

        // 打席完了判定
        const res = (pEv && pEv.result) ? pEv.result : "";
        const snapStrikes = snap ? snap.strikes : 0;
        const snapBalls = snap ? snap.balls : 0;

        const isStrikeOut = res.includes("三振") || ((res.includes("ストライク") || res === "空振り") && snapStrikes === 2);
        const isWalk = (res === "ボール" && snapBalls === 3) || (res === "死球");
        const isInPlay = res.startsWith("打球") || (pEv && pEv.play);
        const isSpecialOut = res.includes("振り逃げ") || res.includes("打撃妨害");

        if (isStrikeOut || isWalk || isInPlay || isSpecialOut) {
          batterPitches.push([...currentAtBat]);
          currentAtBat = [];
        }
      });

      // 打席途中の場合でも残りの球を打席として保持（リアルタイム可視化）
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

  _updateTeamButtonsUI(gameState, currentSide, awayPitches, homePitches) {
    const awayBtn = document.getElementById("cvb-team-away-btn");
    const homeBtn = document.getElementById("cvb-team-home-btn");
    if (!awayBtn || !homeBtn) return;

    const awayName = (gameState.teams?.away?.name || "先攻チーム");
    const homeName = (gameState.teams?.home?.name || "後攻チーム");

    awayBtn.innerHTML = `<span>${awayName} (表)</span> <span class="text-[10px] opacity-75">(${awayPitches}球)</span>`;
    homeBtn.innerHTML = `<span>${homeName} (裏)</span> <span class="text-[10px] opacity-75">(${homePitches}球)</span>`;

    if (currentSide === "away") {
      awayBtn.className = "px-2.5 py-1 rounded-xl text-xs font-black border transition active:scale-95 bg-sky-600 text-white border-sky-400 shadow";
      homeBtn.className = "px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 bg-slate-800 text-slate-300 border-slate-700";
    } else {
      homeBtn.className = "px-2.5 py-1 rounded-xl text-xs font-black border transition active:scale-95 bg-sky-600 text-white border-sky-400 shadow";
      awayBtn.className = "px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 bg-slate-800 text-slate-300 border-slate-700";
    }
  }

  /**
   * 1打席分のデータをビジュアル表示用に整形
   */
  _formatAtBat(pitches, atBatNum) {
    if (!pitches || pitches.length === 0) return null;

    const last = pitches[pitches.length - 1];
    const snap = last.snapshot;
    const ev = last.pitchEvent;

    const inning = snap ? snap.inning : (ev && ev.inningStr ? parseInt(ev.inningStr, 10) || 1 : 1);
    let resultText = (ev && ev.result) ? ev.result : "打席中";
    let resultType = "out";

    // 打球結果の解析
    if (resultText.startsWith("打球")) {
      const playType = (ev && ev.play) ? ev.play.type : resultText.replace("打球 (", "").replace(")", "");
      if (playType.includes("本") || playType.includes("二") || playType.includes("三")) {
        resultType = "extra";
      } else if (playType.includes("単打") || playType.includes("安")) {
        resultType = "single";
      } else {
        resultType = "out";
      }
      resultText = playType;
    } else if (resultText.includes("三振") || ((ev.result === "空振り" || ev.result.includes("ストライク")) && snap && snap.strikes === 2)) {
      resultType = "so";
      resultText = ev.result === "空振り" ? "空三振" : "見三振";
    } else if (resultText === "ボール" && snap && snap.balls === 3) {
      resultType = "walk";
      resultText = "四球";
    } else if (resultText === "死球") {
      resultType = "walk";
      resultText = "死球";
    } else {
      resultType = "inprogress";
      resultText = "打席中";
    }

    // 投球ドット配列の生成
    const formattedPitches = pitches.map((item, idx) => {
      const p = item.pitchEvent || {};
      const pNum = idx + 1;
      let pType = "ball";

      if (p.result === "ボール") pType = "ball";
      else if (p.result === "見逃しストライク") pType = "looking";
      else if (p.result === "空振り") pType = "swing";
      else if (p.result === "ファウル") pType = "foul";
      else if (p.result && p.result.startsWith("打球")) pType = "inplay";

      const coords = this._getCourseCoordinates(p.course);

      return {
        num: pNum,
        type: pType,
        x: coords.x,
        y: coords.y,
        courseName: p.course || "未指定",
        desc: `${pNum}球目・${p.result || "投球"} (${p.course || "コース未指定"})`
      };
    });

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

  _getSprayForPlay(pitchEvent, resultType) {
    if (!pitchEvent || (!pitchEvent.result?.startsWith("打球") && !pitchEvent.play)) return null;

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
            まだこのチームの打席データがありません。試合が進むと絵文字文字盤が表示されます。
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
        if (atBat.resultType === "inprogress") badgeBg = "bg-amber-500/20 text-amber-300 border border-amber-500/40";

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
            ${atBat.hitPitchIndex ? atBat.hitPitchIndex + "球目" : "打席終了"}
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

  setTeamSide(sideKey) {
    this.selectedTeamSide = sideKey;
    this.render();
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
