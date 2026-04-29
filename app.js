// ============================================================
//  app.js — Main app logic, state, rendering
// ============================================================

const App = (() => {

  // ── State ────────────────────────────────────────────────
  let state = {
    people: [],
    meals: { breakfast: [], lunch: [], dinner: [] },
    cookingSteps: {},        // { mealName: { steps: [] } }
    shoppingList: [],
    checked: {},
    mealServings: {},
    activeSection: 'shopping', // shopping | recipes
    activeTab: 'breakfast',    // breakfast | lunch | dinner | list
    recipesTab: 'breakfast',   // breakfast | lunch | dinner
    personFilter: 'All',
    recipePersonFilter: 'All',
    activeMeal: null,          // meal name currently open in cook mode
    activeTimer: null,         // { stepIdx, remaining, interval }
    loading: false,
    error: null,
    signedIn: false,
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    Auth.init(onSignedIn, onSignedOut);
    document.getElementById('btn-signin').addEventListener('click', Auth.signIn);
    document.getElementById('btn-signout').addEventListener('click', () => { Auth.signOut(); onSignedOut(); });
    document.getElementById('btn-signout-r').addEventListener('click', () => { Auth.signOut(); onSignedOut(); });
    document.getElementById('btn-refresh').addEventListener('click', loadData);
    document.getElementById('btn-refresh-r').addEventListener('click', loadData);
    document.getElementById('btn-uncheck').addEventListener('click', clearChecked);

    document.querySelectorAll('.section-tab').forEach(t =>
      t.addEventListener('click', () => switchSection(t.dataset.section)));
    document.querySelectorAll('.nav-tab').forEach(t =>
      t.addEventListener('click', () => switchTab(t.dataset.tab)));
    document.querySelectorAll('.rec-tab').forEach(t =>
      t.addEventListener('click', () => switchRecipesTab(t.dataset.tab)));
  }

  // ── Auth ─────────────────────────────────────────────────
  function onSignedIn() {
    state.signedIn = true;
    showScreen('app');
    loadData();
  }

  function onSignedOut() {
    state.signedIn = false;
    showScreen('login');
  }

  function showScreen(name) {
    document.getElementById('screen-login').style.display = name === 'login' ? 'flex' : 'none';
    document.getElementById('screen-app').style.display   = name === 'app'   ? 'flex' : 'none';
  }

  // ── Data loading ─────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [people, breakfast, lunch, dinner, cookingSteps] = await Promise.all([
        Sheets.getPeople(),
        Sheets.getMeals(CONFIG.TABS.BREAKFAST),
        Sheets.getMeals(CONFIG.TABS.LUNCH),
        Sheets.getMeals(CONFIG.TABS.DINNER),
        Sheets.getCookingSteps(),
      ]);
      state.people       = people;
      state.meals        = { breakfast, lunch, dinner };
      state.cookingSteps = cookingSteps;
      state.checked      = {};
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

  // ── Section switching (Shopping / Recipes) ────────────────
  function switchSection(section) {
    state.activeSection = section;
    state.activeMeal = null;
    stopTimer();
    document.querySelectorAll('.section-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.section === section));
    document.getElementById('shopping-section').style.display = section === 'shopping' ? 'flex' : 'none';
    document.getElementById('recipes-section').style.display  = section === 'recipes'  ? 'flex' : 'none';
    if (section === 'recipes') renderRecipesSection();
  }

  // ── Tab switching (Shopping tabs) ─────────────────────────
  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.nav-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    renderShoppingMain();
    renderHeader();
  }

  // ── Recipes tab switching ─────────────────────────────────
  function switchRecipesTab(tab) {
    state.recipesTab = tab;
    state.activeMeal = null;
    stopTimer();
    document.querySelectorAll('.rec-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    renderRecipesMealList();
  }

  // ── Person filters ────────────────────────────────────────
  function setPersonFilter(filter) {
    state.personFilter = filter;
    document.querySelectorAll('#person-filter .filter-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.filter === filter));
    renderMealList();
  }

  function setRecipePersonFilter(filter) {
    state.recipePersonFilter = filter;
    document.querySelectorAll('#recipe-person-filter .filter-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.filter === filter));
    renderRecipesMealList();
  }

  // ── Shopping toggles ──────────────────────────────────────
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
  }

  function toggleItem(key) {
    state.checked[key] = !state.checked[key];
    const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) el.classList.toggle('checked', !!state.checked[key]);
    updateCatCounts();
    renderProgress();
  }

  function clearChecked() {
    state.checked = {};
    renderList();
    renderProgress();
  }

  // ── Cook mode ─────────────────────────────────────────────
  function openMeal(mealName) {
    state.activeMeal = mealName;
    stopTimer();
    renderCookMode();
  }

  function closeMeal() {
    state.activeMeal = null;
    stopTimer();
    renderRecipesMealList();
    document.getElementById('cook-mode').style.display = 'none';
    document.getElementById('recipes-meal-list-wrap').style.display = 'block';
  }

  function startTimer(stepIdx, seconds) {
    stopTimer();
    state.activeTimer = { stepIdx, remaining: seconds };
    updateTimerDisplay(stepIdx, seconds);

    state.activeTimer.interval = setInterval(() => {
      state.activeTimer.remaining--;
      updateTimerDisplay(stepIdx, state.activeTimer.remaining);
      if (state.activeTimer.remaining <= 0) {
        stopTimer();
        const btn = document.getElementById(`timer-btn-${stepIdx}`);
        if (btn) { btn.textContent = '✓ Done'; btn.classList.add('timer-done'); }
        // Vibrate if supported
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.activeTimer?.interval) clearInterval(state.activeTimer.interval);
    state.activeTimer = null;
  }

  function updateTimerDisplay(stepIdx, remaining) {
    const el = document.getElementById(`timer-display-${stepIdx}`);
    if (el) {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
  }

  // ── Rendering ─────────────────────────────────────────────
  function renderAll() {
    renderHeader();
    renderShoppingMain();
    renderBadges();
    if (state.activeSection === 'recipes') renderRecipesSection();
  }

  function renderHeader() {
    const tab = state.activeTab;
    const listEl  = document.getElementById('header-actions-list');
    const mealsEl = document.getElementById('header-actions-meals');
    if (listEl)  listEl.style.display  = tab === 'list' ? 'flex' : 'none';
    if (mealsEl) mealsEl.style.display = tab !== 'list' ? 'flex' : 'none';
  }

  function renderShoppingMain() {
    const tab = state.activeTab;
    document.getElementById('screen-list').style.display  = tab === 'list' ? 'block' : 'none';
    document.getElementById('screen-meals').style.display = tab !== 'list' ? 'block' : 'none';
    if (tab === 'list') { renderList(); renderProgress(); }
    else { renderPersonFilter(); renderMealList(); }
  }

  function renderPersonFilter() {
    const filters = ['All', ...state.people.map(p => p.name)];
    document.getElementById('person-filter').innerHTML = filters.map(f =>
      `<button class="filter-btn ${state.personFilter === f ? 'active' : ''}" data-filter="${f}" onclick="App.setPersonFilter('${f}')">${f}</button>`
    ).join('');
  }

  function renderMealList() {
    const tab = state.activeTab;
    if (tab === 'list') return;
    const meals = state.meals[tab] || [];
    const el = document.getElementById('meal-list');

    const filtered = meals.filter(m =>
      state.personFilter === 'All' || m.person === state.personFilter || m.person === 'Both'
    );

    if (!filtered.length) { el.innerHTML = `<div class="list-empty">No meals found for this filter.</div>`; return; }

    el.innerHTML = filtered.map(m => {
      const servings = state.mealServings[m.name] || 1;
      const safeName = m.name.replace(/'/g, "\\'");
      const personTag = m.person !== 'Both'
        ? `<span class="person-tag ${m.person === 'Le Clue' ? 'tag-you' : 'tag-her'}">${m.person}</span>` : '';
      return `
        <div class="meal-card ${m.include ? 'selected' : ''}">
          <div class="meal-card-main" onclick="App.toggleMeal('${safeName}', '${tab}')">
            <div class="meal-card-check ${m.include ? 'checked' : ''}">${m.include ? '✓' : ''}</div>
            <div class="meal-card-info">
              <div class="meal-card-name">${m.name} ${personTag}</div>
              <div class="meal-card-sub">${m.ingredients.length} ingredients</div>
            </div>
          </div>
          ${m.include ? `
          <div class="meal-card-servings" onclick="event.stopPropagation()">
            <button class="srv-btn" onclick="App.changeMealServings('${safeName}','${tab}',-1)">−</button>
            <span class="srv-count">${servings}×</span>
            <button class="srv-btn" onclick="App.changeMealServings('${safeName}','${tab}',1)">+</button>
          </div>` : ''}
        </div>`;
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
    if (!items.length) { el.innerHTML = `<div class="list-empty">Select meals in Breakfast, Lunch or Dinner to build your list.</div>`; return; }

    const cats = {};
    items.forEach(item => { if (!cats[item.category]) cats[item.category] = []; cats[item.category].push(item); });

    const catIcons = { 'Proteins':'🥩','Fresh Produce':'🥬','Canned & Jarred':'🥫','Stocks & Liquids':'🍲','Pantry & Spices':'🫙','Fats':'🫒','Veg':'🥦','Veg/Fruit':'🍓','Carbs':'🌾','Carbs (Week 1)':'🌾' };

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
              const allNames = state.people.map(p => p.name);
              const isAll = item.people.length >= allNames.length;
              const peopleTag = isAll ? '' : item.people.map(p =>
                `<span class="person-tag ${p === 'Le Clue' ? 'tag-you' : 'tag-her'}">${p}</span>`).join('');
              return `
                <div class="item ${isChecked ? 'checked' : ''}" data-key="${key}" onclick="App.toggleItem('${key.replace(/'/g,"\\'")}')">
                  <div class="checkbox"><span class="checkmark">✓</span></div>
                  <div class="item-text">
                    <div class="item-name">${item.name} ${peopleTag}</div>
                    <div class="meal-tags">${item.meals.map(m => `<span class="meal-tag">${m}</span>`).join('')}</div>
                    ${item.notes ? `<div class="item-note">${item.notes}</div>` : ''}
                  </div>
                  <div class="item-qty">${qtyStr}</div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderProgress() {
    const total = state.shoppingList.length;
    const done  = state.shoppingList.filter(i => state.checked[itemKey(i)]).length;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    const fill  = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = `${done} of ${total} items ticked`;
  }

  function updateCatCounts() {
    const cats = {};
    state.shoppingList.forEach(item => { if (!cats[item.category]) cats[item.category] = []; cats[item.category].push(item); });
    Object.entries(cats).forEach(([cat, items]) => {
      const done = items.filter(i => state.checked[itemKey(i)]).length;
      const el = document.getElementById(`catcount-${CSS.escape(cat)}`);
      if (el) el.textContent = `${done}/${items.length}`;
    });
  }

  // ── Recipes section ───────────────────────────────────────
  function renderRecipesSection() {
    renderRecipePersonFilter();
    if (state.activeMeal) renderCookMode();
    else renderRecipesMealList();
  }

  function renderRecipePersonFilter() {
    const filters = ['All', ...state.people.map(p => p.name)];
    const el = document.getElementById('recipe-person-filter');
    if (el) el.innerHTML = filters.map(f =>
      `<button class="filter-btn ${state.recipePersonFilter === f ? 'active' : ''}" data-filter="${f}" onclick="App.setRecipePersonFilter('${f}')">${f}</button>`
    ).join('');
  }

  function renderRecipesMealList() {
    document.getElementById('cook-mode').style.display = 'none';
    document.getElementById('recipes-meal-list-wrap').style.display = 'block';

    const tab = state.recipesTab;
    const meals = state.meals[tab] || [];
    const el = document.getElementById('recipes-meal-list');

    const filtered = meals.filter(m =>
      state.recipePersonFilter === 'All' || m.person === state.recipePersonFilter || m.person === 'Both'
    );

    if (!filtered.length) { el.innerHTML = `<div class="list-empty">No meals found.</div>`; return; }

    el.innerHTML = filtered.map(m => {
      const hasSteps = !!state.cookingSteps[m.name];
      const safeName = m.name.replace(/'/g, "\\'");
      const personTag = m.person !== 'Both'
        ? `<span class="person-tag ${m.person === 'Le Clue' ? 'tag-you' : 'tag-her'}">${m.person}</span>` : '';
      return `
        <div class="meal-card ${hasSteps ? 'clickable' : ''}" onclick="${hasSteps ? `App.openMeal('${safeName}')` : ''}">
          <div class="meal-card-main">
            <div class="meal-card-icon">${tab === 'breakfast' ? '🌅' : tab === 'lunch' ? '🥗' : '🍲'}</div>
            <div class="meal-card-info">
              <div class="meal-card-name">${m.name} ${personTag}</div>
              <div class="meal-card-sub">${hasSteps ? `${state.cookingSteps[m.name].steps.length} steps · tap to cook` : 'No steps yet'}</div>
            </div>
            ${hasSteps ? `<div class="meal-card-arrow">›</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function renderCookMode() {
    document.getElementById('recipes-meal-list-wrap').style.display = 'none';
    const cookEl = document.getElementById('cook-mode');
    cookEl.style.display = 'block';

    const mealName = state.activeMeal;
    const mealData = state.cookingSteps[mealName];
    const mealInfo = [...state.meals.breakfast, ...state.meals.lunch, ...state.meals.dinner].find(m => m.name === mealName);

    if (!mealData) { cookEl.innerHTML = `<div class="list-empty">No steps found for this meal.</div>`; return; }

    const servings = state.mealServings[mealName] || 1;

    cookEl.innerHTML = `
      <div class="cook-header">
        <button class="back-btn" onclick="App.closeMeal()">‹ Back</button>
        <div class="cook-title">${mealName}</div>
        <div class="cook-servings">
          <button class="srv-btn" onclick="App.changeCookServings('${mealName.replace(/'/g,"\\'")}', -1)">−</button>
          <span class="srv-count">${servings}×</span>
          <button class="srv-btn" onclick="App.changeCookServings('${mealName.replace(/'/g,"\\'")}', 1)">+</button>
        </div>
      </div>

      <div class="cook-ingredients">
        <div class="cook-section-title">🧾 Ingredients</div>
        ${mealInfo ? mealInfo.ingredients.map(ing => {
          const qty = ing.qty !== null ? `<span class="ing-qty">${Math.round(ing.qty * servings * 10) / 10}${ing.unit ? ' ' + ing.unit : ''}</span>` : '';
          return `<div class="ing-row">${qty}<span class="ing-name">${ing.ingredient}</span>${ing.notes ? `<span class="ing-note">${ing.notes}</span>` : ''}</div>`;
        }).join('') : ''}
      </div>

      <div class="cook-steps">
        <div class="cook-section-title">👨‍🍳 Steps</div>
        ${mealData.steps.map((step, idx) => {
          const hasTimer = step.timer > 0;
          const m = Math.floor(step.timer / 60);
          const s = step.timer % 60;
          const timerLabel = s > 0 ? `${m}m ${s}s` : `${m} min`;
          return `
            <div class="cook-step" id="cook-step-${idx}">
              <div class="step-num">${step.stepNum}</div>
              <div class="step-body">
                <div class="step-title">${step.stepTitle}</div>
                <div class="step-instruction">${step.instruction}</div>
                ${hasTimer ? `
                <div class="step-timer">
                  <span class="timer-label">⏱ ${timerLabel}</span>
                  <span class="timer-display" id="timer-display-${idx}">${String(m).padStart(1,'0')}:${String(step.timer % 60).padStart(2,'0')}</span>
                  <button class="timer-btn" id="timer-btn-${idx}" onclick="App.startTimer(${idx}, ${step.timer})">Start</button>
                </div>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  function changeCookServings(mealName, delta) {
    state.mealServings[mealName] = Math.max(1, (state.mealServings[mealName] || 1) + delta);
    renderCookMode();
  }

  // ── Helpers ───────────────────────────────────────────────
  function itemKey(item) { return `${item.category}|${item.name}|${item.unit || ''}`; }

  function formatQty(qty, unit, hasQty) {
    if (!hasQty || qty === 0) return '';
    if (unit === 'g'  && qty >= 1000) return `${(qty / 1000).toFixed(1)} kg`;
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(1)} L`;
    return unit ? `${qty} ${unit}` : '';
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

  return { init, toggleMeal, changeMealServings, toggleItem, setPersonFilter, setRecipePersonFilter, openMeal, closeMeal, startTimer, changeCookServings };
})();

function onGisLoad() { App.init(); }
