# Meal Planner — Setup Guide

A step-by-step guide to get your shopping list app running on GitHub Pages,
connected to your private Google Sheet.

---

## Overview

```
Google Sheets (your data)
      ↓  Google Sheets API (read-only)
GitHub Pages (your app)  ←  Google OAuth (login)
```

Total setup time: ~20 minutes. No coding required beyond filling in config.js.

---

## Step 1 — Create your Google Sheet

1. Go to https://sheets.google.com and create a new spreadsheet.
2. Name it **Meal Planner**.
3. You need **two tabs** (sheets). Rename them exactly:
   - `People`
   - `Recipes`

### People tab — Column layout

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Include | Name | Protein (g) | Carbs (cups) | Fat (tsp EVOO) | Veg (cups) | Notes / Allergies |
| TRUE | Le Clue | 120 | 1 | 2 | 2 | No zucchini. Allergy: cooked salmon & trout. Fish fresh only. |
| TRUE | Partner | 60 | 2 | 2 | 2 | No beef mince. No olives. Same allergies. |

> Row 1 is the header. Data starts from row 2.
> Set Include to TRUE to include in the shopping list, FALSE to exclude.

### Recipes tab — Column layout

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Include | Meal Name | Category | Ingredient | Qty (per 120g protein) | Unit | Notes |
| TRUE | Ostrich Ragu | Proteins | Ostrich mince | 120 | g | |
| TRUE | Ostrich Ragu | Canned & Jarred | Cannellini or butter beans | 80 | g | |
| TRUE | Ostrich Ragu | Canned & Jarred | Canned crushed tomatoes | 200 | g | |
| TRUE | Ostrich Ragu | Fresh Produce | Onion | 1 | | finely diced |
| TRUE | Ostrich Ragu | Fresh Produce | Garlic cloves | 3 | | minced |
| TRUE | Ostrich Ragu | Fresh Produce | Baby spinach or kale | 2 | cups | |
| TRUE | Ostrich Ragu | Fresh Produce | Fresh basil | 1 | tbsp | |
| TRUE | Ostrich Ragu | Pantry & Spices | Dried oregano | 1 | tsp | |
| TRUE | Ostrich Ragu | Pantry & Spices | Bay leaves | 2 | | |
| TRUE | Ostrich Ragu | Pantry & Spices | Chilli flakes | 0.25 | tsp | optional |
| TRUE | Ostrich Ragu | Pantry & Spices | EVOO | 2 | tsp | |
| TRUE | Ostrich Ragu | Carbs (Week 1) | Sweet potato | 1 | cup | Week 1 carb |
| TRUE | Beef Braise | Proteins | Beef chuck or shin | 120 | g | diced |
| TRUE | Beef Braise | Fresh Produce | Shiitake mushrooms | 100 | g | sliced |
| TRUE | Beef Braise | Fresh Produce | Bok choy / napa cabbage | 1 | cup | |
| TRUE | Beef Braise | Fresh Produce | Fresh ginger | 1 | tbsp | grated |
| TRUE | Beef Braise | Fresh Produce | Garlic cloves | 3 | | minced |
| TRUE | Beef Braise | Fresh Produce | Spring onions | 2 | | to serve |
| TRUE | Beef Braise | Canned & Jarred | Oyster sauce | 1 | tbsp | |
| TRUE | Beef Braise | Pantry & Spices | Soy sauce low sodium | 1 | tbsp | |
| TRUE | Beef Braise | Pantry & Spices | Five-spice powder | 0.5 | tsp | |
| TRUE | Beef Braise | Pantry & Spices | Star anise | 2 | | |
| TRUE | Beef Braise | Pantry & Spices | EVOO | 2 | tsp | |
| TRUE | Beef Braise | Pantry & Spices | Sesame oil | 1 | tsp | |
| TRUE | Beef Braise | Stocks & Liquids | Beef stock low sodium | 250 | ml | |
| TRUE | Beef Braise | Carbs (Week 1) | Jasmine rice | 1 | cup | Week 1 carb |
| TRUE | Chicken Stew | Proteins | Chicken thighs boneless skinless | 120 | g | |
| TRUE | Chicken Stew | Fresh Produce | Onion | 1 | | finely diced |
| TRUE | Chicken Stew | Fresh Produce | Garlic cloves | 3 | | minced |
| TRUE | Chicken Stew | Fresh Produce | Roasted red capsicum | 1 | cup | sliced |
| TRUE | Chicken Stew | Fresh Produce | Baby spinach | 1 | cup | |
| TRUE | Chicken Stew | Fresh Produce | Lemon | 1 | | juiced |
| TRUE | Chicken Stew | Fresh Produce | Fresh parsley or coriander | 2 | tbsp | |
| TRUE | Chicken Stew | Canned & Jarred | Canned crushed tomatoes | 150 | g | |
| TRUE | Chicken Stew | Pantry & Spices | Ground cumin | 1 | tsp | |
| TRUE | Chicken Stew | Pantry & Spices | Ground coriander | 1 | tsp | |
| TRUE | Chicken Stew | Pantry & Spices | Ground turmeric | 0.5 | tsp | |
| TRUE | Chicken Stew | Pantry & Spices | Ground cinnamon | 0.5 | tsp | |
| TRUE | Chicken Stew | Pantry & Spices | Smoked paprika | 1 | tsp | |
| TRUE | Chicken Stew | Pantry & Spices | Cayenne pepper | 0.25 | tsp | |
| TRUE | Chicken Stew | Pantry & Spices | EVOO | 2 | tsp | |
| TRUE | Chicken Stew | Stocks & Liquids | Chicken stock low sodium | 150 | ml | |
| TRUE | Chicken Stew | Carbs (Week 1) | Lentils | 1 | cup | canned or dry |
| TRUE | Chipotle Ostrich | Proteins | Ostrich mince | 120 | g | |
| TRUE | Chipotle Ostrich | Fresh Produce | Onion | 1 | | finely diced |
| TRUE | Chipotle Ostrich | Fresh Produce | Garlic cloves | 3 | | minced |
| TRUE | Chipotle Ostrich | Fresh Produce | Roasted red capsicum | 1 | cup | diced |
| TRUE | Chipotle Ostrich | Fresh Produce | Baby spinach or kale | 1 | cup | |
| TRUE | Chipotle Ostrich | Fresh Produce | Lime | 1 | | juiced |
| TRUE | Chipotle Ostrich | Fresh Produce | Fresh coriander | 2 | tbsp | |
| TRUE | Chipotle Ostrich | Canned & Jarred | Black beans | 80 | g | canned drained |
| TRUE | Chipotle Ostrich | Canned & Jarred | Canned crushed tomatoes | 150 | g | |
| TRUE | Chipotle Ostrich | Canned & Jarred | Tomato paste | 1 | tbsp | |
| TRUE | Chipotle Ostrich | Pantry & Spices | Smoked paprika | 1 | tsp | |
| TRUE | Chipotle Ostrich | Pantry & Spices | Ground cumin | 1 | tsp | |
| TRUE | Chipotle Ostrich | Pantry & Spices | Dried oregano | 1 | tsp | |
| TRUE | Chipotle Ostrich | Pantry & Spices | Ancho chilli powder | 1 | tsp | or smoked paprika + cayenne |
| TRUE | Chipotle Ostrich | Pantry & Spices | EVOO | 2 | tsp | |
| TRUE | Chipotle Ostrich | Stocks & Liquids | Chicken or beef stock | 150 | ml | low sodium |
| TRUE | Chipotle Ostrich | Carbs (Week 1) | Wholegrain pasta | 1 | cup | |
| TRUE | Miso Pork | Proteins | Pork shoulder or neck | 120 | g | diced |
| TRUE | Miso Pork | Fresh Produce | Fresh ginger | 1.5 | tbsp | grated |
| TRUE | Miso Pork | Fresh Produce | Garlic cloves | 3 | | minced |
| TRUE | Miso Pork | Fresh Produce | Pak choi or tenderstem broccoli | 1 | cup | |
| TRUE | Miso Pork | Fresh Produce | Broccoli florets | 1 | cup | |
| TRUE | Miso Pork | Fresh Produce | Spring onions | 2 | | to serve |
| TRUE | Miso Pork | Canned & Jarred | White miso paste | 1.5 | tbsp | |
| TRUE | Miso Pork | Pantry & Spices | Soy sauce low sodium | 1 | tbsp | |
| TRUE | Miso Pork | Pantry & Spices | Mirin | 1 | tbsp | or 1 tsp honey + 1 tsp rice vinegar |
| TRUE | Miso Pork | Pantry & Spices | Rice vinegar | 1 | tsp | |
| TRUE | Miso Pork | Pantry & Spices | Sesame seeds | 1 | tsp | to serve |
| TRUE | Miso Pork | Pantry & Spices | EVOO | 2 | tsp | |
| TRUE | Miso Pork | Stocks & Liquids | Chicken or dashi stock | 250 | ml | low sodium |
| TRUE | Miso Pork | Carbs (Week 1) | Homemade naan ingredients | 1 | | wholewheat/wholegrain |

