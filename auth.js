// ============================================================
//  auth.js — Google OAuth 2.0 login / logout / token handling
// ============================================================

const Auth = (() => {
  let accessToken = null;
  let tokenClient = null;

  // Called once Google Identity Services script has loaded
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
        // Store expiry time
        const expiresAt = Date.now() + (response.expires_in * 1000);
        sessionStorage.setItem('gis_token', accessToken);
        sessionStorage.setItem('gis_expires', expiresAt);
        onSignedIn(accessToken);
      },
    });

    // Check for existing session token
    const stored = sessionStorage.getItem('gis_token');
    const expires = sessionStorage.getItem('gis_expires');
    if (stored && expires && Date.now() < parseInt(expires)) {
      accessToken = stored;
      onSignedIn(accessToken);
    } else {
      onSignedOut();
    }
  }

  function signIn() {
    if (!tokenClient) {
      console.error('Auth not initialised yet.');
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {
        accessToken = null;
        sessionStorage.removeItem('gis_token');
        sessionStorage.removeItem('gis_expires');
      });
    }
    accessToken = null;
    sessionStorage.removeItem('gis_token');
    sessionStorage.removeItem('gis_expires');
  }

  function getToken() {
    return accessToken;
  }

  function isSignedIn() {
    return !!accessToken;
  }

  return { init, signIn, signOut, getToken, isSignedIn };
})();
