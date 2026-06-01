// ============================================================
//  household.js — Household shopping list with manual entries
// ============================================================

const Household = (() => {

  const MANUAL_KEY  = 'mealplanner_household_manual_v1';
  const CHECKED_KEY = 'mealplanner_household_checked_v1';
  const QTY_KEY     = 'mealplanner_household_qty_v1';

  const CAT_ICONS = {
    'Cleaning':           '🧹',
    'Toiletries':         '🚿',
    'Paper & Disposables':'🧻',
    'Health & Medicine':  '💊',
    'Pet':                '🐾',
    'Miscellaneous':      '📦',
  };

  let sheetItems  = [];
  let manualItems = [];
  let checked     = {};
  let quantities  = {};
  let container   = null;

  function save() {
    try {
      localStorage.setItem(MANUAL_KEY,  JSON.stringify(manualItems));
      localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
      localStorage.setItem(QTY_KEY,     JSON.stringify(quantities));
    } catch(e) {}
    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isReady()) {
      FirebaseSync.saveHouseholdChecked(checked);
      FirebaseSync.saveHouseholdQty(quantities);
      FirebaseSync.saveHouseholdManual(manualItems);
    }
  }

  function load() {
    try {
      const m = localStorage.getItem(MANUAL_KEY);
      const c = localStorage.getItem(CHECKED_KEY);
      const q = localStorage.getItem(QTY_KEY);
      if (m) manualItems = JSON.parse(m);
      if (c) checked     = JSON.parse(c);
      if (q) quantities  = JSON.parse(q);
    } catch(e) { manualItems = []; checked = {}; quantities = {}; }
  }

  function init(items) {
    sheetItems = items;
    load();
    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isReady()) {
      FirebaseSync.listenHouseholdChecked(remote => { if (remote) { checked = remote; if (container) render(); } });
      FirebaseSync.listenHouseholdQty(remote => { if (remote) { quantities = remote; if (container) render(); } });
      FirebaseSync.listenHouseholdManual(remote => { if (remote) { manualItems = remote; if (container) render(); } });
    }
  }

  function mount(el) { container = el; }

  function toggleItem(id) {
    checked[id] = !checked[id];
    save();
    const el = document.querySelector('[data-hid="' + id + '"]');
    if (el) el.classList.toggle('checked', !!checked[id]);
    updateCatCount(id);
    updateProgress();
  }

  function changeQty(id, delta) {
    const current = quantities[id] || 0;
    const next = Math.max(0, current + delta);
    quantities[id] = next;
    save();
    const qtyEl  = document.getElementById('hqty-' + id);
    const cardEl = document.querySelector('[data-hid="' + id + '"]');
    if (qtyEl) {
      qtyEl.textContent = next;
      qtyEl.className = 'qty-count' + (next > 0 ? ' qty-has' : '');
    }
    if (cardEl) cardEl.classList.toggle('qty-active', next > 0);
    updateCatCount(id);
    updateProgress();
  }

  function addManualItem(category, name) {
    if (!name.trim()) return;
    const id = 'manual_' + Date.now();
    manualItems.push({ id, category, name: name.trim(), notes: '', recurring: false, manual: true });
    save(); render();
  }

  function removeManualItem(id) {
    manualItems = manualItems.filter(i => i.id !== id);
    delete checked[id];
    delete quantities[id];
    save(); render();
  }

  function clearManualItems() {
    manualItems = [];
    Object.keys(checked).forEach(k => { if (k.startsWith('manual_')) delete checked[k]; });
    Object.keys(quantities).forEach(k => { if (k.startsWith('manual_')) delete quantities[k]; });
    save(); render();
  }

  function uncheckAll() { checked = {}; save(); render(); }

  function updateCatCount(id) {
    const all       = [...sheetItems, ...manualItems];
    const item      = all.find(i => i.id === id);
    if (!item) return;
    const cat       = item.category;
    const catItems  = all.filter(i => i.category === cat);
    const catNeeded = catItems.filter(i => (quantities[i.id] || 0) >= 1);
    const done      = catNeeded.filter(i => checked[i.id]).length;
    const el = document.getElementById('hcat-count-' + CSS.escape(cat));
    if (el) el.textContent = done + '/' + catNeeded.length;
  }

  function updateProgress() {
    const all    = [...sheetItems, ...manualItems];
    const needed = all.filter(i => (quantities[i.id] || 0) >= 1);
    const total  = needed.length;
    const done   = needed.filter(i => checked[i.id]).length;
    const pct    = total ? Math.round((done / total) * 100) : 0;
    const fill   = container ? container.querySelector('.progress-fill') : null;
    const label  = container ? container.querySelector('.progress-label') : null;
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = done + ' of ' + total + ' items ticked';
  }

  function render() {
    if (!container) return;
    const all = [...sheetItems, ...manualItems];
    const cats = {};
    all.forEach(item => {
      if (!cats[item.category]) cats[item.category] = [];
      cats[item.category].push(item);
    });

    const needed    = all.filter(i => (quantities[i.id] || 0) >= 1);
    const total     = needed.length;
    const done      = needed.filter(i => checked[i.id]).length;
    const pct       = total ? Math.round((done / total) * 100) : 0;
    const hasManual = manualItems.length > 0;

    container.innerHTML =
      '<div class="progress-wrap">' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="progress-label">' + done + ' of ' + total + ' items ticked</div>' +
      '</div>' +
      '<div class="household-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="Household.uncheckAll()">Uncheck all</button>' +
        (hasManual ? '<button class="btn btn-ghost btn-sm" onclick="Household.clearManualItems()">Clear manual items</button>' : '') +
      '</div>' +
      '<div class="household-add-bar">' +
        '<input type="text" id="household-add-input" class="household-input" placeholder="Add an item..." onkeydown="if(event.key===\'Enter\')Household.submitQuickAdd()" />' +
        '<select id="household-add-cat" class="household-select">' +
          Object.keys(CAT_ICONS).map(c => '<option value="' + c + '">' + CAT_ICONS[c] + ' ' + c + '</option>').join('') +
        '</select>' +
        '<button class="household-add-btn" onclick="Household.submitQuickAdd()">+ Add</button>' +
      '</div>' +
      (!all.length
        ? '<div class="list-empty">No household items found.</div>'
        : Object.entries(cats).map(function(entry) {
            const cat       = entry[0];
            const items     = entry[1];
            const catNeeded = items.filter(i => (quantities[i.id] || 0) >= 1);
            const catDone   = catNeeded.filter(i => checked[i.id]).length;
            const catTotal  = catNeeded.length;
            const icon      = CAT_ICONS[cat] || '📦';
            return '<div class="category">' +
              '<div class="category-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
                '<div class="category-title">' +
                  '<span class="category-icon">' + icon + '</span>' +
                  '<span class="category-name">' + cat + '</span>' +
                  '<span class="category-count" id="hcat-count-' + CSS.escape(cat) + '">' + catDone + '/' + catTotal + '</span>' +
                '</div>' +
                '<span class="category-chevron">▼</span>' +
              '</div>' +
              '<div class="category-items">' +
                items.map(function(item) {
                  const isChecked = !!checked[item.id];
                  const qty = quantities[item.id] || 0;
                  return '<div class="item ' + (isChecked ? 'checked' : '') + ' ' + (qty > 0 ? 'qty-active' : '') + '" data-hid="' + item.id + '" onclick="Household.toggleItem(\'' + item.id + '\')">' +
                    '<div class="checkbox"><span class="checkmark">✓</span></div>' +
                    '<div class="item-text">' +
                      '<div class="item-name">' + item.name +
                        (item.manual    ? ' <span class="manual-tag">manual</span>'    : '') +
                        (item.recurring ? ' <span class="recurring-tag">recurring</span>' : '') +
                      '</div>' +
                      (item.notes ? '<div class="item-note">' + item.notes + '</div>' : '') +
                    '</div>' +
                    '<div class="item-qty-ctrl" onclick="event.stopPropagation()">' +
                      '<button class="qty-btn" onclick="Household.changeQty(\'' + item.id + '\', -1)">−</button>' +
                      '<span class="qty-count ' + (qty > 0 ? 'qty-has' : '') + '" id="hqty-' + item.id + '">' + qty + '</span>' +
                      '<button class="qty-btn" onclick="Household.changeQty(\'' + item.id + '\', 1)">+</button>' +
                    '</div>' +
                    (item.manual ? '<button class="item-remove" onclick="event.stopPropagation();Household.removeManualItem(\'' + item.id + '\')">×</button>' : '') +
                  '</div>';
                }).join('') +
              '</div>' +
            '</div>';
          }).join(''));
  }

  function submitQuickAdd() {
    const input = document.getElementById('household-add-input');
    const cat   = document.getElementById('household-add-cat');
    if (!input || !cat) return;
    addManualItem(cat.value, input.value);
    input.value = '';
    input.focus();
  }

  return { init, mount, render, toggleItem, changeQty, addManualItem, removeManualItem, clearManualItems, uncheckAll, submitQuickAdd };
})();
