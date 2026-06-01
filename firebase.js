// ============================================================
//  firebase.js — Firebase Realtime Database sync layer
// ============================================================

const FirebaseSync = (() => {

  const firebaseConfig = {
    apiKey:            "AIzaSyA9xXsD0V5fK_L8UZM1ol1yDAQmAgfxzIo",
    authDomain:        "meal-planner-800f3.firebaseapp.com",
    databaseURL:       "https://meal-planner-800f3-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:         "meal-planner-800f3",
    storageBucket:     "meal-planner-800f3.firebasestorage.app",
    messagingSenderId: "1005030482979",
    appId:             "1:1005030482979:web:090ad4fc1ff4cf3de1fd96"
  };

  const DB_PATH = 'mealplanner';
  let db        = null;
  let listeners = {};
  let ready     = false;
  let onReadyCb = null;

  // ── Init ──────────────────────────────────────────────────
  function init(onReady) {
    onReadyCb = onReady;
    // Load Firebase SDK from CDN
    const script1 = document.createElement('script');
    script1.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js';
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js';
      script2.onload = () => {
        try {
          firebase.initializeApp(firebaseConfig);
          db    = firebase.database();
          ready = true;
          console.log('Firebase ready');
          if (onReadyCb) onReadyCb();
        } catch(e) {
          console.error('Firebase init error:', e);
        }
      };
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  }

  function isReady() { return ready && db !== null; }

  // ── Generic read/write ────────────────────────────────────
  async function set(path, data) {
    if (!isReady()) return;
    try {
      await db.ref(DB_PATH + '/' + path).set(data);
    } catch(e) { console.error('Firebase set error:', e); }
  }

  async function get(path) {
    if (!isReady()) return null;
    try {
      const snap = await db.ref(DB_PATH + '/' + path).once('value');
      return snap.val();
    } catch(e) { console.error('Firebase get error:', e); return null; }
  }

  function listen(path, callback) {
    if (!isReady()) return;
    const ref = db.ref(DB_PATH + '/' + path);
    listeners[path] = ref;
    ref.on('value', snap => callback(snap.val()));
  }

  function unlisten(path) {
    if (listeners[path]) { listeners[path].off(); delete listeners[path]; }
  }

  // ── Planner ───────────────────────────────────────────────
  async function savePlan(plan) { await set('plan', plan); }
  async function saveBatch(batchCounts) { await set('batch', batchCounts); }

  function listenPlan(callback)  { listen('plan',  callback); }
  function listenBatch(callback) { listen('batch', callback); }

  // ── Shopping checked ──────────────────────────────────────
  async function saveChecked(checked) { await set('checked', checked); }
  function listenChecked(callback)    { listen('checked', callback); }

  // ── Household quantities ──────────────────────────────────
  async function saveHouseholdQty(quantities) { await set('household_qty', quantities); }
  function listenHouseholdQty(callback)       { listen('household_qty', callback); }

  // ── Snacks quantities ─────────────────────────────────────
  async function saveSnacksQty(quantities) { await set('snacks_qty', quantities); }
  function listenSnacksQty(callback)       { listen('snacks_qty', callback); }

  // ── Household checked ─────────────────────────────────────
  async function saveHouseholdChecked(checked) { await set('household_checked', checked); }
  function listenHouseholdChecked(callback)    { listen('household_checked', callback); }

  // ── Snacks checked ────────────────────────────────────────
  async function saveSnacksChecked(checked) { await set('snacks_checked', checked); }
  function listenSnacksChecked(callback)    { listen('snacks_checked', callback); }

  // ── Manual items ──────────────────────────────────────────
  async function saveHouseholdManual(items) { await set('household_manual', items); }
  function listenHouseholdManual(callback)  { listen('household_manual', callback); }

  async function saveSnacksManual(items) { await set('snacks_manual', items); }
  function listenSnacksManual(callback)  { listen('snacks_manual', callback); }

  return {
    init, isReady,
    savePlan, saveBatch, listenPlan, listenBatch,
    saveChecked, listenChecked,
    saveHouseholdQty, listenHouseholdQty,
    saveSnacksQty, listenSnacksQty,
    saveHouseholdChecked, listenHouseholdChecked,
    saveSnacksChecked, listenSnacksChecked,
    saveHouseholdManual, listenHouseholdManual,
    saveSnacksManual, listenSnacksManual,
  };
})();
