/**
 * sync.js — optional real-time multi-device layer + real login.
 *
 * If src/js/firebase-config.js has a real Firebase project config:
 *  - Firebase Authentication (Email/Password) becomes the login system.
 *    Nobody can open the app and use it without an account an Admin
 *    created for them — there is no "anonymous" access anymore.
 *  - Firestore gives every device the same live data (db.js calls the
 *    push/subscribe helpers below after every write).
 *
 * If no config is set, KDM_SYNC.enabled is false and the app falls back
 * to the original single-device ID+PIN login stored in localStorage.
 */
(function (global) {
  const cfg = global.KDM_FIREBASE_CONFIG;
  const looksConfigured = cfg && cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY';

  const sync = {
    enabled: false,
    authReady: Promise.resolve(null) // resolves with the Firebase user (or null) once the initial session check is done
  };

  if (looksConfigured && global.firebase) {
    try {
      firebase.initializeApp(cfg);
      const auth = firebase.auth();
      const db = firebase.firestore();
      // Firestore's JS SDK queues writes locally and syncs automatically
      // once the connection returns — this is what gives us the
      // "offline-first" behaviour the app needs on a factory Wi-Fi.
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {
        /* ignore — persistence not available in this WebView, sync still works online */
      });

      sync.enabled = true;
      sync.db = db;
      sync.auth = auth;

      let resolveAuthReady;
      sync.authReady = new Promise((resolve) => { resolveAuthReady = resolve; });
      let firstAuthEvent = true;
      auth.onAuthStateChanged((user) => {
        if (firstAuthEvent) { firstAuthEvent = false; resolveAuthReady(user); }
        sync._onAuthChangeCb && sync._onAuthChangeCb(user);
      });

      sync.onAuthChange = function (cb) { sync._onAuthChangeCb = cb; };

      sync.signIn = function (email, password) {
        return auth.signInWithEmailAndPassword(email, password);
      };
      sync.signOut = function () { return auth.signOut(); };

      // Creates a brand-new login (email+password) WITHOUT logging out
      // whoever is currently signed in (the Admin doing the adding). This
      // uses a short-lived secondary Firebase app instance — a supported
      // client-side pattern, no backend/Cloud Function required.
      sync.createUserKeepingCurrentSession = function (email, password) {
        const secondaryApp = firebase.initializeApp(cfg, 'secondary-' + Date.now());
        return secondaryApp.auth().createUserWithEmailAndPassword(email, password)
          .then((cred) => {
            const uid = cred.user.uid;
            return secondaryApp.auth().signOut().then(() => secondaryApp.delete()).then(() => uid);
          })
          .catch((e) => secondaryApp.delete().finally(() => { throw e; }));
      };

      sync.getDocOnce = function (path) {
        return db.doc(path).get().then((snap) => (snap.exists ? snap.data() : null));
      };

      sync.push = function (collection, id, data) {
        if (!sync.enabled) return Promise.resolve();
        return db.collection(collection).doc(String(id)).set(data, { merge: true })
          .catch((e) => console.error(`[sync] push failed (${collection}/${id})`, e));
      };

      sync.setDoc = function (path, data) {
        if (!sync.enabled) return Promise.resolve();
        return db.doc(path).set(data, { merge: false })
          .catch((e) => console.error(`[sync] setDoc failed (${path})`, e));
      };

      sync.subscribeCollection = function (collection, cb) {
        if (!sync.enabled) return () => {};
        return db.collection(collection).onSnapshot(
          (snap) => cb(snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))),
          (e) => console.error(`[sync] subscribe failed (${collection})`, e)
        );
      };

      sync.subscribeDoc = function (path, cb) {
        if (!sync.enabled) return () => {};
        return db.doc(path).onSnapshot(
          (snap) => cb(snap.exists ? snap.data() : null),
          (e) => console.error(`[sync] subscribeDoc failed (${path})`, e)
        );
      };
    } catch (e) {
      console.error('[sync] Firebase init failed, falling back to single-device mode', e);
      sync.enabled = false;
    }
  }

  if (!sync.enabled) {
    sync.push = () => Promise.resolve();
    sync.setDoc = () => Promise.resolve();
    sync.subscribeCollection = () => () => {};
    sync.subscribeDoc = () => () => {};
  }

  global.KDM_SYNC = sync;
})(window);
