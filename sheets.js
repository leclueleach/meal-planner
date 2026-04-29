// ============================================================
//  sheets.js — Google Sheets API reads & data parsing
// ============================================================

const Sheets = (() => {

  const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

  async function fetchRange(tabName, range) {
    const token = Auth.getToken();
    if (!token) throw new Error('Not authenticated');

    const url = `${BASE_URL}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(tabName + '!' + range)}?key=${CONFIG.API_KEY}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Sheets API error');
    }

    const data = await res.json();
    return data.values || [];
  }

  // ── People Tab ──────────────────────────────────────────
  async function getPeople() {
    const rows = await fetchRange(CONFIG.TABS.PEOPLE, 'A2:G50');
    return rows
      .filter(r => r.length >= 2)
      .map((r, idx) => ({
        id: idx,
        include: (r[0] || '').toUpperCase() === 'TRUE',
        name: r[1] || `Person ${idx + 1}`,
        protein_g: parseFloat(r[2]) || 0,
        carbs_cups: parseFloat(r[3]) || 0,
        fat_tsp: parseFloat(r[4]) || 0,
        veg_cups: parseFloat(r[5]) || 0,
        notes: r[6] || '',
      }));
  }

  // ── Meal Tab (Breakfast / Lunch / Dinner) ────────────────
  // Columns: Include, Meal Name, Category, Person, Ingredient, Qty, Unit, Notes
  async function getMeals(tabName) {
    const rows = await fetchRange(tabName, 'A2:H300');
    const mealsMap = {};
    const mealOrder = [];

    rows.forEach((r) => {
      if (r.length < 5) return;
      const include  = (r[0] || '').toUpperCase() === 'TRUE';
      const mealName = (r[1] || '').trim();
      const category = (r[2] || 'Other').trim();
      const person   = (r[3] || 'Both').trim(); // Le Clue / Partner / Both
      const ingredient = (r[4] || '').trim();
      const qty      = r[5] !== undefined && r[5] !== '' ? parseFloat(r[5]) : null;
      const unit     = (r[6] || '').trim() || null;
      const notes    = (r[7] || '').trim();

      if (!mealName || !ingredient) return;

      if (!mealsMap[mealName]) {
        mealsMap[mealName] = { name: mealName, include, person, ingredients: [] };
        mealOrder.push(mealName);
      }

      mealsMap[mealName].ingredients.push({ category, person, ingredient, qty, unit, notes });
    });

    return mealOrder.map(name => mealsMap[name]);
  }

  // ── Build Shopping List ──────────────────────────────────
  // Takes meals from all 3 meal types, scales by servings and person profile
  function buildShoppingList(people, allMeals, mealServings = {}) {
    const selectedPeople = people.filter(p => p.include);
    if (!selectedPeople.length) return [];

    const agg = {};

    Object.entries(allMeals).forEach(([mealType, meals]) => {
      const selectedMeals = meals.filter(r => r.include);

      selectedMeals.forEach(meal => {
        const timesToMake = mealServings[meal.name] || 1;

        meal.ingredients.forEach(ing => {
          const isProtein = ing.category === 'Proteins';
          const isCarb    = ing.category.startsWith('Carbs');

          // Determine which people this ingredient applies to
          const applicablePeople = selectedPeople.filter(p => {
            if (ing.person === 'Both' || meal.person === 'Both') return true;
            return p.name === ing.person || p.name === meal.person;
          });

          applicablePeople.forEach(person => {
            let scaledQty = ing.qty;
            if (scaledQty !== null) {
              if (isProtein) scaledQty = (ing.qty / 120) * person.protein_g;
              else if (isCarb) scaledQty = ing.qty * person.carbs_cups;
              scaledQty = scaledQty * timesToMake;
            }

            const key = `${ing.category}|${ing.ingredient}|${ing.unit || ''}`;
            if (!agg[key]) {
              agg[key] = {
                category: ing.category,
                name: ing.ingredient,
                unit: ing.unit,
                qty: 0,
                hasQty: false,
                meals: new Set(),
                mealType,
                notes: ing.notes,
                people: new Set(),
              };
            }
            if (scaledQty !== null) {
              agg[key].qty += scaledQty;
              agg[key].hasQty = true;
            }
            agg[key].meals.add(meal.name);
            agg[key].people.add(person.name);
          });
        });
      });
    });

    const catOrder = ['Proteins', 'Fresh Produce', 'Canned & Jarred', 'Stocks & Liquids', 'Pantry & Spices', 'Fats', 'Veg', 'Veg/Fruit', 'Carbs', 'Carbs (Week 1)'];

    return Object.values(agg)
      .map(item => ({
        ...item,
        meals: [...item.meals],
        people: [...item.people],
        qty: Math.round(item.qty * 10) / 10,
      }))
      .sort((a, b) => {
        const ai = catOrder.findIndex(c => a.category.startsWith(c.split(' ')[0]));
        const bi = catOrder.findIndex(c => b.category.startsWith(c.split(' ')[0]));
        const ca = ai === -1 ? 99 : ai;
        const cb = bi === -1 ? 99 : bi;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      });
  }

  return { getPeople, getMeals, buildShoppingList };
})();
