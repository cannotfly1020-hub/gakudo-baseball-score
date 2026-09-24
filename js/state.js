/**
 * js/state.js
 * 試合状態の一元管理（BSO、走者、球数、イニング、投球履歴）
 * 得点配列をイニング番号（state.inning）と直接同期させ、表裏のズレを根絶
 */

export class GameState {
  constructor() {
    this.state = {
      // カウント
      balls: 0,
      strikes: 0,
      outs: 0,

      // イニング・得点（各イニングのindex = イニング番号 - 1）
      inning: 1,
      isTop: true, // true: 表 (先攻), false: 裏 (後攻)
      awayScore: [0], // 先攻得点
      homeScore: [],  // 後攻得点（1回裏開始時に[0]になる）

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

    this.listeners = [];
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

  // BSOの手動ダイレクト変更（B:0〜3, S:0〜2, O:0〜2をタップで順繰り）
  cycleCount(type) {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    if (type === "B") {
      this.state.balls = (this.state.balls + 1) % 4;
    } else if (type === "S") {
      this.state.strikes = (this.state.strikes + 1) % 3;
    } else if (type === "O") {
      this.state.outs = (this.state.outs + 1) % 3;
    }
    this.state.history.push({
      snapshot,
      pitchEvent: {
        pitchNum: this.state.pitchCount,
        inningStr: `${this.state.inning}回${this.state.isTop ? "表" : "裏"}`,
        course: "手動修正",
        result: `カウント手動修正 (${type})`,
        bsoBefore: `${snapshot.balls}-${snapshot.strikes}-${snapshot.outs}`
      }
    });
    this.notify();
  }

  // 特定イニングの得点を直接修正
  setInningScore(isTop, inningIndex, newScore) {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    const targetArr = isTop ? this.state.awayScore : this.state.homeScore;
    
    while (targetArr.length <= inningIndex) {
      targetArr.push(0);
    }
    targetArr[inningIndex] = Math.max(0, parseInt(newScore, 10) || 0);

    this.state.history.push({
      snapshot,
      pitchEvent: {
        pitchNum: this.state.pitchCount,
        inningStr: `${this.state.inning}回${this.state.isTop ? "表" : "裏"}`,
        course: "手動修正",
        result: `${inningIndex + 1}回${isTop ? "表" : "裏"}得点修正: ${newScore}点`,
        bsoBefore: `${snapshot.balls}-${snapshot.strikes}-${snapshot.outs}`
      }
    });
    this.notify();
  }

  // 球数を直接修正
  setPitchCount(newCount) {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    this.state.pitchCount = Math.max(0, parseInt(newCount, 10) || 0);
    this.state.history.push({
      snapshot,
      pitchEvent: {
        pitchNum: this.state.pitchCount,
        inningStr: `${this.state.inning}回${this.state.isTop ? "表" : "裏"}`,
        course: "手動修正",
        result: `球数手動修正: ${newCount}球`,
        bsoBefore: `${snapshot.balls}-${snapshot.strikes}-${snapshot.outs}`
      }
    });
    this.notify();
  }

  // イニング・表裏を手動直接変更
  setInning(newInning, isTop) {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    this.state.inning = Math.max(1, parseInt(newInning, 10) || 1);
    this.state.isTop = isTop;
    this.resetCount();
    this.notify();
  }

  // 試合データの一括クリア（初期化）
  resetGame() {
    this.state = {
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      isTop: true,
      awayScore: [0],
      homeScore: [],
      pitchCount: 0,
      pitchLimit: 70,
      timeLimitMinutes: 90,
      timerRemainingSeconds: 90 * 60,
      timerRunning: false,
      isTieBreak: false,
      runners: { 1: false, 2: false, 3: false },
      currentBatter: { name: "1番 打者", order: 1, pos: "投" },
      currentPitcher: { name: "先発 投手" },
      history: []
    };
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

  // 攻守交代処理（得点配列の二重追加を解消）
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
      if (this.state.awayScore[idx] === undefined) {
        this.state.awayScore[idx] = 0;
      }
    } else {
      // 表が終わったら裏へ
      this.state.isTop = false;
      const idx = this.state.inning - 1;
      if (this.state.homeScore[idx] === undefined) {
        this.state.homeScore[idx] = 0;
      }
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

  // 現在のイニングに対して厳密に得点を加算
  addRun(points = 1) {
    const idx = this.state.inning - 1;
    if (this.state.isTop) {
      while (this.state.awayScore.length <= idx) {
        this.state.awayScore.push(0);
      }
      this.state.awayScore[idx] = (this.state.awayScore[idx] || 0) + points;
    } else {
      while (this.state.homeScore.length <= idx) {
        this.state.homeScore.push(0);
      }
      this.state.homeScore[idx] = (this.state.homeScore[idx] || 0) + points;
    }
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