> Tip: To add a new meal, just add more rows with the same Meal Name.
> To add a new person, add a new row to the People tab.
> Toggle Include between TRUE and FALSE to control what appears in the app.

---

## Step 2 — Google Cloud Console setup

### 2a — Create a project

1. Go to https://console.cloud.google.com
2. Click the project dropdown (top left) → **New Project**
3. Name it `meal-planner` → **Create**
4. Make sure your new project is selected in the dropdown

### 2b — Enable the Sheets API

1. Go to **APIs & Services → Library**
2. Search for **Google Sheets API**
3. Click it → **Enable**

### 2c — Create an API Key

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → API Key**
3. Copy the key — you'll put this in `config.js` as `API_KEY`
4. Click **Edit API Key** → Under **API restrictions**, select
   **Restrict key** → choose **Google Sheets API** → Save

### 2d — Create an OAuth 2.0 Client ID

1. Still in **Credentials**, click **+ Create Credentials → OAuth client ID**
2. If prompted, configure the **OAuth consent screen** first:
   - User type: **External**
   - App name: `Meal Planner`
   - Support email: your Gmail
   - Scroll to bottom → Save and continue (skip optional fields)
   - Add your Gmail as a **Test user** → Save
3. Back in Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Meal Planner Web`
   - **Authorised JavaScript origins** — add:
     - `http://localhost:5500` (for local testing)
     - `https://YOURUSERNAME.github.io` (your GitHub Pages domain)
   - **Authorised redirect URIs** — add the same two URLs
   - Click **Create**
