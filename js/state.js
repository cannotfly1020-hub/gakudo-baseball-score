/**
 * js/state.js
 * 試合状態の一元管理（BSO、走者、球数、イニング、投球履歴）
 * 自己再帰的な履歴肥大化（RangeError）を防止する安全スナップショット実装
 */

export class GameState {
  constructor() {
    this.initDefaultState();
    this.listeners = [];
  }

  // 初期状態の設定
  initDefaultState() {
    this.state = {
      // カウント
      balls: 0,
      strikes: 0,
      outs: 0,

      // イニング・得点
      inning: 1,
      isTop: true, // true: 表, false: 裏
      awayScore: [0],
      homeScore: [0],

      // 球数・タイマー
      pitchCount: 0,
      pitchLimit: 70,
      timeLimitMinutes: 90,
      timerRemainingSeconds: 90 * 60,
      timerRunning: false,
      isTieBreak: false,

      // 走者
      runners: {
        1: false,
        2: false,
        3: false
      },

      currentBatter: { name: "1番 打者", order: 1, pos: "投" },
      currentPitcher: { name: "先発 投手" },

      // 投球履歴（※スナップショットには含めない）
      history: []
    };
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState() {
    return this.state;
  }

  /**
   * 履歴（history）を除外した安全な盤面スナップショットを生成
   * これにより再帰的なデータ爆発（RangeError）を完全に根絶する
   */
  createSnapshot() {
    return {
      balls: this.state.balls,
      strikes: this.state.strikes,
      outs: this.state.outs,
      inning: this.state.inning,
      isTop: this.state.isTop,
      awayScore: [...this.state.awayScore],
      homeScore: [...this.state.homeScore],
      pitchCount: this.state.pitchCount,
      pitchLimit: this.state.pitchLimit,
      timeLimitMinutes: this.state.timeLimitMinutes,
      timerRemainingSeconds: this.state.timerRemainingSeconds,
      timerRunning: this.state.timerRunning,
      isTieBreak: this.state.isTieBreak,
      runners: { ...this.state.runners },
      currentBatter: { ...this.state.currentBatter },
      currentPitcher: { ...this.state.currentPitcher }
    };
  }

  recordPitch(course, resultType) {
    // 履歴自身を含めない安全スナップショットを取得
    const snapshot = this.createSnapshot();

    let pitchEvent = {
      pitchNum: this.state.pitchCount + 1,
      inningStr: `${this.state.inning}回${this.state.isTop ? "表" : "裏"}`,
      course: course,
      result: resultType,
      bsoBefore: `${this.state.balls}-${this.state.strikes}-${this.state.outs}`
    };

    this.state.pitchCount += 1;

    switch (resultType) {
      case "ボール":
        this.handleBall();
        break;
      case "見逃しストライク":
      case "空振り":
        this.handleStrike();
        break;
      case "ファウル":
        this.handleFoul();
        break;
      case "死球":
        this.handleHitByPitch();
        break;
      default:
        break;
    }

    this.state.history.push({ snapshot, pitchEvent });
    this.notify();
  }

  handleBall() {
    if (this.state.balls < 3) {
      this.state.balls += 1;
    } else {
      this.advanceWalk();
      this.resetCount();
    }
  }

  handleStrike() {
    if (this.state.strikes < 2) {
      this.state.strikes += 1;
    } else {
      this.handleOut();
      this.resetCount();
    }
  }

  handleFoul() {
    if (this.state.strikes < 2) {
      this.state.strikes += 1;
    }
  }

  handleHitByPitch() {
    this.advanceWalk();
    this.resetCount();
  }

  handleOut() {
    if (this.state.outs < 2) {
      this.state.outs += 1;
    } else {
      this.handleSideRetired();
    }
  }

  handleSideRetired() {
    this.state.balls = 0;
    this.state.strikes = 0;
    this.state.outs = 0;
    this.state.runners = { 1: false, 2: false, 3: false };

    if (!this.state.isTop) {
      this.state.inning += 1;
      this.state.isTop = true;
      this.ensureScoreArrayCapacity(this.state.inning - 1);
    } else {
      this.state.isTop = false;
      this.ensureScoreArrayCapacity(this.state.inning - 1);
    }
  }

  ensureScoreArrayCapacity(targetIdx) {
    while (this.state.awayScore.length <= targetIdx) {
      this.state.awayScore.push(0);
    }
    while (this.state.homeScore.length <= targetIdx) {
      this.state.homeScore.push(0);
    }
  }

  advanceWalk() {
    if (!this.state.runners[1]) {
      this.state.runners[1] = true;
    } else if (!this.state.runners[2]) {
      this.state.runners[2] = true;
    } else if (!this.state.runners[3]) {
      this.state.runners[3] = true;
    } else {
      this.addRun(1);
    }
  }

  addRun(points = 1) {
    const idx = this.state.inning - 1;
    this.ensureScoreArrayCapacity(idx);

    if (this.state.isTop) {
      this.state.awayScore[idx] = (this.state.awayScore[idx] || 0) + points;
    } else {
      this.state.homeScore[idx] = (this.state.homeScore[idx] || 0) + points;
    }
    this.notify();
  }

  setScore(isTop, inningIdx, score) {
    this.ensureScoreArrayCapacity(inningIdx);
    const parsed = Math.max(0, parseInt(score, 10) || 0);
    if (isTop) {
      this.state.awayScore[inningIdx] = parsed;
    } else {
      this.state.homeScore[inningIdx] = parsed;
    }
    this.notify();
  }

  setCount(type, val) {
    if (["balls", "strikes", "outs"].includes(type)) {
      this.state[type] = Math.max(0, parseInt(val, 10) || 0);
      this.notify();
    }
  }

  setPitchCount(count) {
    this.state.pitchCount = Math.max(0, parseInt(count, 10) || 0);
    this.notify();
  }

  setInning(inning, isTop) {
    this.state.inning = Math.max(1, parseInt(inning, 10) || 1);
    this.state.isTop = !!isTop;
    this.ensureScoreArrayCapacity(this.state.inning - 1);
    this.notify();
  }

  resetGame() {
    this.initDefaultState();
    this.notify();
  }

  resetCount() {
    this.state.balls = 0;
    this.state.strikes = 0;
  }

  toggleRunner(base) {
    if (this.state.runners[base] !== undefined) {
      this.state.runners[base] = !this.state.runners[base];
      this.notify();
    }
  }

  undo() {
    if (this.state.history.length === 0) return;
    const lastAction = this.state.history.pop();
    // 復元時、history配列は壊さず盤面状態だけを復元
    Object.assign(this.state, lastAction.snapshot);
    this.notify();
  }
}
