// ============================================================
//  config.js — Fill these in before running the app
//  See SETUP.md for step-by-step instructions
// ============================================================

const CONFIG = {
  // From Google Cloud Console → APIs & Services → Credentials
  // OAuth 2.0 Client ID (Web application type)
  GOOGLE_CLIENT_ID: '576328640545-761lh2uam1k19snquin9dida5cvenkgj.apps.googleusercontent.com',

  // Your Google Sheet ID
  // Found in the Sheet URL: docs.google.com/spreadsheets/d/SHEET_ID/edit
  SHEET_ID: '1PsvzMbDC5J4X30BJk_N95kpSyVhaBrLNp_wy4cZMm_U',

  // Google Sheets API Key
  // From Google Cloud Console → APIs & Services → Credentials → API Key
  API_KEY: 'AIzaSyAxl3OYUuRXEkRK8kjQCg3WMn-6VrpN4zY',

  // Sheet tab names — must match exactly what you named them in Google Sheets
  TABS: {
    PEOPLE:    'People',
    BREAKFAST: 'Breakfast',
    LUNCH:     'Lunch',
    DINNER:    'Dinner',
    COOKING:   'Cooking',
    MACROS:    'Macros',
    HOUSEHOLD: 'Household',
    SNACKS:    'Snacks',
    PLANNER_SNACKS: 'Planner Snacks',
  },

  // OAuth scopes — read-only access to Sheets is all we need
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',

  // Your GitHub Pages URL
  REDIRECT_URI: 'https://leclueleach.github.io/meal-planner',
};