4. Copy the **Client ID** — you'll put this in `config.js` as `GOOGLE_CLIENT_ID`

---

## Step 3 — Fill in config.js

Open `config.js` and replace the placeholder values:

```js
GOOGLE_CLIENT_ID: 'PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
SHEET_ID: 'PASTE_YOUR_SHEET_ID_HERE',
API_KEY: 'PASTE_YOUR_API_KEY_HERE',
REDIRECT_URI: 'https://YOURUSERNAME.github.io/meal-planner',
```

**Finding your Sheet ID:**
Open your Google Sheet. The URL looks like:
`https://docs.google.com/spreadsheets/d/ABC123XYZ/edit`
The Sheet ID is the part between `/d/` and `/edit` — e.g. `ABC123XYZ`

---

## Step 4 — Push to GitHub

1. Go to https://github.com and create a new repository named `meal-planner`
   - Set it to **Public** (required for free GitHub Pages)
   - Do NOT initialise with a README (you'll push your own files)

2. In your terminal, from the `meal-planner` folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/meal-planner.git
git push -u origin main
```

3. In GitHub, go to your repo → **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main` / `/ (root)`
   - Click **Save**

4. Your app will be live in ~2 minutes at:
   `https://YOURUSERNAME.github.io/meal-planner`

---

## Step 5 — Update config.js with your live URL

Once deployed, open `config.js` and update:
```js
REDIRECT_URI: 'https://YOURUSERNAME.github.io/meal-planner',
```

Also go back to Google Cloud Console → Credentials → your OAuth Client ID
and confirm `https://YOURUSERNAME.github.io` is in the Authorised origins.

Commit and push the updated config.js:
```bash
git add config.js
git commit -m "Update redirect URI for GitHub Pages"
git push
```

---

## Adding recipes or people later

Just edit your Google Sheet directly — no code changes needed.
- Add a new person: new row in the **People** tab
- Add a new meal: new rows in the **Recipes** tab (one row per ingredient, same Meal Name)
- Toggle Include to TRUE/FALSE to include or exclude from the list
- Hit **Refresh** in the app to pull the latest data

---

## File structure

```
meal-planner/
├── index.html    ← App shell and layout
├── styles.css    ← All styling
├── config.js     ← Your credentials (fill this in)
├── auth.js       ← Google OAuth login/logout
├── sheets.js     ← Google Sheets API calls and data logic
├── app.js        ← App state, rendering, interactions
└── SETUP.md      ← This file
```

---

## Troubleshooting

**"Sign in" button does nothing**
→ Check that your Client ID in config.js is correct and the domain is in Authorised origins.

**Data doesn't load after sign in**
→ Check your Sheet ID and API Key in config.js. Make sure the Sheets API is enabled.

**"Error 403"**
→ Your API key may not have Sheets API access enabled, or the Sheet is not accessible.

**App works locally but not on GitHub Pages**
→ Make sure `https://YOURUSERNAME.github.io` is added to Authorised JavaScript origins in Google Cloud Console.
