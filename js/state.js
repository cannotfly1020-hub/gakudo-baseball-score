/**
 * js/state.js
 * 試合状態の一元管理（BSO、走者、球数、イニング、投球履歴）
 * 得点配列をイニング番号（state.inning）と直接同期させ、表裏のズレを根絶
 */

export class GameState {
  constructor() {
    this.initDefaultState();
    this.listeners = [];
  }

  // 初期状態の設定（新規試合リセット時にも再利用可能）
  initDefaultState() {
    this.state = {
      // カウント
      balls: 0,
      strikes: 0,
      outs: 0,

      // イニング・得点（各イニングのindex = イニング番号 - 1）
      // 1回表・裏ともに初期値0で配列を揃えておくことでインデックスズレを防止
      inning: 1,
      isTop: true, // true: 表 (先攻), false: 裏 (後攻)
      awayScore: [0], // 先攻得点
      homeScore: [0], // 後攻得点

      // 球数・タイマー設定
      pitchCount: 0,
      pitchLimit: 70, // 60 または 70
      timeLimitMinutes: 90, // 60 または 90
      timerRemainingSeconds: 90 * 60,
      timerRunning: false,
      isTieBreak: false,

      // 走者 (true: 在塁, false: 空塁)
      runners: {
        1: false,
        2: false,
        3: false
      },

      // 現在の打者・投手
      currentBatter: { name: "1番 打者", order: 1, pos: "投" },
      currentPitcher: { name: "先発 投手" },

      // 1球ごとの全投球ログ
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

  recordPitch(course, resultType) {
    const snapshot = JSON.parse(JSON.stringify(this.state));

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

  // 攻守交代処理（イニング配列を確実に初期化）
  handleSideRetired() {
    this.state.balls = 0;
    this.state.strikes = 0;
    this.state.outs = 0;
    this.state.runners = { 1: false, 2: false, 3: false };

    if (!this.state.isTop) {
      // 裏が終わったらイニングを進める
      this.state.inning += 1;
      this.state.isTop = true;
      const idx = this.state.inning - 1;
      this.ensureScoreArrayCapacity(idx);
    } else {
      // 表が終わったら裏へ
      this.state.isTop = false;
      const idx = this.state.inning - 1;
      this.ensureScoreArrayCapacity(idx);
    }
  }

  // 配列の指定インデックスまで0で埋める安全関数
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

  // 現在のイニングに対して得点を加算
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

  // リカバリー用: 任意のイニング・チームのスコアを直接変更
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

  // リカバリー用: BSO・球数・イニングの直接補正
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

  // 新規試合開始（完全初期化）
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
    this.state = lastAction.snapshot;
    this.notify();
  }
}
