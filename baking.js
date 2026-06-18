// ============================================================
//  baking.js — "Other / Make Anytime" baking selections
//  Toggle a baking recipe on + set batch count; feeds shopping list
// ============================================================

const Baking = (() => {

  const SELECTED_KEY = 'mealplanner_baking_selected_v1';
  const BATCH_KEY    = 'mealplanner_baking_batch_v1';

  let recipes   = [];          // baking meals from the Baking sheet
  let selected  = {};          // { mealName: true }
  let batch     = {};          // { mealName: count }
  let syncReady = false;
  let container = null;

  // ── Storage ───────────────────────────────────────────────
  function save() {
    try {
      localStorage.setItem(SELECTED_KEY, JSON.stringify(selected));
      localStorage.setItem(BATCH_KEY, JSON.stringify(batch));
    } catch(e) {}
    if (syncReady && typeof FirebaseSync !== 'undefined' && FirebaseSync.isReady()) {
      FirebaseSync.saveBakingSelected(selected);
      FirebaseSync.saveBakingBatch(batch);
    }
  }

  function load() {
    try {
      const s = localStorage.getItem(SELECTED_KEY);
      const b = localStorage.getItem(BATCH_KEY);
      if (s) selected = JSON.parse(s);
      if (b) batch    = JSON.parse(b);
    } catch(e) { selected = {}; batch = {}; }
  }

  function init(bakingRecipes) {
    recipes = bakingRecipes || [];
    load();
  }

  function initSync() {
    if (typeof FirebaseSync === 'undefined' || !FirebaseSync.isReady()) { syncReady = true; return; }
    let gotSel = false, gotBatch = false;
    function maybeReady() { if (gotSel && gotBatch) syncReady = true; }
    FirebaseSync.listenBakingSelected(remote => {
      if (remote && typeof remote === 'object') {
        selected = remote;
        try { localStorage.setItem(SELECTED_KEY, JSON.stringify(selected)); } catch(e) {}
        if (container) render();
        if (typeof App !== 'undefined' && App.onPlannerChanged) App.onPlannerChanged();
      }
      gotSel = true; maybeReady();
    });
    FirebaseSync.listenBakingBatch(remote => {
      if (remote && typeof remote === 'object') {
        batch = remote;
        try { localStorage.setItem(BATCH_KEY, JSON.stringify(batch)); } catch(e) {}
        if (container) render();
        if (typeof App !== 'undefined' && App.onPlannerChanged) App.onPlannerChanged();
      }
      gotBatch = true; maybeReady();
    });
    setTimeout(() => { syncReady = true; }, 5000);
  }

  function mount(el) { container = el; }

  // ── Selection logic ───────────────────────────────────────
  function toggle(name) {
    selected[name] = !selected[name];
    if (selected[name] && !batch[name]) batch[name] = 1;
    save();
    render();
    if (typeof App !== 'undefined' && App.onPlannerChanged) App.onPlannerChanged();
  }

  function changeBatch(name, delta) {
    const current = batch[name] || 1;
    const next = Math.max(1, current + delta);
    batch[name] = next;
    save();
    const el = document.getElementById('bake-batch-' + CSS.escape(name));
    if (el) el.textContent = next + '×';
    if (typeof App !== 'undefined' && App.onPlannerChanged) App.onPlannerChanged();
  }

  // Exposed so the shopping list can include selected baking items
  function getSelectedMeals() {
    // Returns array of { meal, batch } for selected baking recipes
    return recipes
      .filter(r => selected[r.name])
      .map(r => ({ meal: r, batch: batch[r.name] || 1 }));
  }

  function getRecipes() { return recipes; }

  // ── Render ────────────────────────────────────────────────
  function render() {
    if (!container) return;
    if (!recipes.length) {
      container.innerHTML = '<div class="stub-empty"><div class="stub-icon">🧁</div><div class="stub-title">No baking recipes yet</div><div class="stub-text">Add baking recipes to the Baking tab in your Google Sheet, then refresh.</div></div>';
      return;
    }

    const selectedCount = recipes.filter(r => selected[r.name]).length;

    container.innerHTML =
      '<div class="planner-wrap">' +
        '<div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Make Anytime</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:14px;line-height:1.5">Toggle anything you want to bake. Ingredients are added to your shopping list, scaled by batch count.</div>' +
        recipes.map(r => {
          const isSel = !!selected[r.name];
          const n = batch[r.name] || 1;
          return '<div class="planner-day" style="margin-bottom:8px">' +
            '<div class="planner-slot ' + (isSel ? 'filled' : '') + '" style="margin:0" onclick="Baking.toggle(\'' + r.name.replace(/'/g,"\\'") + '\')">' +
              '<span class="slot-icon">🧁</span>' +
              '<div class="slot-content">' +
                '<div class="slot-meal">' + r.name + '</div>' +
              '</div>' +
              (isSel
                ? '<div class="slot-batch" onclick="event.stopPropagation()">' +
                    '<button class="slot-batch-btn" onclick="Baking.changeBatch(\'' + r.name.replace(/'/g,"\\'") + '\', -1)">−</button>' +
                    '<span class="slot-batch-count" id="bake-batch-' + CSS.escape(r.name) + '">' + n + '×</span>' +
                    '<button class="slot-batch-btn" onclick="Baking.changeBatch(\'' + r.name.replace(/'/g,"\\'") + '\', 1)">+</button>' +
                  '</div>'
                : '<span style="font-size:0.72rem;color:var(--text-muted)">tap to add</span>') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
  }

  function getState() { return { recipes, selected, batch }; }

  return { init, initSync, mount, render, toggle, changeBatch, getSelectedMeals, getRecipes, getState };
})();
