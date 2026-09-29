/**
 * js/components/rosterMasterTab.js
 * 団員名簿マスタ タブ（選手一覧表示・追加・一括取込・削除・2系統背番号対応）
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
          <button type="button" id="btn-open-batch-import" class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-400 border border-sky-900/50 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
            <span>📥 テキスト一括取込</span>
          </button>
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
              ${roster
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
    if (!offNumStr) return;
    const pracNumStr = prompt("【練習試合用】背番号を入力してください (空欄の場合は公式戦と同じになります):", offNumStr);
    const nameStr = prompt("選手氏名を入力してください (例: 高橋 翔太):");
    if (!nameStr) return;
    const posStr = prompt("守備位置 (例: 投, 捕, 一, 外):", "投") || "投";

    const offNum = parseInt(offNumStr, 10) || 99;
    const pracNum = pracNumStr ? (parseInt(pracNumStr, 10) || offNum) : offNum;
    const matchType = typeof this.options.getMatchType === "function" ? this.options.getMatchType() : "official";

    const roster = this.options.getRoster();
    roster.push({
      id: `p_${Date.now()}`,
      number: matchType === "official" ? offNum : pracNum,
      officialNumber: offNum,
      practiceNumber: pracNum,
      name: nameStr.trim(),
      grade: 6,
      throws: "右",
      bats: "右",
      pos: posStr.trim()
    });

    this.saveAndRerender(roster);
  }

  handleBatchImport() {
    const text = prompt(
      "テキストを貼り付けてください:\n\n形式1 (公式, 練習, 氏名, 学年, 守備):\n10, 1, 山田 太郎, 6, 投\n\n形式2 (従来の単一番号):\n1, 山田 太郎, 6, 投"
    );
    if (!text) return;

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const roster = this.options.getRoster();
    const matchType = typeof this.options.getMatchType === "function" ? this.options.getMatchType() : "official";
    let count = 0;

    lines.forEach((line) => {
      const parts = line.split(/[,、\s\t]+/).filter(Boolean);
      if (parts.length >= 2) {
        if (parts.length >= 3 && !isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
          const offNum = parseInt(parts[0], 10);
          const pracNum = parseInt(parts[1], 10);
          const name = parts[2];
          const grade = parts[3] ? parseInt(parts[3], 10) || 6 : 6;
          const pos = parts[4] || "投";

          if (name) {
            roster.push({
              id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              number: matchType === "official" ? offNum : pracNum,
              officialNumber: offNum,
              practiceNumber: pracNum,
              name,
              grade,
              throws: "右",
              bats: "右",
              pos
            });
            count++;
          }
        } else {
          const num = parseInt(parts[0], 10);
          const name = parts[1];
          const grade = parts[2] ? parseInt(parts[2], 10) || 6 : 6;
          const pos = parts[3] || "投";

          if (!isNaN(num) && name) {
            roster.push({
              id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              number: num,
              officialNumber: num,
              practiceNumber: num,
              name,
              grade,
              throws: "右",
              bats: "右",
              pos
            });
            count++;
          }
        }
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
