// ============================================================
//  planner.js — Weekly meal planner + macro summary
// ============================================================

const Planner = (() => {

  let plan = {};
  let activePicker = null;
  const STORAGE_KEY = 'mealplanner_plan_v1';
  const SLOTS       = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const SLOT_ICONS  = { breakfast: '🌅', lunch: '🥗', dinner: '🍲', snacks: '🍎' };
  const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };
  const DAY_SHORT   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_FULL    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // ── Week helpers ──────────────────────────────────────────
  function getWeekDays() {
    const today = new Date();
    const day   = today.getDay();
    const diff  = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff); monday.setHours(0,0,0,0);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  }

  function toKey(date) { return date.toISOString().split('T')[0]; }
  function isToday(date) { return toKey(date) === toKey(new Date()); }

  // ── Storage ───────────────────────────────────────────────
  function loadPlan() {
    try { const s = sessionStorage.getItem(STORAGE_KEY); if (s) plan = JSON.parse(s); } catch(e) { plan = {}; }
  }
  function savePlan() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch(e) {}
  }
  function ensureDay(key, people) {
    if (!plan[key]) plan[key] = { enabled: false, meals: {} };
    people.forEach(p => { if (!plan[key].meals[p.name]) plan[key].meals[p.name] = { breakfast: null, lunch: null, dinner: null, snacks: null }; });
  }

  function getPlan() { return plan; }

  // ── Init ──────────────────────────────────────────────────
  function init(people) {
    loadPlan();
    getWeekDays().forEach(d => ensureDay(toKey(d), people));
    savePlan();
  }

  // ── Toggles ───────────────────────────────────────────────
  function toggleDay(key) {
    const people = window._plannerPeople || [];
    ensureDay(key, people);
    plan[key].enabled = !plan[key].enabled;
    savePlan();
    if (typeof App !== 'undefined') App.onPlannerChanged();
    PlannerSection.refresh();
  }

  function setMeal(dateKey, person, slot, mealName) {
    if (!plan[dateKey]) return;
    plan[dateKey].meals[person][slot] = mealName;
    savePlan();
    activePicker = null;
    if (typeof App !== 'undefined') App.onPlannerChanged();
    PlannerSection.refresh();
  }

  function clearMeal(dateKey, person, slot) {
    if (!plan[dateKey]) return;
    plan[dateKey].meals[person][slot] = null;
    savePlan();
    if (typeof App !== 'undefined') App.onPlannerChanged();
    PlannerSection.refresh();
  }

  // ── Macro calculation ─────────────────────────────────────
  function calcDayMacros(key, people, allMeals, macroTable) {
    const result = { total: { kcal:0, protein:0, carbs:0, fat:0 } };
    people.forEach(person => {
      result[person.name] = { kcal:0, protein:0, carbs:0, fat:0 };
      ['breakfast','lunch','dinner','snacks'].forEach(slot => {
        const mealName = plan[key]?.meals[person.name]?.[slot];
        if (!mealName) return;
        const meal = Object.values(allMeals).flat().find(m => m.name === mealName);
        if (!meal) return;
        // Pass the specific person so macros scale correctly
        const macros = Sheets.calcMealMacrosPublic(meal, person, macroTable, 1);
        result[person.name].kcal    += macros.kcal;
        result[person.name].protein += macros.protein;
        result[person.name].carbs   += macros.carbs;
        result[person.name].fat     += macros.fat;
      });
      result.total.kcal    += result[person.name].kcal;
      result.total.protein += result[person.name].protein;
      result.total.carbs   += result[person.name].carbs;
      result.total.fat     += result[person.name].fat;
    });
    return result;
  }

  // ── Render ────────────────────────────────────────────────
  function render(container, people, allMeals, macroTable) {
    const days        = getWeekDays();
    const enabledDays = days.filter(d => plan[toKey(d)]?.enabled);

    container.innerHTML =
      '<div class="planner-wrap">' +
        renderWeekStrip(days) +
        (enabledDays.length === 0
          ? '<div class="list-empty" style="margin:20px 0">Tap the days above to start planning your week.</div>'
          : enabledDays.map(d => renderDay(d, people, allMeals, macroTable)).join('')) +
        (enabledDays.length > 0 ? renderWeeklyMacros(enabledDays, people, allMeals, macroTable) : '') +
      '</div>' +
      '<div id="meal-picker" class="meal-picker" onclick="Planner.closePicker(event)">' +
        '<div class="meal-picker-sheet" id="meal-picker-sheet"></div>' +
      '</div>';
  }

  function renderWeekStrip(days) {
    return '<div class="week-strip">' +
      days.map((d, i) => {
        const key     = toKey(d);
        const enabled = plan[key]?.enabled || false;
        const today   = isToday(d);
        return '<div class="day-chip ' + (enabled ? 'enabled' : '') + ' ' + (today ? 'today' : '') + '" onclick="Planner.toggleDay(\'' + key + '\')">' +
          '<div class="day-chip-name">' + DAY_SHORT[i] + '</div>' +
          '<div class="day-chip-check">' + (enabled ? '✓' : '') + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderDay(date, people, allMeals, macroTable) {
    const key     = toKey(date);
    const dayIdx  = (date.getDay() + 6) % 7;
    const dayMacros = calcDayMacros(key, people, allMeals, macroTable);
    const totalKcal = people.reduce((sum, p) => sum + (dayMacros[p.name]?.kcal || 0), 0);

    return '<div class="planner-day">' +
      '<div class="planner-day-header">' +
        '<span class="planner-day-name">' + DAY_FULL[dayIdx] + (isToday(date) ? ' <span class="today-badge">Today</span>' : '') + '</span>' +
        '<span class="planner-day-kcal">' + totalKcal + ' kcal</span>' +
      '</div>' +
      people.map(person => renderPersonSlots(key, person, allMeals)).join('') +
      renderDayMacroSummary(people, dayMacros) +
    '</div>';
  }

  function renderPersonSlots(key, person, allMeals) {
    return '<div class="planner-person-row">' +
      '<div class="planner-person-label">' + person.name + '</div>' +
      '<div class="planner-slots">' +
        ['breakfast','lunch','dinner'].map(slot => {
          const mealName = plan[key]?.meals[person.name]?.[slot] || null;
          const safeKey  = key;
          const safePerson = person.name.replace(/'/g,"\\'");
          return '<div class="planner-slot ' + (mealName ? 'filled' : '') + '" onclick="Planner.openPicker(\'' + safeKey + '\',\'' + safePerson + '\',\'' + slot + '\')">' +
            '<div class="slot-icon">' + SLOT_ICONS[slot] + '</div>' +
            '<div class="slot-content">' +
              (mealName
                ? '<div class="slot-meal">' + mealName + '</div>'
                : '<div class="slot-empty">' + SLOT_LABELS[slot] + '</div>') +
            '</div>' +
            (mealName ? '<button class="slot-clear" onclick="event.stopPropagation();Planner.clearMeal(\'' + safeKey + '\',\'' + safePerson + '\',\'' + slot + '\')">×</button>' : '') +
          '</div>';
        }).join('') +
        // Snacks slot
        renderSnackSlot(key, person, allMeals) +
      '</div></div>';
  }

  function renderSnackSlot(key, person) {
    const dayPlan = plan[key];
    const snackName = dayPlan && dayPlan.meals[person.name] ? dayPlan.meals[person.name]['snacks'] : null;
    const el = document.createElement('div');
    el.className = 'planner-slot' + (snackName ? ' filled' : '');
    el.innerHTML =
      '<div class="slot-icon">&#127822;</div>' +
      '<div class="slot-content">' +
        (snackName ? '<div class="slot-meal">' + snackName + '</div>' : '<div class="slot-empty">Snacks</div>') +
      '</div>' +
      (snackName ? '<button class="slot-clear">&#215;</button>' : '');
    el.addEventListener('click', function() { Planner.openSnackPicker(key, person.name); });
    if (snackName) {
      el.querySelector('.slot-clear').addEventListener('click', function(e) {
        e.stopPropagation();
        Planner.clearSnack(key, person.name);
      });
    }
    return el.outerHTML;
  }

  function renderDayMacroSummary(people, dayMacros) {
    return '<div class="day-macro-row">' +
      people.map(person => {
        const m = dayMacros[person.name] || { kcal:0, protein:0, carbs:0, fat:0 };
        const t = {
          kcal:    person.target_kcal    > 0 ? person.target_kcal    : 1800,
          protein: person.target_protein > 0 ? person.target_protein : 120,
          carbs:   person.target_carbs   > 0 ? person.target_carbs   : 180,
          fat:     person.target_fat     > 0 ? person.target_fat     : 60,
        };
        return '<div class="day-macro-person">' +
          '<div class="day-macro-name">' + person.name + '</div>' +
          '<div class="day-macro-stats">' +
            '<span style="color:#aaff4d">🔥 ' + m.kcal + '<span class="day-macro-target">/' + t.kcal + '</span> kcal</span>' +
            '<span style="color:#6aafd4">🥩 ' + m.protein + '<span class="day-macro-target">/' + t.protein + '</span>g</span>' +
            '<span style="color:#f0c040">🌾 ' + m.carbs + '<span class="day-macro-target">/' + t.carbs + '</span>g</span>' +
            '<span style="color:#b990cc">🫒 ' + m.fat + '<span class="day-macro-target">/' + t.fat + '</span>g</span>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderWeeklyMacros(enabledDays, people, allMeals, macroTable) {
    const totals = {};
    people.forEach(p => { totals[p.name] = { kcal:0, protein:0, carbs:0, fat:0 }; });
    enabledDays.forEach(d => {
      const dm = calcDayMacros(toKey(d), people, allMeals, macroTable);
      people.forEach(p => {
        const m = dm[p.name] || { kcal:0, protein:0, carbs:0, fat:0 };
        totals[p.name].kcal    += m.kcal;
        totals[p.name].protein += m.protein;
        totals[p.name].carbs   += m.carbs;
        totals[p.name].fat     += m.fat;
      });
    });
    const n = enabledDays.length;
    return '<div class="weekly-macros">' +
      '<div class="macros-section-title">Weekly summary (' + n + ' day' + (n !== 1 ? 's' : '') + ')</div>' +
      '<div class="macros-people-grid">' +
        people.map(person => {
          const tk = person.target_kcal>0?person.target_kcal:1800; const tp = person.target_protein>0?person.target_protein:120; const tc = person.target_carbs>0?person.target_carbs:180; const tf = person.target_fat>0?person.target_fat:60;
          const t  = { kcal: tk*n, protein: tp*n, carbs: tc*n, fat: tf*n };
          const d  = totals[person.name];
          return '<div class="macro-person-card">' +
            '<div class="macro-person-name">' + person.name + '</div>' +
            macroRowHTML('🔥','Calories', d.kcal,    t.kcal,    'kcal','#aaff4d') +
            macroRowHTML('🥩','Protein',  d.protein, t.protein, 'g',   '#6aafd4') +
            macroRowHTML('🌾','Carbs',    d.carbs,   t.carbs,   'g',   '#f0c040') +
            macroRowHTML('🫒','Fat',      d.fat,     t.fat,     'g',   '#b990cc') +
          '</div>';
        }).join('') +
      '</div></div>';
  }

  function macroRowHTML(icon, label, value, target, unit, color) {
    const pct  = Math.min(100, Math.round((value / target) * 100));
    const over = value > target;
    return '<div class="macro-row">' +
      '<div class="macro-row-label"><span style="font-size:13px">' + icon + '</span> ' + label + '</div>' +
      '<div class="macro-row-value" style="color:' + (over ? '#ff6b6b' : color) + '">' + value + unit + '</div>' +
      '<div class="macro-bar-wrap"><div class="macro-bar-fill" style="width:' + pct + '%;background:' + (over ? '#ff6b6b' : color) + '"></div></div>' +
      '<div class="macro-target">/ ' + target + unit + '</div>' +
    '</div>';
  }

  // ── Picker ────────────────────────────────────────────────
  function openPicker(dateKey, person, slot) {
    activePicker = { dateKey, person, slot };
    const picker = document.getElementById('meal-picker');
    const sheet  = document.getElementById('meal-picker-sheet');
    if (!picker || !sheet) return;
    picker.classList.add('open');
    const people   = window._plannerPeople || [];
    const allMeals = window._plannerMeals  || {};
    const slotKey  = slot === 'snacks' ? 'snacks' : slot;
    const meals    = (allMeals[slotKey] || []).filter(m => m.person === 'Both' || m.person === person);
    const current  = plan[dateKey]?.meals[person]?.[slot] || null;

    sheet.innerHTML =
      '<div class="picker-header">' +
        '<span class="picker-title">' + (slot === 'breakfast' ? '🌅' : slot === 'lunch' ? '🥗' : slot === 'snacks' ? '🍎' : '🍲') + ' ' + SLOT_LABELS[slot] + ' — ' + person + '</span>' +
        '<button class="picker-close" onclick="Planner.closePicker()">×</button>' +
      '</div>' +
      '<div class="picker-meals">' +
        (meals.length === 0
          ? '<div class="list-empty" style="margin:12px">No meals available.</div>'
          : meals.map(m =>
              '<div class="picker-meal ' + (current === m.name ? 'selected' : '') + '" onclick="Planner.selectMeal(\'' + dateKey + '\',\'' + person.replace(/'/g,"\\'") + '\',\'' + slot + '\',\'' + m.name.replace(/'/g,"\\'") + '\')">' +
                '<div class="picker-check ' + (current === m.name ? 'checked' : '') + '">' + (current === m.name ? '✓' : '') + '</div>' +
                '<span>' + m.name + '</span>' +
              '</div>'
            ).join('')) +
      '</div>';
  }

  function closePicker(e) {
    if (e && e.target !== document.getElementById('meal-picker')) return;
    activePicker = null;
    const picker = document.getElementById('meal-picker');
    if (picker) picker.classList.remove('open');
  }

  function selectMeal(dateKey, person, slot, mealName) {
    setMeal(dateKey, person, slot, mealName);
    const picker = document.getElementById('meal-picker');
    if (picker) picker.classList.remove('open');
  }

  function openSnackPicker(dateKey, person) {
    openPicker(dateKey, person, 'snacks');
  }

  function clearSnack(dateKey, person) {
    clearMeal(dateKey, person, 'snacks');
  }

  return { init, render, getPlan, toggleDay, openPicker, openSnackPicker, closePicker, selectMeal, clearMeal, clearSnack };
})();

// ── PlannerSection ────────────────────────────────────────
const PlannerSection = (() => {
  function mount(container) { /* lazy */ }
  function refresh() {
    const container = document.getElementById('planner-content');
    if (!container) return;
    const people   = window._plannerPeople;
    const allMeals = window._plannerMeals;
    const macros   = window._plannerMacroTable;
    if (!people || !allMeals || !macros) {
      container.innerHTML = '<div class="list-empty" style="margin:20px 12px">Loading — please wait.</div>';
      return;
    }
    Planner.render(container, people, allMeals, macros);
  }
  return { mount, refresh };
})();
