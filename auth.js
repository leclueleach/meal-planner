// ============================================================
//  auth.js — Google OAuth 2.0 login / logout / token handling
// ============================================================
const Auth = (() => {
  let accessToken = null;
  let tokenClient = null;

  function init(onSignedIn, onSignedOut) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('Auth error:', response.error);
          onSignedOut();
          return;
        }
        accessToken = response.access_token;
        const expiresAt = Date.now() + (response.expires_in * 1000);
        localStorage.setItem('gis_token', accessToken);
        localStorage.setItem('gis_expires', expiresAt);
        onSignedIn(accessToken);
      },
      error_callback: (error) => {
        // Silent sign-in failed — show login screen
        console.log('Silent sign-in failed:', error);
        onSignedOut();
      },
    });

    // Check for existing stored token first
    const stored  = localStorage.getItem('gis_token');
    const expires = localStorage.getItem('gis_expires');
    if (stored && expires && Date.now() < parseInt(expires)) {
      // Valid stored token — go straight in
      accessToken = stored;
      onSignedIn(accessToken);
    } else {
      // No valid token — try silent sign-in first
      // If that fails, error_callback will call onSignedOut() to show login screen
      try {
        tokenClient.requestAccessToken({ prompt: '' });
      } catch(e) {
        onSignedOut();
      }
    }
  }

  function signIn() {
    if (!tokenClient) { console.error('Auth not initialised yet.'); return; }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => { accessToken = null; });
    }
    accessToken = null;
    localStorage.removeItem('gis_token');
    localStorage.removeItem('gis_expires');
  }

  function getToken()   { return accessToken; }
  function isSignedIn() { return !!accessToken; }

  return { init, signIn, signOut, getToken, isSignedIn };
})();
