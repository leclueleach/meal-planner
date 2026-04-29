// ============================================================
//  sheets.js — Google Sheets API reads & data parsing
// ============================================================

const Sheets = (() => {

  const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

  // Generic fetch from a named range/tab
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
  // Expected columns:
  // A: Include (TRUE/FALSE)  B: Name  C: Protein (g)  D: Carbs (cups)
  // E: Fat (tsp EVOO)  F: Veg (cups)  G: Notes/Allergies
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

  // ── Recipes Tab ─────────────────────────────────────────
  // Expected columns:
  // A: Include (TRUE/FALSE)  B: Meal Name  C: Category  D: Ingredient
  // E: Qty (per 1 protein serving)  F: Unit  G: Notes
  // Rows with the same Meal Name are grouped together.
  async function getRecipes() {
    const rows = await fetchRange(CONFIG.TABS.RECIPES, 'A2:G300');

    const mealsMap = {};
    const mealOrder = [];

    rows.forEach((r) => {
      if (r.length < 4) return;
      const include = (r[0] || '').toUpperCase() === 'TRUE';
      const mealName = (r[1] || '').trim();
      const category = (r[2] || 'Other').trim();
      const ingredient = (r[3] || '').trim();
      const qty = r[4] !== undefined && r[4] !== '' ? parseFloat(r[4]) : null;
      const unit = (r[5] || '').trim() || null;
      const notes = (r[6] || '').trim();

      if (!mealName || !ingredient) return;

      if (!mealsMap[mealName]) {
        mealsMap[mealName] = {
          name: mealName,
          include,
          ingredients: [],
        };
        mealOrder.push(mealName);
      }

      mealsMap[mealName].ingredients.push({ category, ingredient, qty, unit, notes });
    });

    return mealOrder.map(name => mealsMap[name]);
  }

  // ── Build Shopping List ──────────────────────────────────
  // Combines selected meals × selected people into a flat ingredient list,
  // grouped by category. Protein quantities scale per person profile.
  function buildShoppingList(people, recipes, mealServings = {}) {
    const selectedPeople = people.filter(p => p.include);
    const selectedMeals = recipes.filter(r => r.include);

    if (!selectedPeople.length || !selectedMeals.length) return [];

    const agg = {};

    selectedMeals.forEach(meal => {
      const timesToMake = mealServings[meal.name] || 1;
      meal.ingredients.forEach(ing => {
        const isProtein = ing.category === 'Proteins';
        const isCarb = ing.category === 'Carbs (Week 1)';

        selectedPeople.forEach(person => {
          let scaledQty = ing.qty;
          if (scaledQty !== null) {
            if (isProtein) {
              scaledQty = (ing.qty / 120) * person.protein_g;
            } else if (isCarb) {
              scaledQty = ing.qty * person.carbs_cups;
            }
            // Multiply by how many times this meal is being made
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
              notes: ing.notes,
            };
          }
          if (scaledQty !== null) {
            agg[key].qty += scaledQty;
            agg[key].hasQty = true;
          }
          agg[key].meals.add(meal.name);
        });
      });
    });

    // Convert to array, group by category
    const items = Object.values(agg).map(item => ({
      ...item,
      meals: [...item.meals],
      qty: Math.round(item.qty * 10) / 10,
    }));

    // Sort by category then name
    const catOrder = ['Proteins', 'Fresh Produce', 'Canned & Jarred', 'Stocks & Liquids', 'Pantry & Spices', 'Carbs (Week 1)'];
    items.sort((a, b) => {
      const ai = catOrder.indexOf(a.category);
      const bi = catOrder.indexOf(b.category);
      const ca = ai === -1 ? 99 : ai;
      const cb = bi === -1 ? 99 : bi;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });

    return items;
  }

  return { getPeople, getRecipes, buildShoppingList };
})();
