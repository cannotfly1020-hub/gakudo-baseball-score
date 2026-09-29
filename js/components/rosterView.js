// ... existing code ...
        <!-- 自チーム時: ベンチ名簿バッジ -->
        ${isMyTeam ? `
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-400 flex items-center gap-1">
                <span>👥 名簿から打順へ割当</span>
                <span class="text-[10px] text-indigo-400 font-mono">(${this.matchType === "official" ? "公式戦" : "練習試合"})</span>:
              </span>
              <button type="button" id="btn-copy-prev-order" class="text-[10px] text-emerald-400 hover:underline">標準オーダーで全自動配置</button>
            </div>
            <div class="flex flex-wrap gap-1 max-h-[85px] overflow-y-auto" id="bench-badges-container">
              ${this.roster
                .map((p) => {
                  const isAssigned = this.myLineup.some((slot) => slot.playerId === p.id);
                  const displayNum = this.getPlayerNumber(p);
                  return `
                    <button type="button" draggable="true" class="btn-bench-badge px-2 py-0.5 rounded text-[11px] font-bold border transition flex items-center gap-1 select-none cursor-grab active:cursor-grabbing ${
                      isAssigned ? "bg-slate-800/40 border-slate-800 text-slate-600 opacity-60" : "bg-slate-800 border-slate-700 text-emerald-400 hover:bg-emerald-950/50 hover:border-emerald-600 active:scale-95 shadow"
                    }" data-player-id="${p.id}" title="タップで割当、またはドラッグして目的の打順へドロップ">
                      <span class="font-mono font-black">#${displayNum}</span>
                      <span class="text-slate-200">${p.name.split(" ")[0]}</span>
                    </button>
                  `;
                })
                .join("")}
            </div>
          </div>
        ` : ""}

        <button type="button" id="btn-apply-lineup" class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-1.5">
