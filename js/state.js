/**
 * js/state.js
 * 試合状態の一元管理（BSO、走者、球数、イニング、投球履歴）
 * 他のモジュールに依存せず、純粋なデータと更新ロジックのみを保持します。
 */

export class GameState {
  constructor() {
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

    // 状態変更を各コンポーネントに通知するリスナー群
    this.listeners = [];
  }

  // 購読（コンポーネントが状態変更を受け取るための登録）
  subscribe(listener) {
    this.listeners.push(listener);
  }

  // 全リスナーへ更新を通知
  notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // 現在の状態スナップショットを取得
  getState() {
    return this.state;
  }

  // 1球の記録処理
  recordPitch(course, resultType) {
    // 巻き戻し（Undo）用に直前の状態をディープコピーして保存
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

    // 履歴にスナップショットとイベントをプッシュ
    this.state.history.push({ snapshot, pitchEvent });
    this.notify();
  }

  // ボール処理
  handleBall() {
    if (this.state.balls < 3) {
      this.state.balls += 1;
    } else {
      // 4ボール ➔ 四球出塁
      this.advanceWalk();
      this.resetCount();
    }
  }

  // ストライク処理（見逃し・空振り）
  handleStrike() {
    if (this.state.strikes < 2) {
      this.state.strikes += 1;
    } else {
      // 3ストライク ➔ 奪三振アウト
      this.handleOut();
      this.resetCount();
    }
  }

  // ファウル処理
  handleFoul() {
    if (this.state.strikes < 2) {
      this.state.strikes += 1;
    }
    // 2ストライク以降はカウント据え置き
  }

  // 死球処理
  handleHitByPitch() {
    this.advanceWalk();
    this.resetCount();
  }

  // アウト処理
  handleOut() {
    if (this.state.outs < 2) {
      this.state.outs += 1;
    } else {
      // 3アウト ➔ チェンジ（攻守交代）
      this.handleSideRetied();
    }
  }

  // 攻守交代
  handleSideRetied() {
    this.state.balls = 0;
    this.state.strikes = 0;
    this.state.outs = 0;
    this.state.runners = { 1: false, 2: false, 3: false };

    if (!this.state.isTop) {
      this.state.inning += 1;
      this.state.isTop = true;
      this.state.awayScore.push(0);
    } else {
      this.state.isTop = false;
      this.state.homeScore.push(0);
    }
  }

  // 四死球時の押し出し進塁ロジック
  advanceWalk() {
    if (!this.state.runners[1]) {
      this.state.runners[1] = true;
    } else if (!this.state.runners[2]) {
      this.state.runners[2] = true;
    } else if (!this.state.runners[3]) {
      this.state.runners[3] = true;
    } else {
      // 満塁押し出し（得点加算）
      this.addRun(1);
    }
  }

  // 得点加算
  addRun(points = 1) {
    if (this.state.isTop) {
      const idx = this.state.awayScore.length - 1;
      this.state.awayScore[idx] += points;
    } else {
      const idx = this.state.homeScore.length - 1;
      this.state.homeScore[idx] += points;
    }
  }

  // カウントリセット（打者完了時）
  resetCount() {
    this.state.balls = 0;
    this.state.strikes = 0;
  }

  // 走者手動トグル（画面の塁タップによる手動補正）
  toggleRunner(base) {
    if (this.state.runners[base] !== undefined) {
      this.state.runners[base] = !this.state.runners[base];
      this.notify();
    }
  }

  // 1球アンドゥ（取消）
  undo() {
    if (this.state.history.length === 0) return;
    const lastAction = this.state.history.pop();
    this.state = lastAction.snapshot;
    this.notify();
  }
}
