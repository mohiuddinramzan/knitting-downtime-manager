/**
 * sync.js — optional real-time multi-device layer.
 *
 * If src/js/firebase-config.js has a real Firebase project config, this
 * file signs in anonymously (just so Firestore's security rules see a
 * signed-in request) and exposes push/subscribe helpers. db.js calls these
 * after every local write, and re-applies whatever comes back from other
 * devices to its own localStorage mirror, then fires 'kdm:data-changed' so
 * the currently open screen can refresh.
 *
 * If no config is set, KDM_SYNC.enabled is false and nothing here runs —
 * the app behaves exactly like the original single-device build.
 */
(function (global) {
  const cfg = global.KDM_FIREBASE_CONFIG;
  const looksConfigured = cfg && cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY';

  const sync = {
    enabled: false,
    ready: Promise.resolve(false)
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
      sync.ready = new Promise((resolve) => {
        auth.signInAnonymously().catch((e) => console.error('[sync] anonymous sign-in failed', e));
        auth.onAuthStateChanged((user) => resolve(!!user));
      });

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
          (snap) => cb(snap.docs.map((d) => d.data())),
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
