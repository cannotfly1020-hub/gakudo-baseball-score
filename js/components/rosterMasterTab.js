/**
 * js/components/rosterMasterTab.js
 * 団員名簿マスタ タブ（公式戦背番号の「なし/空欄」完全対応版）
 */

export class RosterMasterTabComponent {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.editingPlayerIndex = null;
  }

  render() {
    const roster = typeof this.options.getRoster === "function" ? this.options.getRoster() : [];

    this.container.innerHTML = `
      <div class="space-y-3">
        <!-- 上部操作バー -->
        <div class="flex items-center justify-between gap-2">
          <button type="button" id="btn-open-add-player" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
            <span>＋ 選手を追加</span>
          </button>
          <div class="flex items-center gap-1.5">
            <button type="button" id="btn-clear-roster" class="bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-700 transition" title="名簿を一度空にして新規取り込みしたい場合に利用">
              <span>全消去</span>
            </button>
            <button type="button" id="btn-open-batch-import" class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
              <span>📥 テキスト一括取込</span>
            </button>
          </div>
        </div>

        <!-- 名簿一覧テーブル -->
        <div class="overflow-x-auto max-h-[52vh] overflow-y-auto rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-950 sticky top-0 border-b border-slate-800 text-[10px] text-slate-400">
              <tr>
                <th class="py-1.5 px-2">公式#</th>
                <th class="py-1.5 px-2">練習#</th>
                <th class="py-1.5 px-2">氏名 (フルネーム)</th>
                <th class="py-1.5 px-1 text-center">学年</th>
                <th class="py-1.5 px-1 text-center">守備</th>
                <th class="py-1.5 px-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              ${roster.length === 0 ? `
                <tr>
                  <td colspan="6" class="py-6 text-center text-slate-500 text-xs">
                    選手が登録されていません。「＋ 選手を追加」または「テキスト一括取込」から登録してください。
                  </td>
                </tr>
              ` : roster
                .map((p, idx) => {
                  const hasOff = p.officialNumber !== null && p.officialNumber !== undefined && p.officialNumber !== "";
                  const hasPrac = p.practiceNumber !== null && p.practiceNumber !== undefined && p.practiceNumber !== "";

                  return `
                    <tr class="hover:bg-slate-800/40">
                      <td class="py-1.5 px-2 font-mono font-black ${hasOff ? 'text-indigo-400' : 'text-slate-500 font-normal'}">
                        ${hasOff ? `#${p.officialNumber}` : '<span class="text-[11px] text-slate-500 font-sans">なし</span>'}
                      </td>
                      <td class="py-1.5 px-2 font-mono font-black ${hasPrac ? 'text-emerald-400' : 'text-slate-500 font-normal'}">
                        ${hasPrac ? `#${p.practiceNumber}` : '<span class="text-[11px] text-slate-500 font-sans">なし</span>'}
                      </td>
                      <td class="py-1.5 px-2 font-bold text-slate-100">${p.name}</td>
                      <td class="py-1.5 px-1 text-slate-400 text-center">${p.grade || 6}年</td>
                      <td class="py-1.5 px-1 font-bold text-amber-300 text-center">${p.pos || "投"}</td>
                      <td class="py-1.5 px-2 text-right space-x-1">
                        <button type="button" class="btn-edit-player text-sky-300 hover:text-sky-200 text-[10px] font-bold px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800 transition" data-idx="${idx}">
                          編集
                        </button>
                        <button type="button" class="btn-delete-player text-rose-400 hover:text-rose-300 text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-900 transition" data-idx="${idx}">
                          削除
                        </button>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 選手情報 編集・追加モーダル -->
      <div id="player-edit-modal" class="hidden fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 select-none">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3 flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 id="player-modal-title" class="font-black text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
              <span>✏️</span>
              <span>選手情報の編集</span>
            </h3>
            <button type="button" id="btn-close-edit-modal" class="text-slate-400 hover:text-white text-base px-2 py-0.5 rounded hover:bg-slate-800">✕</button>
          </div>

          <form id="form-player-edit" class="space-y-2.5 text-xs">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 mb-0.5">氏名 (フルネーム) <span class="text-rose-400">*必須</span></label>
              <input type="text" id="input-edit-name" required placeholder="例: 森山 惇都" class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-bold outline-none">
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-indigo-300 mb-0.5">
                  公式戦背番号 (#) <span class="text-[9px] text-slate-400 font-normal">※なしなら空欄</span>
                </label>
                <input type="number" id="input-edit-off-num" min="0" max="99" placeholder="未付与は空欄" class="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-indigo-300 font-mono font-black text-xs outline-none">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-emerald-300 mb-0.5">
                  練習試合背番号 (#) <span class="text-[9px] text-slate-400 font-normal">※任意</span>
                </label>
                <input type="number" id="input-edit-prac-num" min="0" max="99" placeholder="例: 8" class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono font-black text-xs outline-none">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-0.5">学年</label>
                <select id="select-edit-grade" class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-slate-200 text-xs font-bold outline-none">
                  <option value="6">6年</option>
                  <option value="5">5年</option>
                  <option value="4">4年</option>
                  <option value="3">3年</option>
                  <option value="2">2年</option>
                  <option value="1">1年</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-0.5">主な守備位置</label>
                <select id="select-edit-pos" class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-slate-200 text-xs font-bold outline-none">
                  <option value="投">投 (投手)</option>
                  <option value="捕">捕 (捕手)</option>
                  <option value="一">一 (一塁)</option>
                  <option value="二">二 (二塁)</option>
                  <option value="三">三 (三塁)</option>
                  <option value="遊">遊 (遊撃)</option>
                  <option value="左">左 (左翼)</option>
                  <option value="中">中 (中堅)</option>
                  <option value="右">右 (右翼)</option>
                  <option value="外">外 (外野)</option>
                </select>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" id="btn-cancel-edit" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition">
                キャンセル
              </button>
              <button type="submit" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-lg shadow-md transition flex items-center gap-1">
                <span>✓ 保存する</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 大型テキストエリア 一括取込専用モーダル -->
      <div id="batch-import-modal" class="hidden fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 select-none">
        <div class="bg-slate-900 border border-indigo-700/80 rounded-2xl w-full max-w-lg p-4 shadow-2xl space-y-3 flex flex-col max-h-[90vh]">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center gap-1.5">
              <span class="text-base">📥</span>
              <h3 class="font-black text-xs sm:text-sm text-slate-100">選手テキスト一括取込</h3>
            </div>
            <button type="button" id="btn-close-import-modal" class="text-slate-400 hover:text-white text-base px-2 py-0.5 rounded hover:bg-slate-800">✕</button>
          </div>

          <p class="text-[11px] text-slate-300 leading-relaxed">
            Markdownや箇条書きのテキストをそのまま貼り付けてください。<br>
            <span class="text-indigo-400 font-bold">「見出し」や「記号 -」は自動判別され、公式背番号がない選手も柔軟に抽出されます。</span>
          </p>

          <textarea id="textarea-batch-input" rows="8" placeholder="ここにテキストを丸ごと貼り付けてください&#10;例:&#10;- 7 森山 惇都 8&#10;- 松本 蓮 75&#10;- 5 西田 圭佑 91" class="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 outline-none font-mono leading-relaxed resize-none"></textarea>

          <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
            <span id="import-preview-count" class="text-[11px] font-bold text-slate-400">貼り付け待ち...</span>
            <div class="flex items-center gap-2">
              <button type="button" id="btn-cancel-import" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition">
                キャンセル
              </button>
              <button type="button" id="btn-execute-import" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black rounded-lg shadow-md transition flex items-center gap-1">
                <span>✓ 名簿に登録する</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const btnAdd = this.container.querySelector("#btn-open-add-player");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => this.openEditModal(null));
    }

    const btnClear = this.container.querySelector("#btn-clear-roster");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        if (window.confirm("名簿を全消去して新規作成しますか？")) {
          this.saveAndRerender([]);
        }
      });
    }

    this.container.querySelectorAll(".btn-edit-player").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        this.openEditModal(idx);
      });
    });

    this.container.querySelectorAll(".btn-delete-player").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        this.handleDeletePlayer(idx);
      });
    });

    const editModal = this.container.querySelector("#player-edit-modal");
    const btnCloseEdit = this.container.querySelector("#btn-close-edit-modal");
    const btnCancelEdit = this.container.querySelector("#btn-cancel-edit");
    const formEdit = this.container.querySelector("#form-player-edit");

    const closeEdit = () => {
      if (editModal) editModal.classList.add("hidden");
      this.editingPlayerIndex = null;
    };

    if (btnCloseEdit) btnCloseEdit.addEventListener("click", closeEdit);
    if (btnCancelEdit) btnCancelEdit.addEventListener("click", closeEdit);

    if (formEdit) {
      formEdit.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSavePlayerEdit();
      });
    }

    this.bindBatchImportEvents();
  }

  openEditModal(idx) {
    this.editingPlayerIndex = idx;
    const modal = this.container.querySelector("#player-edit-modal");
    const titleEl = this.container.querySelector("#player-modal-title");
    const inputName = this.container.querySelector("#input-edit-name");
    const inputOff = this.container.querySelector("#input-edit-off-num");
    const inputPrac = this.container.querySelector("#input-edit-prac-num");
    const selectGrade = this.container.querySelector("#select-edit-grade");
    const selectPos = this.container.querySelector("#select-edit-pos");

    if (!modal) return;

    if (idx !== null) {
      const roster = this.options.getRoster();
      const player = roster[idx];
      if (!player) return;

      if (titleEl) titleEl.innerHTML = `<span>✏️</span><span>選手情報の編集</span>`;
      if (inputName) inputName.value = player.name || "";
      if (inputOff) inputOff.value = (player.officialNumber !== null && player.officialNumber !== undefined) ? player.officialNumber : "";
      if (inputPrac) inputPrac.value = (player.practiceNumber !== null && player.practiceNumber !== undefined) ? player.practiceNumber : "";
      if (selectGrade) selectGrade.value = String(player.grade || 6);
      if (selectPos) selectPos.value = player.pos || "投";
    } else {
      if (titleEl) titleEl.innerHTML = `<span>＋</span><span>新規選手の追加</span>`;
      if (inputName) inputName.value = "";
      if (inputOff) inputOff.value = "";
      if (inputPrac) inputPrac.value = "";
      if (selectGrade) selectGrade.value = "6";
      if (selectPos) selectPos.value = "投";
    }

    modal.classList.remove("hidden");
    if (inputName) inputName.focus();
  }

  handleSavePlayerEdit() {
    const inputName = this.container.querySelector("#input-edit-name");
    const inputOff = this.container.querySelector("#input-edit-off-num");
    const inputPrac = this.container.querySelector("#input-edit-prac-num");
    const selectGrade = this.container.querySelector("#select-edit-grade");
    const selectPos = this.container.querySelector("#select-edit-pos");
    const modal = this.container.querySelector("#player-edit-modal");

    const name = inputName ? inputName.value.trim() : "";
    if (!name) return;

    // 空欄の場合は null（なし）として扱う
    const offNum = inputOff && inputOff.value.trim() !== "" ? parseInt(inputOff.value, 10) : null;
    const pracNum = inputPrac && inputPrac.value.trim() !== "" ? parseInt(inputPrac.value, 10) : (offNum ?? null);
    const grade = selectGrade ? parseInt(selectGrade.value, 10) || 6 : 6;
    const pos = selectPos ? selectPos.value : "投";

    const roster = this.options.getRoster();
    const matchType = typeof this.options.getMatchType === "function" ? this.options.getMatchType() : "official";

    const currentNumber = matchType === "official" ? offNum : pracNum;

    if (this.editingPlayerIndex !== null && roster[this.editingPlayerIndex]) {
      const target = roster[this.editingPlayerIndex];
      target.name = name;
      target.officialNumber = offNum;
      target.practiceNumber = pracNum;
      target.number = currentNumber;
      target.grade = grade;
      target.pos = pos;
    } else {
      roster.push({
        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        number: currentNumber,
        officialNumber: offNum,
        practiceNumber: pracNum,
        name: name,
        grade: grade,
        throws: "右",
        bats: "右",
        pos: pos
      });
    }

    if (modal) modal.classList.add("hidden");
    this.editingPlayerIndex = null;
    this.saveAndRerender(roster);
  }

  bindBatchImportEvents() {
    const btnBatch = this.container.querySelector("#btn-open-batch-import");
    const importModal = this.container.querySelector("#batch-import-modal");
    const btnCloseModal = this.container.querySelector("#btn-close-import-modal");
    const btnCancelModal = this.container.querySelector("#btn-cancel-import");
    const btnExecuteModal = this.container.querySelector("#btn-execute-import");
    const textarea = this.container.querySelector("#textarea-batch-input");
    const countPreview = this.container.querySelector("#import-preview-count");

    if (btnBatch && importModal) {
      btnBatch.addEventListener("click", () => {
        if (textarea) textarea.value = "";
        if (countPreview) countPreview.textContent = "テキストを貼り付けてください";
        importModal.classList.remove("hidden");
        if (textarea) textarea.focus();
      });
    }

    const closeModal = () => {
      if (importModal) importModal.classList.add("hidden");
    };

    if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

    if (textarea && countPreview) {
      textarea.addEventListener("input", () => {
        const parsed = this.parseInputText(textarea.value);
        if (parsed.length > 0) {
          countPreview.innerHTML = `<span class="text-emerald-400 font-bold">✓ ${parsed.length}名</span> の選手を検出しました`;
        } else {
          countPreview.textContent = "検出中...";
        }
      });
    }

    if (btnExecuteModal && textarea) {
      btnExecuteModal.addEventListener("click", () => {
        const parsed = this.parseInputText(textarea.value);
        if (parsed.length === 0) {
          if (countPreview) countPreview.textContent = "選手情報が検出できませんでした。";
          return;
        }

        const roster = this.options.getRoster();
        const matchType = typeof this.options.getMatchType === "function" ? this.options.getMatchType() : "official";

        parsed.forEach((p) => {
          const currentNumber = matchType === "official" ? p.offNum : p.pracNum;
          roster.push({
            id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            number: currentNumber,
            officialNumber: p.offNum,
            practiceNumber: p.pracNum,
            name: p.name,
            grade: p.grade,
            throws: "右",
            bats: "右",
            pos: p.pos
          });
        });

        closeModal();
        this.saveAndRerender(roster);
      });
    }
  }

  parseInputText(rawText) {
    if (!rawText) return [];

    const lines = rawText.split("\n");
    const results = [];

    lines.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line) return;

      if (line.startsWith("#")) return;
      line = line.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
      line = line.replace(/\*\*/g, "").trim();
      line = line.replace(/^[-*•・]\s*/, "").trim();

      if (!/\d/.test(line)) return;

      let offNum = null;
      let pracNum = null;
      let fullName = "";
      let pos = "投";
      let grade = 6;

      if (line.includes(",") || line.includes("、")) {
        const parts = line.split(/[,、]+/).map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          if (!isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
            offNum = parseInt(parts[0], 10);
            pracNum = parseInt(parts[1], 10);
            fullName = parts[2] || "";
            grade = parts[3] ? parseInt(parts[3], 10) || 6 : 6;
            pos = parts[4] || "投";
          } else {
            const num = parseInt(parts[0], 10);
            if (!isNaN(num)) {
              pracNum = num;
              offNum = num <= 20 ? num : null;
              fullName = parts[1] || "";
              grade = parts[2] ? parseInt(parts[2], 10) || 6 : 6;
              pos = parts[3] || "投";
            }
          }
        }
      } else {
        const matchDual = line.match(/^(\d+)\s+(.+?)\s+(\d+)$/);
        if (matchDual) {
          offNum = parseInt(matchDual[1], 10);
          fullName = matchDual[2].trim();
          pracNum = parseInt(matchDual[3], 10);
        } else {
          const matchNameFirst = line.match(/^(.+?)\s+(\d+)$/);
          if (matchNameFirst) {
            const num = parseInt(matchNameFirst[2], 10);
            fullName = matchNameFirst[1].trim();
            pracNum = num;
            // 学童野球において21番以上などは公式戦背番号未付与と推定
            offNum = num <= 20 ? num : null;
          } else {
            const matchNumFirst = line.match(/^(\d+)\s+(.+)$/);
            if (matchNumFirst) {
              const num = parseInt(matchNumFirst[1], 10);
              fullName = matchNumFirst[2].trim();
              pracNum = num;
              offNum = num <= 20 ? num : null;
            }
          }
        }
      }

      if (fullName && pracNum !== null) {
        results.push({
          offNum,
          pracNum,
          name: fullName,
          grade,
          pos
        });
      }
    });

    return results;
  }

  handleDeletePlayer(idx) {
    const roster = this.options.getRoster();
    const p = roster[idx];
    const pName = p ? p.name : "選手";
    if (window.confirm(`「${pName}」を名簿から削除しますか？`)) {
      roster.splice(idx, 1);
      this.saveAndRerender(roster);
    }
  }

  saveAndRerender(updatedRoster) {
    if (typeof this.options.onSave === "function") {
      this.options.onSave(updatedRoster);
    }
    this.render();
  }
}
