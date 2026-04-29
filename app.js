// ============================================================
//  app.js — Main app logic, state, rendering
// ============================================================

const App = (() => {

  // ── State ────────────────────────────────────────────────
  let state = {
    people: [],
    meals: { breakfast: [], lunch: [], dinner: [] },
    shoppingList: [],
    checked: {},
    mealServings: {},
    activeTab: 'breakfast',      // breakfast | lunch | dinner | list
    personFilter: 'All',         // All | Le Clue | Partner
    loading: false,
    error: null,
    signedIn: false,
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    Auth.init(onSignedIn, onSignedOut);
    document.getElementById('btn-signin').addEventListener('click', Auth.signIn);
    document.getElementById('btn-signout').addEventListener('click', () => { Auth.signOut(); onSignedOut(); });
    document.getElementById('btn-refresh').addEventListener('click', loadData);
    document.getElementById('btn-uncheck').addEventListener('click', clearChecked);

    // Bottom nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
  }

  // ── Auth ─────────────────────────────────────────────────
  function onSignedIn() {
    state.signedIn = true;
    showScreen('app');
    loadData();
  }

  function onSignedOut() {
    state.signedIn = false;
    state.meals = { breakfast: [], lunch: [], dinner: [] };
    state.people = [];
    state.shoppingList = [];
    state.checked = {};
    showScreen('login');
  }

  function showScreen(name) {
    document.getElementById('screen-login').style.display = name === 'login' ? 'flex' : 'none';
    document.getElementById('screen-app').style.display  = name === 'app'   ? 'flex' : 'none';
  }

  // ── Data loading ─────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [people, breakfast, lunch, dinner] = await Promise.all([
        Sheets.getPeople(),
        Sheets.getMeals(CONFIG.TABS.BREAKFAST),
        Sheets.getMeals(CONFIG.TABS.LUNCH),
        Sheets.getMeals(CONFIG.TABS.DINNER),
      ]);
      state.people    = people;
      state.meals     = { breakfast, lunch, dinner };
      state.checked   = {};
      state.mealServings = {};
      [...breakfast, ...lunch, ...dinner].forEach(m => { state.mealServings[m.name] = 1; });
      rebuildList();
      renderAll();
    } catch (err) {
      setError('Could not load data from Google Sheets. ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function rebuildList() {
    state.shoppingList = Sheets.buildShoppingList(state.people, state.meals, state.mealServings);
  }

  // ── Tab switching ─────────────────────────────────────────
  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    renderMainContent();
    renderHeader();
  }

  // ── Person filter ─────────────────────────────────────────
  function setPersonFilter(filter) {
    state.personFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    renderMealList();
  }

  // ── Toggles ───────────────────────────────────────────────
  function toggleMeal(name, mealType) {
    const meal = state.meals[mealType].find(m => m.name === name);
    if (meal) meal.include = !meal.include;
    rebuildList();
    state.checked = {};
    renderMealList();
    renderBadges();
  }

  function changeMealServings(name, mealType, delta) {
    state.mealServings[name] = Math.max(1, (state.mealServings[name] || 1) + delta);
    rebuildList();
    state.checked = {};
    renderMealList();
    if (state.activeTab === 'list') renderList();
  }

  function toggleItem(key) {
    state.checked[key] = !state.checked[key];
    renderProgress();
    // Just update the single item visually
    const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) el.classList.toggle('checked', !!state.checked[key]);
    updateCatCounts();
  }

  function clearChecked() {
    state.checked = {};
    renderList();
    renderProgress();
  }

  // ── Rendering ─────────────────────────────────────────────
  function renderAll() {
    renderHeader();
    renderMainContent();
    renderBadges();
  }

  function renderHeader() {
    const tab = state.activeTab;
    const titles = { breakfast: '🌅 Breakfast', lunch: '🥗 Lunch', dinner: '🍲 Dinner', list: '🛒 Shopping List' };
    document.getElementById('header-title').textContent = titles[tab] || '';
    document.getElementById('header-actions-list').style.display = tab === 'list' ? 'flex' : 'none';
    document.getElementById('header-actions-meals').style.display = tab !== 'list' ? 'flex' : 'none';
  }

  function renderMainContent() {
    const tab = state.activeTab;
    document.getElementById('screen-list').style.display  = tab === 'list' ? 'block' : 'none';
    document.getElementById('screen-meals').style.display = tab !== 'list' ? 'block' : 'none';

    if (tab === 'list') {
      renderList();
      renderProgress();
    } else {
      renderPersonFilter();
      renderMealList();
    }
  }

  function renderPersonFilter() {
    const filters = ['All', ...state.people.map(p => p.name)];
    document.getElementById('person-filter').innerHTML = filters.map(f => `
      <button class="filter-btn ${state.personFilter === f ? 'active' : ''}"
        data-filter="${f}" onclick="App.setPersonFilter('${f}')">${f}</button>
    `).join('');
  }

  function renderMealList() {
    const tab = state.activeTab;
    if (tab === 'list') return;
    const meals = state.meals[tab] || [];
    const el = document.getElementById('meal-list');

    const filtered = meals.filter(m => {
      if (state.personFilter === 'All') return true;
      return m.person === state.personFilter || m.person === 'Both';
    });

    if (!filtered.length) {
      el.innerHTML = `<div class="list-empty">No meals found for this filter.</div>`;
      return;
    }

    el.innerHTML = filtered.map(m => {
      const servings = state.mealServings[m.name] || 1;
      const mealType = tab;
      const safeName = m.name.replace(/'/g, "\\'");
      const personTag = m.person !== 'Both' ? `<span class="person-tag ${m.person === 'Le Clue' ? 'tag-you' : 'tag-her'}">${m.person}</span>` : '';
      return `
        <div class="meal-card ${m.include ? 'selected' : ''}">
          <div class="meal-card-main" onclick="App.toggleMeal('${safeName}', '${mealType}')">
            <div class="meal-card-check ${m.include ? 'checked' : ''}">
              ${m.include ? '✓' : ''}
            </div>
            <div class="meal-card-info">
              <div class="meal-card-name">${m.name} ${personTag}</div>
              <div class="meal-card-sub">${m.ingredients.length} ingredients</div>
            </div>
          </div>
          ${m.include ? `
          <div class="meal-card-servings" onclick="event.stopPropagation()">
            <button class="srv-btn" onclick="App.changeMealServings('${safeName}', '${mealType}', -1)">−</button>
            <span class="srv-count">${servings}×</span>
            <button class="srv-btn" onclick="App.changeMealServings('${safeName}', '${mealType}', 1)">+</button>
          </div>` : ''}
        </div>
      `;
    }).join('');
  }

  function renderBadges() {
    const counts = {
      breakfast: state.meals.breakfast.filter(m => m.include).length,
      lunch:     state.meals.lunch.filter(m => m.include).length,
      dinner:    state.meals.dinner.filter(m => m.include).length,
      list:      state.shoppingList.length,
    };
    Object.entries(counts).forEach(([tab, count]) => {
      const badge = document.getElementById(`badge-${tab}`);
      if (badge) { badge.textContent = count; badge.style.display = count ? 'inline-flex' : 'none'; }
    });
  }

  function renderList() {
    const el = document.getElementById('shopping-list');
    const items = state.shoppingList;

    if (!items.length) {
      el.innerHTML = `<div class="list-empty">Select meals in Breakfast, Lunch or Dinner to build your list.</div>`;
      return;
    }

    const cats = {};
    items.forEach(item => {
      if (!cats[item.category]) cats[item.category] = [];
      cats[item.category].push(item);
    });

    const catIcons = {
      'Proteins': '🥩', 'Fresh Produce': '🥬', 'Canned & Jarred': '🥫',
      'Stocks & Liquids': '🍲', 'Pantry & Spices': '🫙', 'Fats': '🫒',
      'Veg': '🥦', 'Veg/Fruit': '🍓', 'Carbs': '🌾', 'Carbs (Week 1)': '🌾',
    };

    el.innerHTML = Object.entries(cats).map(([cat, catItems]) => {
      const catDone = catItems.filter(i => state.checked[itemKey(i)]).length;
      return `
        <div class="category" id="cat-${CSS.escape(cat)}">
          <div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <div class="category-title">
              <span class="category-icon">${catIcons[cat] || '📦'}</span>
              <span class="category-name">${cat}</span>
              <span class="category-count" id="catcount-${CSS.escape(cat)}">${catDone}/${catItems.length}</span>
            </div>
            <span class="category-chevron">▼</span>
          </div>
          <div class="category-items">
            ${catItems.map(item => {
              const key = itemKey(item);
              const isChecked = !!state.checked[key];
              const qtyStr = formatQty(item.qty, item.unit, item.hasQty);
              const allPeople = state.people.map(p => p.name);
              const isAll = item.people.length >= allPeople.length;
              const peopleTag = isAll ? '' : item.people.map(p =>
                `<span class="person-tag ${p === 'Le Clue' ? 'tag-you' : 'tag-her'}">${p}</span>`
              ).join('');
              return `
                <div class="item ${isChecked ? 'checked' : ''}" data-key="${key}" onclick="App.toggleItem('${key.replace(/'/g, "\\'")}')">
                  <div class="checkbox"><span class="checkmark">✓</span></div>
                  <div class="item-text">
                    <div class="item-name">${item.name} ${peopleTag}</div>
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
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = `${done} of ${total} items ticked`;
  }

  function updateCatCounts() {
    const cats = {};
    state.shoppingList.forEach(item => {
      if (!cats[item.category]) cats[item.category] = [];
      cats[item.category].push(item);
    });
    Object.entries(cats).forEach(([cat, items]) => {
      const done = items.filter(i => state.checked[itemKey(i)]).length;
      const el = document.getElementById(`catcount-${CSS.escape(cat)}`);
      if (el) el.textContent = `${done}/${items.length}`;
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function itemKey(item) { return `${item.category}|${item.name}|${item.unit || ''}`; }

  function formatQty(qty, unit, hasQty) {
    if (!hasQty || qty === 0) return '';
    if (unit === 'g'  && qty >= 1000) return `${(qty / 1000).toFixed(1)} kg`;
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(1)} L`;
    if (unit) return `${qty} ${unit}`;
    return '';
  }

  function setLoading(val) {
    state.loading = val;
    document.getElementById('loading-bar').style.display = val ? 'block' : 'none';
  }

  function setError(msg) {
    state.error = msg;
    const el = document.getElementById('error-banner');
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else el.style.display = 'none';
  }

  return { init, toggleMeal, changeMealServings, toggleItem, setPersonFilter };
})();

function onGisLoad() { App.init(); }
