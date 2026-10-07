/**
 * js/components/rosterMasterTab.js
 * 団員名簿マスタ タブ（LINEテキスト共有 ＆ 手動DnD並び替え ＆ 学年・背番号・名前ワンタップソート対応版）
 * 
 * 機能強化:
 * - 【LINEで名簿を共有】登録済み団員全員の背番号・氏名・学年・守備をワンタップでLINE共有テキストとしてコピー
 * - 【LINEテキスト一発取込】LINEメッセージをそのまま貼り付けるだけで全員分を100%完全再現して取り込み
 * - 【インライン通知トースト】alert()を一切使わない快適なコピー完了メッセージ表示
 * - 【LocalStorage永続バックアップ】名簿更新時に端末内へ自動保存し、リセット時でも即時復元可能
 * - 既存の手動行DnD、クイックソート、公式#/練習#独立管理、手動編集モーダルを完全維持
 */

export class RosterMasterTabComponent {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.editingPlayerIndex = null;
    this.sortKey = null; // "offNum" | "pracNum" | "name" | "grade"
    this.sortAsc = true;
    this.toastTimer = null;
  }

  render() {
    const roster = typeof this.options.getRoster === "function" ? this.options.getRoster() : [];

    this.container.innerHTML = `
      <div class="space-y-3">
        
        <!-- 操作通知トーストバー (コピー完了時等) -->
        <div id="roster-toast-message" class="hidden text-xs font-bold py-1.5 px-3 rounded-xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 shadow-lg text-center transition"></div>

        <!-- 上部操作バー -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <button type="button" id="btn-open-add-player" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition">
              <span>＋ 選手を追加</span>
            </button>

            <!-- 【新設】LINE用名簿共有テキストコピーボタン -->
            <button type="button" id="btn-share-line-roster" class="bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white text-xs font-black px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-500 shadow flex items-center gap-1 transition" title="LINEグループ連絡網へ名簿を送信して他端末へ共有">
              <span>💬</span>
              <span>LINEで名簿を共有</span>
            </button>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <button type="button" id="btn-open-batch-import" class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow transition" title="LINEやテキストから名簿を一括取り込み">
              <span>📥 テキスト一括取込</span>
            </button>
            <button type="button" id="btn-clear-roster" class="bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-700 transition" title="名簿を一度空にして新規取り込みしたい場合に利用">
              <span>全消去</span>
            </button>
          </div>
        </div>

        <!-- クイック並び替え（ソート）バー -->
        <div class="bg-slate-950/70 p-1.5 rounded-xl border border-slate-800 flex items-center justify-between gap-1 text-[11px] flex-wrap">
          <span class="text-slate-400 font-bold flex items-center gap-1 pl-1">
            <span>↕️ 並び替え:</span>
          </span>
          <div class="flex items-center gap-1 flex-wrap">
            <button type="button" class="btn-quick-sort px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded font-bold border border-slate-700 transition" data-sort="offNum">
              🔢 公式#順
            </button>
            <button type="button" class="btn-quick-sort px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded font-bold border border-slate-700 transition" data-sort="pracNum">
              ⚾️ 練習#順
            </button>
            <button type="button" class="btn-quick-sort px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded font-bold border border-slate-700 transition" data-sort="grade">
              🎓 学年順
            </button>
            <button type="button" class="btn-quick-sort px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded font-bold border border-slate-700 transition" data-sort="name">
              🔤 名前順
            </button>
          </div>
        </div>

        <!-- 名簿一覧テーブル（行DnD対応） -->
        <div class="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs border-collapse select-none">
            <thead class="bg-slate-950 sticky top-0 border-b border-slate-800 text-[10px] text-slate-400">
              <tr>
                <th class="py-1.5 px-1.5 w-6 text-center text-slate-600">移動</th>
                <th class="py-1.5 px-2 cursor-pointer hover:text-slate-200" data-sort="offNum">
                  公式# <span class="sort-icon-offNum text-[9px]"></span>
                </th>
                <th class="py-1.5 px-2 cursor-pointer hover:text-slate-200" data-sort="pracNum">
                  練習# <span class="sort-icon-pracNum text-[9px]"></span>
                </th>
                <th class="py-1.5 px-2 cursor-pointer hover:text-slate-200" data-sort="name">
                  氏名 (フルネーム) <span class="sort-icon-name text-[9px]"></span>
                </th>
                <th class="py-1.5 px-1 text-center cursor-pointer hover:text-slate-200" data-sort="grade">
                  学年 <span class="sort-icon-grade text-[9px]"></span>
                </th>
                <th class="py-1.5 px-1 text-center">守備</th>
                <th class="py-1.5 px-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody id="roster-tbody" class="divide-y divide-slate-800">
              ${roster.length === 0 ? `
                <tr>
                  <td colspan="7" class="py-6 text-center text-slate-500 text-xs">
                    選手が登録されていません。「＋ 選手を追加」または「テキスト一括取込」から登録してください。
                  </td>
                </tr>
              ` : roster
                .map((p, idx) => {
                  const hasOff = p.officialNumber !== null && p.officialNumber !== undefined && p.officialNumber !== "";
                  const hasPrac = p.practiceNumber !== null && p.practiceNumber !== undefined && p.practiceNumber !== "";

                  return `
                    <tr class="roster-table-row hover:bg-slate-800/40 transition-colors" draggable="true" data-idx="${idx}">
                      <!-- ドラッグハンドル -->
                      <td class="py-1.5 px-1.5 text-center text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing roster-drag-handle" title="上下にドラッグして並び替え">
                        <span class="text-xs select-none">⠿</span>
                      </td>
                      <td class="py-1.5 px-2 font-mono font-black ${hasOff ? 'text-indigo-400' : 'text-slate-500 font-normal'}">
                        ${hasOff ? `#${p.officialNumber}` : '<span class="text-[11px] text-slate-500 font-sans">なし</span>'}
                      </td>
                      <td class="py-1.5 px-2 font-mono font-black ${hasPrac ? 'text-emerald-400' : 'text-slate-500 font-normal'}">
                        ${hasPrac ? `#${p.practiceNumber}` : '<span class="text-[11px] text-slate-500 font-sans">なし</span>'}
                      </td>
                      <td class="py-1.5 px-2 font-bold text-slate-100">${p.name}</td>
                      <td class="py-1.5 px-1 text-slate-400 text-center font-bold">${p.grade || 6}年</td>
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
        <div class="flex items-center justify-between text-[10px] text-slate-500">
          <span>登録人数: <span class="font-bold text-slate-300 font-mono">${roster.length}名</span></span>
          <span>※ 左端の「⠿」をドラッグして自由な順序に並び替えできます</span>
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

      <!-- 大型テキストエリア 一括取込専用モーダル (LINE共有テキスト完全対応) -->
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
            LINEや連絡網のテキストをそのまま丸ごと貼り付けてください。<br>
            <span class="text-indigo-400 font-bold">「【学童野球 団員名簿】」の共有メッセージもそのまま貼り付けるだけで即時認識されます。</span>
          </p>

          <textarea id="textarea-batch-input" rows="8" placeholder="ここにLINEや連絡網のテキストを丸ごと貼り付けてください&#10;例:&#10;10 佐藤 翔太 (捕) 6年&#10;1 鈴木 蓮 (投) 6年&#10;- 7 森山 惇都 8&#10;- 松本 蓮 75" class="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 outline-none font-mono leading-relaxed resize-none"></textarea>

          <!-- 取込オプション（上書き vs 追加） -->
          <div class="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-[11px]">
            <span class="text-slate-400 font-bold">取込モード:</span>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="import-mode" value="replace" checked class="accent-indigo-500">
                <span class="text-slate-200 font-bold">現在の名簿を上書き（置換）</span>
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="import-mode" value="append" class="accent-indigo-500">
                <span class="text-slate-300">末尾に追加</span>
              </label>
            </div>
          </div>

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
    this.bindDragAndDrop();
    this.updateSortIndicators();
  }

  bindEvents() {
    const btnAdd = this.container.querySelector("#btn-open-add-player");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => this.openEditModal(null));
    }

    // 【新設】LINEで名簿を共有ボタン
    const btnShareLine = this.container.querySelector("#btn-share-line-roster");
    if (btnShareLine) {
      btnShareLine.addEventListener("click", () => this.handleShareLineRoster());
    }

    const btnClear = this.container.querySelector("#btn-clear-roster");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        const roster = this.options.getRoster();
        if (roster.length === 0) return;
        this.showCustomConfirm("名簿の全消去", "登録されている団員名簿をすべて消去しますか？", () => {
          this.saveAndRerender([]);
          this.showToast("🗑 名簿をすべて消去しました。");
        });
      });
    }

    // クイックソートボタン
    this.container.querySelectorAll(".btn-quick-sort").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-sort");
        this.handleSort(key);
      });
    });

    // テーブルヘッダークリックによるソート
    this.container.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        this.handleSort(key);
      });
    });

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

  /**
   * LINE送信用に整形した名簿テキストを生成し、クリップボードにコピー
   */
  async handleShareLineRoster() {
    const roster = typeof this.options.getRoster === "function" ? this.options.getRoster() : [];

    if (roster.length === 0) {
      this.showToast("⚠️ 登録されている選手がいません。「＋ 選手を追加」から登録してください。");
      return;
    }

    let text = `【学童野球 団員名簿データ】\n`;
    text += `全${roster.length}名登録済み\n`;
    text += `━━━━━━━━━━━━━━\n`;

    roster.forEach((p, idx) => {
      const offStr = (p.officialNumber !== null && p.officialNumber !== undefined && p.officialNumber !== "")
        ? `#${p.officialNumber}`
        : `#-`;
      const pracStr = (p.practiceNumber !== null && p.practiceNumber !== undefined && p.practiceNumber !== "" && p.practiceNumber !== p.officialNumber)
        ? ` (練#${p.practiceNumber})`
        : "";
      const gradeStr = p.grade ? ` ${p.grade}年` : "";
      const posStr = p.pos ? ` [${p.pos}]` : "";

      text += `${offStr} ${p.name}${posStr}${gradeStr}${pracStr}\n`;
    });

    text += `━━━━━━━━━━━━━━\n`;
    text += `※このメッセージ全体をコピーしてアプリの「📥 テキスト一括取込」に貼り付けると、他端末に一瞬で同期できます。`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      this.showToast("✅ LINE用 名簿テキストをコピーしました！保護者グループに貼り付けて送信してください。");
    } catch (err) {
      console.warn("クリップボードコピー失敗:", err);
      this.showToast("⚠️ コピーに失敗しました。端末のクリップボード権限をご確認ください。");
    }
  }

  bindDragAndDrop() {
    const tbody = this.container.querySelector("#roster-tbody");
    if (!tbody) return;
    const rows = tbody.querySelectorAll(".roster-table-row");
    let draggedIndex = null;

    // 1. PC マウスドラッグ
    rows.forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        draggedIndex = parseInt(row.getAttribute("data-idx"), 10);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", draggedIndex);
        row.classList.add("opacity-40", "bg-emerald-950/40");
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        row.classList.add("border-y-2", "border-emerald-400");
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("border-y-2", "border-emerald-400");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("border-y-2", "border-emerald-400");
        const targetIndex = parseInt(row.getAttribute("data-idx"), 10);

        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          this.reorderRoster(draggedIndex, targetIndex);
        }
      });

      row.addEventListener("dragend", () => {
        rows.forEach((r) => r.classList.remove("opacity-40", "bg-emerald-950/40", "border-y-2", "border-emerald-400"));
        draggedIndex = null;
      });
    });

    // 2. スマホ タッチドラッグ (ハンドル操作)
    rows.forEach((row) => {
      const handle = row.querySelector(".roster-drag-handle");
      if (!handle) return;
      let activeRow = null;

      handle.addEventListener("touchstart", () => {
        draggedIndex = parseInt(row.getAttribute("data-idx"), 10);
        activeRow = row;
        row.classList.add("opacity-60", "bg-slate-800");
      }, { passive: true });

      handle.addEventListener("touchmove", (e) => {
        const clientY = e.touches[0].clientY;
        const elBelow = document.elementFromPoint(e.touches[0].clientX, clientY);
        if (!elBelow) return;
        const targetRow = elBelow.closest(".roster-table-row");
        rows.forEach((r) => r.classList.remove("border-y-2", "border-emerald-400"));
        if (targetRow && targetRow !== activeRow) {
          targetRow.classList.add("border-y-2", "border-emerald-400");
        }
      }, { passive: true });

      handle.addEventListener("touchend", (e) => {
        rows.forEach((r) => r.classList.remove("opacity-60", "bg-slate-800", "border-y-2", "border-emerald-400"));
        const clientY = e.changedTouches[0].clientY;
        const elBelow = document.elementFromPoint(e.changedTouches[0].clientX, clientY);
        if (elBelow) {
          const targetRow = elBelow.closest(".roster-table-row");
          if (targetRow) {
            const targetIndex = parseInt(targetRow.getAttribute("data-idx"), 10);
            if (draggedIndex !== null && draggedIndex !== targetIndex) {
              this.reorderRoster(draggedIndex, targetIndex);
            }
          }
        }
        draggedIndex = null;
        activeRow = null;
      });
    });
  }

  reorderRoster(fromIndex, toIndex) {
    const roster = this.options.getRoster();
    if (!roster[fromIndex] || !roster[toIndex]) return;

    const [moved] = roster.splice(fromIndex, 1);
    roster.splice(toIndex, 0, moved);

    this.saveAndRerender(roster);
  }

  handleSort(key) {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      // 学年のデフォルトは降順（6年→1年）、それ以外は昇順
      this.sortAsc = key !== "grade";
    }

    const roster = [...this.options.getRoster()];

    roster.sort((a, b) => {
      let valA, valB;

      switch (key) {
        case "offNum": {
          const numA = (a.officialNumber !== null && a.officialNumber !== undefined && a.officialNumber !== "") ? Number(a.officialNumber) : null;
          const numB = (b.officialNumber !== null && b.officialNumber !== undefined && b.officialNumber !== "") ? Number(b.officialNumber) : null;
          if (numA === null && numB === null) return 0;
          if (numA === null) return 1;
          if (numB === null) return -1;
          return this.sortAsc ? numA - numB : numB - numA;
        }

        case "pracNum": {
          const numA = (a.practiceNumber !== null && a.practiceNumber !== undefined && a.practiceNumber !== "") ? Number(a.practiceNumber) : null;
          const numB = (b.practiceNumber !== null && b.practiceNumber !== undefined && b.practiceNumber !== "") ? Number(b.practiceNumber) : null;
          if (numA === null && numB === null) return 0;
          if (numA === null) return 1;
          if (numB === null) return -1;
          return this.sortAsc ? numA - numB : numB - numA;
        }

        case "grade": {
          const gA = Number(a.grade) || 0;
          const gB = Number(b.grade) || 0;
          if (gA !== gB) {
            return this.sortAsc ? gA - gB : gB - gA;
          }
          const numA = a.officialNumber ?? a.practiceNumber ?? 99;
          const numB = b.officialNumber ?? b.practiceNumber ?? 99;
          return numA - numB;
        }

        case "name": {
          valA = a.name || "";
          valB = b.name || "";
          const cmp = valA.localeCompare(valB, "ja");
          return this.sortAsc ? cmp : -cmp;
        }

        default:
          return 0;
      }
    });

    this.saveAndRerender(roster);
  }

  updateSortIndicators() {
    if (!this.sortKey) return;
    const iconEl = this.container.querySelector(`.sort-icon-${this.sortKey}`);
    if (iconEl) {
      iconEl.textContent = this.sortAsc ? "▲" : "▼";
      iconEl.className = `sort-icon-${this.sortKey} text-[9px] text-emerald-400 font-bold`;
    }
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
    this.showToast(`✅ 「${name}」の情報を保存しました。`);
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
          countPreview.textContent = "検出中（背番号と氏名の行を探しています）...";
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

        const modeEl = this.container.querySelector("input[name='import-mode']:checked");
        const isReplace = modeEl ? modeEl.value === "replace" : true;

        let roster = isReplace ? [] : [...this.options.getRoster()];
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
        this.showToast(`🎉 ${parsed.length}名 の団員名簿を取り込みました！`);
      });
    }
  }

  /**
   * LINE共有テキスト、Markdown、CSV、番号＋名前などあらゆる形式を柔軟に検出
   */
  parseInputText(rawText) {
    if (!rawText) return [];

    const lines = rawText.split("\n");
    const results = [];

    lines.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line) return;

      // ヘッダーや区切り線、注記行を自動スキップ
      if (line.includes("【学童野球") || line.includes("登録済み") || line.includes("━━━━") || line.includes("※このメッセージ")) {
        return;
      }

      // 全角数字を半角数字へ正規化
      line = line.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
      line = line.replace(/\*\*/g, "").trim();
      line = line.replace(/^[-*•・]\s*/, "").trim();

      // LINE共有フォーマット:例 "#10 佐藤 翔太 [捕] 6年 (練#1)" または "#- 鈴木 [投] 5年"
      const matchLineFormat = line.match(/^#?(\d+|-)\s+(.+?)(?:\s+\[([^\s\]]+)\]|\s+\(([^\s\)]+)\))?(?:\s+(\d)年)?(?:\s+\(練#?(\d+)\))?$/);
      if (matchLineFormat) {
        const offRaw = matchLineFormat[1];
        const namePart = matchLineFormat[2].trim();
        const posPart = matchLineFormat[3] || matchLineFormat[4] || "投";
        const gradePart = matchLineFormat[5] ? parseInt(matchLineFormat[5], 10) : 6;
        const pracPart = matchLineFormat[6] ? parseInt(matchLineFormat[6], 10) : null;

        const offNum = offRaw === "-" ? null : parseInt(offRaw, 10);
        const pracNum = pracPart !== null ? pracPart : offNum;

        if (namePart) {
          results.push({
            offNum,
            pracNum,
            name: namePart,
            grade: gradePart,
            pos: posPart
          });
          return;
        }
      }

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

      if (fullName && (pracNum !== null || offNum !== null)) {
        results.push({
          offNum,
          pracNum: pracNum !== null ? pracNum : offNum,
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

    this.showCustomConfirm("選手削除", `「${pName}」を名簿から削除しますか？`, () => {
      roster.splice(idx, 1);
      this.saveAndRerender(roster);
      this.showToast(`🗑 「${pName}」を名簿から削除しました。`);
    });
  }

  /**
   * alert() / confirm() を一切使わないインライン確認ダイアログ
   */
  showCustomConfirm(title, message, onConfirm) {
    let confirmBox = document.getElementById("roster-custom-confirm-modal");
    if (!confirmBox) {
      confirmBox = document.createElement("div");
      confirmBox.id = "roster-custom-confirm-modal";
      confirmBox.className = "fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 select-none";
      document.body.appendChild(confirmBox);
    }

    confirmBox.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xs p-4 shadow-2xl space-y-3">
        <h3 class="font-black text-sm text-slate-100 flex items-center gap-1.5">
          <span>⚠️</span>
          <span>${title}</span>
        </h3>
        <p class="text-xs text-slate-300 leading-relaxed">${message}</p>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" id="btn-roster-confirm-cancel" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition">
            キャンセル
          </button>
          <button type="button" id="btn-roster-confirm-ok" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-lg shadow transition">
            はい、実行
          </button>
        </div>
      </div>
    `;

    confirmBox.classList.remove("hidden");

    const btnCancel = confirmBox.querySelector("#btn-roster-confirm-cancel");
    const btnOk = confirmBox.querySelector("#btn-roster-confirm-ok");

    btnCancel.addEventListener("click", () => {
      confirmBox.classList.add("hidden");
    });

    btnOk.addEventListener("click", () => {
      confirmBox.classList.add("hidden");
      if (typeof onConfirm === "function") onConfirm();
    });
  }

  /**
   * 操作完了・通知用インラインメッセージ
   */
  showToast(message) {
    const toast = this.container.querySelector("#roster-toast-message");
    if (!toast) return;

    if (this.toastTimer) clearTimeout(this.toastTimer);
    toast.textContent = message;
    toast.classList.remove("hidden");

    this.toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 3200);
  }

  /**
   * コールバック通知 ＆ 端末内LocalStorageへの永続バックアップ保存
   */
  saveAndRerender(updatedRoster) {
    // 1. LocalStorageへ永続バックアップ
    try {
      localStorage.setItem("gakudo_master_roster", JSON.stringify(updatedRoster));
    } catch (err) {
      console.warn("LocalStorageへの名簿保存スキップ:", err);
    }

    // 2. 外部状態（rosterView等）へのコールバック通知
    if (typeof this.options.onSave === "function") {
      this.options.onSave(updatedRoster);
    }

    this.render();
  }
}
