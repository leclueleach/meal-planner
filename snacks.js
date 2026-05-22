// ============================================================
//  snacks.js — Snacks shopping list with manual entries
// ============================================================

const Snacks = (() => {

  const MANUAL_KEY  = 'mealplanner_snacks_manual_v1';
  const CHECKED_KEY = 'mealplanner_snacks_checked_v1';

  const CAT_ICONS = {
    'Hot Drinks':          '☕',
    'Cold Drinks':         '🥤',
    'Fruit':               '🍎',
    'Nuts & Dried Fruit':  '🥜',
    'Treats & Entertaining':'🍫',
    'Dairy & Extras':      '🥛',
    'Miscellaneous':       '📦',
  };

  let sheetItems  = [];
  let manualItems = [];
  let checked     = {};
  let container   = null;

  function save() {
    try {
      localStorage.setItem(MANUAL_KEY,  JSON.stringify(manualItems));
      localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
    } catch(e) {}
  }

  function load() {
    try {
      const m = localStorage.getItem(MANUAL_KEY);
      const c = localStorage.getItem(CHECKED_KEY);
      if (m) manualItems = JSON.parse(m);
      if (c) checked     = JSON.parse(c);
    } catch(e) { manualItems = []; checked = {}; }
  }

  function init(items) { sheetItems = items; load(); }
  function mount(el)   { container = el; }

  function toggleItem(id) {
    checked[id] = !checked[id];
    save();
    const el = document.querySelector('[data-sid="' + id + '"]');
    if (el) el.classList.toggle('checked', !!checked[id]);
    updateCatCount(id);
  }

  function addManualItem(category, name) {
    if (!name.trim()) return;
    const id = 'smanual_' + Date.now();
    manualItems.push({ id, category, name: name.trim(), notes: '', recurring: false, manual: true });
    save(); render();
  }

  function removeManualItem(id) {
    manualItems = manualItems.filter(i => i.id !== id);
    delete checked[id];
    save(); render();
  }

  function clearManualItems() {
    manualItems = [];
    Object.keys(checked).forEach(k => { if (k.startsWith('smanual_')) delete checked[k]; });
    save(); render();
  }

  function uncheckAll() { checked = {}; save(); render(); }

  function updateCatCount(id) {
    const all  = [...sheetItems, ...manualItems];
    const item = all.find(i => i.id === id);
    if (!item) return;
    const catItems = all.filter(i => i.category === item.category);
    const done     = catItems.filter(i => checked[i.id]).length;
    const el = document.getElementById('scat-count-' + CSS.escape(item.category));
    if (el) el.textContent = done + '/' + catItems.length;
  }

  function render() {
    if (!container) return;
    const all = [...sheetItems, ...manualItems];
    const cats = {};
    all.forEach(item => { if (!cats[item.category]) cats[item.category] = []; cats[item.category].push(item); });
    const total    = all.length;
    const done     = all.filter(i => checked[i.id]).length;
    const pct      = total ? Math.round((done / total) * 100) : 0;
    const hasManual = manualItems.length > 0;

    container.innerHTML =
      '<div class="progress-wrap">' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="progress-label">' + done + ' of ' + total + ' items ticked</div>' +
      '</div>' +
      '<div class="household-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="Snacks.uncheckAll()">Uncheck all</button>' +
        (hasManual ? '<button class="btn btn-ghost btn-sm" onclick="Snacks.clearManualItems()">Clear manual items</button>' : '') +
      '</div>' +
      '<div class="household-add-bar">' +
        '<input type="text" id="snacks-add-input" class="household-input" placeholder="Add a snack or drink..." onkeydown="if(event.key===\'Enter\')Snacks.submitQuickAdd()" />' +
        '<select id="snacks-add-cat" class="household-select">' +
          Object.keys(CAT_ICONS).map(c => '<option value="' + c + '">' + CAT_ICONS[c] + ' ' + c + '</option>').join('') +
        '</select>' +
        '<button class="household-add-btn" onclick="Snacks.submitQuickAdd()">+ Add</button>' +
      '</div>' +
      (!all.length
        ? '<div class="list-empty">No snacks found. Add items above or check your Google Sheet.</div>'
        : Object.entries(cats).map(([cat, items]) => {
            const catDone = items.filter(i => checked[i.id]).length;
            const icon    = CAT_ICONS[cat] || '📦';
            return '<div class="category">' +
              '<div class="category-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
                '<div class="category-title">' +
                  '<span class="category-icon">' + icon + '</span>' +
                  '<span class="category-name">' + cat + '</span>' +
                  '<span class="category-count" id="scat-count-' + CSS.escape(cat) + '">' + catDone + '/' + items.length + '</span>' +
                '</div>' +
                '<span class="category-chevron">▼</span>' +
              '</div>' +
              '<div class="category-items">' +
                items.map(item => {
                  const isChecked = !!checked[item.id];
                  return '<div class="item ' + (isChecked ? 'checked' : '') + '" data-sid="' + item.id + '" onclick="Snacks.toggleItem(\'' + item.id + '\')">' +
                    '<div class="checkbox"><span class="checkmark">✓</span></div>' +
                    '<div class="item-text">' +
                      '<div class="item-name">' + item.name +
                        (item.manual    ? ' <span class="manual-tag">manual</span>'    : '') +
                        (item.recurring ? ' <span class="recurring-tag">recurring</span>' : '') +
                      '</div>' +
                      (item.notes ? '<div class="item-note">' + item.notes + '</div>' : '') +
                    '</div>' +
                    (item.manual ? '<button class="item-remove" onclick="event.stopPropagation();Snacks.removeManualItem(\'' + item.id + '\')">×</button>' : '') +
                  '</div>';
                }).join('') +
              '</div>' +
            '</div>';
          }).join(''));
  }

  function submitQuickAdd() {
    const input = document.getElementById('snacks-add-input');
    const cat   = document.getElementById('snacks-add-cat');
    if (!input || !cat) return;
    addManualItem(cat.value, input.value);
    input.value = '';
    input.focus();
  }

  return { init, mount, render, toggleItem, addManualItem, removeManualItem, clearManualItems, uncheckAll, submitQuickAdd };
})();
