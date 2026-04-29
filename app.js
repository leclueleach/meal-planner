// ============================================================
//  app.js — Main app logic, state, rendering
// ============================================================

const App = (() => {

  // ── State ────────────────────────────────────────────────
  let state = {
    people: [],
    recipes: [],
    shoppingList: [],
    checked: {},       // { itemKey: true/false }
    loading: false,
    error: null,
    signedIn: false,
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    Auth.init(onSignedIn, onSignedOut);
    document.getElementById('btn-signin').addEventListener('click', Auth.signIn);
    document.getElementById('btn-signout').addEventListener('click', () => {
      Auth.signOut();
      onSignedOut();
    });
    document.getElementById('btn-refresh').addEventListener('click', loadData);
    document.getElementById('btn-uncheck').addEventListener('click', clearChecked);
  }

  // ── Auth callbacks ───────────────────────────────────────
  function onSignedIn() {
    state.signedIn = true;
    showScreen('app');
    loadData();
  }

  function onSignedOut() {
    state.signedIn = false;
    state.people = [];
    state.recipes = [];
    state.shoppingList = [];
    state.checked = {};
    showScreen('login');
  }

  function showScreen(name) {
    document.getElementById('screen-login').style.display = name === 'login' ? 'flex' : 'none';
    document.getElementById('screen-app').style.display = name === 'app' ? 'block' : 'none';
  }

  // ── Data loading ─────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [people, recipes] = await Promise.all([
        Sheets.getPeople(),
        Sheets.getRecipes(),
      ]);
      state.people = people;
      state.recipes = recipes;
      state.checked = {};
      rebuildList();
      renderAll();
    } catch (err) {
      setError('Could not load data from Google Sheets. ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function rebuildList() {
    state.shoppingList = Sheets.buildShoppingList(state.people, state.recipes);
  }

  // ── Toggle handlers ──────────────────────────────────────
  function togglePerson(id) {
    const p = state.people.find(p => p.id === id);
    if (p) p.include = !p.include;
    rebuildList();
    state.checked = {};
    renderAll();
  }

  function toggleMeal(name) {
    const r = state.recipes.find(r => r.name === name);
    if (r) r.include = !r.include;
    rebuildList();
    state.checked = {};
    renderAll();
  }

  function toggleItem(key) {
    state.checked[key] = !state.checked[key];
    renderProgress();
    renderList();
  }

  function clearChecked() {
    state.checked = {};
    renderList();
    renderProgress();
  }

  // ── Rendering ────────────────────────────────────────────
  function renderAll() {
    renderPeoplePanel();
    renderMealsPanel();
    renderList();
    renderProgress();
  }

  function renderPeoplePanel() {
    const el = document.getElementById('people-panel');
    if (!state.people.length) {
      el.innerHTML = '<p class="panel-empty">No people found in sheet.</p>';
      return;
    }
    el.innerHTML = state.people.map(p => `
      <label class="panel-item ${p.include ? 'active' : ''}">
        <input type="checkbox" ${p.include ? 'checked' : ''} onchange="App.togglePerson(${p.id})">
        <span class="panel-check">${p.include ? '✓' : ''}</span>
        <span class="panel-label">
          <span class="panel-name">${p.name}</span>
          <span class="panel-sub">${p.protein_g}g protein · ${p.carbs_cups} cup carbs</span>
        </span>
      </label>
    `).join('');
  }

  function renderMealsPanel() {
    const el = document.getElementById('meals-panel');
    if (!state.recipes.length) {
      el.innerHTML = '<p class="panel-empty">No recipes found in sheet.</p>';
      return;
    }
    el.innerHTML = state.recipes.map(r => `
      <label class="panel-item ${r.include ? 'active' : ''}">
        <input type="checkbox" ${r.include ? 'checked' : ''} onchange="App.toggleMeal('${r.name.replace(/'/g, "\\'")}')">
        <span class="panel-check">${r.include ? '✓' : ''}</span>
        <span class="panel-label">
          <span class="panel-name">${r.name}</span>
          <span class="panel-sub">${r.ingredients.length} ingredients</span>
        </span>
      </label>
    `).join('');
  }

  function renderList() {
    const el = document.getElementById('shopping-list');
    const items = state.shoppingList;

    if (!items.length) {
      el.innerHTML = `<div class="list-empty">Select at least one person and one meal above to generate your shopping list.</div>`;
      return;
    }

    // Group by category
    const cats = {};
    items.forEach((item, idx) => {
      if (!cats[item.category]) cats[item.category] = [];
      cats[item.category].push({ ...item, idx });
    });

    const catIcons = {
      'Proteins': '🥩', 'Fresh Produce': '🥬', 'Canned & Jarred': '🥫',
      'Stocks & Liquids': '🍲', 'Pantry & Spices': '🫙', 'Carbs (Week 1)': '🌾',
    };

    el.innerHTML = Object.entries(cats).map(([cat, catItems]) => {
      const catDone = catItems.filter(i => state.checked[itemKey(i)]).length;
      return `
        <div class="category">
          <div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <div class="category-title">
              <span class="category-icon">${catIcons[cat] || '📦'}</span>
              <span class="category-name">${cat}</span>
              <span class="category-count">${catDone}/${catItems.length}</span>
            </div>
            <span class="category-chevron">▼</span>
          </div>
          <div class="category-items">
            ${catItems.map(item => {
              const key = itemKey(item);
              const isChecked = !!state.checked[key];
              const qtyStr = formatQty(item.qty, item.unit, item.hasQty);
              return `
                <div class="item ${isChecked ? 'checked' : ''}" onclick="App.toggleItem('${key.replace(/'/g,"\\'")}')">
                  <div class="checkbox"><span class="checkmark">✓</span></div>
                  <div class="item-text">
                    <div class="item-name">${item.name}</div>
                    <div class="meal-tags">${item.meals.map(m => `<span class="meal-tag">${m}</span>`).join('')}</div>
                    ${item.notes ? `<div class="item-note">${item.notes}</div>` : ''}
                  </div>
                  <div class="item-qty">${qtyStr}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderProgress() {
    const total = state.shoppingList.length;
    const done = state.shoppingList.filter(i => state.checked[itemKey(i)]).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent = `${done} of ${total} items ticked`;
  }

  // ── Helpers ──────────────────────────────────────────────
  function itemKey(item) {
    return `${item.category}|${item.name}|${item.unit || ''}`;
  }

  function formatQty(qty, unit, hasQty) {
    if (!hasQty || qty === 0) return '';
    if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(1)} kg`;
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(1)} L`;
    if (unit) return `${qty} ${unit}`;
    return '';
  }

  function setLoading(val) {
    state.loading = val;
    document.getElementById('loading-bar').style.display = val ? 'block' : 'none';
    document.getElementById('btn-refresh').disabled = val;
    document.getElementById('btn-refresh').textContent = val ? 'Loading…' : 'Refresh';
  }

  function setError(msg) {
    state.error = msg;
    const el = document.getElementById('error-banner');
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else { el.style.display = 'none'; }
  }

  return { init, togglePerson, toggleMeal, toggleItem };
})();

// Kick off once Google Identity Services is ready
function onGisLoad() {
  App.init();
}
