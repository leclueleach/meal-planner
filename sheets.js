// ============================================================
//  sheets.js — Google Sheets API reads & data parsing
// ============================================================

const Sheets = (() => {

  const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

  async function fetchRange(tabName, range) {
    const token = Auth.getToken();
    if (!token) throw new Error('Not authenticated');
    const url = `${BASE_URL}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(tabName + '!' + range)}?key=${CONFIG.API_KEY}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Sheets API error');
    }
    const data = await res.json();
    return data.values || [];
  }

  // ── People ───────────────────────────────────────────────
  async function getPeople() {
    const rows = await fetchRange(CONFIG.TABS.PEOPLE, 'A2:L50');
    return rows.filter(r => r.length >= 2).map((r, idx) => ({
      id: idx,
      include: (r[0] || '').toUpperCase() === 'TRUE',
      name: r[1] || `Person ${idx + 1}`,
      protein_g:  parseFloat(r[2]) || 0,
      carbs_cups: parseFloat(r[3]) || 0,
      fat_tsp:    parseFloat(r[4]) || 0,
      veg_cups:   parseFloat(r[5]) || 0,
      notes: r[6] || '',
      target_kcal:    parseFloat(r[7]) || 0,
      target_protein: parseFloat(r[8]) || 0,
      target_carbs:   parseFloat(r[9]) || 0,
      target_fat:     parseFloat(r[10]) || 0,
      target_fibre:   parseFloat(r[11]) || 0,
    }));
  }

  // ── Meals ────────────────────────────────────────────────
  async function getMeals(tabName) {
    const rows = await fetchRange(tabName, 'A2:H300');
    const mealsMap = {};
    const mealOrder = [];
    rows.forEach(r => {
      if (r.length < 5) return;
      const include    = (r[0] || '').toUpperCase() === 'TRUE';
      const mealName   = (r[1] || '').trim();
      const category   = (r[2] || 'Other').trim();
      const person     = (r[3] || 'Both').trim();
      const ingredient = (r[4] || '').trim();
      const qty        = r[5] !== undefined && r[5] !== '' ? parseFloat(r[5]) : null;
      const unit       = (r[6] || '').trim() || null;
      const notes      = (r[7] || '').trim();
      if (!mealName || !ingredient) return;
      if (!mealsMap[mealName]) {
        mealsMap[mealName] = { name: mealName, include, person, ingredients: [] };
        mealOrder.push(mealName);
      }
      mealsMap[mealName].ingredients.push({ category, person, ingredient, qty, unit, notes });
    });
    return mealOrder.map(name => mealsMap[name]);
  }

  // ── Macro reference table ────────────────────────────────
  // Columns: Ingredient, Calories/100g, Protein/100g, Carbs/100g, Fat/100g
  async function getMacroTable() {
    const rows = await fetchRange(CONFIG.TABS.MACROS, 'A2:F200');
    const table = {};
    rows.forEach(r => {
      if (r.length < 5) return;
      const name = (r[0] || '').trim().toLowerCase();
      if (!name) return;
      table[name] = {
        kcal:    parseFloat(r[1]) || 0,
        protein: parseFloat(r[2]) || 0,
        carbs:   parseFloat(r[3]) || 0,
        fat:     parseFloat(r[4]) || 0,
        fibre:   parseFloat(r[5]) || 0,
      };
    });
    return table;
  }

  // ── Cooking Steps ────────────────────────────────────────
  async function getCookingSteps() {
    const rows = await fetchRange(CONFIG.TABS.COOKING, 'A2:F200');
    const stepsMap = {};
    rows.forEach(r => {
      if (r.length < 5) return;
      const mealName    = (r[0] || '').trim();
      const mealType    = (r[1] || '').trim().toLowerCase();
      const stepNum     = parseInt(r[2]) || 0;
      const stepTitle   = (r[3] || '').trim();
      const instruction = (r[4] || '').trim();
      const timer       = parseInt(r[5]) || 0;
      if (!mealName || !instruction) return;
      if (!stepsMap[mealName]) stepsMap[mealName] = { mealName, mealType, steps: [] };
      stepsMap[mealName].steps.push({ stepNum, stepTitle, instruction, timer });
    });
    Object.values(stepsMap).forEach(m => m.steps.sort((a, b) => a.stepNum - b.stepNum));
    return stepsMap;
  }

  // ── Unit conversion to grams ─────────────────────────────
  function toGrams(qty, unit, ingredient) {
    if (qty === null) return 0;
    const u = (unit || '').toLowerCase().trim();
    const ing = ingredient.toLowerCase();

    if (u === 'g')    return qty;
    if (u === 'kg')   return qty * 1000;
    if (u === 'ml')   return qty; // approximate ml ≈ g for liquids
    if (u === 'l')    return qty * 1000;

    // Volumetric conversions — approximate
    if (u === 'cup' || u === 'cups') {
      if (ing.includes('oat'))    return qty * 90;
      if (ing.includes('rice'))   return qty * 185;
      if (ing.includes('pasta') || ing.includes('noodle')) return qty * 140;
      if (ing.includes('lentil') || ing.includes('bean') || ing.includes('chickpea')) return qty * 170;
      if (ing.includes('spinach') || ing.includes('kale') || ing.includes('rocket') || ing.includes('greens') || ing.includes('cabbage')) return qty * 30;
      if (ing.includes('berry') || ing.includes('berries') || ing.includes('mango')) return qty * 145;
      if (ing.includes('broccoli') || ing.includes('capsicum') || ing.includes('veg') || ing.includes('edamame')) return qty * 120;
      if (ing.includes('yoghurt')) return qty * 245;
      if (ing.includes('milk'))   return qty * 240;
      return qty * 150; // generic
    }
    if (u === 'tbsp') {
      if (ing.includes('butter') || ing.includes('tahini') || ing.includes('miso') || ing.includes('paste')) return qty * 16;
      if (ing.includes('oil') || ing.includes('evoo') || ing.includes('vinegar') || ing.includes('soy') || ing.includes('mirin') || ing.includes('sauce')) return qty * 15;
      if (ing.includes('seed') || ing.includes('flax') || ing.includes('chia')) return qty * 10;
      if (ing.includes('herb') || ing.includes('parsley') || ing.includes('coriander') || ing.includes('basil') || ing.includes('ginger')) return qty * 4;
      return qty * 12;
    }
    if (u === 'tsp') {
      if (ing.includes('oil') || ing.includes('evoo') || ing.includes('vinegar') || ing.includes('soy') || ing.includes('mirin')) return qty * 5;
      if (ing.includes('seed') || ing.includes('spice') || ing.includes('powder') || ing.includes('cumin') || ing.includes('paprika') || ing.includes('turmeric') || ing.includes('cinnamon') || ing.includes('oregano') || ing.includes('flakes')) return qty * 3;
      return qty * 4;
    }
    if (u === 'pinch') return 0.5;

    // Countable items
    if (!u || u === '' || u === 'null') {
      if (ing.includes('egg'))    return qty * 55;
      if (ing.includes('banana')) return qty * 120;
      if (ing.includes('lemon') || ing.includes('lime')) return qty * 60;
      if (ing.includes('onion')) return qty * 110;
      if (ing.includes('garlic clove')) return qty * 5;
      if (ing.includes('spring onion')) return qty * 15;
      if (ing.includes('star anise')) return qty * 2;
      if (ing.includes('bay leaf') || ing.includes('bay leave')) return qty * 1;
      if (ing.includes('avocado')) return qty * 150;
      if (ing.includes('wrap'))   return qty * 60;
      if (ing.includes('naan'))   return qty * 80;
      return qty * 10;
    }
    return 0;
  }

  // ── Calculate macros for a meal per person ───────────────
  function calcMealMacros(meal, person, macroTable, servings) {
    let kcal = 0, protein = 0, carbs = 0, fat = 0, fibre = 0;

    meal.ingredients.forEach(ing => {
      // Only count ingredients applicable to this person
      const applies = ing.person === 'Both' || meal.person === 'Both' ||
                      ing.person === person.name || meal.person === person.name;
      if (!applies) return;

      let qty = ing.qty;
      if (qty === null) return;

      // Scale protein by person's target
      const isProtein = ing.category === 'Proteins';
      const isCarb    = ing.category.startsWith('Carbs');
      if (isProtein) qty = (qty / 120) * person.protein_g;
      else if (isCarb) qty = qty * person.carbs_cups;
      qty = qty * servings;

      const grams = toGrams(qty, ing.unit, ing.ingredient);
      if (grams === 0) return;

      // Look up macro table — try exact match first, then partial
      const key = ing.ingredient.toLowerCase().trim();
      let macro = macroTable[key];
      if (!macro) {
        const keys = Object.keys(macroTable);
        const partial = keys.find(k => key.includes(k) || k.includes(key.split(' ')[0]));
        if (partial) macro = macroTable[partial];
      }
      if (!macro) return;

      const factor = grams / 100;
      kcal    += macro.kcal    * factor;
      protein += macro.protein * factor;
      carbs   += macro.carbs   * factor;
      fat     += macro.fat     * factor;
      fibre   += (macro.fibre  || 0) * factor;
    });

    return {
      kcal:    Math.round(kcal),
      protein: Math.round(protein),
      carbs:   Math.round(carbs),
      fat:     Math.round(fat),
      fibre:   Math.round(fibre * 10) / 10,
    };
  }

  // ── Build macro summary ──────────────────────────────────
  function buildMacroSummary(people, allMeals, mealServings, macroTable) {
    const selectedPeople = people.filter(p => p.include);
    const result = {};

    selectedPeople.forEach(person => {
      result[person.name] = {
        daily: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        meals: [],
      };

      Object.entries(allMeals).forEach(([mealType, meals]) => {
        meals.filter(m => m.include).forEach(meal => {
          const servings = mealServings[meal.name] || 1;
          const macros = calcMealMacros(meal, person, macroTable, servings);
          result[person.name].meals.push({
            mealName: meal.name,
            mealType,
            servings,
            ...macros,
          });
          result[person.name].daily.kcal    += macros.kcal;
          result[person.name].daily.protein += macros.protein;
          result[person.name].daily.carbs   += macros.carbs;
          result[person.name].daily.fat     += macros.fat;
        });
      });
    });

    return result;
  }

  // ── Build Shopping List ──────────────────────────────────
  function buildShoppingList(people, allMeals, mealServings = {}) {
    const selectedPeople = people.filter(p => p.include);
    if (!selectedPeople.length) return [];
    const agg = {};

    Object.entries(allMeals).forEach(([mealType, meals]) => {
      meals.filter(r => r.include).forEach(meal => {
        const timesToMake = mealServings[meal.name] || 1;
        meal.ingredients.forEach(ing => {
          const isProtein = ing.category === 'Proteins';
          const isCarb    = ing.category.startsWith('Carbs');
          const applicablePeople = selectedPeople.filter(p => {
            if (ing.person === 'Both' || meal.person === 'Both') return true;
            return p.name === ing.person || p.name === meal.person;
          });
          applicablePeople.forEach(person => {
            let scaledQty = ing.qty;
            if (scaledQty !== null) {
              if (isProtein)   scaledQty = (ing.qty / 120) * person.protein_g;
              else if (isCarb) scaledQty = ing.qty * person.carbs_cups;
              scaledQty = scaledQty * timesToMake;
            }
            const key = `${ing.category}|${ing.ingredient}|${ing.unit || ''}`;
            if (!agg[key]) {
              agg[key] = { category: ing.category, name: ing.ingredient, unit: ing.unit, qty: 0, hasQty: false, meals: new Set(), mealType, notes: ing.notes, people: new Set() };
            }
            if (scaledQty !== null) { agg[key].qty += scaledQty; agg[key].hasQty = true; }
            agg[key].meals.add(meal.name);
            agg[key].people.add(person.name);
          });
        });
      });
    });

    const catOrder = ['Proteins','Fresh Produce','Canned & Jarred','Stocks & Liquids','Pantry & Spices','Fats','Veg','Veg/Fruit','Carbs','Carbs (Week 1)'];
    return Object.values(agg).map(item => ({
      ...item, meals: [...item.meals], people: [...item.people],
      qty: Math.round(item.qty * 10) / 10,
    })).sort((a, b) => {
      const ai = catOrder.findIndex(c => a.category.startsWith(c.split(' ')[0]));
      const bi = catOrder.findIndex(c => b.category.startsWith(c.split(' ')[0]));
      const ca = ai === -1 ? 99 : ai;
      const cb = bi === -1 ? 99 : bi;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });
  }

  // ── Household Tab ───────────────────────────────────────
  // Columns: Include, Category, Item, Brand/Notes, Recurring
  async function getHouseholdItems() {
    const rows = await fetchRange(CONFIG.TABS.HOUSEHOLD, 'A2:E200');
    return rows
      .filter(r => r.length >= 3 && (r[0] || '').toUpperCase() === 'TRUE')
      .map((r, idx) => ({
        id: 'sheet_' + idx,
        category:  (r[1] || 'Miscellaneous').trim(),
        name:      (r[2] || '').trim(),
        notes:     (r[3] || '').trim(),
        recurring: (r[4] || '').toUpperCase() === 'TRUE',
        checked:   false,
        manual:    false,
      }))
      .filter(r => r.name);
  }

  // ── Snacks Shopping Tab ─────────────────────────────────
  async function getSnacksItems() {
    const rows = await fetchRange(CONFIG.TABS.SNACKS, 'A2:E200');
    return rows
      .filter(r => r.length >= 3 && (r[0] || '').toUpperCase() === 'TRUE')
      .map((r, idx) => ({
        id: 'snack_' + idx,
        category:  (r[1] || 'Miscellaneous').trim(),
        name:      (r[2] || '').trim(),
        notes:     (r[3] || '').trim(),
        recurring: (r[4] || '').toUpperCase() === 'TRUE',
        checked:   false,
        manual:    false,
      }))
      .filter(r => r.name);
  }

  // ── Planner Snacks Tab ───────────────────────────────────
  async function getPlannerSnacks() {
    return getMeals(CONFIG.TABS.PLANNER_SNACKS);
  }

  return { getPeople, getMeals, getCookingSteps, getMacroTable, getHouseholdItems, getSnacksItems, getPlannerSnacks, buildShoppingList, buildMacroSummary, calcMealMacrosPublic: calcMealMacros };
})();
