/**
 * js/app.js
 * アプリ全体の司令塔・エントリーポイント
 * 
 * 担当役割:
 * - 各コンポーネント（Scoreboard, RunnerDiamond, Zone）のインスタンス化
 * - 状態管理インスタンス（GameState）の生成と各部品への受け渡し
 * - ヘッダー操作（アンドゥ・1球取消）のバインド
 * - 打球モーダル起動時のインターフェース予約
 */

import { GameState } from "./state.js";
import { ScoreboardComponent } from "./components/scoreboard.js";
import { RunnerDiamondComponent } from "./components/runnerDiamond.js";
import { ZoneComponent } from "./components/zone.js";

class BaseballApp {
  constructor() {
    this.gameState = null;
    this.scoreboardComponent = null;
    this.runnerDiamondComponent = null;
    this.zoneComponent = null;
  }

  /**
   * アプリの初期化
   */
  init() {
    // 1. 状態管理（金庫）のインスタンス生成
    this.gameState = new GameState();

    // 2. DOM要素の受け皿（スロット）を取得
    const scoreboardSlot = document.getElementById("scoreboard-slot");
    const diamondSlot = document.getElementById("diamond-slot");
    const zoneSlot = document.getElementById("zone-slot");

    // 3. 各コンポーネントの初期化とスロットへの描画
    if (scoreboardSlot) {
      this.scoreboardComponent = new ScoreboardComponent(scoreboardSlot, this.gameState);
    }

    if (diamondSlot) {
      this.runnerDiamondComponent = new RunnerDiamondComponent(diamondSlot, this.gameState);
    }

    if (zoneSlot) {
      this.zoneComponent = new ZoneComponent(zoneSlot, this.gameState, {
        onInPlay: (selectedCourse) => this.handleInPlay(selectedCourse)
      });
    }

    // 4. グローバル操作（ヘッダーのアンドゥボタンなど）をバインド
    this.bindGlobalActions();

    // 5. 初回レンダリング通知
    this.gameState.notify();

    console.log("⚾️ gakudo-baseball-score が正常に起動しました");
  }

  /**
   * ヘッダーや共通ボタンのイベント登録
   */
  bindGlobalActions() {
    // ヘッダーの「1球取消」ボタン
    const undoBtn = document.getElementById("btn-undo");
    if (undoBtn) {
      undoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.gameState.undo();
      });
    }

    // キーボードショートカット（PCでの操作性向上: Ctrl+Z / Cmd+Z で1球取消）
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.gameState.undo();
      }
    });
  }

  /**
   * 打球結果ボタン（インプレー）タップ時の処理
   * （※ 後ほど作成する js/components/sprayModal.js と合流します）
   */
  handleInPlay(course) {
    // sprayModal.js が完成するまでのフォールバック（簡易プロンプト選択の代用）
    const playType = prompt(
      `【コース: ${course}】打球結果を入力してください:\n1: 単打\n2: 二塁打\n3: 三塁打\n4: 本塁打\n5: 凡打(アウト)\n6: 失策(エラー)`,
      "5"
    );

    if (!playType) return;

    const resultMap = {
      "1": { label: "単打", runs: 0, advance: 1, out: 0 },
      "2": { label: "二塁打", runs: 0, advance: 2, out: 0 },
      "3": { label: "三塁打", runs: 0, advance: 3, out: 0 },
      "4": { label: "本塁打", runs: 1, advance: 4, out: 0 },
      "5": { label: "凡打（アウト）", runs: 0, advance: 0, out: 1 },
      "6": { label: "失策（エラー）", runs: 0, advance: 1, out: 0 }
    };

    const action = resultMap[playType.trim()] || resultMap["5"];

    // 状態の更新
    const state = this.gameState.getState();
    const snapshot = JSON.parse(JSON.stringify(state));

    state.pitchCount += 1;

    // アウト加算
    if (action.out > 0) {
      this.gameState.handleOut();
    }

    // 進塁処理（簡易）
    if (action.advance === 1) {
      this.gameState.advanceWalk();
    } else if (action.advance >= 2 && action.advance <= 3) {
      state.runners[action.advance] = true;
    } else if (action.advance === 4) {
      // 本塁打: 走者全員生還＋打者得点
      let runsScored = 1;
      if (state.runners[1]) runsScored++;
      if (state.runners[2]) runsScored++;
      if (state.runners[3]) runsScored++;
      state.runners = { 1: false, 2: false, 3: false };
      this.gameState.addRun(runsScored);
    }

    this.gameState.resetCount();

    const pitchEvent = {
      pitchNum: state.pitchCount,
      inningStr: `${state.inning}回${state.isTop ? "表" : "裏"}`,
      course: course,
      result: action.label,
      bsoBefore: `${snapshot.balls}-${snapshot.strikes}-${snapshot.outs}`
    };

    state.history.push({ snapshot, pitchEvent });
    this.gameState.notify();
  }
}

// DOMContentLoaded のタイミングで起動
document.addEventListener("DOMContentLoaded", () => {
  const app = new BaseballApp();
  app.init();
});
