/**
 * js/components/rosterMasterTab.js
 * 団員名簿マスタ タブ（フルネーム完全抽出・大型テキストエリア一括取込・2系統背番号）
 */

export class RosterMasterTabComponent {
  /**
   * @param {HTMLElement} containerElement 描画対象のコンテナ要素
   * @param {Object} options コールバックと設定
   *   - getRoster: () => Array
   *   - onSave: (updatedRoster) => void
   *   - getMatchType: () => "official" | "practice"
   */
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
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
        <div class="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-950 sticky top-0 border-b border-slate-800 text-[10px] text-slate-400">
              <tr>
                <th class="py-1.5 px-2">公式#</th>
                <th class="py-1.5 px-2">練習#</th>
                <th class="py-1.5 px-2">氏名 (フルネーム)</th>
                <th class="py-1.5 px-1">学年</th>
                <th class="py-1.5 px-1">守備</th>
                <th class="py-1.5 px-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              ${roster.length === 0 ? `
                <tr>
                  <td colspan="6" class="py-6 text-center text-slate-500 text-xs">
                    選手が登録されていません。「テキスト一括取込」から名簿を登録してください。
                  </td>
                </tr>
              ` : roster
                .map(
                  (p, idx) => `
                <tr class="hover:bg-slate-800/40">
                  <td class="py-1.5 px-2 font-mono font-black text-indigo-400">#${p.officialNumber ?? p.number ?? "-"}</td>
                  <td class="py-1.5 px-2 font-mono font-black text-emerald-400">#${p.practiceNumber ?? p.number ?? "-"}</td>
                  <td class="py-1.5 px-2 font-bold text-slate-100">${p.name}</td>
                  <td class="py-1.5 px-1 text-slate-400">${p.grade}年</td>
                  <td class="py-1.5 px-1 font-bold text-amber-300">${p.pos}</td>
                  <td class="py-1.5 px-2 text-right">
                    <button type="button" class="btn-delete-player text-rose-400 hover:text-rose-300 text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-900" data-idx="${idx}">
                      削除
                    </button>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
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
            <span class="text-indigo-400 font-bold">「見出し」や「記号 -」は自動判別され、フルネームと背番号が抽出されます。</span>
          </p>

          <textarea id="textarea-batch-input" rows="8" placeholder="ここにテキストを丸ごと貼り付けてください&#10;例:&#10;- 7 森山 惇都 8&#10;- 佐甲 大知 25&#10;- 5 西田 圭佑 91" class="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 outline-none font-mono leading-relaxed resize-none"></textarea>

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
      btnAdd.addEventListener("click", () => this.handleAddPlayer());
    }

    const btnClear = this.container.querySelector("#btn-clear-roster");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        // UI安全モーダル的な確認（全消去）
        if (window.confirm("名簿を全消去して新規作成しますか？")) {
          this.saveAndRerender([]);
        }
      });
    }

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
          roster.push({
            id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            number: matchType === "official" ? p.offNum : p.pracNum,
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

    this.container.querySelectorAll(".btn-delete-player").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        this.handleDeletePlayer(idx);
      });
    });
  }

  /**
   * テキスト解析エンジン（正規表現によるフルネーム・背番号の完全抽出）
   */
  parseInputText(rawText) {
    if (!rawText) return [];

    const lines = rawText.split("\n");
    const results = [];

    lines.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line) return;

      // 1. 見出し行 (#, ##) のスキップ
      if (line.startsWith("#")) return;

      // 2. 全角数字を半角数字へ標準化 (０-９ -> 0-9)
      line = line.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

      // 3. 装飾記号 (太字 ** や箇条書き記号 -, *, •, ・) を行頭から除去
      line = line.replace(/\*\*/g, "").trim();
      line = line.replace(/^[-*•・]\s*/, "").trim();

      // 数字が1つも含まれない純粋なタイトル行はスキップ
      if (!/\d/.test(line)) return;

      let offNum = null;
      let pracNum = null;
      let fullName = "";
      let pos = "投";
      let grade = 6;

      // 4. カンマ区切りの判定
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
              offNum = num;
              pracNum = num;
              fullName = parts[1] || "";
              grade = parts[2] ? parseInt(parts[2], 10) || 6 : 6;
              pos = parts[3] || "投";
            }
          }
        }
      } else {
        // 5. 空白区切りの高度な正規表現マッチング（姓名間の空白を完全保護）

        // パターンA: [先頭数字] [氏名(スペース含有可)] [末尾数字]
        // 例: "- 7 森山 惇都 8" -> off: 7, name: "森山 惇都", prac: 8
        const matchDual = line.match(/^(\d+)\s+(.+?)\s+(\d+)$/);
        if (matchDual) {
          offNum = parseInt(matchDual[1], 10);
          fullName = matchDual[2].trim();
          pracNum = parseInt(matchDual[3], 10);
        } else {
          // パターンB: [氏名(スペース含有可)] [末尾数字]
          // 例: "- 佐甲 大知 25" -> off: 25, prac: 25, name: "佐甲 大知"
          const matchNameFirst = line.match(/^(.+?)\s+(\d+)$/);
          if (matchNameFirst) {
            const num = parseInt(matchNameFirst[2], 10);
            offNum = num;
            pracNum = num;
            fullName = matchNameFirst[1].trim();
          } else {
            // パターンC: [先頭数字] [氏名(スペース含有可)]
            // 例: "25 佐甲 大知" -> off: 25, prac: 25, name: "佐甲 大知"
            const matchNumFirst = line.match(/^(\d+)\s+(.+)$/);
            if (matchNumFirst) {
              const num = parseInt(matchNumFirst[1], 10);
              offNum = num;
              pracNum = num;
              fullName = matchNumFirst[2].trim();
            }
          }
        }
      }

      // 名前と背番号が正しく抽出できた場合にリストへ追加
      if (fullName && offNum !== null && pracNum !== null) {
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

  handleAddPlayer() {
    const offNumStr = window.prompt("【公式戦用】背番号を入力してください (例: 10):");
    if (offNumStr === null || offNumStr.trim() === "") return;
    const pracNumStr = window.prompt("【練習試合用】背番号を入力してください (空欄の場合は公式戦と同じになります):", offNumStr);
    const nameStr = window.prompt("選手氏名 (フルネーム) を入力してください (例: 高橋 翔太):");
    if (!nameStr) return;
    const posStr = window.prompt("守備位置 (例: 投, 捕, 一, 外):", "投") || "投";

    const offNum = parseInt(offNumStr, 10);
    const validOffNum = !isNaN(offNum) ? offNum : 99;
    const pracNum = pracNumStr !== null && pracNumStr.trim() !== "" ? parseInt(pracNumStr, 10) : validOffNum;
    const validPracNum = !isNaN(pracNum) ? pracNum : validOffNum;
    const matchType = typeof this.options.getMatchType === "function" ? this.options.getMatchType() : "official";

    const roster = this.options.getRoster();
    roster.push({
      id: `p_${Date.now()}`,
      number: matchType === "official" ? validOffNum : validPracNum,
      officialNumber: validOffNum,
      practiceNumber: validPracNum,
      name: nameStr.trim(),
      grade: 6,
      throws: "右",
      bats: "右",
      pos: posStr.trim()
    });

    this.saveAndRerender(roster);
  }

  handleDeletePlayer(idx) {
    const roster = this.options.getRoster();
    roster.splice(idx, 1);
    this.saveAndRerender(roster);
  }

  saveAndRerender(updatedRoster) {
    if (typeof this.options.onSave === "function") {
      this.options.onSave(updatedRoster);
    }
    this.render();
  }
}
