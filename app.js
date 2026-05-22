// ============================================================
//  app.js — Main app logic, state, rendering
// ============================================================

const App = (() => {

  let state = {
    people: [],
    meals: { breakfast: [], lunch: [], dinner: [] },
    cookingSteps: {},
    macroTable: {},
    shoppingList: [],
    checked: {},
    mealServings: {},
    activeSection: 'shopping',
    shopTab: 'meals',            // meals | household | snacks-shop
    recipesTab: 'breakfast',
    personFilter: 'All',
    recipePersonFilter: 'All',
    activeMeal: null,
    cookFor: 'Both',
    activeTimer: null,
    timerPaused: false,
    completedSteps: {},
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
    document.querySelectorAll('.section-tab').forEach(t => t.addEventListener('click', () => switchSection(t.dataset.section)));
    document.querySelectorAll('.nav-tab').forEach(t => t.addEventListener('click', () => switchShopTab(t.dataset.tab)));
    document.querySelectorAll('.rec-tab').forEach(t => t.addEventListener('click', () => switchRecipesTab(t.dataset.tab)));
    PlannerSection.mount(document.getElementById('planner-content'));
    Household.mount(document.getElementById('household-content'));
    Snacks.mount(document.getElementById('snacks-content'));
  }

  // ── Auth ─────────────────────────────────────────────────
  function onSignedIn() { state.signedIn = true; showScreen('app'); loadData(); }
  function onSignedOut() { state.signedIn = false; showScreen('login'); }
  function showScreen(name) {
    document.getElementById('screen-login').style.display = name === 'login' ? 'flex' : 'none';
    document.getElementById('screen-app').style.display   = name === 'app'   ? 'flex' : 'none';
  }

  // ── Data loading ─────────────────────────────────────────
  async function loadData() {
    setLoading(true); setError(null);
    try {
      const [people, breakfast, lunch, dinner, cookingSteps, macroTable, householdItems, snacksItems, plannerSnacks] = await Promise.all([
        Sheets.getPeople(),
        Sheets.getMeals(CONFIG.TABS.BREAKFAST),
        Sheets.getMeals(CONFIG.TABS.LUNCH),
        Sheets.getMeals(CONFIG.TABS.DINNER),
        Sheets.getCookingSteps(),
        Sheets.getMacroTable(),
        Sheets.getHouseholdItems().catch(() => []),
        Sheets.getSnacksItems().catch(() => []),
        Sheets.getPlannerSnacks().catch(() => []),
      ]);
      state.people       = people;
      state.meals        = { breakfast, lunch, dinner };
      state.cookingSteps = cookingSteps;
      state.macroTable   = macroTable;
      state.mealServings = {};
      [...breakfast, ...lunch, ...dinner].forEach(m => { state.mealServings[m.name] = 1; });
      Household.init(householdItems);
      Snacks.init(snacksItems);
      window._plannerPeople     = people;
      window._plannerMeals      = { breakfast, lunch, dinner, snacks: plannerSnacks };
      window._plannerMacroTable = macroTable;
      Planner.init(people);
      loadMealSelections();
      loadChecked();
      rebuildList();
      renderAll();
    } catch (err) {
      setError('Could not load data from Google Sheets. ' + err.message);
    } finally { setLoading(false); }
  }

  function rebuildList() {
    // Shopping list is built from ALL selected meals across planner days
    // Pull unique selected meals from planner state
    const plannerMeals = getPlannerSelectedMeals();
    state.shoppingList = Sheets.buildShoppingList(state.people, plannerMeals, state.mealServings);
  }

  // Get unique meals selected anywhere in the planner
  function getPlannerSelectedMeals() {
    const plan = Planner.getPlan();
    const selected = { breakfast: new Set(), lunch: new Set(), dinner: new Set(), snacks: new Set() };

    Object.values(plan).forEach(day => {
      if (!day.enabled) return;
      Object.values(day.meals).forEach(personMeals => {
        ['breakfast','lunch','dinner'].forEach(slot => {
          if (personMeals[slot]) selected[slot].add(personMeals[slot]);
        });
      });
    });

    // Build filtered meal arrays with include=true only for selected
    const result = {};
    ['breakfast','lunch','dinner','snacks'].forEach(type => {
      result[type] = (state.meals[type] || []).map(m => ({
        ...m,
        include: selected[type].has(m.name),
      }));
    });
    return result;
  }

  // ── Section switching ─────────────────────────────────────
  function switchSection(section) {
    state.activeSection = section;
    state.activeMeal = null;
    stopTimer();
    document.querySelectorAll('.section-tab').forEach(t => t.classList.toggle('active', t.dataset.section === section));
    document.getElementById('shopping-section').style.display = section === 'shopping' ? 'flex' : 'none';
    document.getElementById('recipes-section').style.display  = section === 'recipes'  ? 'flex' : 'none';
    document.getElementById('planner-section').style.display  = section === 'planner'  ? 'flex' : 'none';
    if (section === 'recipes') renderRecipesSection();
    if (section === 'planner') PlannerSection.refresh();
    if (section === 'shopping') { rebuildList(); renderShoppingTab(); }
  }

  function switchShopTab(tab) {
    state.shopTab = tab;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    renderShoppingTab();
    renderShoppingHeader();
  }

  function switchRecipesTab(tab) {
    state.recipesTab = tab;
    state.activeMeal = null;
    stopTimer();
    document.querySelectorAll('.rec-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    renderRecipesMealList();
  }

  // ── Filters ───────────────────────────────────────────────
  function setRecipePersonFilter(filter) {
    state.recipePersonFilter = filter;
    document.querySelectorAll('#recipe-person-filter .filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    renderRecipesMealList();
  }

  // ── Shopping ──────────────────────────────────────────────
  function toggleItem(key) {
    state.checked[key] = !state.checked[key];
    const el = document.querySelector('[data-key="' + CSS.escape(key) + '"]');
    if (el) el.classList.toggle('checked', !!state.checked[key]);
    updateCatCounts(); renderProgress();
    saveChecked();
  }

  function clearChecked() { state.checked = {}; saveChecked(); renderList(); renderProgress(); }

  // ── Cook mode ─────────────────────────────────────────────
  function openMeal(mealName) { state.activeMeal = mealName; state.completedSteps = {}; stopTimer(); renderCookMode(); }
  function closeMeal() {
    state.activeMeal = null; stopTimer();
    renderRecipesMealList();
    document.getElementById('cook-mode').style.display = 'none';
    document.getElementById('recipes-meal-list-wrap').style.display = 'block';
  }

  function setCookFor(who) {
    state.cookFor = who;
    document.querySelectorAll('.cook-for-btn').forEach(b => b.classList.toggle('active', b.dataset.who === who));
    renderCookIngredients();
  }

  // ── Timer ─────────────────────────────────────────────────
  function startTimer(stepIdx, seconds) {
    stopTimer();
    state.timerPaused = false;
    state.activeTimer = { stepIdx, remaining: seconds };
    updateTimerDisplay(stepIdx, seconds);
    updateTimerButtons(stepIdx, 'running');
    state.activeTimer.interval = setInterval(() => {
      if (state.timerPaused) return;
      state.activeTimer.remaining--;
      updateTimerDisplay(stepIdx, state.activeTimer.remaining);
      if (state.activeTimer.remaining <= 0) {
        stopTimer();
        updateTimerButtons(stepIdx, 'done');
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        playBeep();
      }
    }, 1000);
  }

  function pauseTimer(stepIdx) {
    if (!state.activeTimer || state.activeTimer.stepIdx !== stepIdx) return;
    state.timerPaused = !state.timerPaused;
    updateTimerButtons(stepIdx, state.timerPaused ? 'paused' : 'running');
  }

  function stopTimer() {
    if (state.activeTimer?.interval) clearInterval(state.activeTimer.interval);
    state.activeTimer = null; state.timerPaused = false;
  }

  function updateTimerDisplay(stepIdx, remaining) {
    const el = document.getElementById('timer-display-' + stepIdx);
    if (el) { const m = Math.floor(remaining / 60); const s = remaining % 60; el.textContent = m + ':' + String(s).padStart(2,'0'); }
  }

  function updateTimerButtons(stepIdx, status) {
    const startBtn = document.getElementById('timer-btn-' + stepIdx);
    const pauseBtn = document.getElementById('timer-pause-' + stepIdx);
    if (status === 'running') {
      if (startBtn) { startBtn.textContent = 'Running'; startBtn.disabled = true; startBtn.classList.remove('timer-done'); }
      if (pauseBtn) { pauseBtn.style.display = 'inline-block'; pauseBtn.textContent = 'Pause'; }
    } else if (status === 'paused') {
      if (startBtn) startBtn.textContent = 'Paused';
      if (pauseBtn) pauseBtn.textContent = 'Resume';
    } else if (status === 'done') {
      if (startBtn) { startBtn.textContent = '✓ Done'; startBtn.classList.add('timer-done'); startBtn.disabled = false; }
      if (pauseBtn) pauseBtn.style.display = 'none';
    }
  }

  function toggleStepComplete(stepIdx) {
    state.completedSteps[stepIdx] = !state.completedSteps[stepIdx];
    const stepEl  = document.getElementById('cook-step-' + stepIdx);
    const checkEl = document.getElementById('step-check-' + stepIdx);
    if (stepEl)  stepEl.classList.toggle('step-done', !!state.completedSteps[stepIdx]);
    if (checkEl) { checkEl.classList.toggle('checked', !!state.completedSteps[stepIdx]); checkEl.textContent = state.completedSteps[stepIdx] ? '✓' : ''; }
  }

  // ── Rendering ─────────────────────────────────────────────
  function renderAll() {
    renderShoppingTab();
    renderShoppingHeader();
    renderBadges();
    if (state.activeSection === 'recipes') renderRecipesSection();
    if (state.activeSection === 'planner') PlannerSection.refresh();
  }

  function renderShoppingHeader() {
    const tab = state.shopTab;
    const listEl  = document.getElementById('header-actions-list');
    const mealsEl = document.getElementById('header-actions-meals');
    if (listEl)  listEl.style.display  = tab === 'meals' ? 'flex' : 'none';
    if (mealsEl) mealsEl.style.display = tab !== 'meals' ? 'flex' : 'none';
  }

  function renderShoppingTab() {
    const tab = state.shopTab;
    document.getElementById('screen-meals-list').style.display    = tab === 'meals'       ? 'block' : 'none';
    document.getElementById('screen-household').style.display     = tab === 'household'   ? 'block' : 'none';
    if (tab === 'household') Household.render();
    if (tab === 'snacks-shop') Snacks.render();
    document.getElementById('screen-snacks-shop').style.display   = tab === 'snacks-shop' ? 'block' : 'none';
    if (tab === 'meals') { renderList(); renderProgress(); }
  }

  function renderBadges() {
    const count = state.shoppingList.length;
    const badge = document.getElementById('badge-meals');
    if (badge) { badge.textContent = count; badge.style.display = count ? 'inline-flex' : 'none'; }
  }

  function renderList() {
    const el = document.getElementById('shopping-list');
    const items = state.shoppingList;
    if (!items.length) {
      el.innerHTML = '<div class="list-empty">Plan your meals in the Planner tab to generate your shopping list.</div>';
      return;
    }
    const cats = {};
    items.forEach(item => { if (!cats[item.category]) cats[item.category] = []; cats[item.category].push(item); });
    const catIcons = { 'Proteins':'🥩','Fresh Produce':'🥬','Canned & Jarred':'🥫','Stocks & Liquids':'🍲','Pantry & Spices':'🫙','Fats':'🫒','Veg':'🥦','Veg/Fruit':'🍓','Carbs':'🌾','Carbs (Week 1)':'🌾' };
    el.innerHTML = Object.entries(cats).map(([cat, catItems]) => {
      const catDone = catItems.filter(i => state.checked[itemKey(i)]).length;
      return '<div class="category" id="cat-' + CSS.escape(cat) + '">' +
        '<div class="category-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
          '<div class="category-title">' +
            '<span class="category-icon">' + (catIcons[cat] || '📦') + '</span>' +
            '<span class="category-name">' + cat + '</span>' +
            '<span class="category-count" id="catcount-' + CSS.escape(cat) + '">' + catDone + '/' + catItems.length + '</span>' +
          '</div>' +
          '<span class="category-chevron">▼</span>' +
        '</div>' +
        '<div class="category-items">' +
          catItems.map(item => {
            const key = itemKey(item);
            const isChecked = !!state.checked[key];
            const qtyStr = formatQty(item.qty, item.unit, item.hasQty);
            const isAll = item.people.length >= state.people.filter(p => p.include).length;
            const peopleTag = isAll ? '' : item.people.map(p => '<span class="person-tag ' + (p === 'Le Clue' ? 'tag-you' : 'tag-her') + '">' + p + '</span>').join('');
            return '<div class="item ' + (isChecked ? 'checked' : '') + '" data-key="' + key + '" onclick="App.toggleItem(\'' + key.replace(/'/g,"\\'") + '\')">' +
              '<div class="checkbox"><span class="checkmark">✓</span></div>' +
              '<div class="item-text">' +
                '<div class="item-name">' + item.name + ' ' + peopleTag + '</div>' +
                '<div class="meal-tags">' + item.meals.map(m => '<span class="meal-tag">' + m + '</span>').join('') + '</div>' +
                (item.notes ? '<div class="item-note">' + item.notes + '</div>' : '') +
              '</div>' +
              '<div class="item-qty">' + qtyStr + '</div>' +
            '</div>';
          }).join('') +
        '</div></div>';
    }).join('');
  }

  function renderProgress() {
    const total = state.shoppingList.length;
    const done  = state.shoppingList.filter(i => state.checked[itemKey(i)]).length;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    const fill  = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = done + ' of ' + total + ' items ticked';
  }

  function updateCatCounts() {
    const cats = {};
    state.shoppingList.forEach(item => { if (!cats[item.category]) cats[item.category] = []; cats[item.category].push(item); });
    Object.entries(cats).forEach(([cat, items]) => {
      const done = items.filter(i => state.checked[itemKey(i)]).length;
      const el = document.getElementById('catcount-' + CSS.escape(cat));
      if (el) el.textContent = done + '/' + items.length;
    });
  }

  // ── Recipes section ───────────────────────────────────────
  function renderRecipesSection() { renderRecipePersonFilter(); if (state.activeMeal) renderCookMode(); else renderRecipesMealList(); }

  function renderRecipePersonFilter() {
    const filters = ['All', ...state.people.map(p => p.name)];
    const el = document.getElementById('recipe-person-filter');
    if (el) el.innerHTML = filters.map(f =>
      '<button class="filter-btn ' + (state.recipePersonFilter === f ? 'active' : '') + '" data-filter="' + f + '" onclick="App.setRecipePersonFilter(\'' + f + '\')">' + f + '</button>'
    ).join('');
  }

  function renderRecipesMealList() {
    document.getElementById('cook-mode').style.display = 'none';
    document.getElementById('recipes-meal-list-wrap').style.display = 'block';
    const tab   = state.recipesTab;
    const meals = state.meals[tab] || [];
    const el    = document.getElementById('recipes-meal-list');
    const filtered = meals.filter(m => state.recipePersonFilter === 'All' || m.person === state.recipePersonFilter || m.person === 'Both');
    if (!filtered.length) { el.innerHTML = '<div class="list-empty">No meals found.</div>'; return; }
    el.innerHTML = filtered.map(m => {
      const hasSteps = !!state.cookingSteps[m.name];
      const safeName = m.name.replace(/'/g, "\\'");
      const personTag = m.person !== 'Both' ? '<span class="person-tag ' + (m.person === 'Le Clue' ? 'tag-you' : 'tag-her') + '">' + m.person + '</span>' : '';
      return '<div class="meal-card ' + (hasSteps ? 'clickable' : '') + '" onclick="' + (hasSteps ? 'App.openMeal(\'' + safeName + '\')' : '') + '">' +
        '<div class="meal-card-main">' +
          '<div class="meal-card-icon">' + (tab === 'breakfast' ? '🌅' : tab === 'lunch' ? '🥗' : '🍲') + '</div>' +
          '<div class="meal-card-info">' +
            '<div class="meal-card-name">' + m.name + ' ' + personTag + '</div>' +
            '<div class="meal-card-sub">' + (hasSteps ? state.cookingSteps[m.name].steps.length + ' steps · tap to cook' : 'No steps yet') + '</div>' +
          '</div>' +
          (hasSteps ? '<div class="meal-card-arrow">›</div>' : '') +
        '</div></div>';
    }).join('');
  }

  function renderCookMode() {
    document.getElementById('recipes-meal-list-wrap').style.display = 'none';
    const cookEl   = document.getElementById('cook-mode');
    cookEl.style.display = 'block';
    const mealName = state.activeMeal;
    const mealData = state.cookingSteps[mealName];
    if (!mealData) { cookEl.innerHTML = '<div class="list-empty">No steps found for this meal.</div>'; return; }
    const servings = state.mealServings[mealName] || 1;
    const safeName = mealName.replace(/'/g, "\\'");
    const people   = state.people.filter(p => p.include);

    let html = '<div class="cook-header">' +
      '<button class="back-btn" onclick="App.closeMeal()">&#8249; Back</button>' +
      '<div class="cook-title">' + mealName + '</div>' +
      '<div class="cook-servings">' +
        '<button class="srv-btn" onclick="App.changeCookServings(\'' + safeName + '\', -1)">&#8722;</button>' +
        '<span class="srv-count">' + servings + '&times;</span>' +
        '<button class="srv-btn" onclick="App.changeCookServings(\'' + safeName + '\', 1)">+</button>' +
      '</div></div>';

    html += '<div class="cook-for-bar"><span class="cook-for-label">Cook for:</span>';
    people.forEach(p => {
      html += '<button class="cook-for-btn ' + (state.cookFor === p.name ? 'active' : '') + '" data-who="' + p.name + '" onclick="App.setCookFor(\'' + p.name.replace(/'/g,"\\'") + '\')">' + p.name + '</button>';
    });
    if (people.length > 1) html += '<button class="cook-for-btn ' + (state.cookFor === 'Both' ? 'active' : '') + '" data-who="Both" onclick="App.setCookFor(\'Both\')">Both</button>';
    html += '</div><div id="cook-ingredients-wrap"></div>';

    html += '<div class="cook-steps"><div class="cook-section-title">&#128104;&#8205;&#127859; Steps</div>';
    mealData.steps.forEach((step, idx) => {
      const hasTimer  = step.timer > 0;
      const m = Math.floor(step.timer / 60);
      const s = step.timer % 60;
      const timerLabel = s > 0 ? (m + 'm ' + s + 's') : (m + ' min');
      const timerHtml = hasTimer
        ? '<div class="step-timer"><span class="timer-label">&#9201; ' + timerLabel + '</span>' +
          '<span class="timer-display" id="timer-display-' + idx + '">' + String(m).padStart(1,'0') + ':' + String(step.timer % 60).padStart(2,'0') + '</span>' +
          '<button class="timer-btn" id="timer-btn-' + idx + '" onclick="App.startTimer(' + idx + ',' + step.timer + ')">Start</button>' +
          '<button class="timer-pause-btn" id="timer-pause-' + idx + '" onclick="App.pauseTimer(' + idx + ')" style="display:none">Pause</button></div>'
        : '';
      const isDone = !!state.completedSteps[idx];
      html += '<div class="cook-step ' + (isDone ? 'step-done' : '') + '" id="cook-step-' + idx + '">' +
        '<div class="step-num">' + step.stepNum + '</div>' +
        '<div class="step-body"><div class="step-title">' + step.stepTitle + '</div>' +
        '<div class="step-instruction">' + step.instruction + '</div>' + timerHtml + '</div>' +
        '<div class="step-check ' + (isDone ? 'checked' : '') + '" id="step-check-' + idx + '" onclick="App.toggleStepComplete(' + idx + ')">' + (isDone ? '&#10003;' : '') + '</div>' +
      '</div>';
    });
    html += '</div>';
    cookEl.innerHTML = html;
    renderCookIngredients();
  }

  function renderCookIngredients() {
    const wrap     = document.getElementById('cook-ingredients-wrap');
    if (!wrap) return;
    const mealName = state.activeMeal;
    const mealInfo = [...state.meals.breakfast, ...state.meals.lunch, ...state.meals.dinner].find(m => m.name === mealName);
    const servings = state.mealServings[mealName] || 1;
    const cookFor  = state.cookFor;
    const people   = state.people.filter(p => p.include);
    if (!mealInfo) { wrap.innerHTML = ''; return; }

    const targets = cookFor === 'Both' ? people : people.filter(p => p.name === cookFor);
    const agg = {};
    mealInfo.ingredients.forEach(ing => {
      targets.forEach(person => {
        const applies = ing.person === 'Both' || mealInfo.person === 'Both' || ing.person === person.name || mealInfo.person === person.name;
        if (!applies) return;
        let qty = ing.qty;
        if (qty !== null) {
          if (ing.category === 'Proteins')           qty = (qty / 120) * person.protein_g;
          else if (ing.category.startsWith('Carbs')) qty = qty * person.carbs_cups;
          qty = qty * servings;
        }
        const key = ing.ingredient + '|' + (ing.unit || '');
        if (!agg[key]) agg[key] = { ingredient: ing.ingredient, unit: ing.unit, qty: 0, hasQty: qty !== null, notes: ing.notes, category: ing.category };
        if (qty !== null) agg[key].qty += qty;
      });
    });

    const items = Object.values(agg);
    const forLabel = cookFor === 'Both' ? 'Both' : cookFor;
    let html = '<div class="cook-ingredients"><div class="cook-section-title">&#129518; Ingredients <span class="cook-for-tag">' + forLabel + ' &middot; ' + servings + '&times;</span></div>';
    items.forEach(ing => {
      const qtyStr  = ing.hasQty ? '<span class="ing-qty">' + (Math.round(ing.qty * 10) / 10) + (ing.unit ? ' ' + ing.unit : '') + '</span>' : '';
      const showNote = ing.notes && !(ing.category === 'Proteins' && cookFor === 'Both');
      html += '<div class="ing-row">' + qtyStr + '<span class="ing-name">' + ing.ingredient + '</span>' + (showNote ? '<span class="ing-note">' + ing.notes + '</span>' : '') + '</div>';
    });
    html += '</div>';
    wrap.innerHTML = html;
  }

  function changeCookServings(mealName, delta) {
    state.mealServings[mealName] = Math.max(1, (state.mealServings[mealName] || 1) + delta);
    renderCookMode();
  }

  // ── Persist ───────────────────────────────────────────────
  const CHECKED_KEY  = 'mealplanner_checked_v1';
  const SERVINGS_KEY = 'mealplanner_servings_v1';

  function saveChecked() {
    try { localStorage.setItem(CHECKED_KEY, JSON.stringify(state.checked)); } catch(e) {}
  }
  function loadChecked() {
    try { const s = localStorage.getItem(CHECKED_KEY); if (s) state.checked = JSON.parse(s); } catch(e) { state.checked = {}; }
  }
  function saveMealSelections() {
    try { localStorage.setItem(SERVINGS_KEY, JSON.stringify(state.mealServings)); } catch(e) {}
  }
  function loadMealSelections() {
    try { const s = localStorage.getItem(SERVINGS_KEY); if (s) Object.assign(state.mealServings, JSON.parse(s)); } catch(e) {}
  }

  // ── Helpers ───────────────────────────────────────────────
  function itemKey(item) { return item.category + '|' + item.name + '|' + (item.unit || ''); }
  function formatQty(qty, unit, hasQty) {
    if (!hasQty || qty === 0) return '';
    if (unit === 'g'  && qty >= 1000) return (qty / 1000).toFixed(1) + ' kg';
    if (unit === 'ml' && qty >= 1000) return (qty / 1000).toFixed(1) + ' L';
    return unit ? qty + ' ' + unit : '';
  }
  function setLoading(val) { state.loading = val; document.getElementById('loading-bar').style.display = val ? 'block' : 'none'; }
  function setError(msg) {
    state.error = msg;
    const el = document.getElementById('error-banner');
    if (msg) { el.textContent = msg; el.style.display = 'block'; } else el.style.display = 'none';
  }

  // Public API — called by Planner when plan changes to refresh shopping list
  function onPlannerChanged() { rebuildList(); renderBadges(); if (state.activeSection === 'shopping') { renderList(); renderProgress(); } }

  return { init, toggleItem, clearChecked: clearChecked, setRecipePersonFilter, openMeal, closeMeal, startTimer, pauseTimer, toggleStepComplete, changeCookServings, setCookFor, onPlannerChanged };
})();

function onGisLoad() { App.init(); }

// ── Audio ─────────────────────────────────────────────────
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('touchstart', initAudio, { once: false, passive: true });
document.addEventListener('click', initAudio, { once: false, passive: true });

function playBeep() {
  try {
    initAudio();
    if (!audioCtx) return;
    [0, 0.3, 0.6].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660 + (i * 220), audioCtx.currentTime + offset);
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + offset + 0.28);
      osc.start(audioCtx.currentTime + offset);
      osc.stop(audioCtx.currentTime + offset + 0.28);
    });
  } catch(e) { console.log('Audio not available:', e); }
}
