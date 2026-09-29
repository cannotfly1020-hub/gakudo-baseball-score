/**
 * js/components/tenkeyModal.js
 * 相手チーム選手 背番号・氏名入力用 大型テンキーモーダルコンポーネント
 */

export class TenkeyModalComponent {
  /**
   * @param {HTMLElement} containerElement テンキー受皿要素 (#tenkey-modal-slot)
   * @param {Function} onConfirm 入力決定時のコールバック (orderIdx, { number, name }) => void
   */
  constructor(containerElement, onConfirm) {
    this.container = containerElement;
    this.onConfirm = onConfirm;

    this.targetSlot = null;
    this.currentNumber = "";
  }

  /**
   * テンキーモーダルを展開
   * @param {number|string} orderIdx 打順インデックス (0〜8) または "opp_bench"
   * @param {Object} currentSlot 現在のスロット情報 { number, name, pos }
   */
  open(orderIdx, currentSlot = {}) {
    this.targetSlot = orderIdx;
    this.currentNumber = currentSlot.number ? String(currentSlot.number) : "";

    // 「相手 1番」や「1番 打者」などの自動生成名は空欄にして入力しやすくする
    const isAutoName = currentSlot.name && (currentSlot.name.includes("番 打者") || currentSlot.name.includes("相手"));
    const initialName = (currentSlot.name && !isAutoName) ? currentSlot.name : "";

    this.render(orderIdx, initialName);
    this.bindEvents();
    this.container.className = "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 select-none";
  }

  close() {
    this.container.className = "hidden";
    this.container.innerHTML = "";
    this.targetSlot = null;
    this.currentNumber = "";
  }

  render(orderIdx, initialName) {
    // 相手控え登録時は「相手 控え選手登録」、通常スロット時は「〇番 相手選手情報入力」と自然に切り替え
    const isBench = orderIdx === "opp_bench";
    const titleText = isBench 
      ? "相手 控え選手登録" 
      : `${typeof orderIdx === "number" ? orderIdx + 1 : ""}番 相手選手情報入力`;

    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-[280px] p-3.5 shadow-2xl space-y-3">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 class="text-xs font-black text-amber-400">${titleText}</h3>
          <button type="button" id="btn-tenkey-close" class="text-slate-400 hover:text-white text-base">✕</button>
        </div>

        <!-- 背番号 ＆ 氏名入力エリア -->
        <div class="space-y-2">
          <div class="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
            <span class="text-xs text-slate-400 font-bold">背番号:</span>
            <span class="font-mono font-black text-2xl text-emerald-400"># <span id="tenkey-display">${this.currentNumber || "_"}</span></span>
          </div>

          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">選手氏名 (苗字など)</label>
            <input type="text" id="input-opp-player-name" value="${initialName}" placeholder="例: 佐藤" class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-bold">
          </div>
        </div>

        <!-- 電卓風テンキーパッド -->
        <div class="grid grid-cols-3 gap-1.5" id="tenkey-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"]
            .map((key) => {
              const bgClass =
                key === "OK"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black"
                  : key === "C"
                  ? "bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-bold"
                  : "bg-slate-800 hover:bg-slate-700 text-white font-bold";
              return `
              <button type="button" class="btn-tenkey-key py-2.5 rounded-xl text-sm shadow active:scale-95 transition ${bgClass}" data-key="${key}">
                ${key}
              </button>
            `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  bindEvents() {
    const closeBtn = this.container.querySelector("#btn-tenkey-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }

    const displayEl = this.container.querySelector("#tenkey-display");
    const nameInputEl = this.container.querySelector("#input-opp-player-name");

    this.container.querySelectorAll(".btn-tenkey-key").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-key");
        if (key === "C") {
          this.currentNumber = "";
        } else if (key === "OK") {
          const num = parseInt(this.currentNumber, 10);
          const enteredName = nameInputEl ? nameInputEl.value.trim() : "";

          if (typeof this.onConfirm === "function" && this.targetSlot !== null) {
            this.onConfirm(this.targetSlot, {
              number: !isNaN(num) ? num : undefined,
              name: enteredName || (!isNaN(num) ? `${num}番 打者` : undefined)
            });
          }
          this.close();
          return;
        } else {
          if (this.currentNumber.length < 3) {
            this.currentNumber += key;
          }
        }

        if (displayEl) {
          displayEl.textContent = this.currentNumber || "_";
        }
      });
    });
  }
}
