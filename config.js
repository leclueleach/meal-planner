// ============================================================
//  config.js — Fill these in before running the app
//  See SETUP.md for step-by-step instructions
// ============================================================

const CONFIG = {
  // From Google Cloud Console → APIs & Services → Credentials
  // OAuth 2.0 Client ID (Web application type)
  GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',

  // Your Google Sheet ID
  // Found in the Sheet URL: docs.google.com/spreadsheets/d/SHEET_ID/edit
  SHEET_ID: 'YOUR_SHEET_ID_HERE',

  // Google Sheets API Key
  // From Google Cloud Console → APIs & Services → Credentials → API Key
  API_KEY: 'YOUR_API_KEY_HERE',

  // Sheet tab names — must match exactly what you named them in Google Sheets
  TABS: {
    PEOPLE:    'People',
    BREAKFAST: 'Breakfast',
    LUNCH:     'Lunch',
    DINNER:    'Dinner',
  },

  // OAuth scopes — read-only access to Sheets is all we need
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',

  // Your GitHub Pages URL
  REDIRECT_URI: 'https://leclueleach.github.io/meal-planner',
};
