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

  // Sheet tab names (change if you rename the tabs in your Google Sheet)
  TABS: {
    PEOPLE: 'People',
    RECIPES: 'Recipes',
  },

  // OAuth scopes — read-only access to Sheets is all we need
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',

  // Your GitHub Pages URL (update after deploying)
  // e.g. 'https://yourusername.github.io/meal-planner'
  REDIRECT_URI: 'http://localhost:5500', // Change to your GitHub Pages URL after deploy
};
