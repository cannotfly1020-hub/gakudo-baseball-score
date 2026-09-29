/**
 * js/components/rosterMasterTab.js
 * 団員名簿マスタ タブ（選手一覧表示・追加・スマート一括取込・削除・2系統背番号対応）
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

        <div class="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-950 sticky top-0 border-b border-slate-800 text-[10px] text-slate-400">
              <tr>
                <th class="py-1.5 px-2">公式#</th>
                <th class="py-1.5 px-2">練習#</th>
                <th class="py-1.5 px-2">氏名</th>
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
                  <td class="py-1.5 px-2 font-bold text-slate-200">${p.name}</td>
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
        const text = prompt("名簿を全消去して新規作成しますか？\n消去する場合は「クリア」と入力してください:");
        if (text === "クリア") {
          this.saveAndRerender([]);
        }
      });
    }

    const btnBatch = this.container.querySelector("#btn-open-batch-import");
    if (btnBatch) {
      btnBatch.addEventListener("click", () => this.handleBatchImport());
    }

    this.container.querySelectorAll(".btn-delete-player").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        this.handleDeletePlayer(idx);
      });
    });
  }

  handleAddPlayer() {
    const offNumStr = prompt("【公式戦用】背番号を入力してください (例: 10):");
    if (offNumStr === null || offNumStr.trim() === "") return;
    const pracNumStr = prompt("【練習試合用】背番号を入力してください (空欄の場合は公式戦と同じになります):", offNumStr);
    const nameStr = prompt("選手氏名を入力してください (例: 高橋 翔太):");
    if (!nameStr) return;
    const posStr = prompt("守備位置 (例: 投, 捕, 一, 外):", "投") || "投";

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

  /**
   * スマートテキスト一括取込パーサー
   * Markdown、LINE、カンマ区切り、空白区切りのあらゆる形式に対応
   */
  handleBatchImport() {
    const text = prompt(
      "テキストをそのまま貼り付けてください:\n\n対応形式の例:\n・- 7 森山 惇都 8 (公式# 氏名 練習#)\n・- 佐甲 大知 25 (氏名 背番号)\n・10, 1, 山田 太郎 (CSV形式)"
    );
    if (!text) return;

    const lines = text.split("\n");
    const roster = this.options.getRoster();
    const matchType = typeof this.options.getMatchType === "function" ? this.options.getMatchType() : "official";
    let count = 0;

    lines.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line) return;

      // 1. マークダウンの見出し行 (# や ##) は自動スキップ
      if (line.startsWith("#")) return;

      // 2. 装飾記号 (太字 ** や箇条書き記号 -, *, •, ・) を除去
      line = line.replace(/\*\*/g, "").trim();
      line = line.replace(/^[-*•・]\s*/, "").trim();

      // 数字が1つも含まれていない純粋なタイトル行（例: 「スターティングメンバー」など）はスキップ
      if (!/\d/.test(line)) return;

      let offNum = null;
      let pracNum = null;
      let name = "";
      let pos = "投";
      let grade = 6;

      // 3. カンマ区切りの判定
      if (line.includes(",") || line.includes("、")) {
        const parts = line.split(/[,、]+/).map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          if (!isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
            offNum = parseInt(parts[0], 10);
            pracNum = parseInt(parts[1], 10);
            name = parts[2] || "";
            grade = parts[3] ? parseInt(parts[3], 10) || 6 : 6;
            pos = parts[4] || "投";
          } else {
            const num = parseInt(parts[0], 10);
            if (!isNaN(num)) {
              offNum = num;
              pracNum = num;
              name = parts[1] || "";
              grade = parts[2] ? parseInt(parts[2], 10) || 6 : 6;
              pos = parts[3] || "投";
            }
          }
        }
      } else {
        // 4. 空白・タブ区切りのスマート解析
        const tokens = line.split(/[\s\t]+/).filter(Boolean);
        if (tokens.length >= 2) {
          const firstIsNum = !isNaN(parseInt(tokens[0], 10));
          const lastIsNum = !isNaN(parseInt(tokens[tokens.length - 1], 10));

          if (firstIsNum && lastIsNum && tokens.length >= 3) {
            // パターンA: [公式#] [氏 名 ...] [練習#] （例: 7 森山 惇都 8）
            offNum = parseInt(tokens[0], 10);
            pracNum = parseInt(tokens[tokens.length - 1], 10);
            name = tokens.slice(1, -1).join(" ");
          } else if (!firstIsNum && lastIsNum) {
            // パターンB: [氏 名 ...] [背番号] （例: 佐甲 大知 25）
            const num = parseInt(tokens[tokens.length - 1], 10);
            offNum = num;
            pracNum = num;
            name = tokens.slice(0, -1).join(" ");
          } else if (firstIsNum && !lastIsNum) {
            // パターンC: [背番号] [氏 名 ...] （例: 25 佐甲 大知）
            const num = parseInt(tokens[0], 10);
            offNum = num;
            pracNum = num;
            name = tokens.slice(1).join(" ");
          }
        }
      }

      // 名前と背番号が正しく抽出できた場合に選手登録
      if (name && offNum !== null && pracNum !== null) {
        roster.push({
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          number: matchType === "official" ? offNum : pracNum,
          officialNumber: offNum,
          practiceNumber: pracNum,
          name: name.trim(),
          grade,
          throws: "右",
          bats: "右",
          pos
        });
        count++;
      }
    });

    if (count > 0) {
      this.saveAndRerender(roster);
    }
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
