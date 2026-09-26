// ... existing code ...
    // 3. 打者・投手情報の更新
    const batterEl = this.container.querySelector("#current-batter-info");
    const pitcherEl = this.container.querySelector("#current-pitcher-info");
    if (batterEl && state.currentBatter) {
      batterEl.textContent = `${state.currentBatter.order}番 ${state.currentBatter.name} (${state.currentBatter.pos || "打"})`;
    }
    if (pitcherEl && state.currentPitcher) {
      pitcherEl.textContent = state.currentPitcher.name;
    }

    // 4. 走者の有無に応じた走塁ボタンの活性・非活性制御（誤操作防止）
    this.updateRunnerButtons(state);

    // 5. 直近投球ログの更新（#log-slot が存在する場合）
    this.renderLog(state);
  }

  updateRunnerButtons(state) {
    const hasRunners = Boolean(
      state.runners && (state.runners[1] || state.runners[2] || state.runners[3])
    );

    const buttonIds = [
      "btn-runner-steal",
      "btn-runner-caught",
      "btn-runner-wildpitch",
      "btn-runner-pickoff"
    ];

    buttonIds.forEach((id) => {
      const btn = this.container.querySelector(`#${id}`);
      if (btn) {
        btn.disabled = !hasRunners;
        if (!hasRunners) {
          btn.classList.add("opacity-30", "cursor-not-allowed", "pointer-events-none");
        } else {
          btn.classList.remove("opacity-30", "cursor-not-allowed", "pointer-events-none");
        }
      }
    });
  }

  updateLamp(elementId, isOn, activeClass) {
// ... existing code ...
  recordRunnerAction(description, updateFn) {
    const state = this.gameState.getState();
    // 念のための安全ガード（走者がいなければ発火しない）
    const hasRunners = Boolean(
      state.runners && (state.runners[1] || state.runners[2] || state.runners[3])
    );
    if (!hasRunners) return;

    const snapshot = JSON.parse(JSON.stringify(state));

    updateFn(state);

    const pitchEvent = {
// ... existing code ...