// ... existing code ...
    this.container.querySelectorAll(".btn-open-slot-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderIdx = parseInt(btn.getAttribute("data-order"), 10);
        if (this.targetTeam === "opp") {
          if (this.tenkeyComponent) {
            this.tenkeyComponent.open(orderIdx, this.oppLineup[orderIdx] || {});
          }
        } else {
          this.openPlayerSelectPrompt(orderIdx);
        }
      });
    });

    // ドラッグ＆ドロップ（打順同士 ＆ 名簿から打順へ）の紐付け
    this.bindLineupDragAndDrop();

    // ベンチバッジ：ワンタップ時は「空き枠へ先頭から配置」
    this.container.querySelectorAll(".btn-bench-badge").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // ドラッグ操作だった場合はクリック処理をスキップ
        if (btn.dataset.wasDragged === "true") {
          btn.dataset.wasDragged = "false";
          return;
        }
        const pId = btn.getAttribute("data-player-id");
        const player = this.roster.find((p) => p.id === pId);
        if (!player) return;

        const emptyIdx = this.myLineup.findIndex((slot) => !slot.playerId);
        const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
        this.assignPlayerToSlot(pId, targetIdx);
      });
    });

    const btnApply = this.container.querySelector("#btn-apply-lineup");
    if (btnApply) {
      btnApply.addEventListener("click", () => this.applyLineupToGame());
    }
  }

  bindLineupDragAndDrop() {
    const rows = this.container.querySelectorAll(".lineup-slot-row");
    const badges = this.container.querySelectorAll(".btn-bench-badge");
    let dragData = null; // { type: "slot", index: 0 } または { type: "bench", playerId: "p1" }

    // 1. スロット行の PC ドラッグ
    rows.forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        const orderIdx = parseInt(row.getAttribute("data-order"), 10);
        dragData = { type: "slot", index: orderIdx };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        row.classList.add("opacity-40", "scale-[0.98]", "border-emerald-500");
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        row.classList.add("bg-emerald-950/50", "border-emerald-400");
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("bg-emerald-950/50", "border-emerald-400");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("bg-emerald-950/50", "border-emerald-400");
        const targetIndex = parseInt(row.getAttribute("data-order"), 10);

        try {
          const raw = e.dataTransfer.getData("text/plain");
          const payload = raw ? JSON.parse(raw) : dragData;
          if (!payload) return;

          if (payload.type === "slot" && payload.index !== targetIndex) {
            // 打順同士の並び替え
            this.reorderLineup(payload.index, targetIndex);
          } else if (payload.type === "bench") {
            // 名簿から指定打順への割当
            this.assignPlayerToSlot(payload.playerId, targetIndex);
          }
        } catch (err) {
          console.warn("ドロップデータ解析エラー", err);
        }
      });

      row.addEventListener("dragend", () => {
        rows.forEach((r) => r.classList.remove("opacity-40", "scale-[0.98]", "border-emerald-500", "bg-emerald-950/50", "border-emerald-400"));
        dragData = null;
      });
    });

    // 2. 名簿バッジの PC ドラッグ
    badges.forEach((badge) => {
      badge.addEventListener("dragstart", (e) => {
        const pId = badge.getAttribute("data-player-id");
        dragData = { type: "bench", playerId: pId };
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        badge.classList.add("opacity-50", "border-emerald-400");
      });

      badge.addEventListener("dragend", () => {
        badge.classList.remove("opacity-50", "border-emerald-400");
        dragData = null;
      });
    });

    // 3. スロット行の スマホタッチ (Touch DnD)
    rows.forEach((row) => {
      const handle = row.querySelector(".drag-handle");
      if (!handle) return;
      let activeRow = null;

      handle.addEventListener("touchstart", () => {
        const orderIdx = parseInt(row.getAttribute("data-order"), 10);
        dragData = { type: "slot", index: orderIdx };
        activeRow = row;
        row.classList.add("opacity-60", "border-emerald-500", "bg-slate-900");
      }, { passive: true });

      handle.addEventListener("touchmove", (e) => {
        const clientY = e.touches[0].clientY;
        const elBelow = document.elementFromPoint(e.touches[0].clientX, clientY);
        if (!elBelow) return;
        const targetRow = elBelow.closest(".lineup-slot-row");
        rows.forEach((r) => r.classList.remove("bg-emerald-950/50", "border-emerald-400"));
        if (targetRow && targetRow !== activeRow) {
          targetRow.classList.add("bg-emerald-950/50", "border-emerald-400");
        }
      }, { passive: true });

      handle.addEventListener("touchend", (e) => {
        rows.forEach((r) => r.classList.remove("opacity-60", "border-emerald-500", "bg-slate-900", "bg-emerald-950/50", "border-emerald-400"));
        const clientY = e.changedTouches[0].clientY;
        const elBelow = document.elementFromPoint(e.changedTouches[0].clientX, clientY);
        if (elBelow) {
          const targetRow = elBelow.closest(".lineup-slot-row");
          if (targetRow && dragData && dragData.type === "slot") {
            const targetIndex = parseInt(targetRow.getAttribute("data-order"), 10);
            if (dragData.index !== targetIndex) {
              this.reorderLineup(dragData.index, targetIndex);
            }
          }
        }
        dragData = null;
        activeRow = null;
      });
    });

    // 4. 名簿バッジの スマホタッチ (Touch DnD)
    badges.forEach((badge) => {
      let startX = 0, startY = 0;
      let isDragging = false;
      const pId = badge.getAttribute("data-player-id");

      badge.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = false;
        badge.dataset.wasDragged = "false";
      }, { passive: true });

      badge.addEventListener("touchmove", (e) => {
        const moveX = Math.abs(e.touches[0].clientX - startX);
        const moveY = Math.abs(e.touches[0].clientY - startY);

        // 10px以上動いたらドラッグ判定
        if (moveX > 10 || moveY > 10) {
          isDragging = true;
          badge.dataset.wasDragged = "true";
          badge.classList.add("opacity-50", "border-emerald-400");

          const elBelow = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
          const targetRow = elBelow ? elBelow.closest(".lineup-slot-row") : null;
          rows.forEach((r) => r.classList.remove("bg-emerald-950/60", "border-emerald-400"));
          if (targetRow) {
            targetRow.classList.add("bg-emerald-950/60", "border-emerald-400");
          }
        }
      }, { passive: true });

      badge.addEventListener("touchend", (e) => {
        badge.classList.remove("opacity-50", "border-emerald-400");
        rows.forEach((r) => r.classList.remove("bg-emerald-950/60", "border-emerald-400"));

        if (isDragging) {
          const clientX = e.changedTouches[0].clientX;
          const clientY = e.changedTouches[0].clientY;
          const elBelow = document.elementFromPoint(clientX, clientY);
          const targetRow = elBelow ? elBelow.closest(".lineup-slot-row") : null;

          if (targetRow) {
            const targetIndex = parseInt(targetRow.getAttribute("data-order"), 10);
            this.assignPlayerToSlot(pId, targetIndex);
          }
        }
        isDragging = false;
      });
    });
  }

  assignPlayerToSlot(playerId, targetIndex) {
    const player = this.roster.find((p) => p.id === playerId);
    if (!player || targetIndex < 0 || targetIndex >= 9) return;

    // スクロール位置の退避
    const modalScrollEl = this.container.querySelector(".overflow-y-auto");
    const modalScrollTop = modalScrollEl ? modalScrollEl.scrollTop : 0;
    const slotsScrollEl = this.container.querySelector("#lineup-slots-container");
    const slotsScrollTop = slotsScrollEl ? slotsScrollEl.scrollTop : 0;

    // もしその選手がすでに別の打順にいる場合は、その枠の選手と入れ替える（スワップ）
    const existingIndex = this.myLineup.findIndex((slot) => slot.playerId === player.id);
    const targetSlot = this.myLineup[targetIndex];

    if (existingIndex !== -1 && existingIndex !== targetIndex) {
      // 既存枠と入れ替え
      this.myLineup[existingIndex] = {
        ...targetSlot,
        order: existingIndex + 1
      };
    }

    // 指定打順スロットへ選手を配置
    this.myLineup[targetIndex] = {
      order: targetIndex + 1,
      playerId: player.id,
      number: this.getPlayerNumber(player),
      name: player.name,
      pos: player.pos || targetSlot.pos || "外"
    };

    this.saveLineup("my", this.myLineup);
    this.render();
    this.initSubComponents();
    this.bindEvents();

    // スクロール位置の即時復元
    const newModalScrollEl = this.container.querySelector(".overflow-y-auto");
    if (newModalScrollEl) newModalScrollEl.scrollTop = modalScrollTop;
    const newSlotsScrollEl = this.container.querySelector("#lineup-slots-container");
    if (newSlotsScrollEl) newSlotsScrollEl.scrollTop = slotsScrollTop;
  }

  reorderLineup(fromIndex, toIndex) {
// ... existing code ...
