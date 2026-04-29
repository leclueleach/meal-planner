// ============================================================
//  planner.js — Weekly meal planner + macro summary
// ============================================================

const Planner = (() => {

  // ── State ─────────────────────────────────────────────────
  // plan[dateKey] = { enabled, meals: { person: { breakfast, lunch, dinner } } }
  let plan = {};
  let activePicker = null; // { dateKey, person, slot }
  const STORAGE_KEY = 'mealplanner_plan_v1';
  const SLOTS = ['breakfast', 'lunch', 'dinner'];
  const SLOT_ICONS   = { breakfast: '🌅', lunch: '🥗', dinner: '🍲' };
  const SLOT_LABELS  = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
  const DAY_SHORT    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_FULL     = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // ── Week helpers ──────────────────────────────────────────
  function getWeekDays() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }

  function toKey(date) { return date.toISOString().split('T')[0]; }
  function isToday(date) { return toKey(date) === toKey(new Date()); }

  // ── Storage ───────────────────────────────────────────────
  function loadPlan() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) plan = JSON.parse(saved);
    } catch(e) { plan = {}; }
  }

  function savePlan() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch(e) {}
  }

  function ensureDay(key, people) {
    if (!plan[key]) {
      plan[key] = { enabled: false, meals: {} };
      people.forEach(p => {
        plan[key].meals[p.name] = { breakfast: null, lunch: null, dinner: null };
      });
    } else {
      // Ensure all people exist
      people.forEach(p => {
        if (!plan[key].meals[p.name]) {
          plan[key].meals[p.name] = { breakfast: null, lunch: null, dinner: null };
        }
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init(people) {
    loadPlan();
    const days = getWeekDays();
    days.forEach(d => ensureDay(toKey(d), people));
    savePlan();
  }

  // ── Toggle day enabled ────────────────────────────────────
  function toggleDay(key, people) {
    ensureDay(key, people);
    plan[key].enabled = !plan[key].enabled;
    savePlan();
  }

  // ── Set meal ──────────────────────────────────────────────
  function setMeal(dateKey, person, slot, mealName) {
    if (!plan[dateKey]) return;
    plan[dateKey].meals[person][slot] = mealName;
    savePlan();
    activePicker = null;
  }

  function clearMeal(dateKey, person, slot) {
    if (!plan[dateKey]) return;
    plan[dateKey].meals[person][slot] = null;
    savePlan();
  }

  // ── Get available meals for a slot ───────────────────────
  function getMealsForSlot(slot, person, allMeals) {
    const meals = allMeals[slot] || [];
    return meals.filter(m => m.person === 'Both' || m.person === person);
  }

  // ── Render ────────────────────────────────────────────────
  function render(container, people, allMeals, macroTable) {
    const days = getWeekDays();
    const enabledDays = days.filter(d => plan[toKey(d)]?.enabled);

    container.innerHTML = `
      <div class="planner-wrap">

        <!-- Week strip -->
        <div class="week-strip">
          ${days.map((d, i) => {
            const key = toKey(d);
            const enabled = plan[key]?.enabled || false;
            const today = isToday(d);
            return `
              <div class="day-chip ${enabled ? 'enabled' : ''} ${today ? 'today' : ''}"
                   onclick="Planner.toggleDay('${key}')">
                <div class="day-chip-name">${DAY_SHORT[i]}</div>
                <div class="day-chip-num">${d.getDate()}</div>
                <div class="day-chip-check">${enabled ? '✓' : ''}</div>
              </div>`;
          }).join('')}
        </div>

        ${enabledDays.length === 0 ? `
          <div class="list-empty" style="margin:20px 0">
            Tap the days above to start planning your week.
          </div>` : ''}

        <!-- Day plans -->
        ${enabledDays.map(d => renderDay(d, people, allMeals, macroTable)).join('')}

        <!-- Weekly macro summary -->
        ${enabledDays.length > 0 ? renderWeeklyMacros(enabledDays, people, allMeals, macroTable) : ''}

      </div>

      <!-- Meal picker overlay -->
      <div id="meal-picker" class="meal-picker ${activePicker ? 'open' : ''}" onclick="Planner.closePicker(event)">
        <div class="meal-picker-sheet" id="meal-picker-sheet">
          ${activePicker ? renderPicker(activePicker, people, allMeals) : ''}
        </div>
      </div>
    `;
  }

  function renderDay(date, people, allMeals, macroTable) {
    const key = toKey(date);
    const dayIdx = (date.getDay() + 6) % 7;
    const dayMacros = calcDayMacros(key, people, allMeals, macroTable);

    return `
      <div class="planner-day">
        <div class="planner-day-header">
          <span class="planner-day-name">${DAY_FULL[dayIdx]} ${isToday(date) ? '<span class="today-badge">Today</span>' : ''}</span>
          <span class="planner-day-kcal">${dayMacros.total.kcal} kcal</span>
        </div>

        ${people.map(person => `
          <div class="planner-person-row">
            <div class="planner-person-label">${person.name}</div>
            <div class="planner-slots">
              ${SLOTS.map(slot => {
                const mealName = plan[key]?.meals[person.name]?.[slot] || null;
                return `
                  <div class="planner-slot ${mealName ? 'filled' : ''}"
                       onclick="Planner.openPicker('${key}', '${person.name}', '${slot}')">
                    <div class="slot-icon">${SLOT_ICONS[slot]}</div>
                    <div class="slot-content">
                      ${mealName
                        ? `<div class="slot-meal">${mealName}</div>`
                        : `<div class="slot-empty">${SLOT_LABELS[slot]}</div>`
                      }
                    </div>
                    ${mealName ? `<button class="slot-clear" onclick="event.stopPropagation(); Planner.clearMeal('${key}','${person.name}','${slot}')">×</button>` : ''}
                  </div>`;
              }).join('')}
            </div>
          </div>
        `).join('')}

        <!-- Day macro summary -->
        <div class="day-macro-row">
          ${people.map(person => {
            const m = dayMacros[person.name] || { kcal:0, protein:0, carbs:0, fat:0 };
            return `
              <div class="day-macro-person">
                <span class="day-macro-name">${person.name}</span>
                <div class="day-macro-stats">
                  <span style="color:#aaff4d">${m.kcal} kcal</span>
                  <span style="color:#6aafd4">${m.protein}g</span>
                  <span style="color:#f0c040">${m.carbs}g</span>
                  <span style="color:#b990cc">${m.fat}g</span>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderPicker(picker, people, allMeals) {
    const { dateKey, person, slot } = picker;
    const meals = getMealsForSlot(slot, person, allMeals);
    const current = plan[dateKey]?.meals[person]?.[slot] || null;

    return `
      <div class="picker-header">
        <span class="picker-title">${SLOT_ICONS[slot]} ${SLOT_LABELS[slot]} — ${person}</span>
        <button class="picker-close" onclick="Planner.closePicker()">×</button>
      </div>
      <div class="picker-meals">
        ${meals.length === 0
          ? `<div class="list-empty" style="margin:12px">No meals available for this slot.</div>`
          : meals.map(m => `
              <div class="picker-meal ${current === m.name ? 'selected' : ''}"
                   onclick="Planner.selectMeal('${dateKey}','${person}','${slot}','${m.name.replace(/'/g,"\\'")}')">
                <div class="picker-check ${current === m.name ? 'checked' : ''}">${current === m.name ? '✓' : ''}</div>
                <span>${m.name}</span>
              </div>`).join('')
        }
      </div>`;
  }

  function renderWeeklyMacros(enabledDays, people, allMeals, macroTable) {
    const totals = {};
    people.forEach(p => { totals[p.name] = { kcal:0, protein:0, carbs:0, fat:0 }; });

    enabledDays.forEach(d => {
      const key = toKey(d);
      const dm = calcDayMacros(key, people, allMeals, macroTable);
      people.forEach(p => {
        const m = dm[p.name] || { kcal:0, protein:0, carbs:0, fat:0 };
        totals[p.name].kcal    += m.kcal;
        totals[p.name].protein += m.protein;
        totals[p.name].carbs   += m.carbs;
        totals[p.name].fat     += m.fat;
      });
    });

    const n = enabledDays.length;
    const targets = {
      'Le Clue': { kcal: 1800, protein: 120, carbs: 180, fat: 60 },
    };
    const defaultTarget = { kcal: 1600, protein: 80, carbs: 200, fat: 55 };

    return `
      <div class="weekly-macros">
        <div class="macros-section-title">Weekly summary (${n} day${n !== 1 ? 's' : ''})</div>
        <div class="macros-people-grid">
          ${people.map(person => {
            const t = targets[person.name] || defaultTarget;
            const wt = { kcal: t.kcal * n, protein: t.protein * n, carbs: t.carbs * n, fat: t.fat * n };
            const d = totals[person.name];
            return `
              <div class="macro-person-card">
                <div class="macro-person-name">${person.name}</div>
                ${macroRowHTML('🔥', 'Calories', d.kcal, wt.kcal, 'kcal', '#aaff4d')}
                ${macroRowHTML('🥩', 'Protein',  d.protein, wt.protein, 'g', '#6aafd4')}
                ${macroRowHTML('🌾', 'Carbs',    d.carbs,   wt.carbs,   'g', '#f0c040')}
                ${macroRowHTML('🫒', 'Fat',      d.fat,     wt.fat,     'g', '#b990cc')}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function macroRowHTML(icon, label, value, target, unit, color) {
    const pct  = Math.min(100, Math.round((value / target) * 100));
    const over = value > target;
    return `
      <div class="macro-row">
        <div class="macro-row-label"><span style="font-size:13px">${icon}</span> ${label}</div>
        <div class="macro-row-value" style="color:${over ? '#ff6b6b' : color}">${value}${unit}</div>
        <div class="macro-bar-wrap"><div class="macro-bar-fill" style="width:${pct}%;background:${over ? '#ff6b6b' : color}"></div></div>
        <div class="macro-target">/ ${target}${unit}</div>
      </div>`;
  }

  // ── Macro calculation ─────────────────────────────────────
  function calcDayMacros(key, people, allMeals, macroTable) {
    const result = { total: { kcal:0, protein:0, carbs:0, fat:0 } };
    people.forEach(person => {
      result[person.name] = { kcal:0, protein:0, carbs:0, fat:0 };
      SLOTS.forEach(slot => {
        const mealName = plan[key]?.meals[person.name]?.[slot] || null;
        if (!mealName) return;
        const meal = Object.values(allMeals).flat().find(m => m.name === mealName);
        if (!meal) return;
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

  // ── Picker controls ───────────────────────────────────────
  function openPicker(dateKey, person, slot) {
    activePicker = { dateKey, person, slot };
    const sheet = document.getElementById('meal-picker-sheet');
    const picker = document.getElementById('meal-picker');
    if (sheet && picker) {
      picker.classList.add('open');
      // Re-render picker content
      const people = window._plannerPeople;
      const allMeals = window._plannerMeals;
      sheet.innerHTML = renderPicker(activePicker, people, allMeals);
    }
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
    // Re-render planner
    PlannerSection.refresh();
  }

  function clearMealAndRefresh(dateKey, person, slot) {
    clearMeal(dateKey, person, slot);
    PlannerSection.refresh();
  }

  function toggleDayAndRefresh(key) {
    const people = window._plannerPeople;
    toggleDay(key, people);
    PlannerSection.refresh();
  }

  return {
    init, render, toggleDay: toggleDayAndRefresh,
    openPicker, closePicker, selectMeal, clearMeal: clearMealAndRefresh,
  };
})();

// ── PlannerSection — bridge between App and Planner ──────
const PlannerSection = (() => {
  let _container = null;

  function mount(container) { _container = container; }

  function refresh() {
    if (!_container) return;
    const people   = window._plannerPeople;
    const allMeals = window._plannerMeals;
    const macros   = window._plannerMacroTable;
    if (!people || !allMeals || !macros) return;
    Planner.render(_container, people, allMeals, macros);
  }

  return { mount, refresh };
})();
